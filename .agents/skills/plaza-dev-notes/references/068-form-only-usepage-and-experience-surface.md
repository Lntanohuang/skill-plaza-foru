# 068 · 交互收敛：任务配置表单页 + 在线对话成为唯一运行呈现面

- 状态：已实现（2026-10-16。构建通过；无头浏览器断言表单交接请求体/历史列表/详情卡/导航；真实表单任务（含附件沙箱延续）待用户回归。同日用户回归发现多轮会话回归 bug，已修复，见文末补注）。
- 动机：此前「在线运行」页同时承载表单模式与对话模式，且与「在线对话」页功能重叠（两套 SSE 处理、两套消息流渲染），历史记录分裂在两处（UsePage 侧栏读 /api/runs，体验页读 localStorage 本地会话）。用户决策：对话能力收敛到在线对话页，`/use/:slug` 只做任务配置表单（广场二级页），提交后跳转在线对话运行，所有历史记录在在线对话展示。

## 约定细节

### 导航与入口

- 全局导航删「在线运行」（`web/src/components/SiteHead.vue`）；路由 `/use/:slug?` 保留（技能卡/详情页入口），`meta.nav` 改 `skills`、文档标题改「任务配置 · <技能名>」（`web/src/router/index.ts`）。首页 hero 主 CTA 改指 `/experience`。

### 任务配置页（UsePage，纯表单）

- 删除：表单/对话模式切换（`?mode=chat` 不再被读取）、对话模式整块（聊天流/输入卡/附件随消息消费）、SSE 运行链路（makeStreamHandler/进度时间线/运行结果区）、侧栏历史卡、UseHistoryList 组件（文件已删）。UsePage 从约 1079 行降到约 400 行。
- 保留：结构化表单、Mock 知识库、附件上传（`uploadSessionIds` 沙箱）、测试模板（022 的 PLAZA_ENV=test 流程不变）。
- `run()` 改为任务交接：`stashPendingFormTask({ slug, prompt, taskTitle, attachments, sessionId })` 写 sessionStorage 后 `router.push({ name: 'experience' })`（`web/src/composables/pendingTask.ts`，取走即删，刷新不重发）。sessionId 传表单上传产生的沙箱会话，在线对话沿用同一沙箱引擎才能读到附件。

### 在线对话页（ExperiencePage，唯一运行呈现面）

- 表单承接：onMounted 先 `await probeApi()` 再 `consumePendingFormTask()`——挂载技能 chip、新建对话、预置 convSessions 为表单沙箱会话、以 `runReal(prompt, slug, skill, { taskTitle, attachments })` 发起运行；后端未就绪时回落演示输出。
- 进度时间线：UsePage 的 status→ProgressItem 映射（`toolProgress`/`handleProgressStatus`，030 安全边界不变）迁入体验页，`ToolCallGroup` 贴在发起运行的 AI 消息上（`progressOwner`），正文首字自动折叠（066 交互）。067 记录的「体验页接入 ToolCallGroup」路线落地。
- 结果呈现：AI 消息由 MarkdownView 换 `ReportOutput`，done 事件的 `charts`/`reportUrl` 不再丢弃——`$` 挂载报告技能或表单任务生成的报告链接/图表直接可看可下载（067 指出的缺口关闭）。
- 历史记录：删除 localStorage 本地会话（`skill-plaza:history`、登录合并/清空 watch、会话分组），侧栏改为 /api/runs 运行记录（今天/昨天/更早分组；行内：分类图标 + taskTitle/promptDigest + 技能名·时间 + `use-hist-outcome` 徽章）；点击在主区 `.exp-history-view` 只读详情卡（trace 反向取最后一条 assistant 文本，live=false 不冒充），「返回对话」回到消息流。运行结束（sending true→false 的 watch）自动刷新列表。旧 localStorage 键成为无主数据，无害保留。

### 验证（2026-10-16 实测）

