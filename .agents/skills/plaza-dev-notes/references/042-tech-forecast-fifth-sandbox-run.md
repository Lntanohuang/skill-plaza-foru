# 042 · tech-forecast 第五次广场沙箱运行（快照+高职切片补查稳定复用、四图报告）

**状态**：已实现观察（2026-10-13 广东省 AI/大模型 + 具身智能与机器人高职预判会话 `sess-20261013-164624-kpub`）。报告已写入 `web/server/workspace/sess-20261013-164624-kpub/report.html`（UTF-8 31,879 字节）。报告的 `parseReport` 链路回归仍待验证（同 035/037/039/040/041）。

**动机**：041 落地 `references/data/` 快照层并首次引用（第四次运行）。本次第五次运行在同一任务参数（广东省、AI+机器人、1–3 年、高职、软件技术/工业机器人技术专业群）下复现该链路，验证“快照优先 + 高职对口切片实时补查”的稳定性，并确认 041 记录的高职切片结论可跨会话复用。

## 约定细节

### 会话与查询（与 041 对照）
- 快照直接引用：`guangdong-ai.md`、`guangdong-robotics.md`（快照日期 2026-10-13），覆盖新兴 vs 对照的省级城市分布与广州/深圳薪资·学历·经验横截面（AI＝大模型 vs Java/软件测试；机器人＝机器人 vs 数控）。
- 实时补查（每批 8 条，`--parallel`，内部并发 2，整批 209s / 221s）：沿用 041 已固化的两个高职对口切片——①`keywords=["机器人"]` + `roleTerms=["运维","调试","集成","应用"]`；②`keywords=["数据标注"]` + `roleTerms=["标注","数据","质检","人工智能","AI"]`，城市广州+深圳，queryId 为 `title-top`/`salary-distribution`/`education-distribution`/`experience-distribution`。16 条全部 `ok:true`。
- **复现结果与 041 一致**：机器人调试/应用切片大专占比广州 59.09% / 深圳 48.65%（041 为 60.29% / 48.68%，差异来自本次 roleTerms 为“运维/调试/集成/应用”，041 另含“实施”）；广州 3 年以内经验 71.21%；深圳薪资 10–15K 占 37.84%。数据标注切片广州大专 43.06% / 深圳 35.58%，广州、深圳岗位名榜首均为“数据标注/AI训练师”。→ 结论：该切片口径可作为可复用基线，**在报告口径写明 roleTerms 后跨会话稳定**。

### 报告产物与结构
- 产物：`web/server/workspace/sess-20261013-164624-kpub/report.html`；7 个 `<h2>` 与 `TECH_FORECAST_REPORT_SECTIONS`（`web/server/lib/skills.ts:62-70`）精确一致且顺序一致。
- 4 个 figure：`radar-chart CH_RADAR_TECH`（两方向×5 维，图下同数据评分表）、`sankey-chart CH_SANKEY_SKILL`（5 传统技能→7 新兴技能、8 条连线，带宽＝强 3/中 1.5 相对单位）、`bar-chart CH_BAR_SALARY`（机器人调试/应用月薪分桶，广州 vs 深圳）、`stacked-bar-chart CH_STACK_EDU`（4 组学历构成）。全部有 `data-chart-skill`+`data-chart-id`+`<figcaption>`+内联 `<svg viewBox>`+`<title>`/`<desc>`；无 `<script>`、无 Base64、无外链。
- 最小结构校验脚本（正则级）：h2 序列一致、doctype/html/head/body/`</html>` 齐全、每 figure 4 项附件齐全、无 script/base64 → 全部通过。未运行 `validateCompleteHtmlReport`（本轮只做最小存在性/结构检查，未读取全文）。

### 公开来源（本次可引用）
- 《国务院关于深入实施“人工智能+”行动的意见》（国发〔2025〕11号），中国政府网，2025-08-26（`--fetch` 正文成功，URL 形如 `gov.cn/zhengce/content/202508/content_7037861.htm`）。
- 2026 世界人工智能大会主旨讲话（全文），中国政府网（来源新华社），2026-07-17（`--fetch` 正文成功，`gov.cn/yaowen/liebiao/202607/content_7075874.htm`）。
- 《什么是“具身智能”？和人形机器人有什么关系？》，新华网，2025-10-23。
- 《Future of Jobs Report 2025》，World Economic Forum（weforum.org），2025-01-07（英文交叉印证唯一可用来源）。
- 《教育强国建设规划纲要（2024—2035年）》相关报道，求是网，2025-01-20。

## 成本与取舍

- **快照 + 固定两切片补查已成为本组合的稳定工作流**：本次 16 条补查约 7 分钟，加 4 次检索/抓取，端到端仍明显短于 035/037 的实时全量查询。**未再复现**“只引用快照不补查”的否决方案——快照 roleTerms 固定为 `["后端","服务端","开发"]`，机器人域仍被收窄成软件岗，高职对口的运维/调试/标注岗位必须补查。
- **检索相关性波动持续存在**（同 038/039/041）：英文查询（LLM hiring demand、robotics technician workforce、IFR World Robotics）几乎全部返回无关页；可用命中来自“人工智能 训练师 数据标注 新职业 人力资源”“工信部 人形机器人 创新发展”等中文长查询，以及直接 `--fetch` 已知 URL。本次英文交叉印证仅取得 WEF Future of Jobs 一条，第七章显式标注该缺口，未编造来源。
- **图数从 6 降为 4**：快照已承担新兴 vs 对照横截面，图表只保留“必须的雷达+桑基”与两张高职切片图（薪资分桶、学历构成），其余对比用表格呈现，降低坐标维护成本。若后续图数回升，恢复 041 记录的脚本生成方案。

## 后续扩展路线

- 同 041：把高职对口切片（`机器人`+运维/调试/集成/应用/实施；`数据标注`）预聚合进 `references/data/`，并在 README 增列每切片 `roleTerms`，即可消除本次 16 条补查。
- `web-search.mjs` 相关性过滤/重试仍未实现；建议在 tech-forecast 检索纪律补“结果无关时按未评估处理”的显式降级路径（本会话沿用该做法）。
- 回填 `validateCompleteHtmlReport(html,{heatmapChecks:false})` 与 `parseReport` 对 HTML 报告的实测结果（本次未跑）。
