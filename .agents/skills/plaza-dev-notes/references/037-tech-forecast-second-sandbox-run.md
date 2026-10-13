# 037 · tech-forecast 第二次广场沙箱运行（省级口径复现、任务提示与工具可用性矛盾）

**状态**：已实现观察（2026-10-13 广东省 AI/大模型 + 工业机器人高职预判会话 `sess-20261013-112006-oi1j`）。报告校验通过；`parseReport` 链路回归仍待验证。

**动机**：035 记录了首次 tech-forecast 沙箱运行。本次为第二次同类任务（广东省 / 人工智能与大模型应用 / 1–3 年 / 高职 / 软件技术+工业机器人技术），用于确认 035 的省级查询组合能否稳定复现，并记录一个会影响后续提示词与沙箱声明的事实：任务提示把参考知识库描述为“前端 Mock 演示，本次运行未实际接入”，但岗位库在注入凭据后实际可用。

## 约定细节

### 复现 035 的省级口径
- 沙箱 `AGENTS.md` 仍只有通用“会话沙箱 / uploads”说明，**没有** `scripts/career-market-query.mjs` 工具节；`web/.env` 的 `MYSQL_*` 仍为注释，`mysqlConfigured()` 为假。与 034/035 完全一致，跨 Skill 取凭据的隐式依赖**未消除**。
- 以进程环境注入 `MYSQL_HOST=192.168.8.1 / PORT=3908 / USER=tringai_read / DATABASE=ai_crowd_souring_extend`（凭据取自 `career-guidance/references/data/岗位库数据源.md` 第 1 节），`node scripts/mysql-query.mjs "SELECT 1"` 连通性 38ms 通过。
- 共执行 7 批 14 条白名单查询（`--parallel` 每次 2 条，单条 65–83s）：`city-distribution`（province=广东省）2 条；`title-top` 深圳/广州/东莞 + `salary-distribution`/`education-distribution`/`experience-distribution` 12 条。全部 `ok:true`。
- **035 的省级结论再次成立**：只有 `city-distribution` 支持 `province`，其余模板按 `a.city` 过滤；“广东省”必须用「省级城市分布 + 城市切片（深圳/广州/东莞）」组合表达。关键词之间 AND、roleTerms 之间 OR 的谓词语义未变。
- 本次省级城市分布：大模型切片深圳 65.6%、广州 21.8%（返回 14 城）；机器人切片深圳 55.2%、广州 33.6%（返回 10 城）。两者均截断/限定于返回城市，报告未把“其他城市”表述为全省剩余。

### 报告产物与校验
- 产物：`web/server/workspace/sess-20261013-112006-oi1j/report.html`，UTF-8 53,735 字节。
- 服务端真实校验器 `validateCompleteHtmlReport(html, { heatmapChecks: false })` → `pass: true`、`errors: []`、`warnings: []`；`figures` 识别到 4 个：`radar-chart CH_RADAR_TECH`、`bar-chart CH_BAR_CITY`、`sankey-chart CH_SANKEY_SKILL`、`stacked-bar-chart CH_STACK_SALARY`。
- 七个 `<h2>` 与 `TECH_FORECAST_REPORT_SECTIONS`（`web/server/lib/skills.ts:62-70`）逐一精确一致；无外部图表库、无 `<script>`、无 Base64、无外链（正则扫描计数为 0）。
- 生成方式沿用 035：SVG 几何（雷达多边形、桑基贝塞尔带、柱/堆叠坐标）由一次性脚本 `/tmp/gen-tf.mjs` 计算写入，不在 `write` 调用里手拼坐标。本次新增 `bar-chart`（省级城市集中度）与 `stacked-bar-chart`（三关键词切片月薪分桶）两张辅助图。
- 证据分级落地：预测字段逐项标 `库内实测 / 内置文档 / 分析推断`；薪资只给区间+口径；无月度序列处一律“趋势未评估”，未写增长百分比。

## 成本与取舍

- **新增事实（本次要记录的重点）**：任务提示词模板写着“参考知识库（前端 Mock 演示，本次运行未实际接入）”，但岗位库查询工具在手动注入凭据后可正常返回真实数据。提示词与真实能力不一致：若 Agent 严格按提示词理解为“无库可用”，会退化成通用行业常识、把岗位名与薪资标成“未评估”，浪费真实可用的实测层。建议后续在 `firstTurnRules`/任务模板中把“知识库”区分为「前端演示数据（可能未接入）」与「岗位库只读查询（凭据就绪时可用）」两类，或在沙箱声明工具节时同步修正文案。
- 复现确认：**不再重复否决方案**（手写 SVG 坐标、把“广东省”当 `city` 传参），结论同 035。
- 接受限制：城际分布图分母只含返回城市；`title-top` 命中的“大模型算法”疑似聚合岗位名（深圳 877 条）已在报告第七章列为待核实项，未据此估算占比。

## 后续扩展路线

- 合并 034/035/037：让 `sandboxAgentsMd()` 在 `mysqlConfigured()` 为假但本地存在凭据时，也为 tech-forecast / career-guidance 会话声明岗位库工具节，消除跨 Skill 取凭据与“Mock 未接入”文案的双重误导。
- 提示词侧：把岗位库能力声明与“前端演示数据”解耦（对应 011/027 的用户输出边界）。
- 白名单候选：`title-trend`（月度岗位计数）与 `skill-keyword-count`，用于把当前“趋势未评估”升级为可追溯序列。
