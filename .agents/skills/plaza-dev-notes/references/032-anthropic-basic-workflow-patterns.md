# 032 · Anthropic Basic Workflows 对 DeepResearch 编排的启发

**状态**：设计建议，待验证；不替代 029 的动态 Lead 编排约定。

## 动机

Anthropic Cookbook 的 Basic workflows 提供了三个可组合的多模型工作流原语：Prompt Chaining、Parallelization、Routing。它不是 DeepResearch 算法或生产系统，但可以作为 `ResearchOrchestrator` 的基础控制流抽象。

## 约定细节

### 三个原语

1. **Chain**：前一步输出作为后一步输入，适合结构化转换和串行质量处理，例如 `extract → normalize → assess → format`。
2. **Parallel**：对独立输入并行执行，适合第一轮宽搜索、不同文件/来源/假设的独立调查；必须受并发、超时和预算限制。
3. **Route**：先根据输入特征选择能力路径，再执行专门任务；应路由到 `taskKind`、领域 Skill 或工具权限，不应写死业务角色。

### 在 DeepResearch 中的组合

以下为可选组合示意，不是强制阶段或固定 DAG；质量判断、语义综合及是否追加任务仍由 Lead 决定。

```text
用户目标
  → Lead route/plan
  → parallel research wave
  → structured reducer/chain
  → quality gate
  → dynamic follow-up route
  → final synthesis chain
```

- Lead 负责 route 和计划，服务端负责编排 parallel。
- 子 Agent 输出先结构化解析，再进行 reducer/chain，不把完整中间文本反复拼接到 Lead 上下文。
- Follow-up 的 route 输入来自新增 finding、冲突和未回答问题；由 Lead 动态生成具体任务。

### 协议与安全调整

- 建议将 Cookbook 的 XML 选择结果改为受 schema 校验的 JSON；验证 route 是否存在、工具 allowlist、依赖和预算。`taskKind` 仍是开放描述字段，不作为权限依据；授权由服务端决定。
- Routing 只需要保存选择结果和可审计理由摘要，不持久化或依赖隐藏 Chain-of-Thought。
- Chain 每一步只传递受限结构化结果或 artifact id；完整原文落盘到研究 artifact，避免链式上下文增长。
- Parallel 结果通过 `ResearchFinding[]` 合并，并按 claim/source hash 去重。

## 成本与取舍

- 这三个原语简单、可组合、易于观测，适合先实现最小可用编排器；代价是单纯组合不能自动解决研究质量和长程记忆问题。
- 被否决的方案是直接照搬 notebook 的字符串传递：容易造成上下文膨胀、类型漂移和错误累积；本项目改用结构化协议、artifact 引用和外部 Research State。
- Routing 增加一次分类模型调用，但可避免把不合适的 Skill/工具交给 Agent；低风险任务可以由规则优先、模型兜底。

## 后续扩展路线

1. 在 `ResearchAssignment` 中明确 `taskKind`、`tools`、`outputSchema`，作为 route 结果的受控协议。
2. 在规划的 `ResearchOrchestrator` 中先复用依赖调度、并发池及能力选择，不必为三个概念额外建立通用工作流引擎；统一产出真实 SSE 事件和 Trace。
3. 用长任务验证不同组合的准确率、成本、延迟和上下文占用。

## 验证口径

已读取 [官方页面](https://platform.claude.com/cookbook/patterns-agents-basic-workflows) 及其 [Notebook 源码](https://github.com/anthropics/claude-cookbooks/blob/main/patterns/agents/basic_workflows.ipynb)。原文明确只是示例而非生产代码；其 chain 传递前一步结果，不是自动累积全部历史，但输出仍可能膨胀或失真。排序、格式化等确定性步骤优先用代码，不必照搬示例中的多次 LLM 调用。

当前仅完成设计映射；Cookbook 模式尚未接入 `ResearchOrchestrator`，待实现和端到端验证。没有据此修改运行时代码或改变 031 的既定实现计划。
