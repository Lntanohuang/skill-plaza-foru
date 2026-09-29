# 025 · 就业指导 trace 运行记录显示链路诊断

**状态**：已实现展示修复（2026-09-29；真实 API/浏览器回归待验证）。

## 动机

用户反馈就业指导的 trace 没有出现在运行记录。需要把“trace 是否落盘”和“前端是否显示”分开核对，避免把 API 不可达、异步索引竞态、旧记录缺少 HTML 报告和最终 HTML 被有意隐藏混成一个问题。

## 约定细节

- 权威数据仍是 `web/server/traces/index.jsonl`、`<runId>.events.jsonl` 和 `<runId>.json` 三层；当前索引包含多条 `career-guidance` 记录，成功运行 `20260928-225102-s86k`、`20260928-230013-syrq` 等同时有 `.json` 与 `.report.html`，最后一条 `20260928-233058-8g1y` 为 timeout 但仍有 `.json` 与 `.events.jsonl`。
- 真实列表接口 `web/server/index.ts:259-268` 只按可选 skill/outcome 过滤，不会排除 `career-guidance`；详情接口 `:279-288` 只有在 `record.files.trace` 存在且可读时才返回 trace，否则返回 `trace: null`。
- 前端 `web/src/api/runsApi.ts:16-25` 将后端不可达、非 2xx、空列表和 JSON 错误全部回落为演示数据；`RunListPage.vue` 会显示演示列表，而 `UsePage.vue:551-560` 为避免冒充真实历史会直接丢弃 `live=false` 的列表。当前本机检查时 `8767` 与 `4188` 均无监听，因此在线页看不到就业指导历史属于环境/API 链路结果，不是索引中没有数据。
- `RunDetailPage.vue:22-27,274-277` 现在只对 `role === 'assistant'` 且存在 `item.files.html` 的最终 HTML 文本显示报告链接；用户任务、工具调用和思考 trace 保持可见。没有独立 HTML 文件的旧记录或 timeout 记录按普通文本展示，避免链接指向不存在的报告。
- `web/server/index.ts` 在 `finalizeRun` 内异步导出 trace，直到导出、侧车处理和环境快照完成才 `appendIndex`；但终态 `done` 先发送并立即触发前端 `busy=false` 刷新。因此刚结束的运行可能短暂不在列表，需等待索引追加或刷新；这是独立于 trace 文件是否已生成的时序问题。报告文件现在在终态、超时和断连收尾时尝试复制，超时且已恢复报告时先返回带 `reportUrl` 的 `done`，避免 error 事件抢先吞掉链接。

## 成本与取舍

- 本次保留用户页“报告链接优先”的边界，没有把完整 HTML/raw trace 重新塞进用户结果区；运行详情仍展示用户输入、工具调用和思考过程。
- 被否决的临时做法：只扩大前端历史刷新次数或单纯延长超时。它不能修复后端未启动、旧记录 `files.html` 缺失、短回复伪报告或详情接口返回 `trace:null`；应分别修复连接状态、文件协议和终态索引时序。
- 运行记录页仍保留开发侧完整 trace 下载和时间线；就业指导最终 HTML 继续由独立 `/api/reports/:runId` 提供。

## 后续扩展路线

- 把 `finalizeRun` 的索引追加结果与 `done` 或前端刷新建立明确时序，避免新记录刚完成时短暂缺席。
- 启动同一 `skill-plaza-foru` 工作区的 8767/4188 后，以 `/api/health`、`/api/runs?limit=200` 和一个成功/timeout career run 做真实浏览器回归；静态构建不等于 trace/浏览器验收。

## 验证证据

- `web/server/traces/index.jsonl` 可解析，70 行中有 24 条 `career-guidance`；其中 20260928-021809-aq1z、20260928-031008-5eb9、20260928-225102-s86k、20260928-230013-syrq 有 HTML 报告路径，20260928-233058-8g1y 有 trace 但无 HTML（timeout）。
- `cd web && npm run build` 通过（vue-tsc 与 Vite build）。
- `curl http://127.0.0.1:8767/api/health`、`curl http://127.0.0.1:4188/` 当前均 connection refused；因此真实 API/浏览器页面验收仍待验证。
