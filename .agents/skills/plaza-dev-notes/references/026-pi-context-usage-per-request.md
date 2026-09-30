# 026 · Pi 每次模型请求的上下文占用记录

**状态**：已实现（2026-09-29；真实 Pi/API 端到端回归由用户执行）。

## 动机

运行 trace 原先只在 `agent_settled` 时调用一次 `get_session_stats`，只能得到最终上下文占用；包含工具调用的长任务中，每次实际模型请求的上下文变化无法复盘。需要把累计 Token 与每次请求的上下文占用分开记录。

## 约定细节

- `web/server/lib/piRunner.ts:215-265`：Pi 的每个 `message_end` 视为一次实际模型请求。该事件到达后向同一 RPC 进程发送一次 `{ type: 'get_session_stats' }`，读取 `data.contextUsage.tokens` 与 `data.contextUsage.contextWindow`。
- 查询不按 `message_update`/token delta 轮询；每次 `message_end` 一次，并在 `agent_settled` 发送 terminal 前等待所有查询完成，避免最终 trace 丢失尚未返回的轮次上下文。
- `web/server/lib/traceExport.ts:40-54` 的 `UsageRound` 增加 `contextTokens`、`contextWindowTokens`、`contextUsageRatio`；同一条轮次同时记录 input/output/cacheRead/total，表示单次请求，不与运行累计值混用。
- `web/server/lib/piRunner.ts:169-193` 对上下文峰值取运行内最大值；`agent_start` 重置本轮峰值。若某次 stats 查询失败，该轮上下文字段保留 `null`/已有窗口元数据，不阻断模型结果。
- `web/server/lib/piRunner.ts:387-442`：终态仍额外调用一次 `get_session_stats` 作为兜底，最终 `peakContextTokens` 为各轮上下文占用最大值，`contextUsageRatio = peakContextTokens / contextWindowTokens`。
- `web/server/index.ts:545-683,860-868`：`runStart`、`runEnd`、运行索引和权威 `trace.json` 均保存累计 token 快照及 `usageRounds`；`web/server/lib/traceMd.ts:15-30` 展示逐轮上下文和使用率。

## 成本与取舍

- 每个实际模型请求额外增加一次轻量 RPC `get_session_stats`，不会增加模型调用或 Token 成本；工具链较长时会增加少量协议事件和请求等待。
- 被否决的做法：每个 `message_update` 都查询上下文。它会产生大量无意义 RPC，并且 delta 级上下文值不具备稳定的请求边界；改为 `message_end` 请求边界。
- 保留终态兜底查询，即使某轮查询因进程忙碌失败，也尽量补齐最后一轮/最终峰值；失败仍明确记录为 `null`，不猜测窗口大小。

## 验证与后续路线

- 已通过相关 server TypeScript 定向检查：`cd web && npx tsc --noEmit --allowImportingTsExtensions --module NodeNext --moduleResolution NodeNext --target ES2022 --skipLibCheck server/lib/traceExport.ts server/lib/traceMd.ts server/lib/runner.ts server/lib/piRunner.ts server/lib/zcodeRunner.ts`。
- 已通过前端构建：`cd web && npm run build`（此前验证；本次未启动模型/API）。
- 2026-09-29 实测运行 `20260929-045756-kokg`：产生 34 个 `message_end`，但事件流中 `get_session_stats` 出站请求为 0；`runEnd`、`index.jsonl` 和 `trace.json` 只有旧版累计 usage，没有 `tokenUsage`、`usageRounds` 或上下文窗口字段。核对发现后端进程于 03:54 启动，而 `piRunner.ts` 修改时间为 04:48，说明 TypeScript 服务进程未重启，运行的是旧代码；该次运行不能作为新逻辑验收依据。
- 本次监控只读取本地进程、健康接口和 trace 文件，未发起新的模型调用，也未使用代理。随后已重启本地后端（`node server/index.ts` 新 PID 20202，监听 `127.0.0.1:8767`），`/api/health` 返回 `ok: true`；待用户再次运行多工具任务，确认 `usageRounds` 数量、每轮 `contextTokens` 和最终峰值与 Pi 原生统计一致。
- 若真实运行发现多个并发 `get_session_stats` 返回时间过晚导致轮次快照偏后续请求，应进一步把 stats 查询串行化或在 Pi 事件边界增加对应的原生上下文字段。
