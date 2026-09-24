---
name: plaza-dev-notes
description: 技能广场仓库（skill-plaza-foru）的开发手记，沉淀本仓库后端 runner、报告输出协议、结构化侧车、广场技能接入等开发约定与设计决策。在本仓库修改 web/server、SSE 协议、报告解析或新增技能/引擎前先读对应记录；产生新的设计决策后按「记录规则」追加条目。
---

# 技能广场开发手记

本技能是本仓库的**活记录本**，供开发会话（zcode / pi 在本仓库工作时）使用，记录"为什么这么设计、接在哪、后续怎么扩"。代码本身能说明的不重复记。

**边界**：这是开发用内部技能——不进 `web/server/lib/skills.ts` 智能体列表、不进 `INSTALLED_SKILLS`、不在广场前端任何接入点出现。面向广场用户的技能接入走 skills.ts 等四个接入点，与本技能无关。

## 何时读

- 改动 `web/server/lib/`（runner / piRunner / zcodeRunner / reportParse / skills / traceExport）或 `/api/chat` SSE 协议前
- 设计报告输出、结构化协议、图表方案前
- 接入新技能或新引擎前

先读下面索引中与任务相关的记录，再动手。

## 何时写

相关任务结束前检查是否满足任一条件：形成新的设计决策、修改既有约定、实现记录中的后续路线，或发现会影响后续开发的重要事实。满足时必须在同一变更中更新对应记录，或新增下一编号的记录并更新本索引；只做与手记无关的局部修复且没有新的可复用约定时，可以不新增记录。

实现落地后回填实际 `file:line`、验证命令/结果和仍未完成的验收项。无法实测的内容标为“待验证”，不要把计划或静态检查写成已完成。

## 记录规则（后续内容按此持续追加）

- 一条记录一个主题：正文放 `references/<三位编号>-<slug>.md`，并在下方索引加一行。
- 记录必含五要素：**状态**（设计中 / 已实现 / 已废弃）、**动机**、**约定细节**（schema、字段、接入点 file:line）、**成本与取舍**（含被否决的备选方案及理由）、**后续扩展路线**。
- 设计定稿但未实现时标"设计定稿，待实现"；实现落地后**回填**实际 file:line 与实测数据，状态改"已实现"。
- 状态变化更新原记录，不删旧记录；被推翻的决策标"已废弃"并注明替代者。
- 编号只增不改，新记录顺延取下一个编号。

## 记录索引

| # | 主题 | 状态 | 文件 |
|---|---|---|---|
| 001 | report-meta 侧车：报告双轨输出（校验字段与用户内容分离） | 已实现（端到端验收待跑） | [001-report-meta-sidecar.md](references/001-report-meta-sidecar.md) |
| 002 | 在线运行历史会话：行内展开原始输入/输出，不依赖运行记录页 | 已废弃（由 004 替代） | [002-use-page-history-inline.md](references/002-use-page-history-inline.md) |
| 003 | 开发任务 GitHub issue 生命周期与 push 关闭 | 已实现（GitHub 认证后待实测） | [003-task-issue-lifecycle.md](references/003-task-issue-lifecycle.md) |
| 004 | 历史会话点击后在在线运行主结果区展示 | 已实现（新记录点击复核受浏览器审批阻断） | [004-history-result-main-panel.md](references/004-history-result-main-panel.md) |
| 005 | 新仓库协作初始化 Skill：手记、Issue hooks 与项目约定 | 已实现（GitHub 远端待验证） | [005-repo-bootstrap-skill.md](references/005-repo-bootstrap-skill.md) |
| 006 | 就业指导最终报告：用户内容与 Agent 工作材料分离 | 已实现（真实 career-guidance 会话待回归） | [006-career-guidance-user-report.md](references/006-career-guidance-user-report.md) |
| 007 | 就业指导依据转入开发侧 evidence 字段 | 已实现（真实 career-guidance 会话待回归） | [007-career-guidance-evidence-field.md](references/007-career-guidance-evidence-field.md) |
| 008 | 流式体验补全：status 过程事件、会话失效自愈与 zcode 错误上抛 | 已实现（前端文案浏览器验收待用户确认） | [008-streaming-status-and-session-selfheal.md](references/008-streaming-status-and-session-selfheal.md) |
| 010 | 就业指导数据图表：结构化规格与前端渲染 | 已实现协议与 Skill 约定（前端组件与真实会话待回归） | [010-career-guidance-charts.md](references/010-career-guidance-charts.md) |
| 009 | MySQL 只读查询工具：scripts/mysql-query.mjs + 沙箱 AGENTS.md 声明 | 已实现（CLI 与 pi 端到端验收通过） | [009-mysql-query-tool.md](references/009-mysql-query-tool.md) |
| 011 | 在线运行用户输出边界与图表展示 | 设计定稿，待实现 | [011-user-facing-output-cleanup.md](references/011-user-facing-output-cleanup.md) |
