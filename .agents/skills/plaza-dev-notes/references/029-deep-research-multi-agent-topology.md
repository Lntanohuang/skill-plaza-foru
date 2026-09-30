# 029 · DeepResearch 主子 Agent 编排与可视化拓扑

**状态**：设计定稿，待实现。

## 动机

DeepResearch 不采用固定流水线，而采用 Anthropic 多 Agent Research 范式：Lead Agent 先理解问题并生成细粒度任务分配 Prompt，多个独立子 Agent 并行执行；Lead Agent 读取结果后识别证据缺口、冲突和未回答问题，再动态派发下一批任务，最后由 Lead Agent 统一综合。任务分工不绑定“市场/政策/企业/技术”等示例领域，而由用户目标、领域 Skill、可用工具和任务上下文决定。用户需要看到主 Agent、子 Agent、任务分发和结果回流的实时拓扑，而不只是最终文本。

## 约定细节

### 1. Pi 接入

- 当前项目继续使用 Pi RPC；DeepResearch 的 Lead session 显式加载专用 extension，并注册 `spawn_research_agents` 工具。
- 子 Agent 每个使用独立 Pi RPC session，不能复用 Lead session 的上下文。启动时使用 Pi 原生 `--name <name>`/`-n <name>`，运行中可用 `set_session_name`；展示名称与内部稳定 `agentId` 分离。
- Lead session 名称示例：`lead-chief-researcher`；子 Agent 名称采用批次 + 任务 slug，例如 `w1-analyze-contract-risk`、`w2-verify-claim-001`，不使用固定角色名。现有 `PiRunner.createSession` 的固定短 UUID 名称需要扩展为可传入 display name。
- 任务调度由服务端编排器负责并发、超时、取消、重试、预算和证据存储；Lead Agent 负责任务规划、动态补洞判断和最终综合。子 Agent 初期 `maxDepth=1`，不可继续创建子 Agent。

### 1.1 泛化边界

- 编排层只理解通用任务字段、依赖、工具权限、证据、结果和状态，不理解具体领域章节或业务名词。
- 领域差异由额外 Skill 注入：例如论文综述、代码审查、合同分析、岗位分析、数据调查各自提供上下文、工具 allowlist、输出合同和质量标准；`deep-research-task-allocation` 只负责把用户目标拆成可执行任务。
- Lead 的拆解轴可以是对象、时间、假设、来源、风险、步骤、文件模块或对立观点，不能在 Skill 中写死“市场规模/政策/企业/技术”四类。
- 拓扑节点显示真实 `taskId`、任务标题和 `taskKind`；Follow-up 节点只在发现具体冲突或缺口后创建，节点集合和数量完全动态。

### 2. Task Allocation Skill

新增 `.agents/skills/deep-research-task-allocation/SKILL.md`，仅注入 Lead Agent。它要求 Lead 在调用调度工具前生成完整分配信息，每个任务至少包含：

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
  /** 执行批次，不代表固定业务阶段；可理解为 round/generation。 */
  wave: number
}
```

Skill 还要求任务之间边界不重叠、明确独立输入、明确交付格式和停止条件；第一波偏向宽搜索，后续波次必须由已返回结果中的缺口/冲突触发。没有证据的内容必须标记为推测，不能伪装成事实。

### 3. 调度工具与结果协议

`spawn_research_agents` 接收 `ResearchAssignment[]` 和本轮 `wave`，服务端校验任务细节后并发启动子 session。任务可以是网页检索、论文比较、代码库分析、合同条款提取、数据核验、文件处理或其他领域动作；具体能力由 `tools` 和领域 Skill 决定，而不是由编排器硬编码。每个子 Agent 固定返回：

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

Lead 收到一批结果后可以再次调用调度工具；显式完成时调用 `finalize_research`，提交最终结论所引用的证据和仍未解决的问题。服务端不替 Lead 做语义拼接或自动宣称研究完成。

### 4. 服务端组件规划

- `web/server/lib/deepResearchRunner.ts`：DeepResearch 运行入口，连接现有 `/api/chat` SSE 与父运行记录。
- `web/server/lib/researchOrchestrator.ts`：Lead/child session 生命周期、并发池、波次、超时、取消、重试、预算和结果回传。
- `web/.pi/extensions/deep-research-lead.ts`：Lead 专用 Pi extension，注册调度与完成工具。
- `web/server/lib/researchTrace.ts`（规划）：保存父子关系、任务分配 Prompt、证据、状态变更和每个 Pi session 的 trace。
- 子 Agent 研究工具必须采用受控 allowlist（网页搜索、URL 抓取、引用提取等）；研究任务默认不开放写文件和任意 bash，避免共享 workspace 污染。

### 5. 事件与拓扑模型

`/api/chat` 保持 SSE，新增事件：`research_plan`、`subagent_created`、`subagent_started`、`subagent_progress`、`subagent_finished`、`subagent_failed`、`research_wave_started`、`synthesis_started`、`done`。事件至少包含：

```ts
{
  runId: string
  parentAgentId: string | null
  agentId: string
  agentName: string
  role: string
  taskId?: string
  wave: number
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  currentAction?: string
  progress?: number
}
```

运行记录使用一个 parent run 加多个 child agent 记录；事件流统一带 `agentId`，子 trace 独立落盘并在父记录中索引。拓扑边表示 `dispatch` 或 `result`，节点状态由事件驱动，不从时间戳推断。

### 6. 前端拓扑

新增 `DeepResearchTopology.vue`，优先使用 SVG/DAG 布局：Lead 在顶部，按 wave 分层展示子 Agent；后续层展示 Lead 运行时生成的具体 follow-up task（例如核验某个冲突结论、调查某个明确缺口），不是预先固定的“核验/反方/补洞”角色，最终 synthesis 位于底部。需要支持：

- 节点按 Pi `agentName` 展示，内部显示 role/taskId；
- 节点状态颜色、运行脉冲和失败/重试标记；
- 分发边与结果回流边使用不同颜色；
- 边上动画粒子表示任务或结果正在传输；
- 点击节点查看分配 Prompt、当前工具、证据、usage、耗时和子 trace；
- 大规模任务支持缩放、拖拽、按 wave 折叠和仅显示失败/运行中节点。

此前的静态 HTML 拓扑示意已删除，不作为实现依据；正式前端拓扑必须直接消费真实 SSE/trace 的动态父子关系。

### 7. 本地研究资料持久化

每个 DeepResearch run 建立独立资料目录，沿用 `web/server/traces/` 作为根目录但不把子 Agent 文档平铺到旧 trace 文件中：

```text
traces/deep-research/<runId>/
  manifest.json                 # run、Lead、任务、Agent、波次与文件索引
  events.jsonl                  # 父子 Agent 统一事件流
  agents/<agentId>/
    assignment.md               # Lead 实际下发的完整任务 Prompt
    source-material.md          # 第一层：清洗后的原始资料与来源证据
    finding-summary.md          # 第二层：该子 Agent 的关键发现与判断
    trace.json                  # 该 Pi session 的完整 trace
  synthesis/
    final.md                    # Lead 最终综合稿（如任务要求落盘）
