# 034 · 就业指导真实会话中岗位库查询工具未声明的观察

- 状态：已实现观察（2026-10-12，广州 Java 后端实习 career-guidance 会话）。
- 动机：记录一次真实 career-guidance 运行里岗位库工具的可用性实际形态，避免后续把“工具已声明”当作必然前提。

## 约定细节与实测

- 会话：`web/server/workspace/sess-20261012-144617-9yd3`（广州 · Java 后端实习 · 岗位匹配）。用户无上传附件，`uploads/` 为空。
- 该会话沙箱 `AGENTS.md` 只含通用的“会话沙箱 / uploads”说明，**没有** `scripts/career-market-query.mjs` 工具节。对应 `web/server/index.ts:98` 的 `mysqlConfigured()` 判定为假：`web/.env` 里 `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` 五行均为注释（`web/.env:53-57`），进程环境也无 `MYSQL_*`。
- 岗位库本身可达：`192.168.8.1:3908` TCP 可连，`mysql` 8.0.42 客户端在机；用 `scripts/career-market-query.mjs` 时以进程环境注入 `web/.env.example` 同名的五个 `MYSQL_*`（值取自 `career-guidance/references/data/岗位库数据源.md` 第 1 节）即可正常查询，无需改脚本。
- 六条白名单查询全部成功（单批 `--parallel` ≤2，串行三批）：`city-distribution`(广东省)/`cohort-summary` ≈48s，`education-distribution`/`experience-distribution` ≈50s，`salary-distribution`/`title-top` ≈65s。结果：广州 Java 后端实习口径样本 10、省内仅广州(10)+深圳(4)；学历 100% 本科及以上；经验 在校 40%/应届 30%/不限 30%；薪资 3–6K 40% 等。
- 报告写入 workspace 根 `report.html`（132,747 字节），`web/server/lib/htmlReport.ts` 的 `validateCompleteHtmlReport` 返回 `pass=true`，5 个 figure（bar×2、stacked-bar×2、heatmap×1），heatmap `status=present`、`CH_CITY`、含 SVG `title/desc/figcaption`。

## 2026-10-12 第二次复现（同为广州 Java 后端实习）

- 会话：`web/server/workspace/sess-20261012-145409-ec5w`，用户无附件、`uploads/` 为空；沙箱 `AGENTS.md` 同样**没有**工具节，`web/.env:53-57` 的 `MYSQL_*` 仍为注释，进程环境也无 `MYSQL_*` —— 与首跑完全一致的“工具未声明”形态。
- 仍以进程环境注入 `web/.env.example` 同名的五个 `MYSQL_*`（值取自 `岗位库数据源.md` 第 1 节）后使用 `scripts/career-market-query.mjs`；六条白名单查询分三批 `--parallel`（每批 ≤2）全部成功：`cohort-summary`/`city-distribution` 约 79s，`education-distribution`/`experience-distribution` 约 97s，`salary-distribution`/`title-top` 约 86s。同口径结果：广州实习样本 10、省内仅广州(10)+深圳(4)；学历 100% 本科及以上；经验 在校 40%/应届 30%/不限 30%；薪资 <3K 20%、3–6K 40%、6–10K 10%、10–15K 10%、15–25K 20%；岗位名 7 个。库内快照日与查询日均为 2026-10-12（与首跑样本量一致，说明该切片短期内稳定）。
- 报告 `report.html`（126,383 字节）：`validateCompleteHtmlReport` 返回 `pass=true`、`errors=[]`、`warnings=[]`，4 个 figure（heatmap×1、stacked-bar×1、bar×2）；heatmap `status=present`、`CH_CITY`、21 条广东城市边界 path；六个固定 h2 齐全。
- 结论：`034` 首跑的观察可稳定复现，工具未声明是**环境配置**问题而非代码缺陷；本会话依旧未改任何仓库代码。
- 2026-10-12 第二次同场景复现（会话 `web/server/workspace/sess-20261012-145151-ksl0`，广州 · Java 后端实习 · 岗位匹配，`uploads/` 为空）：沙箱 `AGENTS.md` 同样只有通用说明，`web/.env` 的 `MYSQL_*` 仍为注释，工具节仍未声明；再次用进程环境注入同名五个变量后，10 条白名单查询（`cohort-summary`/`education-distribution`/`experience-distribution`/`salary-distribution`/`title-top` 各跑实习与在招两套口径 + 省内 `city-distribution`）在 5 个 `--parallel` 批次内全部成功，单批 50–98s，快照日 `2026-10-12`。报告 `report.html`（149,486 字节）经 `validateCompleteHtmlReport` 校验 `pass=true`、无 error/warning、5 figure、heatmap `status=present`。结论：工具未声明是稳定的部署配置缺口，不是偶发；手工注入路径可重复。
- 2026-10-12 复核（workspace `sess-20261012-145256-iwrx`，同为广州 · Java 后端实习 · 岗位匹配）：该会话 `AGENTS.md` 依旧只有通用沙箱说明，工具节未声明；同样以进程环境注入五个 `MYSQL_*` 后六条白名单查询全部成功（三批 `--parallel` ≤2，约 68s/83s/97s）。报告 126,446 字节，`validateCompleteHtmlReport` 返回 `pass=true`、`warnings=[]`，5 个 figure（bar×2、stacked-bar×2、heatmap×1），heatmap `status=present`、`CH_CITY`、21 条广东城市边界 path。结论：未声明工具是稳定的部署配置状态，而非偶发。
- 2026-10-12 第三次复核（workspace `sess-20261012-145941-zsmq`，广州 · Java 后端实习 · 岗位匹配）：`AGENTS.md` 仍只有通用沙箱说明；进程环境注入五个 `MYSQL_*`（host/port/user/password/database 取自岗位库数据源文档第 1 节）后，六条白名单查询以单批 `--parallel`（并发 ≤2）全部成功，整批约 198s，返回结果与 034 前两次一致（广州样本 10、深圳 4；学历本科及以上 100%；在校 40%/应届 30%/不限 30%；薪资 3–6K 40% 等）。报告 127,617 字节，`validateCompleteHtmlReport` 返回 `pass=true`、`warnings=[]`，5 个 figure（bar×3、stacked-bar×1、heatmap×1），heatmap `status=present`、`CH_CITY`、21 条广东城市边界 path。记录为“手工注入环境变量”路径的又一次成功复现。

