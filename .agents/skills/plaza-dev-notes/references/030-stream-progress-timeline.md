# 030 · 在线运行安全进度时间线

- 状态：已实现（2026-09-29；真实 Pi 工具事件与浏览器视觉回归待验证）。
- 动机：既有 SSE 只显示一条 status，思考阶段只有累计字数，工具阶段只有工具名；用户无法知道正在读取资料、查询岗位库、生成图表还是写报告。
- 约定细节：
  - `RunnerEvent.status` 增加 `state`（active/completed/failed）和 `id`；Pi 的 `toolcall_start/toolcall_end` 映射为工具生命周期，服务端经 SSE 传递 `type=status`。接入点：`web/server/lib/runner.ts:25-34`、`web/server/lib/piRunner.ts:307-324`、`web/server/index.ts:818-820`、`web/src/composables/useChatApi.ts:31-43`。
  - 前端保留 `progressEvents` 时间线，不展示原始思维链、工具参数、SQL、命令或文件路径。思考阶段只显示“正在分析任务”和累计处理量；工具名称通过固定映射转为“读取参考资料、查询岗位库、生成报告文件、生成数据图表”等用户文案。接入点：`web/src/pages/UsePage.vue:205-300,380-430`。
  - 表单与对话模式共用同一固定高度进度框，内部滚动并自动定位到最新事件；用户可通过“展开/收起”切换 92px 与 280px 可视高度。工具完成显示成功/失败和耗时，正文开始时关闭前置阶段并显示“正在生成结果”。接入点：`web/src/pages/UsePage.vue` 进度模板与 `web/src/styles/styles.css` 进度样式。
- 成本与取舍：状态事件数量增加但不增加模型 token；不展示完整 thinking 内容，避免泄露隐藏推理、提示词和敏感工具输入；以确定性工具文案换取安全和可读性。暂不把历史 trace 的完整工具时间线回放到用户页，开发详情页仍保留完整材料。
- 后续扩展路线：真实 Pi 运行确认不同版本的 `toolcall_end` 是否携带 tool id/name；补充历史运行进度回放、重试节点和按阶段折叠；必要时为岗位查询增加安全的指标摘要。
- 验证：`cd web && npm run build` 已通过；真实 Pi SSE 序列和浏览器展示待验证。
