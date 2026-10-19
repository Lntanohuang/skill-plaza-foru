# 029 · DeepResearch 多智能体编排设计（未实现）

**状态**：设计定稿，待实现。原 029（拓扑与协议）、030（分阶段实施计划）、031（Lead 上下文预算与交接）、033（拆分与冲突控制）于 2026-10-19 合并，见 076；外部研究依据见 032。

## 动机

DeepResearch 不采用固定流水线，而采用 Anthropic 多 Agent Research 范式：Lead Agent 先理解问题并生成细粒度任务分配 Prompt，多个独立子 Agent 并行执行；Lead 读取结果后识别证据缺口、冲突和未回答问题，再动态派发下一批任务，最后统一综合。任务分工不绑定「市场/政策/企业/技术」等示例领域，由用户目标、领域 Skill、可用工具和任务上下文决定。用户需要看到主 Agent、子 Agent、任务分发和结果回流的实时拓扑。主要风险不是能否并行，而是任务粒度失控、覆盖不完整、多 Agent 同时维护不可合并的全局状态、以及不同来源结果冲突。

## 编排与协议

### Pi 接入

- 继续使用 Pi RPC；Lead session 显式加载专用 extension 并注册 `spawn_research_agents` 工具。
- 子 Agent 各用独立 Pi RPC session，不复用 Lead 上下文；启动用 Pi 原生 `--name/-n`，展示名与内部稳定 `agentId` 分离。Lead 名如 `lead-chief-researcher`；子 Agent 名用批次 + 任务 slug（`w1-analyze-contract-risk`），不用固定角色名。现有 `PiRunner.createSession` 的固定短 UUID 名需扩展为可传 display name。
- 服务端编排器负责任务并发、超时、取消、重试、预算和证据存储；Lead 负责规划、动态补洞判断和最终综合。子 Agent `maxDepth=1`，不可再创建子 Agent。

### 泛化边界

- 编排层只理解通用任务字段、依赖、工具权限、证据、结果和状态，不理解具体领域章节或业务名词；领域差异由领域 Skill 注入。Lead 的拆解轴可以是对象、时间、假设、来源、风险、步骤、文件模块或对立观点，不写死四类示例领域。
- 拓扑节点显示真实 `taskId`、任务标题和 `taskKind`；Follow-up 节点只在发现具体冲突或缺口后创建，节点集合完全动态。

### 任务分配（Task Allocation Skill）

新增 `.agents/skills/deep-research-task-allocation/SKILL.md`，仅注入 Lead。每个任务至少包含：

```ts
interface ResearchAssignment {
  taskId: string
  agentName: string
  role: string
  /** 开放字符串：如 investigate、compare、extract、verify、analyze、transform */
  taskKind?: string
  objective: string
  context: string
  questions: string[]
  method: string[]
  tools: string[]
  deliverables: string[]
  outputSchema?: string
  evidenceRequirements: string[]
  successCriteria: string[]
  constraints: string[]
  dependsOn: string[]
  /** 执行批次（round/generation），不代表固定业务阶段 */
  wave: number
}
```

任务之间边界不重叠、独立输入、明确交付格式与停止条件；第一波宽搜索，后续波次必须由已返回结果中的缺口/冲突触发。没有证据的内容标为推测。

### 结果协议

`spawn_research_agents` 接收 `ResearchAssignment[]` 与 `wave`，服务端校验后并发启动子 session。每个子 Agent 固定返回：

```ts
interface ResearchFinding {
  taskId: string
  agentId: string
  agentName: string
  summary: string
  keyFindings: string[]
  evidence: Array<{
    claim: string
    kind: 'url' | 'file' | 'database' | 'tool-output' | 'message'
    ref: string
    locator?: string
    quote?: string
  }>
  confidence: 'high' | 'medium' | 'low'
  assumptions: string[]
  risks: string[]
  contradictions: string[]
  unansweredQuestions: string[]
  usage?: UsageSummary
}
```

Lead 收到一批结果后可再次调度；显式完成时调用 `finalize_research`。服务端不替 Lead 做语义拼接或宣称研究完成。

### 服务端组件

- `web/server/lib/deepResearchRunner.ts`：运行入口，连接现有 `/api/chat` SSE 与父运行记录。
- `web/server/lib/researchOrchestrator.ts`：Lead/child session 生命周期、并发池、波次、超时、取消、重试、预算、结果回传。
- `web/.pi/extensions/deep-research-lead.ts`：Lead 专用 extension，注册调度与完成工具。
- `web/server/lib/researchArtifactStore.ts` / `researchTrace.ts`：父子关系、任务 Prompt、证据、状态变更与各 session trace。
- 子 Agent 研究工具用受控 allowlist（网页搜索、URL 抓取、引用提取等）；默认不开放写文件和任意 bash，避免共享 workspace 污染。

### 事件与前端拓扑