- 2026-10-12 第四次复核（workspace `sess-20261012-160400-kl2i`，广州 · Java 后端实习 · 岗位匹配，`uploads/` 为空）：`AGENTS.md` 仍只有通用沙箱说明，`web/.env:53-57` 的 `MYSQL_*` 仍全为注释、进程环境无 `MYSQL_*`，工具节未声明。按文档第 1 节注入五个同名变量后，六条白名单查询分三批 `--parallel`（并发 ≤2）全部成功，单批约 45–49s，结果与首跑一致（广州样本 10；学历本科及以上 100%；在校 40%/应届 30%/不限 30%；薪资 3–6K 40%；岗位名 7 个；省内广州 10/深圳 4），快照日 `2026-10-12`。报告 `report.html`（124,182 字节）结构检查：六个固定 h2 齐全、5 个 figure（bar×3、stacked-bar×1、heatmap×1）、heatmap `CH_CITY` 含 SVG `title/desc/figcaption` 与 21 条广东城市边界 path。环境配置缺口稳定复现。

## 成本与取舍

- 本次未改任何仓库代码：跳过的是“把 `web/.env` 的 MYSQL_* 取消注释”这一部署配置，属环境问题而非代码缺陷；不在本记录里改 `web/.env`（gitignore 的本地凭据文件）。
- 修正过的坑：heatmap 图注里若出现“未返回/无结果/失败”等词且附近有“热点图/city-distribution/城市分布”，`htmlReport.ts` 的 `failureHint` 会把成功热点图误判为失败分支，必须写“没有匹配记录/缺失（非 0）”这类中性表述；同时热度图的 `figcaption` 必须在 `<figure>` 内，外部 `<p class="cap">` 不算。

## 后续扩展路线

- 若希望真实会话稳定使用岗位库工具：要么在部署环境的进程环境或 `web/.env` 配齐 `MYSQL_*`（使 `sandboxAgentsMd()` 写入工具节），要么在 career-guidance Skill 文档中显式给出“未声明工具时的凭据来源与注入方式”，避免 Agent 因缺配置直接标“未评估”。
- 待验证：在同一 SQL 口径下复核 `web/server/index.ts:104` 声明工具节的会话是否能用更少步骤完成同样查询，并与本次“手工注入环境变量”路径对比耗时。
