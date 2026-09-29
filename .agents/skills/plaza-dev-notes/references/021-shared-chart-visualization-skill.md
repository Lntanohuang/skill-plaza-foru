# 021 · 共享图表与城市热点图 Skill

- 状态：已实现本地仓库整合（2026-09-28）；共享仓库远端创建/推送待完成。
- 动机：柱状图、折线图、直方图、堆叠柱状图、地图和城市热点图规则此前散落在 career-guidance 子仓库、主仓库 reports 和提示词中；需要统一维护，并为岗位需求分析增加条件化城市热点图。
- 约定细节：新增 `.agents/skills/chart-visualization` 子模块，当前指向本地共享仓库提交 `a2d25f1`；包含 `SKILL.md`、`references/common-rules.md`、五种既有图表规则、`map-chart.md`、`heatmap-chart.md` 和无气泡示例。career-guidance 子模块提交 `d4860c6` 移除旧 `references/html-chart-skills` 并改为读取工作区共享 Skill。`web/server/lib/skills.ts` 与 `piRunner.ts` 提示改为共享路径；中国目标地点且有城市数据时生成无气泡热点图，国外目标地点省略，地点未知不猜测。
- 成本与取舍：多一个共享 Skill 子模块和一个待创建的远端仓库；换取所有图表规则、可访问性、来源口径和地图边界约束集中维护。热点图采用行政区填色而非气泡，避免绝对数量视觉误导；无标准边界或城市范围不明时不生成地图。
- 验证：`quick_validate.py chart-visualization` 通过；`cd web && npm run build` 通过。现有无气泡广东 Java 后端热点图只作为 examples 原型，不代表最终全国查询实现。
- 后续扩展路线：创建并推送 `chart-visualization-skill` 远端；新增中国城市分布白名单 queryId；按中国/国外/未知地点分支调整岗位需求分析查询顺序；用全国标准行政区边界替换当前广东示例。
