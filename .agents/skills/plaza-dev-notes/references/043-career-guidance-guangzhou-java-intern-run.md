# 043 · 就业指导广场沙箱真实运行：广州 Java 后端实习（内联 SVG 五图 + 城市热点图）

- 状态：已实现观察（2026-10-13 会话 `sess-20261013-170737-ypxk`，报告已落盘并通过最小结构检查）。
- 动机：验证记录 013/015/023/024 定稿的 career-guidance HTML 报告契约（六个固定 h2、内联 SVG、城市热点图、岗位库只读查询）在真实任务（广州 · Java 后端实习 · 在校找实习 · 无附件简历）下能否一次跑通，并沉淀本轮岗位库快照。

## 约定细节

- 任务输入：目标岗位 Java 后端实习，地区广州，每周可投入 5–10 小时，匿名经历为「计算机相关专业 + Spring Boot 校园二手交易平台，负责接口设计与 MySQL 建模，无实习」；`uploads/` 不存在，无简历附件，简历改写基于用户材料而非虚构。
- 岗位库查询（`scripts/career-market-query.mjs`，白名单 queryId，无原始 SQL）：
  - 城市：广州市；岗位名谓词 `name LIKE '%Java%'` AND (`后端` OR `服务端` OR `开发`)；在招 `publish_state='PUBLISHING' AND deleted=0`；实习谓词 `name LIKE '%实习%' OR LOWER(name) LIKE '%intern%' OR experience IN ('GRADUATING','ON_CAMPUS')`。
  - 实习口径并行批（7 条，约 194s）：`cohort-summary` 样本 10（本科及以上 10、大专/高职 0、在校/应届 7、经验不限 3、有效薪资 10）；`education-distribution` BENKE 10（100%）；`experience-distribution` ON_CAMPUS 40% / GRADUATING 30% / BUXIAN 30%；`salary-distribution` <3K 20% / 3–6K 40% / 6–10K 10% / 10–15K 10% / 15–25K 20%；`title-top` 7 个岗位名（java开发工程师 30%、Java开发实习生 20%、其余各 10%）；`source-distribution` (NULL) 70% / 前程无忧 30%；`city-distribution`（province=广东省、internship=true）广州 10、深圳 4。
  - 在招口径并行批（3 条，约 96s）：`cohort-summary` 样本 329（本科及以上 276、大专/高职 41、有效薪资 328）；`education-distribution` BENKE 82.7% / DAZHUAN 12.5% / CHUZHONGJIYIXIA 3.0% / SHUOSHI 1.2% / BUXIAN 0.6%；`salary-distribution` 6–10K 21.7% / 10–15K 32.0% / 15–25K 32.0% / 25K+ 9.8% / 3–6K 4.0% / <3K 0.6%。
  - 所有批次 `ok:true`，`failed:[]`，客户端 `mysql`，库内快照 `snapshotDate=2026-10-13`；结果与 `references/data/广州-Java后端实习岗位分析.md` 的 2026-09-28/29 数字一致（实习样本 10、本科 100%、在招 329/83.9%）。
- 报告产物：`workspace/sess-20261013-170737-ypxk/report.html`（约 136 KiB），完整 `<!doctype html>/<html>/<head>/<body>`，h1 后直接进入六个固定 h2；5 张内联 SVG `figure`：`heatmap-chart/CH_CITY`、`stacked-bar-chart/CH_EDU`、`histogram-chart/CH_SALARY_INT`、`histogram-chart/CH_SALARY_ALL`、`bar-chart/CH_TITLE`，每图含 title/desc/figcaption/来源与口径。
- 热点图：读取 `chart-visualization/resources/regions/registry.json` → 广东省 manifest + `administrative-codes/guangdong-city-codes.json` + `boundaries/guangdong-440000-city.geojson`，按六位 adcode 关联，渲染 21 条地级市边界 path；广州 10（深色）、深圳 4、其余城市中性色表示「未返回数据（缺失，非 0）」；`city-distribution` 未提供同口径跨城总量，报告按要求把「其他」标为未评估，未生成数值「其他」。
- 展示口径：全部图表标题/图例只写百分比与排序，不写 `n=10`，来源统一写「基于千万级岗位数据库统计」，实习小样本旁标注「筛选结果较少，仅代表库内结构，代表性有限」，图注保留城市、岗位筛选、实习/在招口径与快照日。

## 成本与取舍

- 查询两批并行共约 290s（单查询约 34–54s），未新增索引或统计快照；沿用记录 020 的 2 路受控并行，未把两套口径混在同一分母。
- 保留六章固定结构 + 内联 SVG 方案，未回退到表格或旧 `report-meta/2.charts`；绝对条数只留在本记录与内部数据文档，用户正文不出现。
- 热点图按记录 023 的取舍继续不生成数值「其他」；非返回城市用中性色，避免把缺失误写为 0。

## 后续扩展路线

- 复核 `report.html` 是否通过 `web/server/lib/htmlReport.ts` 的 `data-chart-skill`/`CH_CITY`/title-desc-figcaption 校验并在浏览器中正常渲染（本轮只做了最小存在性与结构自检，未跑服务端校验）。
- 补齐「仅写后端/服务端实习而不含 Java」的宽口径复跑，修正实习样本偏低估；该缺口在报告正文已作为口径限制说明。
- 关注单次两批查询约 290s 的耗时是否影响真实会话超时；若需要，先基于记录 017 的 EXPLAIN 评估索引或城市统计快照。
- 本轮为 Pi 会话（`sess-20261013-170737-ypxk`），可与记录 025 的 trace 展示链路一起回归真实运行历史展示。

## 验证

- 报告写入后最小结构检查：doctype/html/head/body 均为 true；h2 数量 6 且名称与顺序完全匹配固定章节；`data-chart-skill` 计数 5（heatmap-chart/stacked-bar-chart/histogram-chart×2/bar-chart）；`<svg>` 数 = `<title id=>` 数 = `<desc id=>` 数 = 5；热点图 figure 精确为 `<figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY">` 且含 21 条城市边界 path（广州 data-count=10、深圳 data-count=4）；无 `data-chart-status`、无代码围栏、无 `report-meta`/原始 JSON。
- 未实测：服务端 `htmlReport.ts` 校验、真实浏览器渲染与下载、Pi 运行历史展示（待后续回归）。
