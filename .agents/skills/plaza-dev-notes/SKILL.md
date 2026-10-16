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
| 012 | 就业岗位库查询、开发侧缺口与图表 | 已实现（真实内网岗位库回归待跑） | [012-career-market-query-sidecar.md](references/012-career-market-query-sidecar.md) |
| 013 | 就业指导正式报告：岗位需求分析与简历修改建议 | 已实现（真实查询与浏览器回归待跑） | [013-career-guidance-formal-report.md](references/013-career-guidance-formal-report.md) |
| 012 | Pi 运行详情合并工具与对话时间线 | 已实现（Zcode 未接入） | [012-pi-unified-run-timeline.md](references/012-pi-unified-run-timeline.md) |
| 014 | 流式 Markdown 渲染批处理 | 已实现（浏览器长报告体验待回归） | [014-stream-render-batching.md](references/014-stream-render-batching.md) |
| 015 | 就业指导 HTML 报告文件产物与内联 SVG 绘图 Skill | 已实现（真实 Agent 超时恢复与浏览器回归待验证） | [015-career-guidance-html-report.md](references/015-career-guidance-html-report.md) |
| 016 | 岗位库查询客户端的 mysql_native_password 回落 | 已实现（2026-09-28 实测） | [016-mysql-client-native-password-fallback.md](references/016-mysql-client-native-password-fallback.md) |
| 017 | 岗位统计查询 EXPLAIN 实测 | 已完成计划检查（优化待验证） | [017-career-query-explain.md](references/017-career-query-explain.md) |
| 018 | 就业指导比例展示与来源文案 | 已实现（真实报告待回归） | [018-career-proportion-source-display.md](references/018-career-proportion-source-display.md) |
| 019 | 岗位名 FULLTEXT 替代 LIKE 试验 | 试验完成（不能直接替换） | [019-fulltext-match-trial.md](references/019-fulltext-match-trial.md) |
| 020 | 岗位查询客户端预探测与受控并行 | 已实现（真实岗位库验证通过） | [020-career-query-client-probe-parallel.md](references/020-career-query-client-probe-parallel.md) |
| 021 | 共享图表与城市热点图 Skill | 已实现本地整合（远端待完成） | [021-shared-chart-visualization-skill.md](references/021-shared-chart-visualization-skill.md) |
| 022 | 就业指导开发侧测试模板切换 | 已实现（构建与浏览器交互已验证） | [022-career-test-template-switcher.md](references/022-career-test-template-switcher.md) |
| 023 | 省内城市分布白名单查询与热点图报告校验 | 已实现接入（真实数据库与模型报告已验证） | [023-city-distribution-heatmap.md](references/023-city-distribution-heatmap.md) |
| 024 | 城市热点图省份资源包泛化与 Pi 双省验证 | 已实现资源泛化（真实数据库广东、浙江报告均已验证） | [024-region-resource-generalization.md](references/024-region-resource-generalization.md) |
| 025 | 就业指导 trace 运行记录显示链路诊断 | 已实现（真实 API/浏览器回归待验证） | [025-career-trace-history-display.md](references/025-career-trace-history-display.md) |
| 026 | Pi 每次模型请求的上下文占用记录 | 已实现（真实 Pi/API 端到端回归待用户执行） | [026-pi-context-usage-per-request.md](references/026-pi-context-usage-per-request.md) |
| 027 | Pi-only 执行链与就业报告固定用户结构 | 已实现（真实报告回归待用户执行） | [027-pi-only-user-report-structure.md](references/027-pi-only-user-report-structure.md) |
| 028 | 在线报告下载与结构化任务标题 | 已实现（真实浏览器下载与历史运行回归待验证） | [028-online-report-download-and-task-title.md](references/028-online-report-download-and-task-title.md) |
| 029 | DeepResearch 主子 Agent 编排与可视化拓扑 | 设计定稿，待实现 | [029-deep-research-multi-agent-topology.md](references/029-deep-research-multi-agent-topology.md) |
| 030 | DeepResearch 分阶段实施计划 | 计划确定，待实现 | [030-deep-research-implementation-plan.md](references/030-deep-research-implementation-plan.md) |
| 031 | DeepResearch Lead 上下文预算、压缩与会话交接 | 设计定稿，待实现 | [031-deep-research-lead-context-budget-and-handoff.md](references/031-deep-research-lead-context-budget-and-handoff.md) |
| 032 | Anthropic 基础工作流对研究编排的启发 | 设计建议，待验证 | [032-anthropic-basic-workflow-patterns.md](references/032-anthropic-basic-workflow-patterns.md) |
| 033 | DeepResearch 任务拆分、状态归属与冲突控制 | 设计定稿，待实现 | [033-deep-research-decomposition-and-conflict-control.md](references/033-deep-research-decomposition-and-conflict-control.md) |
| 034 | DeepResearch 架构相关论文检索与启发 | 研究输入已整理，架构结论待验证 | [034-research-papers-for-deep-research-architecture.md](references/034-research-papers-for-deep-research-architecture.md) |
| 035 | Pi 子 Agent 模型选择与计费来源 | 已实现 Skill 规范，运行时接入待实现 | [035-pi-model-selection-and-billing-source.md](references/035-pi-model-selection-and-billing-source.md) |
| 036 | OpenAI 兼容端点 /v1/chat/completions：外部项目统一接入入口 | 已实现（2026-10-14 流式升级为标准 chunk 并复验通过；公网浏览器打开报告待用户执行） | [036-openai-compat-chat-endpoint.md](references/036-openai-compat-chat-endpoint.md) |
| 030 | 在线运行安全进度时间线 | 已实现（真实 Pi 工具事件与浏览器回归待验证） | [030-stream-progress-timeline.md](references/030-stream-progress-timeline.md) |
| 032 | industry-education-report 在广场沙箱内首次端到端运行观察 | 已实现观察（parseReport 链路回归待验证） | [032-industry-education-report-sandbox-run.md](references/032-industry-education-report-sandbox-run.md) |
| 033 | industry-education-report 沙箱内第二次端到端运行（更丰富产物与语义审核） | 已实现观察（parseReport 链路回归待验证） | [033-industry-education-report-second-sandbox-run.md](references/033-industry-education-report-second-sandbox-run.md) |
| 034 | 就业指导真实会话中岗位库查询工具未声明的观察 | 已实现观察（2026-10-12 未声明复现；2026-10-13 工具节已声明） | [034-career-guidance-mysql-tool-not-declared.md](references/034-career-guidance-mysql-tool-not-declared.md) |
| 035 | tech-forecast 广场沙箱首次端到端运行观察（省级口径、雷达/桑基图、报告校验） | 已实现观察（2026-10-12 广东省 AI/机器人高职预判会话） | [035-tech-forecast-sandbox-first-run.md](references/035-tech-forecast-sandbox-first-run.md) |
| 036 | tech-forecast 技能接入与 HTML 报告契约泛化 | 已实现（真实运行回归见记录；浏览器截图待用户执行） | [036-tech-forecast-skill-integration.md](references/036-tech-forecast-skill-integration.md) |
| 037 | tech-forecast 第二次广场沙箱运行（省级口径复现、任务提示与工具可用性矛盾） | 已实现观察（2026-10-13 广东省 AI/大模型·机器人会话） | [037-tech-forecast-second-sandbox-run.md](references/037-tech-forecast-second-sandbox-run.md) |
| 038 | tech-forecast 证据链 v2：title-trend 否决、横截面关键词计划与联网检索工具 | 已实现（v2 运行验证见记录） | [038-tech-forecast-evidence-v2.md](references/038-tech-forecast-evidence-v2.md) |
| 039 | tech-forecast 第三次广场沙箱运行（roleTerms 上限、检索降级、横截面证据落地） | 已实现观察（2026-10-13 广东省 AI/大模型·机器人会话） | [039-tech-forecast-third-sandbox-run.md](references/039-tech-forecast-third-sandbox-run.md) |
| 039 | tech-forecast 第三次广场沙箱运行（roleTerms 显式口径、检索可靠性、六图报告） | 已实现观察（2026-10-13 广东省 AI/大模型·机器人会话） | [039-tech-forecast-third-sandbox-run-roleterms.md](references/039-tech-forecast-third-sandbox-run-roleterms.md) |
| 040 | tech-forecast SKILL.md 按投标规格整体替换与新七章结构 | 已实现（v3 运行验证见记录） | [040-tech-forecast-spec-replacement.md](references/040-tech-forecast-spec-replacement.md) |
| 041 | tech-forecast 库内快照层（references/data/）与第四次广场沙箱运行 | 已实现（快照首次引用；提交与 parseReport 回归待办） | [041-tech-forecast-snapshot-layer-and-fourth-run.md](references/041-tech-forecast-snapshot-layer-and-fourth-run.md) |
| 042 | tech-forecast 第五次广场沙箱运行（快照+高职切片补查稳定复用、四图报告） | 已实现观察（2026-10-13 广东省 AI/大模型·机器人会话） | [042-tech-forecast-fifth-sandbox-run.md](references/042-tech-forecast-fifth-sandbox-run.md) |
| 043 | 纺织服装快照（含公开来源节）与 web-search 检索源修复 | 已实现（guangdong-textile.md 交付审阅） | [043-textile-snapshot-and-search-fallback.md](references/043-textile-snapshot-and-search-fallback.md) |
| 044 | 外部评审意见转化：研判判定规则与报告方法论强化 | 已废弃（用户审阅后回退，详见记录） | [044-review-rules-hardening.md](references/044-review-rules-hardening.md) |
| 043 | 就业指导广场沙箱真实运行：广州 Java 后端实习（内联 SVG 五图 + 城市热点图） | 已实现观察（2026-10-13 本报告会话；服务端校验/浏览器回归待跑） | [043-career-guidance-guangzhou-java-intern-run.md](references/043-career-guidance-guangzhou-java-intern-run.md) |
| 044 | tech-forecast 纺织服装（广东）沙箱运行：快照复用、库内零样本边界、英文检索降级 | 已实现观察（2026-10-13 会话；parseReport/浏览器回归待跑） | [044-tech-forecast-textile-sandbox-run.md](references/044-tech-forecast-textile-sandbox-run.md) |
| 045 | tech-forecast 纺织服装第二次沙箱运行：快照+实时复核一致性、检索相关性放行与 GBK 取数踩坑 | 已实现观察（2026-10-14 会话；parseReport/浏览器回归待跑） | [045-tech-forecast-textile-second-run.md](references/045-tech-forecast-textile-second-run.md) |
| 046 | tech-forecast 纺织服装第三次沙箱运行：`--query` 整批失准与 Bing 站内 `--fetch` 兜底 | 已实现观察（2026-10-14 会话；parseReport/浏览器回归待跑） | [046-tech-forecast-textile-third-run-search-fallback.md](references/046-tech-forecast-textile-third-run-search-fallback.md) |
| 047 | 就业指导第二次广州 Java 后端实习沙箱运行（在招/实习双口径 + 六图） | 已实现观察（2026-10-14 会话；服务端校验通过，浏览器回归待跑） | [047-career-guidance-guangzhou-java-intern-second-run.md](references/047-career-guidance-guangzhou-java-intern-second-run.md) |
| 048 | 广场技能列表动态化：/api/skills 与幽灵卡移除 | 已实现（构建通过、API 实测 6 技能；浏览器页面回归待用户） | [048-plaza-skill-list-dynamic.md](references/048-plaza-skill-list-dynamic.md) |
| 049 | industry-education-report 沙箱内第三次端到端运行（政府部门产业招商口径，180 指标全量引用） | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [049-industry-education-report-third-sandbox-run.md](references/049-industry-education-report-third-sandbox-run.md) |
| 050 | tech-forecast 纺织服装第四次沙箱运行：引用编号顺序自校验与六图报告 | 已实现观察（2026-10-14 会话；parseReport/浏览器回归待跑） | [050-tech-forecast-textile-fourth-run.md](references/050-tech-forecast-textile-fourth-run.md) |
| 051 | tech-forecast 纺织服装第五次沙箱运行：中英文 `--query` 全部失准与权威站点 `--fetch` 取证 | 已实现观察（2026-10-14 会话；parseReport/浏览器回归待跑） | [051-tech-forecast-textile-fifth-run-search-fallback.md](references/051-tech-forecast-textile-fifth-run-search-fallback.md) |
| 052 | industry-education-report 第四次沙箱运行：用户改换产业为新能源汽车、05 无对应切片 → 全章缺口 | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [052-industry-education-report-nev-no-slice-run.md](references/052-industry-education-report-nev-no-slice-run.md) |
| 053 | tech-forecast 纺织服装第六次沙箱运行：全切片实时复核一致、编号重映射与引用顺序自校验 | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [053-tech-forecast-textile-sixth-run-citation-remap.md](references/053-tech-forecast-textile-sixth-run-citation-remap.md) |
| 054 | 就业指导“智能网联汽车”沙箱运行：弱输入（仅行业名）、岗位族长尾、广东热点图 | 已实现观察（2026-10-14 会话；最小结构校验通过，服务端/浏览器回归待跑） | [054-career-guidance-icv-guangdong-run.md](references/054-career-guidance-icv-guangdong-run.md) |
| 054 | industry-education-report 第五次沙箱运行：用户改换产业为智能网联汽车、05 无对应切片 → 全章缺口（复现 052 约定） | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [054-industry-education-report-icv-no-slice-run.md](references/054-industry-education-report-icv-no-slice-run.md) |
| 055 | industry-education-report 第四次同参运行：复用 049 组装脚本、产物 md5 一致与独立数值回查 | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [055-industry-education-report-fourth-sandbox-run.md](references/055-industry-education-report-fourth-sandbox-run.md) |
| 056 | industry-education-report 第六次沙箱运行：智能网联汽车无切片复现，metric `period` 口径微差与组装/回查脚本 | 已实现观察（2026-10-14 会话；服务端校验通过，parseReport/浏览器回归待跑） | [056-industry-education-report-icv-sixth-run.md](references/056-industry-education-report-icv-sixth-run.md) |
| 057 | 公网入口 origin 白名单 PLAZA_ALLOWED_ORIGINS：防跨站默认不放松，公网映射地址显式登记 | 已实现（2026-10-15 curl 四场景验证；浏览器公网回归待确认） | [057-public-origin-allowlist.md](references/057-public-origin-allowlist.md) |
| 058 | industry-education-report 第五次沙箱运行：同参跨会话 md5 二次稳定复现与无证据失败应答观察 | 已实现观察（2026-10-15 会话；服务端校验通过，parseReport/浏览器回归待跑） | [058-industry-education-report-fifth-sandbox-run.md](references/058-industry-education-report-fifth-sandbox-run.md) |
| 059 | industry-education-report 第七次沙箱运行：用户改换对象为「软件工程」、05 无对应切片 → 全章缺口 | 已实现观察（2026-10-15 会话；服务端校验通过，parseReport/浏览器回归待跑） | [059-industry-education-report-swe-no-slice-run.md](references/059-industry-education-report-swe-no-slice-run.md) |
| 060 | industry-education-report 第八次沙箱运行：用户改换对象为「纺织」、05 无对应切片 → 全章缺口（无切片分支第 4 例） | 已实现观察（2026-10-15 会话；服务端校验通过，parseReport/浏览器回归待跑） | [060-industry-education-report-textile-no-slice-run.md](references/060-industry-education-report-textile-no-slice-run.md) |
| 061 | 就业指导第三次广州 Java 后端实习沙箱运行（2026-10-15 快照 + 六图 + 服务端校验通过；热点图文案触发 failureHint 的修正） | 已实现观察（2026-10-15 会话；服务端校验通过，浏览器回归待跑） | [061-career-guidance-guangzhou-java-intern-third-run.md](references/061-career-guidance-guangzhou-java-intern-third-run.md) |
| 062 | 就业指导广州 Java 后端实习并行会话复跑（2026-10-15 快照，全 bar-chart 变体 + failureHint 预检） | 已实现观察（2026-10-15 会话；服务端校验通过，浏览器回归待跑） | [062-career-guidance-guangzhou-java-intern-parallel-run.md](references/062-career-guidance-guangzhou-java-intern-parallel-run.md) |
| 063 | 就业指导「Agent 开发工程师」弱输入运行（仅岗位名、无城市、无简历；深圳参考市场 + 广东热点图 + 相邻 AI 口径对照） | 已实现观察（2026-10-15 会话；服务端校验通过，浏览器回归待跑） | [063-career-guidance-agent-role-shenzhen-run.md](references/063-career-guidance-agent-role-shenzhen-run.md) |
| 064 | 就业指导第四次广州 Java 后端实习沙箱运行（带简历附件 + 六图 + 服务端校验通过） | 已实现观察（2026-10-15 会话；服务端校验通过，浏览器回归待跑） | [064-career-guidance-guangzhou-java-intern-resume-run.md](references/064-career-guidance-guangzhou-java-intern-resume-run.md) |
| 065 | tech-forecast 鞋类设计与工艺沙箱运行：专业型切词、入库日期筛选缺口与六图报告 | 已实现观察（2026-10-16 会话；服务端校验通过，parseReport/浏览器回归待跑） | [065-tech-forecast-footwear-run.md](references/065-tech-forecast-footwear-run.md) |
| 066 | 在线对话/在线运行前端按 SkillHub 设计系统重构（--sk-* 令牌、文档流对话、ToolCallGroup 工具组自动折叠） | 已实现（构建通过；双页双主题截图与一次真实 SSE 会话核对，长报告回归待用户） | [066-skillhub-ui-redesign.md](references/066-skillhub-ui-redesign.md) |
| 067 | 在线对话默认通用智能体与 $ 技能选择器（skill=general 注册、广场卡片过滤、换技能重开会话） | 已实现（2026-10-16 构建/后端 e2e/浏览器断言通过；真实多轮与换技能回归待用户） | [067-experience-general-agent-dollar-picker.md](references/067-experience-general-agent-dollar-picker.md) |
| 068 | 交互收敛：/use 只留任务配置表单（提交跳在线对话交接运行），历史运行记录统一在在线对话侧栏展示 | 已实现（2026-10-16 构建与浏览器断言通过；真实表单任务含附件沙箱延续待用户回归；同日修复多轮会话 session 捕获回归；历史形态被 069 修订） | [068-form-only-usepage-and-experience-surface.md](references/068-form-only-usepage-and-experience-surface.md) |
| 069 | 历史按对话展示整段记录（conversation 剥离提示词包装、clientSessionId 分组、产物只留报告链接/下载）+ 运行进度只显示真实工具调用 | 已实现（2026-10-16 构建/curl/浏览器断言与截图通过；详情卡形态当日被 070 取代，其余约定生效） | [069-conversation-history-and-toolsonly-progress.md](references/069-conversation-history-and-toolsonly-progress.md) |
| 070 | 点开历史即正常对话流：删专门详情卡/产物区，报告链接内联，恢复服务端会话可直接续聊 | 已实现（2026-10-16 构建/浏览器断言含真实续聊与下载路由 200/截图通过） | [070-history-as-normal-chat.md](references/070-history-as-normal-chat.md) |
| 071 | 历史对话补回工具调用摘要（conversation.tools 名称+成败、聚合到轮次首条 AI 消息、折叠组无耗时显示） | 已实现（2026-10-16 构建/curl/浏览器断言与截图通过，无命令泄露） | [071-history-tool-summary.md](references/071-history-tool-summary.md) |
