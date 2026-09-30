# 012 · Pi 运行详情合并工具与对话时间线

**状态**：已实现（2026-09-23；当前执行链已统一为 Pi，历史 Zcode 记录仅作兼容数据）。

## 动机

运行详情页此前把工具调用抽到左侧“工具执行”，把文本和思考过程放到右侧“对话流”。工具虽然来自同一份 Pi trace，却失去了相对于对话的实际位置，用户无法按执行顺序复盘一次运行。

## 约定细节

- `web/src/pages/RunDetailPage.vue:6-78` 从 `trace.messages[].parts` 原始顺序生成 `runTimeline`；每个 part 形成一个事件，支持 `text`、`reasoning`、`tool` 三类。
- 排序使用消息索引和 part 索引生成稳定 `seq`，不依赖可能相同的时间戳；时间戳只用于显示。
- `tool` 节点保留 `tool`、`callID`、`state.status/input/output`，入参和输出继续按需展开；`toolCallCount` 作为时间线头部的次级统计。
- `web/src/pages/RunDetailPage.vue:225-277` 用单列“运行时间线”替代工具侧栏与独立对话流；事件按统一顺序显示。
- `web/src/styles/styles.css:1607-1668` 提供统一节点、连接线、工具卡片和展开控件样式。
- 范围限定为 Pi trace；当前运行链不再接入 Zcode。历史 Zcode trace 文件不删除，按旧记录 schema 只读展示。

## 成本与取舍

- 采用前端归一化，不迁移历史 trace 文件，兼容现有 Pi mock 和已落盘记录，改动集中在详情页。
- 沿用消息 part 顺序而不是按时间戳排序，避免并列时间戳造成顺序漂移；代价是工具完成耗时暂未在节点中展示。
- 暂不引入新的后端事件 schema，避免在 Zcode 尚未纳入前扩大协议变更面。

## 验证与后续路线

- `cd web && npm run build` 已通过（vue-tsc 与 Vite build）。
- 待真实浏览器回归 Pi 运行，确认文本、思考、工具调用交错展示，以及工具详情展开在长输出下的滚动表现。
- 后续只扩展 Pi trace 的事件与展示能力；不要重新引入第二个执行引擎来承载用户报告。
