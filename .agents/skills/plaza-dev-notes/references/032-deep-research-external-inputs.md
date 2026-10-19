# 032 · DeepResearch 外部研究输入：工作流原语与论文启发

**状态**：研究输入已整理，作为 029 设计的外部依据，架构结论待长任务验证。原 032（Anthropic Basic Workflows 启发）与 034（论文检索）于 2026-10-19 合并，见 076；同期 Pi Provider 计费事故的运行约定由 035 承接。

## Anthropic Basic Workflows 三原语

[官方页面](https://platform.claude.com/cookbook/patterns-agents-basic-workflows)（[Notebook 源码](https://github.com/anthropics/claude-cookbooks/blob/main/patterns/agents/basic_workflows.ipynb)）提供三个可组合的控制流原语，可作 `ResearchOrchestrator` 的基础抽象（原文只是示例而非生产代码）：

1. **Chain**：前一步输出作后一步输入，适合结构化转换与串行质量处理。
2. **Parallel**：独立输入并行执行，适合第一轮宽搜索、不同来源/假设的独立调查；必须受并发、超时和预算限制。
3. **Route**：按输入特征选择能力路径再执行；应路由到 `taskKind`、领域 Skill 或工具权限，不写死业务角色。

组合示意（非强制阶段）：用户目标 → Lead route/plan → parallel wave → structured reducer/chain → quality gate → dynamic follow-up → final synthesis。质量判断与是否追加任务仍由 Lead 决定。

接入协议调整：XML 选择结果改受 schema 校验的 JSON；`taskKind` 是开放描述字段不作权限依据；Routing 只保存选择结果与可审计理由，不依赖隐藏 CoT；Chain 每步只传受限结构化结果或 artifact id；Parallel 结果按 claim/source hash 去重合并。否决直接照搬 notebook 的字符串传递（上下文膨胀、类型漂移、错误累积）。

## 论文启发索引

- [STORM, arXiv:2402.14207](https://arxiv.org/abs/2402.14207)：多视角问题生成与提纲综合。启发 coverage matrix；不把视角固化为业务角色。
- [Graph of Thoughts, arXiv:2308.09687](https://arxiv.org/abs/2308.09687)：中间信息建模为可合并/循环/反馈的图。启发 merge/feedback；循环需预算与停止条件。
- [Tree of Thoughts, arXiv:2305.10601](https://arxiv.org/abs/2305.10601)：保留多候选路径搜索评估。启发高风险结论保留 competing claims。
- [Plan-and-Solve, arXiv:2305.04091](https://arxiv.org/abs/2305.04091)：先规划再执行。启发计划门禁与完成条件。
- [Least-to-Most, arXiv:2205.10625](https://arxiv.org/abs/2205.10625)：先易后难组合。启发依赖图；不等于必须串行。
- [AutoGen, arXiv:2308.08155](https://arxiv.org/abs/2308.08155)：可编程多 Agent 对话。启发交互协议显式化。
- [MetaGPT, arXiv:2308.00352](https://arxiv.org/abs/2308.00352)：标准化工作流与中间产物。启发 assignment/finding/state 固定 schema；不照搬软件角色流水线。
- [ChatDev, arXiv:2307.07924](https://arxiv.org/abs/2307.07924)：通信链与沟通式去幻觉。启发阶段边界审查/验证。
- [MemGPT, arXiv:2310.08560](https://arxiv.org/abs/2310.08560)：分层虚拟上下文与长期记忆。启发 source material / finding / canonical state / checkpoint 分层；不只依赖对话压缩。
- [Reflexion, arXiv:2303.11366](https://arxiv.org/abs/2303.11366)：反馈转为可复用记忆。启发记录失败原因与决策。
- [Multiagent Debate, arXiv:2305.14325](https://arxiv.org/abs/2305.14325)：多轮辩论收敛。启发冲突时独立核验；多数票不能替代证据。
- [IterResearch, arXiv:2511.07327](https://arxiv.org/abs/2511.07327)：迭代式 workspace/report 重建。启发 Lead 每轮从外部 state 与 artifact 索引恢复。

## 综合架构结论

```text
Lead plan → coverage/split gate → independent evidence collection
  → claim-level reducer → conflict classification and verification
  → canonical state reconstruction → gap/risk-driven follow-up → final synthesis
```

新增或强化的协议字段：`coverageMatrix`、`scope`、`excludes`、`stopCriteria`、`claimId`、`stateVersion`、`supports/refutes`、`sourceQuality`、`risk`。Sub Agent 只提交 Finding；Orchestrator 管理执行与版本；Lead 批准语义状态与 Follow-up（详见 029）。

## 成本与取舍

- 多视角、候选分支与冲突核验增加调用成本；只对高风险 claim、证据冲突或覆盖不足启用。多 Agent 框架论文多为系统论文或 arXiv 预印本，单一实验结果不能外推为质量保证，需本项目长任务实测协调成本、引用准确率、覆盖率与延迟。

## 后续扩展路线

- 把 coverage matrix、claim graph、source quality 加入 schema；以 STORM/GoT 思想设计可反馈的研究计划但限制循环深度与预算；用冲突注入数据集测试 claim reducer 与不确定性表达；对比单 Lead / 固定并行 / 动态 Follow-up 三方案的质量与成本。
