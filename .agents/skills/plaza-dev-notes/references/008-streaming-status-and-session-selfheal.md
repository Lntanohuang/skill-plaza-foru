# 008 · 流式体验补全：status 过程事件、会话失效自愈与 zcode 错误上抛

**状态**：已实现（2026-09-23 落地并实测；见「验证口径」）。
**适用范围**：`/api/chat` SSE 协议、双引擎（pi/zcode）事件归一层、UsePage 与 ExperiencePage 前端消费。

## 动机

用户反馈「运行输出要改成流式输出」。排查发现正文 delta 链路（pi `message_update.text_delta` → index.ts SSE `text` → 前端 MarkdownView 增量渲染）本来就是流式且正常工作；真实体感缺口有三个：

1. **正文前无反馈**：安装类技能（career-guidance 等）前 15~40s 全是 thinking/toolcall 增量，piRunner 只转发 `text_delta`，前端只显示一行静态「正在读取配置…」，体感像憋到最后一次性输出。
2. **pi 会话空闲回收后必失败**：`PI_IDLE_MS`（30 分钟）sweeper 回收进程后，浏览器仍持旧 sessionId，此后每次运行立刻报「pi 会话不存在」，只能刷新页面（2026-09-23 09:22 真实触发：08:51 结束 +30min ≈ 09:21 被回收，09:22 撞上）。
3. **zcode 会话错误被静默吞掉**：`session/event` 的 `payload.error`（如模型未配置 "Select a model before continuing"）不匹配 zcodeRunner 任何映射分支，前端只见心跳转圈直到 10 分钟超时。

## 约定细节（实现落点，2026-09-23 回填）

### status 事件（思考/工具阶段的过程信号）

- `web/server/lib/runner.ts:25`：`RunnerEvent` 新增 `{ kind: 'status'; phase: 'thinking' | 'tool' | 'text'; chars?: number; tool?: string }`。
- `web/server/lib/piRunner.ts:167-170`：`message_update` 分支——`thinking_delta` 走 `emitThinking`（:215，**节流 ≥700ms/次**，携带累计思考字数）；`toolcall_start` 即时发 `{phase:'tool', tool: toolName}`；`text_start` 发 `{phase:'text'}`（正文即将开始）。`agent_start` 重置 `thinkState`（:197），`disposeSession`/`onChannelExit` 同步清理（:114）。
- `web/server/index.ts:684-686`：status → SSE `{type:'status', phase, chars, tool}`。
- 前端消费：
  - `web/src/composables/useChatApi.ts`：`ChatEvent` 联合类型加 status 分支。
  - `web/src/pages/UsePage.vue:259-261`：`streamStatus` ref 驱动两个模式的加载行（表单模式 :763、对话模式 :912），文案「模型思考中 · 已 N 字 / 调用工具 X / 正在生成结果…」，运行开始时重置。
  - `web/src/pages/ExperiencePage.vue:251-253`：`runStatus` 显示在打字点旁（`.exp-run-status` 样式，styles.css:1113）。

### 会话失效自愈（pi 空闲回收后不再要求刷新）

- `web/server/index.ts:711-729`：`runner.send` 抛错且消息匹配 `/会话不存在|会话进程已退出/` 时，透明重建：`disposeSession` 旧会话 → `createSession(workspaceDir, {skill})` → 更新 `entry`/`sessions` → 重挂 tap/listen → **按首轮重发**（`buildPrompt(…, true)` 重注入技能指令）→ trace 记 `note({sessionRecreated})`。事件回调抽成具名 `onEvent`（:662）以支持重挂。
- 引擎侧多轮上下文随进程丢失、无法恢复——重建后等于新会话续聊，技能指令兜底保证直出质量；副作用是用户追问丢失前文（可接受，优于每次报错）。

### zcode 错误上抛

- `web/server/lib/zcodeRunner.ts:68-73`：`session/event` 的 `payload.error` → `{kind:'error', message:'zcode 会话错误：…'}`，前端立即看到失败原因而不是空转到超时。

## 成本与取舍

- status 事件节流后每轮约 +30~60 个小 SSE 帧（无模型 token 成本）；思考字数只是计数，不外发思考内容。
- 被否决的备选：
  - ~~思考原文流式展示进「执行过程」折叠区~~：需要前端第二缓冲区 + 折叠区在 done 前的展示逻辑，MVP 阶段一行状态文案已消除「卡死」体感；后续要再加。
  - ~~自愈时回放完整多轮历史~~：对话模式前端只发最新一条，历史不在服务端手上，回放不可靠；首轮指令重注入已覆盖直出场景。
  - ~~延长 PI_IDLE_MS 回避回收~~：治标不治本，进程照样会退（重启/崩溃），自愈才是兜底。

## 后续扩展路线

- 思考原文展示：若需要，piRunner 已拿到 thinking_delta 全文，加 `{phase:'thinking', text}` 增量即可，前端折叠区消费。
- zcode 引擎模型未配置（"Select a model"）目前只能报错提示；若本机要跑 zcode 需配 `~/.zcode/cli/config.json`（本期不做）。

## 验证口径（2026-09-23 实测）

1. ✅ curl 直连 `/api/chat`（pi）：事件序 `session → status(thinking,chars=3) → status(tool,bash) → status(thinking,chars=634) → status(text) → text delta×N → done`，时间戳连续（10:56:43 起）。
2. ✅ 会话自愈：kill 会话的 pi 子进程后携旧 sessionId 再发 → 无错误、正常应答，trace 有 `sessionRecreated`（run 20260923-060125）。
3. ✅ `vue-tsc --noEmit` 0 错；server 重启后用户真实 career-guidance 运行 success（11s，sidecar pass，run 20260923-055826）。
4. ⬜ zcode 错误上抛未实测（本机 zcode 无模型配置，运行必错——正好是被修复的场景，但未跑端到端）。
5. ⬜ 前端 status 文案渲染未做浏览器端人工验收（待用户在 UsePage/ExperiencePage 实跑确认）。
