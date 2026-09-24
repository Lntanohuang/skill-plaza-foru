# 008 · 就业指导数据图表：结构化规格与前端渲染

- 状态：已实现协议、Skill 约定和运行详情页首版渲染（2026-09-23；真实 career-guidance 会话待回归）。
- 动机：岗位库和产业数据已有可视化价值，但让模型直接输出 HTML/SVG 会引入口径、注入和布局风险；需要让 Agent 选择图表，程序校验边界，前端负责呈现。
- 约定细节：`.agents/skills/career-guidance/SKILL.md` 增加数据图表规则；`references/output-schemas.md` 定义 `report-meta/2.charts` 示例。`web/server/lib/reportMeta.ts` 增加 `MetaChart`，支持 `bar`、`stackedBar`、`histogram`、`line`、`map`，限制单图 20 个数据点、要求 `sourceIds`，并校验折线图横轴字段和地图行政区 `code`。`web/server/index.ts` 只把通过校验的 charts 写入运行记录，并随 SSE `done` 事件传给在线报告区；`web/src/components/ReportChart.vue` 使用 ECharts 6 渲染柱状图、分布图和折线图，首次出现时动态加载 ECharts，地图暂以提示降级；`RunDetailPage.vue` 和 `UsePage.vue` 都展示图表和口径。旧 `report-meta/1` 仍可解析；`report-meta/2` 作为带图表协议。
- 成本与取舍：引入 ECharts 增加约 886KB 未压缩资源，但通过动态 `import()` 拆出 charts/components/renderers 等 chunk，首屏主 JS 从约 886KB 降至约 378KB；换取 tooltip、响应式尺寸和折线图能力。地图暂不注册 GeoJSON，避免把行政区边界和数据口径混在图表组件中。被否决方案是让 Agent 输出 SVG/HTML，原因是不可安全校验且难以保证跨页面布局。
- 验证：`cd web && npm run build` 通过；构建产物已拆出 `charts-*.js`、`components-*.js`、`renderers-*.js` 等 ECharts chunk。尚未完成真实模型输出、图表数值与正文一致性回归，均标记为待验证。
- 后续扩展路线：用薪资分布、热门岗位、学历结构三类真实样本回归；再按需接入 GeoJSON 地图、堆叠系列、数据表格降级和图片导出，并评估 ECharts 动态分包。
