# 065 · 就业指导广场沙箱第二次运行：广州 Java 后端实习（2026-10-15 快照，四图报告）

- 状态：已实现观察（2026-10-15 会话 `sess-20261015-034246-280f`，报告已落盘并通过最小结构检查）。
- 动机：记录 043 在 `sess-20261013-170737-ypxk` 跑过同一任务；本轮用同一任务输入（目标 Java 后端实习 / 广州 / 在校 / 每周 5–10 小时 / 无附件简历）在**新快照日 2026-10-15** 复跑，验证岗位库数字是否漂移、HTML 报告契约（六固定 h2 + 内联 SVG + 城市热点图）是否稳定复现，并沉淀快照。

## 约定细节

- 任务输入与记录 043 完全一致；`uploads/` 不存在，无简历附件，简历改写只基于用户提供的匿名经历。
- 岗位库查询（`scripts/career-market-query.mjs`，白名单 queryId，无原始 SQL；城市广州市、岗位名含 `Java` 且含 `后端/服务端/开发`、在招 `PUBLISHING AND deleted=0`）：
  - 实习批（7 条，`internship=true`，约 184s，`failed:[]`）：`cohort-summary` 样本 10（本科及以上 10、大专/高职 0、在校/应届 7、经验不限 3、有效薪资 10）；`education-distribution` BENKE 100%；`experience-distribution` ON_CAMPUS 40% / GRADUATING 30% / BUXIAN 30%；`salary-distribution` <3K 20% / 3–6K 40% / 6–10K 10% / 10–15K 10% / 15–25K 20%；`title-top` 7 个岗位名；`source-distribution` (NULL) 70% / 前程无忧 30%；`city-distribution`（province=广东省）广州 10、深圳 4。
  - 在招批（6 条，`internship=false`，约 151s）：`cohort-summary` 样本 329（本科及以上 276、大专/高职 41、有效薪资 328）；`education-distribution` BENKE 82.67% / DAZHUAN 12.46% / CHUZHONGJIYIXIA 3.04% / SHUOSHI 1.22% / BUXIAN 0.61%；`experience-distribution` LESS_THAN_5 38.6% / LESS_THAN_3 27.66% / LESS_THAN_10 22.49% / BUXIAN 5.17% / LESS_THAN_1 3.34% / ON_CAMPUS 1.22% / GRADUATING 0.91% / MORE_THAN_10 0.61%；`salary-distribution` <3K 0.61% / 3–6K 3.96% / 6–10K 21.65% / 10–15K 32.01% / 15–25K 32.01% / 25K+ 9.76%；`title-top` Java开发工程师 30.1%（99/329）等 TOP20；`city-distribution` 10 市（广州 329、深圳 252、东莞 27、佛山 27、珠海 24，其余个位数）。
  - 客户端 `mysql`，库内快照 `snapshotDate=2026-10-15`。**结论：与 `references/data/广州-Java后端实习岗位分析.md` 的 2026-09-28/29 数字逐项一致**，说明该切片在 2026-09-29 → 2026-10-15 期间稳定未漂移，数据文档继续有效，无需改数。
- 报告产物：`web/server/workspace/sess-20261015-034246-280f/report.html`（约 54 KiB），完整 `<!doctype html>/<html>/<head>/<body>`，h1 后直接进入六个固定 h2；4 张内联 SVG `figure`：`heatmap-chart/CH_CITY`、`stacked-bar-chart/CH_EDU`、`histogram-chart/CH_SALARY`、`bar-chart/CH_TITLE`。
- 热点图：`registry.json` → 广东省 manifest + `guangdong-city-codes.json` + `guangdong-440000-city.geojson`，渲染 21 条地级市边界 path；本轮**为每条 path 增加 `data-adcode` 六位标准编码属性**（记录 043 未带），便于服务端/审阅侧核对编码关联；广州深色、深圳次之、其余中性色（缺失非 0）。`city-distribution` 仍未返回同口径跨城总量，报告按要求把「其他」标为未评估，不生成数值「其他」。

