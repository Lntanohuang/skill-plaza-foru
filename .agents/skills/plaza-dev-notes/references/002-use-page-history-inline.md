# 002 · 在线运行「历史会话」：行内展开原始输入/输出，不依赖运行记录页

**状态**：已废弃（2026-09-23，由 004「历史会话点击后在在线运行主结果区展示」替代）。

> 历史实现记录：该方案曾于 2026-09-21 落地并通过浏览器实测；现保留作为变更背景，不再作为当前交互约定。
**适用范围**：`web/src/pages/UsePage.vue`（表单/对话两模式）+ `web/src/components/UseHistoryList.vue`。

## 动机

运行记录页（`/runs` 列表 + `/runs/:runId` 详情）是**测试环境给开发人员用的**工具（导航入口由 `isRunsTabVisible()` 门控，commit 6ff8d8c）。而「在线运行」是面向广场用户的页面——用户查看自己跑过的任务时，不能被跳去一个生产环境根本不存在、且满是 token/工具调用/trace 下载的开发视角页面。

约定：**用户侧历史 = 在线运行页内自包含**。列表 + 原始输入/输出都在 UsePage 就地展示；`/runs` 继续作为开发侧深度排查入口，两条路径互不依赖。

## 约定细节

- **数据源零新增**：列表走现有 `GET /api/runs?limit=200`（`fetchRuns`，`web/src/api/runsApi.ts`）；展开时按 runId 拉现有 `GET /api/runs/:runId` 取 trace。
- **输入/输出提取**（`UseHistoryList.vue` 的 `textOf`/`toggle`）：`trace.messages` **反向**找最后一条 `role === 'user'` / `'assistant'` 消息，拼接其 `type === 'text'` parts。反向取保证多轮会话只看本轮。
- **「原始输入」= 引擎侧完整输入**，含服务端注入的 `<skill …>` 前导（实测 career-guidance 一轮约 3.9k 字）。不剥离——"原始"就是引擎看到的全文，且剥离规则会耦合引擎 prompt 格式。
- **输出渲染**：复用 `MarkdownView`（markdown-it，`html:false`），输入用等宽 `pre`（max-height 180px 滚动），输出 md-body（280px 滚动）。
- **降级**：`fetchRunDetail` 的 `live=false`（mock 兜底）或 `trace=null`（文件损坏）时只显示 `promptDigest` 摘要并标注「原始记录不可用」，mock 数据不冒充真实历史。
- **门控变更**：历史入口原先跟随 `isRunsTabVisible()`，已改为**无条件渲染**（后端不在线时显示提示文案）。dev-only 门控只保留给 `/runs` 导航页签。
- **刷新时机**（`UsePage.vue` `loadHistory` 的三处 watch）：进页面、`apiState` 转就绪、一次运行结束（`busy` true→false）。
- 一次只展开一条（accordion），详情按 runId 缓存在组件内，重复展开不重复请求。

## 成本与取舍

- 每次展开一条额外 `GET /api/runs/:runId`（读 trace.json，本地文件读取，无模型开销）；列表请求不变。
- 被否决的备选：
  - ~~点击跳转 `/runs/:runId` 详情页~~：用户面依赖 dev-only 页面，生产不可达；且详情页视角（工具时间线、usage、trace 下载）不是用户要的。
  - ~~列表接口直接带输入/输出全文~~：`index.jsonl` 与列表响应膨胀两个数量级，90% 的浏览场景只需要摘要。
  - ~~按 clientSessionId 聚合成"会话"~~：当前运行逻辑是一问一答一次性（用户确认），run 即会话粒度；聚合是过度设计。

## 后续扩展路线

- 用户已规划的**「回答转报告形式」**：输出区已有 md 渲染管线，报告卡片化/导出可直接挂在展开面板上。
- 多轮会话成为主流后：再考虑按 `clientSessionId` 分组展开（索引里已有该字段，前端分组即可，无需服务端改动）。
- 若需要「跑完即看」：可让 SSE `done` 事件回带 runId（当前未带），前端可直接定位新记录。
