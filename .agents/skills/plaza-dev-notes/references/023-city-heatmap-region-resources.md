# 023 · 城市热点图：省内白名单查询、省份资源包与报告校验

**状态**：已实现（2026-09-29；真实数据库广东、浙江报告均已跑通，见验证。原 023（省内白名单查询）与 024（省份资源包泛化）于 2026-10-19 合并，见 076）。

## 动机

城市热点图必须先取得与岗位统计相同筛选口径的跨城市记录，再用有标准编码和离线边界依据的地图展示；查询失败、边界缺失或「其他」总量不可得时都不能静默补图或把缺失误写成 0。单一广东边界文件无法泛化到其他省份，需要按省份注册的资源包。

## 约定细节

- **查询**：`scripts/career-market-query.mjs` 注册 `city-distribution`——只接受 `province`（普通城市 query 仍接受 `city`），默认广东省，`limit` 固定 20；`scripts/career-market-queries/city-distribution.sql` 按 `a.province` 分组 `a.city`，按 count 降序 `LIMIT 20`。关键词、岗位词、实习谓词与现有广州查询共用模板（占位 `{{PROVINCE}}`）。
- **省份资源包**：`chart-visualization/resources/regions/registry.json` 是省份唯一索引；每个 `regions/cn/<provinceCode>/manifest.json` 声明 scope、城市编码映射、GeoJSON、SHA-256、来源与许可状态。当前广东 `440000`（21 城）、浙江 `330000`（11 城；浙江边界为 DataV 离线副本，许可待核实）。`scripts/validate-resources.mjs` 遍历 registry 校验 scope/编码/别名/边界数/SHA-256，支持 `--province` 过滤。**未注册省份不得绘制地图**（chart-visualization 与 career-guidance 的 SKILL.md、`skills.ts`、`piRunner.ts` 同步该前置条件）。
- **热点图契约**：`chart-visualization/references/heatmap-chart.md` 固定 `rows[].code`、`coveredCodes`、`totalCount`、`otherCount`、中性色缺失值与 `CH_CITY`/失败状态块字段。
- **执行链**：中国目标地区先调 `city-distribution(province, limit=20)`，成功输出 `<figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY">`；失败/超时/边界缺失输出「热点图未评估」及原因；没有同口径总量时不能凭空计算「其他」。
- **服务端校验**：`web/server/lib/htmlReport.ts` 校验 figure 的 `data-chart-skill`、CH_CITY、成功 SVG 的 `title/desc/figcaption`，以及 `data-chart-status="unassessed"` 的可读失败原因；`web/server/index.ts` 在 HTML 落盘时记 `recorder.note({htmlReport})` 与 `RunRecord.report.html`，不改写、不阻塞用户报告。

## 成本与取舍

- 采用省份资源包而不是全国单一大 GeoJSON：按需加载、独立校验、独立处理来源许可；不让模型在运行时下载或拼接边界。浙江资源增加约 118 KiB 离线边界与 11 城映射。
- 固定 TOP 20 并沿用并发 2 约束，未增加岗位表索引或统计快照；同口径总量未提供前「其他」标未评估，避免重复全量聚合与虚假汇总。
- 真实会话两次出现 Pi 侧非 ASCII 提示词多字节截断（目标省份显示「��」），Agent 靠工作区标识 `-gd`/`-zj` 正确解析；Pi 侧编码问题待排查。

## 后续扩展路线

- 为同口径总量增加受控来源（total query 或统计快照）后再生成数值「其他」；DataV 许可复核后扩展省份或全国资源。

## 验证（2026-09-29 真实数据库端到端）

- 广东（workspace `sess-heatmap-gd`）：`city-distribution` 约 55s 返回广州/深圳，报告约 118 KiB 通过 `validateCompleteHtmlReport`，含 21 条广东边界 path。
- 浙江（workspace `sess-heatmap-zj`）：约 33s 返回杭州/宁波，报告约 77 KiB 校验 `pass:true`、heatmap `status:present`，含 11 条浙江边界 path。
- 两省均小样本（省内仅 2 城返回数据），报告按小样本口径加「代表性有限」说明；未返回城市以中性色标示缺失。
- `node scripts/validate-resources.mjs` 返回 2/2 省份全部通过；htmlReport 单测与前端构建通过。
