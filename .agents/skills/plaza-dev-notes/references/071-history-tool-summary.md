# 071 · 历史对话补回工具调用摘要

- 状态：已实现（2026-10-16。构建通过；curl 验证 conversation 携带工具摘要；无头浏览器验证历史对话渲染折叠工具组、展开行、无命令/SQL/路径泄露）。
- 动机：用户发现实时对话有「工具调用」组（折叠行 + 明细），从历史重新打开同一对话后工具信息消失——070 的 conversation 只含文本轮次，工具 parts 被排除。历史应与实时对话同构。

## 约定细节

- `deriveConversation`（`web/server/index.ts`）assistant 轮新增 `tools?: Array<{ tool: string; failed: boolean }>`：工具 parts 降级为「名称 + 成败」（`state.status === 'error'` 为失败），030 边界不变——参数、命令、SQL、路径不出服务端。
- 聚合口径：一个用户轮次内的全部工具调用挂到该轮**首条** AI 消息的 `tools`（对齐实时对话"一轮一个组"）；末轮只有工具没有正文时并入该轮最后一条 AI 消息。
- 前端（`web/src/pages/ExperiencePage.vue`）：`Msg.tools` + `historyToolItems()`（ProgressItem：中性标题、failed 显示「工具执行失败」，无耗时字段），恢复的消息渲染第二个 `ToolCallGroup` 分支（`:prose-started="true"` 初始折叠）；实时组与历史组互斥（progressOwner 优先）。
- `ToolCallGroup`（`web/src/components/ToolCallGroup.vue`）：`open` 初始值跟随 `proseStarted`（历史进场即折叠，修复 watch 不触发初始值的问题）；新增 `hasTiming`——没有计时数据的组头部不显示「共 Xs」，不伪造。
- `toolProgress` 文案中性化（「正在查询岗位库」→「查询岗位库」等）：实时状态行由 `makeStreamHandler` 拼「正在 + 标题 + …」，已完成行与历史行不再显示"正在"字样。

## 成本与取舍

- 历史工具行无耗时：trace 导出（get_messages 快照）不含 per-call 起止时间，实时事件流（events.jsonl 的 message_update）有但按 callID 关联脆弱（toolcall_start 不带 id），否决事件流反推；显示"已完成 N 步"不带时长。
- 旧记录同样生效：tools 从既有 trace 的 tool parts 派生，无需回填。

## 后续扩展路线

- trace 导出补 per-call 起止时间（piRunner 从实时流捕获 toolcall start/end 并写入 summary.toolCalls 的 ended 字段）后，历史组恢复耗时显示。

## 验证（2026-10-16 实测）

- `cd web && npm run build` 通过。
- curl：天气运行（20261016-162605）conversation 的 assistant 轮携带 4 个 `{tool: 'bash', failed: false}`；你好运行无工具（tools 缺省）。
- 无头浏览器：点开天气对话 → 「工具调用 已完成 4 步，点击查看」默认折叠；展开 4 行「执行数据处理 · 已完成」；DOM 正则断言无 `web-search|\.mjs|SELECT |workspace/` 泄露；截图核对。
