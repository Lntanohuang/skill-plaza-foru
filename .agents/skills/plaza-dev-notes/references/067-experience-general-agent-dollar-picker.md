# 067 · 在线对话默认通用智能体与 $ 技能选择器

- 状态：已实现（2026-10-16。构建通过；后端重启后 e2e 验证；浏览器 $ 选择器交互与 skill 字段断言通过。真实多轮对话与中途换技能回归待用户执行）。**2026-10-16 晚间补注（068）**：本记录的「体验页历史 = localStorage 本地会话」约定已被 068 取代（侧栏改为 /api/runs 运行记录）；「后续路线」中的体验页接入 ToolCallGroup 与报告链接渲染均已在 068 落地，登录相关的会话持久化逻辑随本地会话一并删除。
- 动机：在线对话页把所有未命中示例的输入默认路由到 industry-education-report（`DEFAULT_SLUG` 兜底 + matchDemo 关键词模糊匹配），任何普通问题都被套上产教报告技能的系统提示词、20 分钟超时与报告产出预期，属于路由级错误。正确形态：默认由通用智能体直接回答；需要专业技能时用户显式通过 `$` 挂载。

## 约定细节

### 后端：general 作为一等 skill id

- `web/server/lib/skills.ts`：新增 `GENERAL_SKILL_ID = 'general'`，并把它注册进 `SKILL_PROMPTS`（通用智能体系统提示词：先结论后依据、不编造；遇到产教报告/就业指导/技术预判等专业场景时提示用户在输入框输入 `$` 挂载 SKILL）。
  - 两套入口 `/api/chat`、`/v1/chat/completions` 的校验都是 `skill in SKILL_PROMPTS`，自动放行 general，协议零改动（036 冻结边界不破）。
  - `listPlazaSkills()` 过滤 general：`/api/skills` 仍返回 6 项（048 契约不变），通用智能体不进广场卡片。
  - 不在 `INSTALLED_SKILLS`：pi `createSession` 不加 `--skill`、`buildPrompt` 走 `SKILL_PROMPTS[skill]` 前缀回落、超时用默认 10 分钟而非已安装技能的 20 分钟。
- 运行记录：`RunRecord.skill = 'general'` 正常落盘；前端显示名走 `web/src/data/skills.ts` 的 `GENERAL_SKILL_NAME = '通用智能体'`，RunListPage / RunDetailPage 的 skillName 兜底映射（未知 slug 才裸显）。

### 前端：$ 选择器与发送路由（ExperiencePage.vue）

- `activeSkill: Ref<Skill | undefined>`——undefined 即通用智能体，是输入条的稳定默认态。
- 呼出：光标前命中 `/(?:^|\s)\$([^\s$]*)$/`（@input 驱动 `syncSkillMenu`）或点输入条 `$` 钮（`toggleSkillMenu`，无 token 场景）。菜单按 slug/名称/标签过滤，↑↓ 移动高亮、Enter/Tab 选中、Esc/点击外部关闭；选中后从文本移除 `$token` 并把光标落回原位。
- 挂载态：输入条左侧分类色 chip（图标+技能名+x 清除）；AI 消息无技能时名称显示「通用智能体」。
- 示例问题（`试试这些`）点击时同步挂载对应技能——取代 matchDemo 模糊匹配，该函数与 `DEFAULT_SLUG` 已删除。
- 发送路由（`send()`）：`requested = activeSkill?.slug ?? GENERAL_SKILL_ID`；对话已绑定其它技能时切换 = 删除 `convSessions` 中旧 Pi 会话（旧上下文属于旧技能），下轮不带 sessionId 新建，`buildPrompt` 的 `isFirstTurn = !existingEntry` 随之为 true、按首轮注入新技能指令。

### 验证（2026-10-16 实测）

- `npm run build`（vue-tsc + vite）通过。
- 重启后端后：`/api/skills` 6 项不含 general；假 skill 400 报错不变；`POST /api/chat {"skill":"general"}`「只回复两个字：验收」→ SSE text→usage→done（runId 20261016-153211-fchx），`/api/runs` 首条 `skill=general`。
- CDP 无头浏览器（拦截 fetch 断言请求体）：`$career` 过滤至 1 项、↓+Enter 选中后 chip=就业指导且 `$career` 从文本移除、挂技能发送 `body.skill=career-guidance`（消息内容无 token 残留）、清除 chip 后发送 `body.skill=general`、`$` 钮可呼出菜单。
- 明暗双主题截图核对：菜单玻璃层、chip、发送后消息流均正常，深色下菜单文字对比度名称 15.8:1 / 描述 6.7:1 / slug 5.2:1。

## 成本与取舍

- 否决「把 general 做成 INSTALLED_SKILLS 假技能」：会误加 `--skill` 路径解析、`/skill:` 命令展开语义与 20 分钟超时，通用对话都不需要。
- 否决「$ 语法在后端解析消息文本」：skill 字段已是显式选择通道，前端 chip 状态机足够，后端协议保持冻结。
- 否决「保留 matchDemo 内容模糊路由」：正是本次错误根源；显式 $ 与示例挂技能完全取代。
- 换技能丢弃旧会话的代价：该对话旧轮上下文不延续到新技能（也不可换回恢复）；接受原因是 Pi 会话与 `--skill` 注册在创建时绑定，跨技能复用会话会让 `/skill:` 展开失效。

## 后续扩展路线

- 体验页接入 ToolCallGroup（066 路线）：general 对话同样吃 status 事件，可直接复用。
- 会话内换技能时把旧会话上下文按 036 的历史拍平方式注入新会话，保留记忆。
- $ 菜单标注「已安装」状态（复用 /api/skills 的 installed 字段）。
