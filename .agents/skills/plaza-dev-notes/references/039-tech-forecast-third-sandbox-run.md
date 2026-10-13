# 039 · tech-forecast 第三次广场沙箱运行（roleTerms 上限、检索降级、横截面证据落地）

**状态**：已实现观察（2026-10-13 广东省 AI/大模型 + 工业机器人高职预判会话 `sess-20261013-142147-m2o0`）。报告校验通过；`parseReport` 链路回归仍待验证。

**动机**：035/037/038 之后第三次同类 tech-forecast 沙箱运行，任务与 037 几乎相同（广东省 / 人工智能与大模型应用 / 1–3 年 / 高职 / 软件技术+工业机器人技术）。本轮首次按 038 的 v2 证据链完整执行“岗位库横截面对比 + 联网检索”，因此重点记录 v2 落地时暴露的两个可复用约束（roleTerms 上限、检索源降级）和一份可复用的广东横截面基线。

## 约定细节

### 沙箱与工具
- 沙箱 `AGENTS.md` 同时含「联网检索工具」与「MySQL 只读查询工具」两节，且工具节直接给出 `scripts/career-market-query.mjs` / `scripts/web-search.mjs` 的绝对路径；**无需再跨 Skill 取凭据**，038 的凭据修复（`web/.env` MYSQL_* + 沙箱注入）在本轮生效。034/035/037 的隐式依赖问题在本轮未复现。
- **新事实（本轮要点）**：沙箱工作区内**没有** `.agents/` 目录，但 `AGENTS.md` 仍写“先读取工作区 .agents/skills/chart-visualization/resources/regions/registry.json”。实际共享图表 Skill 位于仓库根 `.agents/skills/chart-visualization/`（`SKILL.md` + `references/{radar,sankey,bar,stacked-bar,common-rules}.md` + `resources/regions/registry.json`）。沙箱提示词里的“工作区 .agents/...”路径与真实位置不一致，Agent 需回退到仓库根路径；建议后续把沙箱文案改为“仓库共享 chart-visualization Skill”。
- 省级口径与 035/037 一致：仅 `city-distribution` 支持 `province`，其余模板按 `a.city` 过滤；“广东省”用「省级城市分布 + 深圳/广州城市切片」表达，不得直接当 `city` 传入。

### roleTerms 上限（本轮踩坑）
- `scripts/career-market-query.mjs` 的 `validateParams` 对 `roleTerms` 校验为 **1–8 个**（`keywords` 同为 1–8）。首次尝试给 AI 切片传 9 个 roleTerms（开发/工程师/算法/应用/运维/数据/测试/产品/运营）直接 `ok:false`（“roleTerms 必须为 1-8 个字符串”），需裁剪到 8 个后重跑。
- `roleTerms` 未显式传入时**默认为 `["后端","服务端","开发"]`**。对“机器人”“大模型”这类宽域，若沿用默认会把结果收窄到软件研发岗（如“机器人”只剩软件/算法类），与“运维/调试/集成”岗位族不符。本轮对同一技术域的新兴切片与对照切片使用**同一组 roleTerms**（AI：开发/工程师/算法/应用/运维/数据/测试/运营；机器人：工程师/运维/调试/集成/开发/操作/应用/装调），以保证横截面可比。该约定未写进 `technology-snapshots.md` 的标准关键词表（表里只有 keywords），是后续应补的文档缺口。

### 岗位库横截面基线（库内实测，快照 2026-10-13）
- 省级城市分布（roleTerms 如上）：`大模型` 深圳 65.63%、广州 21.77%（返回 14 城，深圳+广州 87.4%）；`机器人` 深圳 54.65%、广州 33.38%（返回 11 城，深圳+广州 88.0%）；`数控` 广州 67/深圳 43/佛山 29/东莞 28。
- 深圳切片（新兴 vs 传统对照）：
  - `大模型`：大专及以下 1.75%、本科 54.41%、硕博 41.80%；月薪 25K+ 54.21%、15–25K 17.84%；经验 3–5 年 45.59%。
  - `Java`：大专及以下 16.08%、本科 81.70%；月薪 10–15K 36.91%、15–25K 32.81%。
  - `机器人`：大专及以下 18.18%、本科 60.82%；月薪 25K+ 40.56%、15–25K 26.06%（15K 以上合计 66.62%）；应届+在校 7.04%。
  - `数控`：大专及以下 55.82%、本科 9.30%；月薪 6–10K 46.51%（15K 以上仅 16.28%）。
