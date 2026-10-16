# 072 · 会话归档与删除

- 状态：已实现（2026-10-16。构建通过；curl 验证归档/恢复/会话删除/单条删除路由与列表过滤；无头浏览器验证侧栏内联归档按钮、已归档分区恢复+两步删除、运行记录页归档视图与两步删除、截图核对排版）。
- 动机：会话列表（070 的 clientSessionId 分组）只能越积越多，需要 ChatGPT 式会话管理。用户指定交互形态：**常规列表只保留归档**（按钮与时间同行），**删除只在归档视图提供**（侧栏已归档分区 + 运行记录页归档视图）。

## 约定细节

### 服务端（`web/server/index.ts`、`lib/traceExport.ts`）

- `RunRecord` 新增 `archived?: boolean`；`rewriteIndex(records)` 整体重写 index.jsonl（与同步 append 单线程内不交错）。
- 路由（均过 originAllowed）：
  - `POST /api/runs/session/:key/archive|unarchive`——按 `clientSessionId || runId`（旧记录退化口径与前端分组一致）匹配整段对话翻转 archived；无命中 404。
  - `DELETE /api/runs/session/:key`——从索引移除该对话全部运行记录，返回 `{removed}`。**trace/events 文件保留在磁盘**（索引层删除，不做不可逆清理）。
  - `DELETE /api/runs/:runId`——删除单条运行记录（运行记录页归档视图）。
  - `GET /api/runs` 增加 `?archived=1`（只看归档）；默认排除归档。

### 在线对话侧栏（`ExperiencePage.vue`）

- 常规列表每条对话的 meta 行（`技能 · 时间` / `技能 · N 条消息`）尾部内联一个归档小按钮（`.exp-hist-inline`，18px 图标钮，与时间同行）；**无删除按钮**。
- 侧栏底部「已归档对话 · N」入口（有归档或展开中才显示）：展开后在时间分组后附加「已归档」分区，行内按钮为**恢复 + 删除**（`sidebarSections` 统一渲染；归档行可点开对话）。
- 删除两步确认：首击进入红色「确认」态（2.5 秒自动退出），再击执行；成功后清 detail 缓存，删的是当前打开对话则 `newChat()` 重置空态。
- 归档清空后自动收起已归档分区；运行进行中（sending）禁止归档/删除。

### 运行记录页（`RunListPage.vue`）

- 筛选行右端「归档视图」切换（runs-chip 样式）：切换数据源 `fetchRuns({archived})`，重置技能/结果筛选。
- 归档视图下表格追加「操作」列（`.runs-table.is-archived` 覆写 grid 列宽），每行「删除」按钮两步确认后 `DELETE /api/runs/:runId` 并刷新；常规视图无删除。

## 成本与取舍

- 删除保留 trace 文件：避免不可逆数据丢失，代价是磁盘残留（评测可按 index 对账）。否决「连文件一起删」——用户未明确要求物理清理。
- 归档标记写在服务端索引（跨浏览器生效），否决 localStorage（换端会重现）。
- index.jsonl 改为可重写：append-only 审计性质弱化为「以最终状态为准」；events/trace 原始文件仍逐事件完整留痕。
- 常规列表不放删除：用户明确要求删除只出现在归档视图，降低误删面。

## 后续扩展路线

- 物理清理命令（按归档状态删 trace 文件）按需加脚本。
- 侧栏会话重命名（需新增本地或服务端元数据，与归档标记同机制）。

## 验证（2026-10-16 实测）

- `cd web && npm run build` 通过。
- curl：archive 后 `?archived=1` 含该会话、常规列表不含；unarchive 还原；session/run DELETE 不存在时 404。
- 无头浏览器：侧栏常规行仅一个「归档对话」按钮且位于 meta 行内（与时间同行）；「已归档对话 · 1」入口展开后归档行按钮 = [恢复到对话列表, 删除对话]；运行记录页常规视图无操作列，切「归档视图」后出现操作列与删除按钮，两步删除临时运行（首击确认未删、再击列表与服务端均消失）。截图 80/81/82 核对排版。
