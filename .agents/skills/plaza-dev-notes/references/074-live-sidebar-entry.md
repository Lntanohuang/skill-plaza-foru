# 074 · 侧栏实时对话条目与运行记录落库竞态

- 状态：已实现（2026-10-19。构建通过；无头浏览器真实两轮对话 e2e 8/8 断言 + 截图核对）。
- 动机：用户反馈「刚刚运行的记录、运行中的好像没有在会话记录中展示」。两个独立成因：
  1. 运行记录只在运行**结束**后由服务端落库（`finalizeRun` → 异步 `exportTrace` → `appendIndex`），运行期间侧栏根本没有这条数据；
  2. `done` SSE 先于 `appendIndex` 发出（`web/server/index.ts` terminal 分支 `wire.done` → `finalizeRun` 内 async IIFE 落库），前端 `sending=false` 时立刻 `loadHistory()` 首刷经常扑空，且此后不再刷新——记录要等下一次任意操作才出现。

## 约定细节（`web/src/pages/ExperiencePage.vue`）

- **`convSessions` / `convSlugs` 改为 `reactive(new Map())`**（原先普通 Map 无响应性）：`session` 事件异步写入后，依赖它的 computed（`liveSessionKey`、`liveConvGroup`）才会重算。否则 `liveSessionKey` 在写入前求值缓存 `undefined`，第二轮运行时真实分组的「运行中」徽章永不出现（e2e 实测踩坑）。
- **`liveConvGroup` computed**：当前对话满足「apiReady、有用户消息、其 sess-* 真实分组尚未出现在 historyGroups」时，在侧栏「今天」置顶渲染占位条目：
  - `key = live:<convId>`、`live = true`：不可点开（`selectHistory` 首行拦截）、无归档/恢复/删除按钮、无结局徽章（不伪造结果）；
  - `title` = 首条用户消息 `replace(/\s+/g,' ').slice(0,80)`，与服务端 `promptDigest` 口径一致，落库替换时标题不跳变；
  - `running = sending`：渲染 `.use-hist-outcome.is-running` 蓝色「运行中」徽章（`--sk-blue`，暗色 `#0a84ff` 自动跟随）。
- **`sidebarSections`**：既有分组 `key === liveSessionKey && sending` 时标 `running = true`（第二轮起真实分组换「运行中」徽章，结束自动回结局徽章）；注意先复制 `items` 数组再 unshift，勿改 `groupedHistory` 的缓存数组。落库后由 loadHistory 既有自动高亮（070）设 `selectedSessionKey`，占位条目因真实分组出现而消失。
- **`refreshHistoryAfterRun`**（`watch(sending)` true→false）：`silent` 刷新（`loadHistory({silent:true})` 不切 loading 态，侧栏不闪）；当前会话记录未命中时 1.2s × 3 延迟重拉；仍未命中 `liveDismissed = true` 撤掉占位条目防幽灵对话，下次 `sending=true` 自动复位。
- 空态文案让位：`historyRuns.length === 0 && !liveConvGroup` 才显示「还没有运行记录」。

## 成本与取舍

- 否决服务端「`appendIndex` 完成后再发 `done`」：done 会被 exportTrace（pi RPC）推迟，终端体感变差、协议时序变化面大；前端短窗口补拉成本更低。
- 否决定时轮询 `/api/runs`：只在运行结束后的重试窗口内发请求，平时零开销。
- 占位条目不显示结局徽章：落库前结果未知，伪造「成功」违背诚实展示；bridge 窗口通常 < 2s。

## 后续扩展路线

- 若未来服务端把落库挪到 `done` 之前同步完成，可整体删除重拉逻辑（占位条目逻辑仍需要——运行期间依旧无记录）。

## 验证（2026-10-19 实测）

- `cd web && npm run build` 通过（vue-tsc + vite）。
- CDP e2e（dev 4188 + 后端 8767，真实 deepseek-flash 两轮对话，8/8 断言通过）：
  1. 发消息后侧栏「今天」立即出现高亮占位条目（「运行中」徽章、无操作按钮）；
  2. 运行结束落库后真实条目接管高亮（「成功」徽章 + 归档按钮、占位消失、标题不跳变）；
  3. 同会话第二条消息运行中，真实分组换「运行中」徽章；结束后回到「成功」、meta 变「2 条消息」。
  - 截图 `/tmp/skillhub-shots/run9-1-live-running.png`（占位+运行徽章）、`run9-3-second-running.png`（真实分组运行徽章）视觉核对通过。