## 成本与取舍

- 本轮两批合计约 335s（单查询 38–56s），沿用记录 020 的 2 路受控并行，未把实习/在招混在同一分母。
- 图表数从记录 043 的 5 张降到 4 张（合并薪资口径为单一直方图，实习薪资差异改在正文段落说明），减少单张图的样本噪声，未削减必选章节。
- 热点图继续按记录 023 的取舍不生成数值「其他」。

## 耗时分解（2026-10-15 追加，同日 4 次成功运行横比）

- 方法：`events.jsonl` 中 `message_start/end` 按序配对算模型生成区间、`tool_execution_start/end` 按 `toolCallId` 配对算工具区间，区间去重合并后与 `runStart→runEnd` 总时长对比（4 次运行：`034246-f2ur` / `035720-wki3` / `041031-aldj` / `045558-wfgq`，同一 Java 后端实习·广州任务，模型 deepseek-flash，turn 数 14–23）。
- 结论：**岗位库查询主导墙钟**。`career-market-query.mjs` 去重覆盖 250–336s，占总时长 **61–71%**；模型生成 92–143s（22–35%）；真实空闲（总时长 − 模型 ∪ 工具覆盖）15–35s；非 DB 工具（读文件/写报告文件/图表脚本）合计 <1s。
- 单条 MySQL 子查询约 25s（`--parallel` 6–7 条一批 150–184s，≈25s/条，批内近似线性，即批内实际并行度≈2 见记录 020）；与其他调用并发执行的单条 queryId 45–57s。
- pi 同轮多工具并发有实测收益：`wki3` 同轮并发多个 career-market-query，串行耗时和 385s → 去重后 250s（省约 135s）；`aldj` 省约 73s。模型生成与工具执行始终串行（重叠 0）。
- 模型侧拆分：最终报告正文的长生成仅 1–2 条（57–95s）；其余 18–22 个短轮（任务复述、读 SKILL/附件、逐次工具决策、校验收尾）合计 35–66s，平均 2–3s/轮。
- 优化方向（待验证）：对固定地区岗位切片缓存 `city-distribution`/`title-top` 等固定口径结果（同 041 快照层思路）；或提高批内并行度。空闲与模型侧优化空间小。
- 跨任务复现（2026-09-30 四次不同任务成功运行：IT 技术支持 `20260929-231443-6e8h` 349s、电商运营 `20260930-030301-m1j6` 425s、设备技术员/PLC `20260930-050958-9n2s` 577s 与 `20260930-051948-zbbg` 473s）：DB 查询占比 **61–72%**、模型生成 20–27%、空闲 36–80s，模式与 Java 任务一致，瓶颈是 skill 结构性的。差异在查询批形状：旧任务多拆成 `--parallel(2)` 小批（4–8 次调用、轮数更多、空闲更高，9n2s 空闲 80s），Java 任务用 6–7 条大批总时长并不更长；单条子查询 21–34s 与任务无关。四次成本 $0.043–0.059，cacheRead 0.9–1.3M（命中率 >90%）。

## 后续扩展路线

- 与记录 043 同一待办：跑 `web/server/lib/htmlReport.ts` 校验与真实浏览器渲染/下载回归。
- 本轮新增的 `data-adcode` 属性可考虑纳入 htmlReport 校验（热点图 path 编码覆盖率），但目前该校验未实现，属待验证项。
- 实习口径 `city-distribution` 只返回广州、深圳两市且无总量，热点图信息量低；若要提升，需要在 queryId 中补同口径省份总量（当前白名单未提供）。

## 验证

- 最小结构检查：doctype/html/head/body 均 true；h2 数量 6 且名称与顺序匹配固定章节（indexOf 递增）；`data-chart-skill` 计数 4 且含精确 `<figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY">`；`<svg>` 计数 4；21 个 `data-adcode`；无代码围栏、无 `<script>`、无 base64。
- 未实测：服务端 `htmlReport.ts` 校验、真实浏览器渲染、Pi 运行历史展示（与记录 043 同）。
