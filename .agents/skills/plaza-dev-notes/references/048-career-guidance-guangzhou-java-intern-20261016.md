# 048 · 就业指导广场沙箱第三次运行：广州 Java 后端实习（2026-10-16 快照，六图报告）

- 状态：已实现观察（2026-10-16 会话 `sess-20261015-204342-saf8`，报告已落盘并通过**服务端** `validateCompleteHtmlReport` 校验）。
- 动机：记录 043（2026-10-13）、047（2026-10-15）已用同一任务输入在 `sess-20261013-170737-ypxk`、`sess-20261015-034246-280f` 复跑过。本轮第三次复跑，验证岗位库数字在 2026-10-16 是否继续稳定，并在本轮首次把报告同时跑过 `web/server/lib/htmlReport.ts` 的真实校验（前两轮只做最小结构自检）。

## 约定细节

- 任务输入与前两轮一致：Java 后端实习 / 广州市 / 在校找实习 / 每周 5–10 小时 / 匿名经历（计算机相关专业 + Spring Boot 校园二手交易平台，负责接口设计与 MySQL 建模，无实习）；`uploads/` 不存在，无简历附件。
- 岗位库查询（`scripts/career-market-query.mjs`，白名单 queryId，无原始 SQL；两批串行，批内受控 2 路并行）：
  - 实习批（7 条，`internship=true`，约 255s，`failed:[]`）：`cohort-summary` 样本 10（本科及以上 10、大专/高职 0、在校/应届 7、经验不限 3、有效薪资 10）；`education-distribution` BENKE 100%；`experience-distribution` ON_CAMPUS 40% / GRADUATING 30% / BUXIAN 30%；`salary-distribution` <3K 20% / 3–6K 40% / 6–10K 10% / 10–15K 10% / 15–25K 20%；`title-top` 7 个岗位名；`source-distribution` (NULL) 70% / 前程无忧 30%；`city-distribution`（province=广东省）广州 10、深圳 4。
  - 在招批（6 条，`internship=false`，约 204s）：`cohort-summary` 样本 329（本科及以上 276、大专/高职 41、有效薪资 328）；`education-distribution` BENKE 82.67% / DAZHUAN 12.46% / CHUZHONGJIYIXIA 3.04% / SHUOSHI 1.22% / BUXIAN 0.61%；`experience-distribution` LESS_THAN_5 38.6% / LESS_THAN_3 27.66% / LESS_THAN_10 22.49% / BUXIAN 5.17% / LESS_THAN_1 3.34% / ON_CAMPUS 1.22% / GRADUATING 0.91% / MORE_THAN_10 0.61%；`salary-distribution` <3K 0.61% / 3–6K 3.96% / 6–10K 21.65% / 10–15K 32.01% / 15–25K 32.01% / 25K+ 9.76%；`title-top` Java开发工程师 30.1%（99/329）等 TOP20；`city-distribution` 10 市（广州 329、深圳 252、东莞 27、佛山 27、珠海 24、中山 3、惠州 3、江门 2、汕尾 1、肇庆 1）。
  - 客户端 `mysql`，工具返回 `snapshotDate=2026-10-16`（= 查询日）。**结论：与记录 043/047 及 `references/data/广州-Java后端实习岗位分析.md` 的 2026-09-28/29 数字逐项一致**，该切片在 2026-09-29 → 2026-10-16 继续未漂移。
- 报告产物：`web/server/workspace/sess-20261015-204342-saf8/report.html`（132,618 字节），完整 `<!doctype html>/<html>/<head>/<body>`，h1 后直接进入六个固定 h2；6 张内联 SVG `figure`：`heatmap-chart/CH_CITY`、`stacked-bar-chart/CH_EDU`（学历两口径对照）、`bar-chart/CH_SALARY_INT`、`bar-chart/CH_SALARY`、`bar-chart/CH_EXP`、`bar-chart/CH_TITLE`。
- 本轮口径取舍：薪资改用 `bar-chart`（区间比较）而不是 `histogram-chart`——薪资分桶区间宽度不等（<3/3–6/6–10/10–15/15–25/25+），直方图规则要求“柱宽表达区间宽度”，等宽柱会失真；`bar-chart.md` 明确把“薪资区间”列为适用场景。前两轮用的是直方图标签，属同一数据的另一种呈现。
- 热点图：`registry.json` → 广东省 manifest + `guangdong-city-codes.json` + `guangdong-440000-city.geojson`，21 条地级市边界 path，逐条带 `data-adcode`（六位）与 `data-name`，有记录的城市另带 `data-count`、缺失城市带 `data-count-missing="true"`。本轮用**在招批** `city-distribution`（返回 10 市 = 全部城市，因 limit 20 未截断），故 `totalCount=669` 可得：广州 49.2%、深圳 37.7%、东莞/佛山各 4.0%、珠海 3.6%，其余 5 市各 0.1–0.4%；因已列出全部城市，`otherCount=0`，按契约不加“其他”。实习口径（广州 10/深圳 4）写进图注而不单独成图。
- 展示口径：图表标题/柱标签只写百分比，来源统一“基于千万级岗位数据库统计”，图注保留城市、岗位筛选、实习/在招口径、分母与快照日，实习切片旁保留小样本代表性说明。

## 成本与取舍

- 两批合计约 460s（单条 47–80s），比记录 047 的约 335s 更慢；沿用记录 020 的受控 2 路并行，未提高并发。
- 脚本化生成报告：用临时 Python builder（`/tmp/cg-run/build.py`）把 `geo.json`（由 geojson 投影得到的 21 条 path + 标签坐标）注入 HTML，避免手工粘贴约 98KB 路径数据；builder 与几何脚本只作工作材料，不写入报告、不落仓库。
- 报告从记录 047 的 4 图回到 6 图（把薪资两口径拆开、补经验与岗位名），换取每个口径单一分母；6 张图仍远低于单图 20 点上限。

## 后续扩展路线

- 记录 043/047 遗留：`web/server/lib/htmlReport.ts` 校验本轮**已跑通**（`pass:true`，6 figures，heatmap `present`）；仍待办的是真实浏览器渲染/下载与 Pi 运行历史展示回归。
- 热点图 `data-adcode` 覆盖率校验仍未纳入 `htmlReport.ts`（本轮 21/21 带编码，可考虑做断言）。
- 连跑三轮数字一致，建议对固定地区切片（广州 Java 后端）建快照缓存，避免每次约 8 分钟重复查询（同记录 047 的优化方向）。
- 岗位库实习口径仍只覆盖“岗位名含 Java”，缺“仅写后端/服务端实习”的宽口径复跑；该缺口已在报告正文作为口径限制说明。

## 验证

- 最小结构检查：doctype/html/head/body/`</html>` 均 true；h2 数量 6 且名称与顺序完全匹配固定章节；`data-chart-skill` 计数 6（heatmap/stacked-bar/bar×4）；`<svg>` 计数 6（head 的 `<title>` 使文件内 `<title>` 计数为 7，SVG 内 title/desc 各 6）；`<figcaption>` 计数 6；热点图 figure 精确为 `<figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY">`，含 21 条 `data-adcode`；无 `<script>`、无 base64、无代码围栏、无 `report-meta`/原始 JSON。
- 服务端校验：`esbuild web/server/lib/htmlReport.ts → /tmp/cg-run/htmlReport.mjs`，`validateCompleteHtmlReport(report.html)` 返回 `pass:true`、`errors:[]`、`warnings:[]`、`heatmap.status="present"`、`figureCount=1`。
- 未实测：真实浏览器渲染与下载、Pi 运行历史展示、`data-adcode` 覆盖断言。