- `npm run build` 通过。
- 无头浏览器（拦截 /api/chat 断言请求体）：表单页填示例→提交→URL 变 `#/experience`、请求体 `{skill: 'industry-education-report', taskTitle: '产教决策报告', messages[0] 以「使用 $industry-education-report…」开头}`、chip=产教决策报告、AI 名=技能名；通用直发回归（挂载延续：表单任务后 chip 保持，后续消息沿用该技能直到手动清除）；侧栏 116 条真实运行记录（含 general 显示为「通用智能体」）；详情卡 h2/meta（技能·时间·耗时·结果）正确、「返回对话」恢复消息流；导航五项无「在线运行」。
- 修复过程中发现的 bug：`historyLoading` 初始 true 与防重入守卫冲突导致 loadHistory 首次调用直接 return（侧栏永远「正在加载」），已拆分为独立的 `historyReqInFlight` 守卫。
- 明暗双主题截图核对（表单页/交接后对话/历史详情/深色历史）通过；用户气泡 `white-space: pre-wrap` 经 DOM 实证保留换行。

## 成本与取舍

- 刷新丢上下文：体验页会话仍只在内存（原 localStorage 只存文本不存 sessionId，刷新后本就不能续跑），现在至少运行记录可见可查。否决「localStorage 持久化 sessionId」：与服务端会话生命周期（空闲回收、技能绑定）耦合，容易存出失效引用。
- 表单任务后 chip 保持挂载：后续追问沿用表单技能（符合「提交任务后在那里继续追问」的预期），要回通用手动点 ×。否决「任务完成后自动清 chip」：连续追问是主路径。
- 历史详情只读不续聊：RunRecord 没有完整的对话消息视图（trace 是引擎视角），恢复对话需另做消息重建，留作后续路线。
- 删除 UsePage 结果区后，`done` 载荷的渲染职责全部在 ReportOutput 一处，use 页不再有第二份实现。

## 补注（2026-10-16 晚：多轮会话回归修复）

用户回归发现「每条消息都是新会话」。根因：068 重写 `makeStreamHandler` 时丢掉了 067 的 `session` 事件捕获分支，浏览器从不记住服务端 sessionId，`runReal` 每轮传 `sessionId: undefined` → 服务端每条消息新建引擎会话与沙箱目录（trace 实证：两次运行两个 `sess-*` 目录，均为首轮全量提示词拼接）。修复：`makeStreamHandler(msg, sessionKey)` 增加 `session` 分支写回 `convSessions`（服务端在新建与回收重建两种情况下都会发该事件，幂等）。curl 两轮实测通过：第二轮带 sessionId 问「我上一句说了什么」，回答「你好」，上下文延续。

另澄清记录口径：服务端每收到一次 `/api/chat` 调用就创建一条运行记录（独立 runId/时长/结局/trace），粒度是「单次运行」不是「对话」——即使多轮上下文正常，同一对话的每条消息仍各自一条记录。侧栏按对话分组展示属产品决策，见后续路线。

## 后续扩展路线

- 从运行记录恢复会话：以 clientSessionId + convSlugs 重建对话上下文（需后端提供按会话取消息或前端持久化 sessionId）。
- 体验页结果卡的操作（打开 /runs 详情、导出 trace）按需补。
- UsePage 附件区在无后端时的引导文案与上传按钮状态可再收敛。

## 补注（2026-10-16 晚：历史形态被 069 修订）

本记录「历史记录」段描述的侧栏逐运行条目与「主区只读详情卡（最后一条 assistant 文本 + charts）」已被 [069-conversation-history-and-toolsonly-progress.md](069-conversation-history-and-toolsonly-progress.md) 取代：侧栏按 clientSessionId 分组为对话（「N 条消息」），详情卡改为整段对话转录 + 产物动作（打开/下载 HTML 报告、下载 report.json），结果展示与 charts 从历史功能删除。其余约定（表单交接、附件沙箱、发送后刷新）不变。