- 结论性观察（可复用）：AI 大模型方向“薪资溢价明显但学历门槛高”，不适合高职直接对标算法岗；机器人方向“薪资溢价明显且大专/应届可切入”，是工业机器人技术专业的优先方向。岗位名 `大模型算法`（深圳 877、广州 250）疑似平台聚合条目，报告中列为待核实项，未据此估算占比。

### 联网检索现状
- `web-search.mjs --fetch` 对中国政府网（`www.gov.cn` 国务院“人工智能+”行动意见，国发〔2025〕11 号）、广东省人民政府门户网站（`www.gd.gov.cn`）正文抓取**正常**。
- 但 `--query` 在本轮网络下**大面积降级**：多个多词中文查询（如“工业机器人 运维 人才缺口 2026”“广东 具身智能 机器人 产业 政策 2026”“智能制造 技能人才 缺口 报告 2026”）与英文查询（“LLM hiring demand report 2026”“World Economic Forum Future of Jobs Report 2025”）返回与主题无关的结果（小说、影视、商品、纯名词百科）。仅“大模型 人才需求 报告 2026”“人工智能训练师 标准”等少数短查询返回可用条目。可用的公开来源最终只有三个：①国务院“人工智能+”行动意见；②gd.gov.cn 要闻；③《人工智能训练师国家职业技能标准（2021 年版）》的多篇二手引用（未直连官方原文）。报告对检索失败项显式标注“公开来源未检索”，未编造报道。
- 风险判断：038 修好的 `ensearch=1` 反爬形态可能存在**时间/频次敏感**，或该网络出口触发了 Bing 的降级返回。建议后续为 `web-search.mjs` 增加可用性自检（如对固定查询断言结果与关键词相关）与失败重试/换源。

### 报告产物与校验
- 产物：`web/server/workspace/sess-20261013-142147-m2o0/report.html`，UTF-8 47,725 字节；生成方式为一次性脚本 `/tmp/gen-tf.mjs` 计算雷达多边形、桑基贝塞尔带、分组柱/堆叠柱坐标后写出，不在 `write` 中手拼坐标。
- 结构自检（等价 `validateCompleteHtmlReport(html,{heatmapChecks:false})` 的正则集合）：`<!doctype html>`/`<html>`/`<head>`/`<body>`/`</html>` 齐全；7 个 `<h2>` 与 `TECH_FORECAST_REPORT_SECTIONS` 精确一致；4 个 figure 全部有 `data-chart-skill` + `<figcaption>` + 内联 `<svg>` + `<title>`/`<desc>`（`radar-chart CH_RADAR_TECH`、`bar-chart CH_BAR_CITY`、`sankey-chart CH_SANKEY_SKILL`、`stacked-bar-chart CH_STACK_EDU`）；无 `<script>`、无 `data:image`、无外链；无 NaN/undefined。
- 图表章节归属（本轮约定）：雷达图在第二章；城市分布 bar-chart 放第二章（作为“产业影响力”侧证）；桑基图在第三章；学历堆叠柱放第四章（作为岗位门槛的横截面证据）。**不把补充图放第七章**，第七章只承载口径、推断分级、未评估项与三项待核实问题。

## 成本与取舍

- 接受 roleTerms 8 个上限：为本域设计一组固定 roleTerms 并明确写入报告第七章口径，换取横截面可比；否决“省略 roleTerms 用默认值”的方案（默认 `后端/服务端/开发` 会把机器人域收窄成软件岗，证据失真）。
- 接受检索降级：公开来源层证据薄，趋势列主要退化为“分析推断 + 验证办法”；未因检索失败而编造报道或百分比。
- 复现确认：不再重复 035/037 已否決的方案（手写 SVG 坐标、把“广东省”当 `city` 传参）；本轮新增否決：把 bar/stacked 辅助图放第七章。

## 后续扩展路线

- `technology-snapshots.md` 的标准关键词表补一列“建议 roleTerms”（或明确“roleTerms 上限 8、缺省有默认值”），消除每次运行重新设计 roleTerms 的口径漂移。
- `web-search.mjs` 增加结果相关性自检与换源/重试；若持续降级，评估改用官方站点站内检索或 RSS。
- 沙箱 `AGENTS.md` 把“工作区 .agents/skills/chart-visualization/...”修正为仓库根共享路径（或把共享 Skill 同步进沙箱）。
- `parseReport` 对 HTML 报告的链路仍待回归（同 035/037）。
