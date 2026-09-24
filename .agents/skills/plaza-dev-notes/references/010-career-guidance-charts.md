# 008 · 就业指导数据图表：结构化规格与前端渲染

- 状态：已实现协议、Skill 约定和运行详情页首版渲染（2026-09-23；真实 career-guidance 会话待回归）。
- 动机：岗位库和产业数据已有可视化价值，但让模型直接输出 HTML/SVG 会引入口径、注入和布局风险；需要让 Agent 选择图表，程序校验边界，前端负责呈现。
- 约定细节：`.agents/skills/career-guidance/SKILL.md` 增加数据图表规则；`references/output-schemas.md` 定义 `report-meta/2.charts` 示例。`web/server/lib/reportMeta.ts` 增加 `MetaChart`，支持 `bar`、`stackedBar`、`histogram`、`line`、`map`，限制单图 20 个数据点、要求 `sourceIds`，并校验折线图横轴字段和地图行政区 `code`。`web/server/index.ts` 只把通过校验的 charts 写入运行记录；`web/src/components/ReportChart.vue` 和 `RunDetailPage.vue` 首版渲染柱状/分布图，其他类型暂以数据列表降级。旧 `report-meta/1` 仍可解析；`report-meta/2` 作为带图表协议。
- 成本与取舍：先把图表作为侧车结构保存，正文只展示关键发现和口径，避免把 JSON 暴露给用户；首版使用无依赖 SVG 风格条形组件，避免引入图表库，line/map 暂时降级为数据列表。被否决方案是让 Agent 输出 SVG/HTML，原因是不可安全校验且难以保证跨页面布局。
- 验证：`cd web && npm run build` 通过。尚未完成真实模型输出、前端图表组件、图表数值与正文一致性回归，均标记为待验证。
- 后续扩展路线：用薪资分布、热门岗位、学历结构三类真实样本回归，再决定引入专用图表库、地图、时间趋势和图片导出。
