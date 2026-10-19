# 077 · 运行详情页统一时间线（Pi trace）

**状态**：已实现（2026-09-23；原编号 012，与 012-career-market-query-sidecar 重号，2026-10-19 重组迁至 077，见 076）。当前执行链已统一为 Pi，历史 Zcode 记录仅作兼容数据。

## 动机

运行详情页此前把工具调用抽到左侧「工具执行」，把文本和思考过程放到右侧「对话流」。工具虽然来自同一份 Pi trace，却失去了相对于对话的实际位置，用户无法按执行顺序复盘一次运行。

## 约定细节

- `web/src/pages/RunDetailPage.vue` 从 `trace.messages[].parts` 原始顺序生成 `runTimeline`；每个 part 一个事件，支持 `text`、`reasoning`、`tool` 三类。
- 排序用消息索引 + part 索引生成稳定 `seq`，不依赖可能相同的时间戳；时间戳只用于显示。
- `tool` 节点保留 `tool`、`callID`、`state.status/input/output`，入参与输出按需展开；`toolCallCount` 作为时间线头部次级统计。
- 单列「运行时间线」替代工具侧栏与独立对话流；样式为统一节点、连接线、工具卡片与展开控件。
- 范围限定 Pi trace；历史 Zcode trace 不删除，按旧 schema 只读展示。
- 工具耗时：071 起 piRunner 已把工具起止计时写入 trace（conversation.tools 摘要消费同一数据源），时间线节点按需接入展示。

## 成本与取舍

- 前端归一化而不迁移历史 trace 文件，兼容现有 Pi mock 与已落盘记录，改动集中在详情页。
- 沿用消息 part 顺序而非时间戳排序，避免并列时间戳顺序漂移。
- 不引入新的后端事件 schema，避免扩大协议变更面。

## 验证与后续路线

- `cd web && npm run build` 通过。待真实浏览器回归：文本、思考、工具调用交错展示与长输出下工具详情展开的滚动表现。
- 后续只扩展 Pi trace 的事件与展示能力；不要重新引入第二个执行引擎来承载用户报告。
