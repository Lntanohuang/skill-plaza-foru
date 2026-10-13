# 036 · OpenAI 兼容端点 /v1/chat/completions：外部项目统一接入入口

**状态**：已实现（本地流式/非流式/错误用例/多轮拍平/回归全通过，2026-10-13；公网部署与 career-guidance 端到端待用户执行）

## 动机

另一个项目要调用本服务，其客户端已按 OpenAI 风格 SSE（`content` 正文增量、`reasonContent` 思考增量、`data: [DONE]`）开发。直接改造 `/api/chat` 会破坏广场前端两处事件消费（UsePage/ExperiencePage），故新增平行端点，两协议并存、共用编排核心。

**端点定位（长期策略）**：`/v1/chat/completions` 是外部项目的**唯一**接入入口；后续外部需求以可选字段在此扩展（attachments、会话优化等），协议骨架不破坏。`/api/chat` 冻结为广场前端专用、不再演进。外部接口文档在仓库 `docs/agent-api.md` 第 0 节。

## 约定细节

### 思考原文事件（前置改动）

- `web/server/lib/runner.ts:28-30`：`RunnerEvent` 新增 `{ kind: 'thinking_delta'; delta: string }`。
- `web/server/lib/piRunner.ts:309-314`：pi `thinking_delta` 分支计数照发（节流 status，plaza 前端 030 进度时间线不变），**同时** emit 原文事件。此前原文在该行被降级为字符计数丢弃（008 的取舍，本记录兑现其"后续扩展路线"）。

### 共享编排核心 + wire 适配器

- `web/server/index.ts:399-428`：`TurnParams`（protocol/stream/skill/messages/sessionId/taskTitle/attachments）；`handleOpenAiChat`（校验 + 历史拍平）与 `handleChat`（plaza 校验，行为与旧版一致）都调 `runChatTurn`。
- `web/server/index.ts` `createChatWire(protocol, stream)`：两套 wire 相邻放置——
  - **plaza wire**：输出与旧版 `/api/chat` 逐字节一致的 `type` 事件帧（回归安全）；
  - **openai wire**：流式输出 `{"id":"chatcmpl-<runId>","reasonContent"/"content","role":"assistant"}` 增量，终态 usage 帧 + `[DONE]`；JSON 模式不写 SSE 头，终态一次性回 `chat.completion`（career-guidance 成功时顶层 `reportUrl`/`runId` 扩展字段，`content` 空串）。
- 错误映射：流前校验 400（`unknown_skill_model` 列出可用技能）；流中失败 `{"error":{...,"type":"agent_error"}}` + `[DONE]`；非流式 agent 错误 500、会话占用 429。
- 会话与多轮：技能走**独立 `skill` 字段**（2026-10-13 修订，最初设计为复用 `model` 字段；因语义混淆改为独立字段，`model` 彻底释放——忽略不校验，预留给将来按请求选模型；错误码 `unknown_skill` 并列出可用技能）。无 `sessionId` 或服务端不认识时，messages>1 则历史拍平为「【对话历史】…【当前消息】…」注入首轮 prompt（复用 buildPrompt，不动 runner）；promptDigest 对拍平消息取【当前消息】段。非流式 JSON 的 `model` 字段回显 `runner.describe()` 真实服务模型。
- trace：`RunRecord.protocol: 'plaza' | 'openai'`（`web/server/lib/traceExport.ts:141-142`），运行记录页可区分两类流量；其余落盘（events/trace/报告校验/agentEnv）两入口完全一致。

### 维护性约定（新事件/字段的跟随关系）

- trace 记录、Agent 编排类改动在核心，改一处两入口自动生效。
- 新 RunnerEvent 的输出映射在两个 wire 各加 case（相邻放置降低遗漏）。
- 广场 `/api/chat` 自身协议变化有意不跟随——OpenAI 帧格式是冻结的对外契约。

## 成本与取舍

- 无新增常驻开销；无会话复用时对方每次调用技能指令重注入约 +1~2K token（实测 ai-interview 首轮 prompt_tokens ≈ 14.7K）。
- 被否决方案：① 直接改 `/api/chat` 输出格式——破坏广场前端，否决；② 复制一份完整 handler——trace/报告捕获/自愈全部双份维护，否决；③ reportUrl 走响应头（代理/封装易丢）或轮询接口（复杂+延迟），改为终帧扩展字段，标准客户端忽略未知字段不破坏。

## 验证口径（2026-10-13 本地实测，PI_MODEL=deepseek-v4-pro）

1. ✅ 流式（classroom-assistant 推理型问题）：reasonContent 989 字 → content 增量 → usage 帧 → [DONE]；简单问题无思考阶段时只有 content（pi 未吐 thinking_delta，符合预期）。
2. ✅ 非流式（ai-interview）：标准 chat.completion JSON，usage 含 cost_usd。
3. ✅ 错误用例：假 model 400（列出 5 个可用技能）、空 messages 400，均为 OpenAI 错误体。
4. ✅ 多轮拍平：两轮历史 + 新问题（无 sessionId），模型正确 recall 历史中的代号。
5. ✅ 回归：`/api/chat`（ai-interview）事件序 started → status → session → status → usage → text → usage → done，done 载荷形状与旧版一致；`/api/runs` 两条流量 protocol 分别为 plaza/openai。
6. ⬜ 公网部署后 career-guidance 端到端（reportUrl 帧 + 报告链接可打开）待用户执行。

## 后续扩展路线

- 附件接入：`/api/upload` 产物以可选 `attachments` 字段接入 openai 入口。
- 会话复用优化：对方稳定后建议用返回的 sessionId 续聊，避免每轮重注入历史。
- `reasonContent` 的 plaza 侧展示（008 预留的折叠区路线）如需要，消费同一 thinking_delta 事件即可。
