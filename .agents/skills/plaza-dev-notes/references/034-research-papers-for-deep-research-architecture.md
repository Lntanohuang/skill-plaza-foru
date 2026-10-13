# 034 · DeepResearch 架构相关论文检索与启发

**状态**：研究输入已整理，架构结论待长任务验证。

## 动机

为验证任务拆分、并行协作、外部状态、长程记忆、证据冲突和研究综合方案，检索了原始论文与公开 arXiv 记录。Tavily 当前超过套餐额度；本轮 Pi 子 Agent 因模型提供方余额不足未产生有效结果，因此以下内容是主 Agent 基于原始论文摘要整理的研究输入，不冒充子 Agent 结果。

## 论文索引与约定启发

- [STORM, arXiv:2402.14207](https://arxiv.org/abs/2402.14207)：多视角问题生成、可信来源检索、信息策展和提纲综合。启发 coverage matrix，但不应把视角固化成固定业务角色。
- [Graph of Thoughts, arXiv:2308.09687](https://arxiv.org/abs/2308.09687)：把中间信息建模为可合并、循环和反馈的图。启发研究计划不能只支持线性 chain，应支持 merge/feedback；但循环仍需预算和停止条件。
- [Tree of Thoughts, arXiv:2305.10601](https://arxiv.org/abs/2305.10601)：保留多个候选路径并搜索/评估。启发高风险结论可以保留 competing claims，不应过早压成单一答案。
- [Plan-and-Solve Prompting, arXiv:2305.04091](https://arxiv.org/abs/2305.04091)：先规划再执行。启发计划门禁和 assignment 完成条件。
- [Least-to-Most Prompting, arXiv:2205.10625](https://arxiv.org/abs/2205.10625)：先解决简单子问题再组合复杂问题。启发依赖图和逐步细化，但不意味着所有研究任务都必须串行。
- [AutoGen, arXiv:2308.08155](https://arxiv.org/abs/2308.08155)：可编程多 Agent 对话和工具/人工介入。启发交互协议必须显式，而不是依赖自由对话。
- [MetaGPT, arXiv:2308.00352](https://arxiv.org/abs/2308.00352)：标准化工作流和中间产物降低级联错误。启发 assignment、finding、state 使用固定 schema；不应照搬固定软件角色流水线。
- [ChatDev, arXiv:2307.07924](https://arxiv.org/abs/2307.07924)：通过通信链和沟通式去幻觉协作。启发在阶段边界加入审查/验证，不让错误结果无条件进入下一阶段。
- [MemGPT, arXiv:2310.08560](https://arxiv.org/abs/2310.08560)：分层虚拟上下文和长期记忆。启发 source material、finding summary、canonical state、checkpoint 分层；不能只依赖对话压缩。
- [Reflexion, arXiv:2303.11366](https://arxiv.org/abs/2303.11366)：把反馈转为可复用的语言记忆。启发记录失败原因、验证反馈和决策，而不是只记录成功结论。
- [Multiagent Debate, arXiv:2305.14325](https://arxiv.org/abs/2305.14325)：多实例多轮提出、辩论和收敛。启发冲突时追加独立核验；其结果不能等同于外部事实核验，不能用多数票替代证据。
- [IterResearch, arXiv:2511.07327](https://arxiv.org/abs/2511.07327)：迭代式 workspace/report 重建。启发 Lead 每轮从外部 state 和 artifact 索引恢复，而不是无限累积 transcript。

## 综合架构结论

```text
Lead plan
  → coverage/split gate
  → independent evidence collection
  → claim-level reducer
  → conflict classification and verification
  → canonical state reconstruction
  → gap/risk-driven follow-up
  → final synthesis
```

新增或强化的协议字段：`coverageMatrix`、`scope`、`excludes`、`stopCriteria`、`claimId`、`stateVersion`、`supports/refutes`、`sourceQuality`、`risk`。Sub Agent 只提交 Finding；Orchestrator 管理执行和版本；Lead 批准语义状态和 Follow-up。

## 成本与取舍

多视角、候选分支和冲突核验会增加调用成本；只有高风险 Claim、证据冲突或覆盖不足时才启用。多 Agent 框架论文多为系统论文或 arXiv 预印本，不能把单一实验结果直接外推为 DeepResearch 的质量保证；需要用本项目长任务基准实测协调成本、引用准确率、覆盖率和延迟。

## 后续扩展路线

1. 把 coverage matrix、claim graph 和 source quality 加入 schema。
2. 以 STORM/GoT 的思想设计可反馈的研究计划，但限制循环深度和预算。
3. 用冲突注入数据集测试 claim reducer、独立核验和不确定性表达。
4. 比较单 Lead、固定并行、多 Agent 动态 Follow-up 三种方案的质量/成本。

## Pi Provider 运行约定

本轮启动子 Agent 时曾在命令中显式指定 `openrouter/anthropic/claude-sonnet-4.6`，这不是提示词或项目配置要求，而是调用方的错误选择；该参数覆盖了全局默认模型，并导致请求走 OpenRouter API 余额。当前用户 Pi 配置实际为 `~/.pi/agent/settings.json` 的 `defaultProvider: openai-codex`、`defaultModel: gpt-6-sol`，且 `auth.json` 仅有 `openai-codex` OAuth；OpenRouter 可用性来自环境中的 `OPENROUTER_API_KEY`，不应被误当成用户订阅。

后续子 Agent 调用应默认继承 Lead 的 provider/model；若没有显式覆盖，使用 `openai-codex` OAuth。研究编排配置不得硬编码 OpenRouter；若需要跨 provider，应先经过预算和凭据检查，并在事件中记录 provider、model 和 billing source。

## 验证口径

已通过 arXiv API 获取并核对上述主要论文的题目、摘要和链接（部分论文的会议归属未在本记录中断言）。已核对 Pi 的 provider 配置、认证状态和本轮子 Agent 调用参数；尚未完成同行评审元分析、实现验证或真实 DeepResearch 长任务回归。
