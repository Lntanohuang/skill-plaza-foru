# 031 · DeepResearch Lead 上下文预算、压缩与会话交接

**状态**：设计定稿，待实现。

## 动机

DeepResearch 的 Lead Agent 会经历多轮“派单 → 收集摘要 → 判断缺口 → Follow-up → 综合”。如果把每个子 Agent 的完整结果、工具输出和原始资料直接追加到 Lead Pi session，上下文会持续增长，最终触发压缩、上下文溢出或摘要失真。必须把 Pi 原生 compaction、外部研究资料索引和 Lead session 交接结合起来，而不是只依赖模型窗口变大。

## 约定细节

### 1. Lead 不接收原始材料全文

- 子 Agent 的完整抓取内容只落盘到 `source-material.md`，不直接作为 Lead tool result 返回。
- Lead 默认只接收受限大小的 `finding-summary.md` 摘要、证据索引和 artifact id。
- Lead 需要展开时调用只读 `read_research_artifact`，只读取指定 Agent、指定文档和指定片段；服务端对单次读取做字节/Token 上限。
- 调度工具返回固定大小的 `ResearchFinding`，超出上限的完整结果只保存在本地 artifact，并返回 `artifactId`、摘要和截断提示。

### 2. 外部 Research State 是事实源

每个 run 维护一个与 Pi 对话分离的状态快照：

```text
traces/deep-research/<runId>/state/
  current-state.json
  current-state.md
  checkpoints/<checkpointId>.json
```

`current-state.json` 至少包含：

```ts
interface ResearchStateSnapshot {
  runId: string
  goal: string
  constraints: string[]
  outputContract?: string
  completedTaskIds: string[]
  activeTaskIds: string[]
  evidenceRefs: string[]
  keyFindings: string[]
  contradictions: string[]
  unansweredQuestions: string[]
  pendingFollowups: string[]
  decisions: string[]
  lastCheckpointId: string
  context: {
    tokens: number | null
    window: number | null
    ratio: number | null
  }
}
```

每个批次完成后，编排器先更新该快照，再把压缩后的状态摘要交给 Lead。状态快照不是最终报告，也不替代第一层/第二层研究资料。

### 3. 分级上下文预算

根据 Pi `get_session_stats.contextUsage` 或 `ctx.getContextUsage()` 计算当前 Lead 上下文占用率：

- **低于 60%**：正常运行，只返回摘要和必要证据。
- **60%～75%**：禁止把多个摘要原文拼接进 Prompt，改用 state snapshot + artifact 引用；Follow-up 任务必须更小。
- **75%～85%**：主动触发 Pi compaction，使用 DeepResearch 专用摘要指令保留目标、约束、已完成任务、关键证据、冲突、决策和下一步。
- **高于 85% 或 compaction 失败**：创建新的 Lead session，执行 checkpoint handoff，不再向旧 session 追加内容。

阈值是相对当前模型 `contextWindow` 的比例，不写死某个 Token 数。`reserveTokens` 必须为最终回答和 compaction 请求预留空间；项目设置需要显式配置 `compaction.enabled`、`reserveTokens` 和 `keepRecentTokens`。

### 4. 使用 Pi 原生 compaction，但定制摘要内容

- DeepResearch Lead session 启用 Pi 自动 compaction。
- 监听 `compaction_start`、`compaction_end`、`session_compact_failed` 和 `agent_settled`，把结果写入父子事件流和 trace。
- Lead extension 使用 `session_before_compact` 提供定制摘要，摘要必须包含 `ResearchStateSnapshot` 的关键字段，而不是只概括自然语言对话。
- compaction 仍保留 Pi 的原始 session entries；本地 artifact、manifest 和 state snapshot 独立保存，保证压缩不会丢研究材料。
- 子 Agent 也使用 Pi compaction，但由于子任务应短而独立，优先采用“完成即结束”，不让单个子 Agent 无限多轮。

### 5. Lead Session Handoff

新 Lead session 不是丢失上下文，而是从 checkpoint 恢复：

1. 停止旧 Lead 接收新的 Follow-up。
2. 将最新 `current-state.json` 固化为 checkpoint。
3. 启动新的 Pi RPC session，使用新的 `--name`，例如 `lead-checkpoint-02`。
4. 注入一份受限的 handoff Prompt：目标、约束、当前状态、关键结论、未回答问题、artifact 索引和允许的下一步工具。
5. 在 manifest 中登记 `replacesAgentId`、`checkpointId` 和 `parentAgentId`，拓扑显示为 Lead session 的接力边。
6. 旧 session 只读保留，用于审计和 Trace 复盘。

handoff Prompt 禁止包含所有历史消息和所有原始资料，只包含状态摘要与可按需读取的 artifact 引用。

### 6. 结果压缩与去重

- 子 Agent 结果先经过结构化解析，再进入 Lead context；不把连续工具事件、重复来源和完整网页内容直接拼接。
- 证据按 `contentHash`、来源标识和 claim 去重。
- Lead 只收到新增或发生变化的 findings；历史 findings 通过 `findingId`/`artifactId` 引用。
- 每轮保留一个短的“新增事实 / 冲突 / 缺口 / 决策”增量摘要，避免重复发送完整 state。

### 7. 溢出与失败处理

- Pi 的 overflow recovery 和自动 compaction 是第一层兜底；服务端必须等待 `agent_settled`，不能在 `agent_end` 立即判定任务结束。
- compaction 失败时，不重复发送同一个超大 Prompt；先落盘 state/checkpoint，再执行 Lead session handoff。
- handoff 失败时，保留已完成子 Agent 资料，运行状态标记 `paused_context_limit`，允许用户重试/继续，而不是丢弃整个 run。
- 每次压缩和 handoff 记录前后上下文占用、原因、摘要版本和恢复 session。

## 成本与取舍

- 原生 compaction 会产生额外摘要模型调用；这是可接受的上下文维护成本，不能用无限扩大窗口替代。
- Lead session handoff 会增加一次初始化和状态注入成本，但比在接近上限时继续追加内容更可靠，也使超长任务可以继续。
- 外部 state/artifact 索引增加文件和协议复杂度，但保证压缩后仍能回溯证据；被否决的方案是只依赖 Pi compaction summary，因为自然语言摘要不能稳定承载全部任务图、证据引用和文件关系。
- 被否决的方案是把所有子 Agent 结果永久留在 Lead transcript 中；它会重复消耗上下文并放大来源冲突，改为摘要 + artifact 按需读取。

## 后续扩展路线

1. 在 `ResearchOrchestrator` 中增加 context budget controller 和 checkpoint store。
2. 在 Lead extension 中实现 `session_before_compact` 自定义摘要和 `read_research_artifact` 工具。
3. 在 PiRunner 中统一记录 compaction、overflow、handoff 和 context usage 事件。
4. 前端拓扑显示 context ratio、compaction 节点、Lead session 接力和 checkpoint 恢复状态。
5. 用长任务实测不同模型窗口下的压缩频率、handoff 成功率、摘要可恢复性和最终报告质量。

## 验证口径

尚未实现 context budget controller、DeepResearch 自定义 compaction、Lead handoff 和 checkpoint 恢复；当前仅完成设计，待真实长任务验证。