`/api/chat` 保持 SSE，新增事件：`research_plan`、`subagent_created/started/progress/finished/failed`、`research_wave_started`、`synthesis_started`、`done`。事件至少含 `runId / parentAgentId / agentId / agentName / role / taskId? / wave / status / currentAction? / progress?`。运行记录用一个 parent run 加多个 child agent 记录；子 trace 独立落盘并在父记录中索引；拓扑边表示 dispatch 或 result，节点状态由事件驱动，不从时间戳推断，不由前端推断。

`DeepResearchTopology.vue` 用 SVG/DAG 布局：Lead 顶部、按 wave 分层、synthesis 底部；节点显示 agentName/role/taskId，支持状态色、失败重试标记、分发/回流边动画、点击查看分配 Prompt/工具/证据/usage/子 trace、缩放拖拽、按 wave 折叠与失败筛选。

### 本地研究资料持久化（两层）

```text
traces/deep-research/<runId>/
  manifest.json                 # run、Lead、任务、Agent、波次与文件索引
  events.jsonl                  # 父子 Agent 统一事件流
  state/                        # Research State（见下节）
  agents/<agentId>/
    assignment.md               # Lead 实际下发的完整任务 Prompt
    source-material.md          # 第一层：清洗后的原始资料与来源证据
    finding-summary.md          # 第二层：关键发现与判断
    trace.json                  # 该 Pi session 完整 trace
  synthesis/final.md
```

- `source-material.md` 是清洗、去重、保留来源类型/标识/标题/时间/引用片段/内容 hash 的材料，每条事实可回指来源；不是原始网页 HTML。
- Lead 默认只接收第二层摘要；需要展开时按 artifact id 读取第一层文档。`manifest.json` 保存全部索引（agentId/agentName/parentAgentId/taskId/wave/状态/模型/时间/文件路径/hash），前端节点点击经 manifest 定位文档，不猜路径。
- 文档临时文件写入后 rename，事件追加写；子 Agent 失败仍保留已完成材料并标 `partial/failed`。SSE 只推 artifact 元数据，不推文档内容。只读文档接口由服务端按 manifest 解析路径，禁止客户端提交任意路径。

## Lead 上下文预算、压缩与会话交接

1. **Lead 不接收原始材料全文**：完整抓取只落 `source-material.md`；Lead 默认接收受限大小的摘要、证据索引和 artifact id；按需 `read_research_artifact`（单次读取有字节/Token 上限）。
2. **外部 Research State 是事实源**：每 run 维护 `state/current-state.json|md` 与 `checkpoints/<id>.json`，快照至少含 goal、constraints、outputContract、completed/activeTaskIds、evidenceRefs、keyFindings、contradictions、unansweredQuestions、pendingFollowups、decisions、lastCheckpointId、context{tokens,window,ratio}。每批次完成后先更新快照，再交压缩摘要给 Lead。快照不是最终报告，也不替代两层资料。
3. **分级上下文预算**（按当前模型窗口比例，不写死 Token 数）：<60% 正常运行；60–75% 禁止拼接多个摘要原文，改用 state snapshot + artifact 引用、Follow-up 更小；75–85% 主动触发 Pi compaction（定制摘要）；>85% 或 compaction 失败 → checkpoint handoff 换新 Lead session。`reserveTokens` 为最终回答与 compaction 预留；项目设置显式配 `compaction.enabled/reserveTokens/keepRecentTokens`。
4. **Pi 原生 compaction + 定制摘要**：监听 `compaction_start/end`、`session_compact_failed`、`agent_settled` 写入事件流与 trace；Lead extension 用 `session_before_compact` 提供含 `ResearchStateSnapshot` 关键字段的定制摘要。compaction 保留 Pi 原始 entries，本地 artifact/manifest/state 独立保存。子 Agent 优先「完成即结束」，不无限多轮。
5. **Lead Session Handoff**：固化 checkpoint → 新 Pi RPC session（新 `--name`，如 `lead-checkpoint-02`）→ 注入受限 handoff Prompt（目标、约束、状态、关键结论、未答问题、artifact 索引、允许的下一步工具；禁止包含全部历史与原始资料）→ manifest 登记 `replacesAgentId/checkpointId/parentAgentId`，拓扑显示接力边；旧 session 只读保留供审计。
6. **结果压缩与去重**：子 Agent 结果先结构化解析再进 Lead context；证据按 contentHash/来源/claim 去重；Lead 只收新增或变化的 findings，历史经 `findingId/artifactId` 引用；每轮保留短的「新增事实/冲突/缺口/决策」增量摘要。
7. **溢出与失败**：Pi overflow recovery 与自动 compaction 是第一层兜底，服务端必须等 `agent_settled` 而非 `agent_end`；compaction 失败不重发超大 Prompt，先落 checkpoint 再 handoff；handoff 失败保留已完成资料、状态标 `paused_context_limit` 允许重试；每次压缩/交接记录前后占用、原因、摘要版本与恢复 session。

## 任务拆分、状态归属与冲突控制