```

- `source-material.md` 不是未经处理的网页 HTML，而是经过清洗、去重、保留来源类型、来源标识、标题/路径/查询条件、抓取或读取时间、引用片段和内容 hash 的材料；来源可以是 URL、上传文件、代码文件、数据库结果、工具输出或用户提供内容，每条事实必须能回指来源。
- `finding-summary.md` 只记录子 Agent 的摘要、关键结论、证据引用、可信度、冲突和未回答问题；它不是最终报告，也不能替代第一层材料。
- Lead 默认只接收第二层摘要；发现证据冲突或需要展开时，通过 artifact id 读取对应第一层文档，避免把全部原始材料塞入上下文。
- `manifest.json` 保存 `agentId`、`agentName`、`parentAgentId`、`taskId`、`wave`、状态、模型、时间、文件路径和内容 hash；前端节点点击通过 manifest 定位文档，不猜路径。
- 文档采用临时文件写入后 rename，事件使用追加写；子 Agent 失败时仍保留已完成的第一层材料，并在 manifest 标记 `partial`/`failed`。SSE 只推送 artifact 元数据和状态，不推送大段文档内容。
- 服务端提供只读文档接口：按 `runId/agentId` 获取 assignment、source-material、finding-summary 和 trace；路径必须由服务端根据 manifest 解析，禁止客户端直接提交任意文件路径。

## 成本与取舍

- 采用独立 Pi session 而不是在一个 session 中模拟多个角色，代价是进程、上下文和 token 成本增加；换取上下文隔离、并发能力、独立 trace 和可视化父子关系。
- 采用 Lead 动态派单而不是服务端固定 DAG，增加调度不确定性和预算控制难度，但符合 DeepResearch 的自适应研究范式。服务端只限制资源和安全边界，不替模型决定研究结论。
- 采用结构化证据返回而不是只返回自然语言，增加子 Agent Prompt 和协议约束，但可支持引用校验、冲突发现、质量门禁和前端证据查看。
- 不采用“子 Agent 无限递归”：容易形成成本失控、拓扑不可读和死循环；初始设计固定为 Lead 可多波次派单、子 Agent 不再派单。
- 不采用前端自行推断拓扑：会丢失真实父子关系和失败/重试语义；拓扑必须由服务端事件和持久化关系驱动。
- 持久化两层资料会增加磁盘占用和文档管理成本，但换取可复核、可引用、可断点恢复的研究过程；不把来源材料和摘要合并成单一文件，避免 Lead 后续无法回溯证据。

## 后续扩展路线

1. 实现 Task Allocation Skill、Lead extension 和 `ResearchOrchestrator`，先以现有 Pi RPC/trace 为执行基础。
2. 增加 DeepResearch 事件协议和父子 trace，接入 `UsePage` 的实时运行区域及历史运行详情。
3. 接入研究工具 allowlist、来源/引用校验、冲突检测、预算控制和按 Agent 模型路由。
4. 加入基于证据覆盖率、未回答问题和引用完整性的自动质量门禁；必要时让 Lead 重新派发核验波次。
5. 将静态拓扑示意替换为真实 DAG 布局，支持长任务、失败重试、断线重连和历史运行复盘。

## 验证口径

- 尚未实现服务端调度、SSE 事件、Task Allocation Skill、真实 Pi 子 session 和前端组件；以上均为待验证项。
- 临时静态 HTML 拓扑稿已删除；后续只保留基于真实运行事件的前端拓扑实现，避免把示例节点误读为固定架构。
