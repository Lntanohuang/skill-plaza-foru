# 035 · tech-forecast 广场沙箱首次端到端运行观察

**状态**：已实现观察（2026-10-12 广东省 AI/机器人高职预判会话）。`parseReport` 链路回归待验证。

**动机**：`tech-forecast`（新岗位·新技术预判）此前只有协议与 Skill 约定，没有一次真实会话记录它的图表生成方式、岗位库查询可行性与报告校验结果。本次在广场沙箱 `sess-20261012-164229-gl49` 实跑，沉淀可复用的接入点与踩坑。

## 约定细节

### 会话与输入
- 目标：广东省；技术领域=人工智能与大模型应用、具身智能与机器人；窗口=未来 1–3 年；院校=高职；专业群=软件技术、工业机器人技术。
- 沙箱 `AGENTS.md` 只含通用“会话沙箱 / uploads”说明，**没有** `scripts/career-market-query.mjs` 工具节；`web/.env:53-57` 的 `MYSQL_*` 仍全部为注释（与 034 完全一致）。`mysqlConfigured()`（`web/server/index.ts:100`）在服务端为假，因此沙箱未注入工具节。

### 岗位库查询（库内实测层）
- 复现方式：以进程环境注入 `MYSQL_HOST=192.168.8.1 / PORT=3908 / USER=tringai_read / PASSWORD / DATABASE=ai_crowd_souring_extend`（值同 `career-guidance/references/data/岗位库数据源.md` 第 1 节），执行 `node scripts/career-market-query.mjs --parallel '[...]'`；白名单 queryId 与 `--parallel` 上限 2 未被改动。
- 本会话共执行 21 条白名单查询（外加 1 条 `SELECT 1` 连通性探测），全部 `ok:true`：`city-distribution`（province=广东省）2 条；深圳/广州的 `title-top`、`salary-distribution`、`education-distribution`、`experience-distribution` 共 19 条。单条全表聚合 39–70s。
- **关键限制（本次实测确认）**：白名单里只有 `city-distribution` 支持 `province`（`scripts/career-market-queries/city-distribution.sql`：`a.province = {{PROVINCE}}`）；其余模板都按 `a.city` 过滤。因此“广东省”这一地区粒度只能通过「`city-distribution` 做省级城市排序 + 对深圳/广州做城市切片」组合表达，不能把“广东省”直接当 `city` 传入（`a.city='广东省'` 必空）。
- 关键词谓词语义：`--parallel`/`--query` 的 `keywords` 之间是 **AND**，`roleTerms` 之间是 **OR**，再整体 AND（`scripts/career-market-query.mjs` 的 `TITLE_PREDICATE`）。故“大模型”这类宽域只能用单关键词 + 较宽 `roleTerms`，不能把多个并列行业词塞进 `keywords`。
- `city-distribution` 对“机器人”这类大域会截断于前 20 城，报告里“其他城市”只能表示“已返回城市合计”，不能当作全省总量；

### 报告产物与校验
- 产物路径：`web/server/workspace/sess-20261012-164229-gl49/report.html`，UTF-8 66,091 字节（HTML 字符串 46k 字符）。
- 用服务端真实校验器核对：`validateCompleteHtmlReport(html, { heatmapChecks: false })` → `pass: true`，`errors: []`，`warnings: []`。tech-forecast 的契约在 `web/server/lib/skills.ts:119` 明确 `heatmapChecks: false`（无 CH_CITY 热点图要求）。
- 章节：7 个 `<h2>` 与 `TECH_FORECAST_REPORT_SECTIONS`（`web/server/lib/skills.ts:62-70`）逐一精确一致、顺序一致。
- 图表（均为 `data-chart-skill` 内联 SVG，无 JS/外部库/Base64）：`radar-chart`（技术成熟度，5 维 × 4 技术，单图 4 多边形达上限）、`sankey-chart`（6 来源 × 12 目标 = 18 节点，≤20）、2×`bar-chart`（大模型/机器人省级城市分布）、2×`stacked-bar-chart`（学历构成、月薪分桶构成）。雷达图与同数据评分表并存；桑基图图注写明“流量为分析推断（内置文档）”及强度→宽度的映射。
- 生成方式：SVG 几何（雷达多边形、桑基贝塞尔路径、柱状坐标）由本地一次性生成脚本 `/tmp/gen-tf.mjs` 计算后写入 `report.html`，不手工在 `write` 工具里拼坐标。

### 证据分级落地
- 预测字段逐项标注 `库内实测 / 内置文档 / 分析推断`；预计薪资只给区间并写“该技术方向切片月薪分桶，非单一岗位分位”的口径。
- 无真实月度序列，所有“增长趋势”只作定性判断，不写百分比；未单独查询的切片薪资（AI 数据标注、具身智能）如实标 `未评估` 并写入第七章。

## 成本与取舍

- **否决：直接手写 SVG 坐标**——雷达 4 多边形 × 5 维、桑基 18 节点 12 连线，手写易错且难校验；改为一次性生成脚本，产物仍是纯静态 HTML。
- **否决：把“广东省”作为 `city` 参数传入普通查询**——模板按 `a.city` 等值过滤，必然零结果；应使用 `city-distribution` 的 `province` + 城市切片。
- **已知限制（本次接受）**：沙箱未声明岗位库工具，Agent 需从 `career-guidance` 数据文档取凭据自行注入环境，属于跨 Skill 隐式依赖；`parseReport`（`web/server/lib/reportParse.ts`）对 HTML 产物不适用，仍待确认服务端最终读取链路。

## 后续扩展路线

- 若 tech-forecast 成为常用技能，建议让 `sandboxAgentsMd()` 在 `mysqlConfigured()` 为假但本地存在凭据时，也为 tech-forecast 会话声明一次岗位库工具节，消除跨 Skill 取凭据的隐式依赖（与 034 的结论合并处理）。
- 白名单可考虑新增 `industry-chain-top`（按 `c_position_chain`）以支持“产业链 → 岗位”分析，现模板无法直接查询产业链维度。
- 可预置“省内城市 + 分母口径”的通用 bar/stacked 图模板，减少每次运行重复阐述“其他城市”与分母定义的成本。
- `parseReport` 的六级统计口径基于 Markdown 标记（`· fact` 等），与 HTML 报告技能不匹配；后续可评估为 HTML 报告技能增加结构化 sidecar（参见 001/027）。
