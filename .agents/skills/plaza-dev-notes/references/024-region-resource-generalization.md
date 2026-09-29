# 024 · 城市热点图省份资源包泛化与 Pi 双省验证

- 状态：已实现资源泛化（2026-09-29；真实数据库广东、浙江报告均已跑通，见验证）。
- 动机：`city-distribution` 查询参数已经可以接收省份，但单一广东边界文件会使其他省份无法安全绘图；需要把行政区映射、边界、来源和校验变成按省份注册的资源包，再用 Pi + career-guidance 验证广东和浙江的分支。
- 约定细节：
  - `.agents/skills/chart-visualization/resources/regions/registry.json` 是省份唯一索引；每个 `regions/cn/<provinceCode>/manifest.json` 声明 scope、城市编码映射、GeoJSON、SHA-256、来源和许可状态。当前资源包为广东 `440000`（21 城）和浙江 `330000`（11 城）；浙江边界来自 DataV 离线副本，许可待核实。
  - `scripts/validate-resources.mjs` 已改为遍历 registry，校验 manifest scope、六位编码、城市别名、GeoJSON parent 编码、边界数量和 SHA-256，并支持 `--province=广东省|浙江省|330000`。
  - `.agents/skills/chart-visualization/SKILL.md` 与 `references/heatmap-chart.md` 要求先解析 registry/manifest；未注册省份不得绘制地图。`.agents/skills/career-guidance/SKILL.md`、`web/server/lib/skills.ts`、`web/server/lib/piRunner.ts` 同步该前置条件。
  - Pi 验证使用临时 `PI_CODING_AGENT_DIR` 和隔离 fixture 工作区；广东成功展开 career-guidance 与 chart-visualization Skill、命中 `city-distribution` 指令并生成 `/private/tmp/pi-heatmap-validation/guangdong.report.html`，服务端 HTML 校验通过。浙江运行按用户要求停止，未宣称生成浙江报告。当时真实岗位库两省调用均返回 MySQL `ERROR 2003`，因此 fixture 报告不代表真实数据验收。
  - 2026-09-29 后续在真实 Pi 会话（workspace `sess-heatmap-gd`）中，岗位库恢复可达：广东真实 `city-distribution` 返回广州/深圳 2 城，报告成功生成含 21 条广东边界 path 的 `CH_CITY` 热点图并通过服务端校验。该次输入的目标省份在 Pi 消息中显示为乱码“��”，Agent 依据工作区标识 `-gd` 解析为广东省；建议后续核实 Pi 侧非 ASCII 提示词在多字节截断时是否有编码丢失。
- 成本与取舍：采用省份资源包而不是全国单一大 GeoJSON，便于按需加载、独立校验和处理来源许可；没有让模型在运行时下载或拼接边界。当前“其他”仍要求同口径总量，避免由 TOP 20 结果臆造。浙江资源增加约 118 KiB 离线边界和一套 11 城映射。
- 验证：`node scripts/validate-resources.mjs` 返回 2/2；广东 21/21/42、浙江 11/11/22；两个省份过滤校验均通过；Pi auth check 返回 ready；广东 Pi Skill 展开与 fixture HTML 生成通过，`htmlReport` 校验为 pass；浙江 Pi 运行已停止；既有 HTML 校验测试和前端构建保持通过。2026-09-29 真实数据库广东报告（`sess-heatmap-gd`）query 成功、离线边界匹配、`CH_CITY` 生成与服务端校验通过；浙江真实报告仍未跑。
- 2026-09-29 后续在真实 Pi 会话（workspace `sess-heatmap-zj`）中完成浙江真实报告：同一乱码“��”输入按工作区标识 `-zj` 解析为浙江省。`city-distribution`（`province=浙江省`、`keywords=[Java]`、`roleTerms=[后端,服务端,开发]`、`internship=true`、`limit=20`）约 33s 返回杭州、宁波 2 城；同口径 `cohort-summary`/`education-distribution`/`experience-distribution`/`salary-distribution`/`title-top`/`source-distribution`（`city=杭州市`）并行批次约 136s 全部成功。报告写入 `report.html`（约 77 KiB），含 `data-chart-skill="heatmap-chart" data-chart-id="CH_CITY"` 与 11 条浙江城市边界 path，另有 `CH_EDU`/`CH_EXP`/`CH_SAL`/`CH_TITLE` 四张柱状图和内联 SVG；`validateCompleteHtmlReport` 返回 `pass:true` 且 heatmap `status:present`。注意：浙江批次未取得同口径总量，报告未生成数值“其他”，未返回城市以中性色标示缺失。
- 后续扩展路线：广东、浙江真实报告均已在各自会话会话验证，待补充同口径 total query 或统计快照以生成数值“其他”；完成 DataV 许可复核后再增加其他省份；顺带排查 Pi 侧非 ASCII 提示词多字节截断的编码丢失问题。
