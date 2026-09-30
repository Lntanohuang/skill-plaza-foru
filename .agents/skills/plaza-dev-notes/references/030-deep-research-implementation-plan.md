# 030 · DeepResearch 分阶段实施计划

**状态**：计划确定，待实现。

## 目标

在不破坏现有 Pi 运行链、SSE、历史 Trace 和普通任务的前提下，完整实现泛化的 Lead Agent + 多个独立 Sub Agent + 动态 Follow-up + 两层本地研究资料持久化 + 实时拓扑前端。

本计划是完整方案的实施顺序，不是功能缩水的 MVP 切分；每阶段都以可验收的基础能力作为下一阶段前提。

## 阶段 0：契约冻结与泛化边界

- 冻结 `ResearchAssignment`、`ResearchFinding`、`EvidenceRef`、`ResearchEvent`、`manifest.json` schema。
- 明确通用编排层与领域 Skill 的边界；禁止把市场、政策、企业、技术等具体领域写入通用 Task Allocation Skill。
- 明确 `agentId`、`agentName`、`taskId`、`parentAgentId`、`wave` 的生命周期和命名规则。
- 验收：用网页调查、代码分析、合同分析三类任务生成合法且不含领域硬编码的任务计划。

## 阶段 1：Task Allocation Skill 与 Lead Prompt

- 创建 `.agents/skills/deep-research-task-allocation/SKILL.md`。
- 建立 Lead 的任务拆解、任务去重、工具分配、证据要求、停止条件和 Follow-up 判断规则。
- 定义 `spawn_research_agents`、`get_research_state`、`finalize_research` 工具契约。
- 验收：Lead 能输出多种领域的细粒度任务；每个任务包含目标、方法、工具、交付物和成功标准。

## 阶段 2：Pi Session 与 Agent Pool

- 扩展 `web/server/lib/runner.ts`、`web/server/lib/piRunner.ts` 的 `createSession` 参数，支持 `name`、模型、工具、Skill 和 Lead extension。
- 使用 Pi 原生 `--name/-n` 创建 Lead/子 Agent session；内部保留稳定 `agentId`。
- 建立 Agent Pool，支持并发、超时、取消、重试和子 Agent `maxDepth=1`。
- 验收：同一批任务启动多个独立 Pi RPC session，能按名称区分、独立导出 trace，并能单独取消失败任务。

## 阶段 3：两层研究资料持久化

- 实现 `web/server/lib/researchArtifactStore.ts`。
- 落盘 `assignment.md`、`source-material.md`、`finding-summary.md`、`trace.json`、`manifest.json` 和 `events.jsonl`。
- 实现来源清洗、去重、内容 hash、原子写入、部分失败保留和断点恢复。
- 验收：子 Agent 中途失败时，已完成的第一层材料和第二层摘要仍可读取，manifest 状态准确标记。

## 阶段 4：Lead 调度与动态 Follow-up

- 实现 `web/server/lib/researchOrchestrator.ts`，让 Lead 的工具调用触发并行子 Agent。
- 子 Agent 返回摘要后，Lead 可以读取摘要或按 artifact id 回溯第一层材料。
- Follow-up 任务必须由具体冲突、缺口、风险或未回答问题触发，不预先创建固定角色。
- 验收：完成“第一批并行任务 → Lead 判断 → 动态 Follow-up → Lead 综合”的完整闭环。

## 阶段 5：SSE、父子 Trace 与历史 API

- 在 `/api/chat` 增加 DeepResearch 运行模式和研究事件。
- 接入父子 Agent 事件、状态、任务边、artifact 元数据、usage、上下文信息、compaction 和 Lead handoff 事件。
- 增加研究 manifest、任务文档、来源材料、摘要、state checkpoint 和 trace 的只读接口。
- 验收：断开并重连前端后，能根据 `runId` 恢复真实拓扑、Agent 状态、Lead 当前 checkpoint 和已落盘文档。

## 阶段 6：真实前端拓扑与研究资料面板

- 实现 `web/src/components/DeepResearchTopology.vue` 和节点详情面板。
- 节点从 `subagent_created` 动态产生；边由 dispatch/result 事件产生；不提前声明节点集合。
- 支持任务状态、失败重试、节点展开、Prompt 查看、第一层材料查看、摘要查看和 Trace 查看。
- 支持按批次折叠、运行中/失败筛选、缩放、拖拽和历史运行复盘。
- 验收：网页调查、代码分析和合同分析使用同一组件显示不同的真实任务拓扑。

## 阶段 7：上下文预算、质量门禁与安全

- 实现 context budget controller，按当前模型窗口比例触发“正常运行 → 只读摘要 → Pi compaction → Lead session handoff”。
- 在 Lead extension 中接入 `session_before_compact`，生成包含 Research State Snapshot 的定制摘要；compaction 失败时先落盘 checkpoint，再切换 Lead session。
- 子 Agent 结果只返回受限摘要和 artifact id；原始资料通过按需读取，避免污染 Lead 上下文。
- 加入证据完整性、来源可回溯、结论覆盖率、冲突处理和未回答问题检查。
- 加入总 Token、并发数、运行时长、单 Agent 超时和重试预算。
- 研究工具采用 allowlist；网页内容作为不可信输入处理，防止 Prompt Injection 和路径逃逸。
- 验收：长任务触发自动压缩或 handoff 后，Lead 能从 checkpoint 继续研究，且不重复注入完整历史；预算超限、来源缺失、Agent 失败、工具异常和恶意文档均能被记录并安全结束。

## 阶段 8：端到端回归与现有运行记录兼容

- 对 Pi RPC、现有运行历史、SSE、trace、前端详情页和下载接口做回归。
- 保证普通 Pi 任务不被 DeepResearch 调度逻辑影响。
- 验证旧 trace 可以继续读取，新 DeepResearch trace 能完整复盘父子关系和两层资料。
- 验收：完成长任务、取消任务、部分失败、断线重连、历史打开和最终报告下载全链路验证。

## 依赖与风险

- 阶段 0 的协议冻结是后续所有阶段的前置条件；若 schema 变化，必须同步更新方案文档和实现记录。
- 阶段 2 依赖 Pi RPC 的 `--name`、`set_session_name` 和现有 `PiRunner` 生命周期管理。
- 阶段 3 必须先于前端资料面板，否则前端只能显示临时内存内容，不能支持历史复盘。
- 阶段 4 的动态 Follow-up 不能由服务端固定生成，必须保留 Lead 的判断权；服务端只负责资源、安全和状态约束。
- 阶段 5/6 需要兼容现有普通 `/api/chat` SSE 和历史 trace，不能改变旧运行记录的读取语义。

## 验证状态

尚未实现服务端调度、SSE 事件、Task Allocation Skill、真实 Pi 子 session、Artifact Store 和前端组件；以上均为待验证项。