- **拆分闸门**：Lead 先建 question/claim coverage matrix（每个问题/候选结论有负责人、证据要求、完成条件和状态），assignment 增加 `scope/excludes/inputRefs/priority/stopCriteria`。只有「可独立执行、证据路径明显不同、有工具/上下文隔离收益、结果可结构化合并」同时满足才拆分；强依赖、共享上下文、任务很小或合并成本高时合并。第一波宽搜索，后续拆分由具体缺口/冲突/风险触发；不允许子 Agent 递归派单。计划门禁检查重复范围、未覆盖问题、循环依赖、缺证据要求、任务数/并发/预算上限。
- **状态归属**：Sub Agent 只拥有本地上下文，产出追加式 finding 与 artifact，不直接改全局状态；Orchestrator 拥有执行状态、任务状态、版本、事件与 artifact 索引（幂等提交、并发合并）；Lead 拥有研究语义判断（批准关键 claim、解释冲突、决定 follow-up 与完成）；SSE/拓扑只是 manifest/events 的投影。全局状态三层：不可变 source-material、结构化 finding、Lead 批准的 canonical research state；finding 带 `taskId/stateVersion`，提交走版本检查与幂等事件。
- **冲突处理**：不覆盖冲突结果、不以多数票替代证据判断。先归一化为原子 claim，按来源质量、时间范围、口径/定义、方法、证据直接性与独立 corroboration 分类判断；可消解的由 Lead 更新 canonical claim 并保留被否定证据，不可消解的保留 competing claims、降置信度、生成针对冲突的 follow-up；最终报告显式表达未决冲突。
- **质量门禁**：每波完成后查 coverage、重复范围、证据完整性、冲突数、未答问题与预算；未通过只对缺口/冲突生成 follow-up，不整轮重跑。高风险 claim 安排独立来源或独立方法双重核验，普通 claim 不默认重复执行。

## 实施阶段（顺序依赖）

0. 契约冻结：冻结 ResearchAssignment/Finding/EvidenceRef/ResearchEvent/manifest schema 与泛化边界、命名规则；验收=三类任务（网页调查/代码分析/合同分析）生成合法且无领域硬编码的任务计划。
1. Task Allocation Skill 与 Lead Prompt：拆解/去重/工具分配/证据要求/停止条件规则与 `spawn_research_agents/get_research_state/finalize_research` 契约。
2. Pi Session 与 Agent Pool：`createSession` 支持名称/模型/工具/Skill/extension；并发、超时、取消、重试、`maxDepth=1`。
3. 两层资料持久化：researchArtifactStore，来源清洗、去重、hash、原子写入、部分失败保留、断点恢复。
4. Lead 调度与动态 Follow-up：完整闭环「并行任务 → Lead 判断 → Follow-up → 综合」。
5. SSE、父子 Trace 与历史 API：研究事件 + 只读接口；断线重连可恢复拓扑/状态/checkpoint。
6. 前端拓扑与资料面板：节点由事件动态产生，支持 Prompt/材料/摘要/Trace 查看、折叠筛选缩放、历史复盘。
7. 上下文预算、质量门禁与安全：budget controller、定制 compaction、handoff、证据完整性检查、Token/并发/时长预算、工具 allowlist、网页内容按不可信输入处理。
8. 端到端回归：普通 Pi 任务不受影响、旧 trace 可读、长任务/取消/部分失败/断线重连/下载全链路。

依赖要点：阶段 0 是全部前置；阶段 3 必须先于前端资料面板；阶段 4 的 Follow-up 判断权在 Lead，服务端只管资源/安全/状态；阶段 5/6 兼容现有 SSE 与历史 trace 语义。

## 成本与取舍

- 独立 Pi session 而非单 session 多角色：进程/上下文/token 成本增加，换取上下文隔离、并发、独立 trace 与可视化父子关系。
- Lead 动态派单而非固定 DAG：调度不确定性与预算控制难度增加，但符合自适应研究范式；服务端不替模型决定研究结论。
- 结构化证据返回：Prompt 与协议约束增加，换取引用校验、冲突发现、质量门禁与前端证据查看。
- 禁止子 Agent 无限递归（成本失控/拓扑不可读/死循环）；禁止前端推断拓扑（丢失真实父子关系）。
- 两层资料 + 外部 state：磁盘与管理成本增加，换取可复核、可引用、可断点恢复；不依赖 Pi compaction summary 承载任务图（自然语言摘要不能稳定承载结构关系）。
- 原生 compaction 有额外摘要调用成本，是可接受的上下文维护成本；handoff 一次初始化成本换超长任务可继续。
- 覆盖矩阵/门禁/claim 归一化增加协议成本，但比过度并行后人工修复便宜；冲突不强行自动裁决，避免把错误共识伪装成事实。

## 后续扩展路线

- 按实施阶段顺序落地（阶段 0 契约冻结为前置）；接入研究工具 allowlist、来源/引用校验、预算控制与按 Agent 模型路由（模型选择规则见 035）。
- 前端显示覆盖率、冲突、未回答问题、任务重复与状态版本，而不只显示 Agent 数量；加入基于证据覆盖率的自动质量门禁。

## 验证口径

尚未实现任何服务端调度、SSE 事件、Task Allocation Skill、真实 Pi 子 session、Artifact Store 与前端组件；全部为待验证项。曾被删除的静态 HTML 拓扑示意不作为实现依据。
