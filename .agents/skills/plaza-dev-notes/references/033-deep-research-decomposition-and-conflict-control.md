# 033 · DeepResearch 任务拆分、状态归属与冲突控制

**状态**：设计定稿，待实现。

## 动机

动态多 Agent 研究的主要风险不是能否并行，而是任务粒度失控、覆盖不完整、多个 Agent 同时维护不可合并的全局状态，以及不同来源或不同任务结果发生冲突。

## 约定细节

### 1. 任务拆分闸门

Lead 先建立 `question/claim coverage matrix`，再生成 assignment。每个问题或候选结论必须有负责人、证据要求、完成条件和状态；assignment 增加或等价表达 `scope`、`excludes`、`inputRefs`、`priority`、`stopCriteria`。

只有同时满足“可独立执行、证据路径明显不同、具有工具/上下文隔离收益、结果可结构化合并”时才拆分。强依赖、共享上下文、任务很小或合并成本高时合并为一个任务。第一波允许宽搜索，后续拆分必须由具体缺口、冲突或风险触发；不允许子 Agent 递归派单。

服务端或 Lead 计划门禁检查：重复范围、未覆盖问题、循环依赖、缺少证据要求、任务数/并发/预算上限。拆分不是越细越好，目标是最小协调成本下的完整覆盖。

### 2. 状态归属

- **Sub Agent**：只拥有本地工作上下文，产出追加式 finding 和 artifact，不直接修改全局状态。
- **Orchestrator**：拥有执行状态、任务状态、版本、事件和 artifact 索引，负责幂等提交和并发合并。
- **Lead**：拥有研究语义判断，批准关键 claim、解释冲突、决定 follow-up 和完成研究。
- **SSE/拓扑**：只是 `manifest/events` 的投影，不作为事实源。

全局状态按三层保存：不可变 `source-material`、结构化 `finding`、Lead 批准的 canonical research state。每个 finding 携带 `taskId`、`stateVersion`、evidence、assumptions、confidence、contradictions 和 unansweredQuestions；状态提交采用版本检查和幂等事件。

### 3. 冲突处理

不要直接覆盖冲突结果，也不要以多数票替代证据判断。先把结果归一化为原子 claim，并按来源质量、时间范围、口径/定义、方法、证据直接性和独立 corroboration 分类判断。冲突可能是事实矛盾、时间变化、定义不同、样本不同或任务重叠。

可解释或可消解的冲突由 Lead 更新 canonical claim 并保留被否定/限定的证据；无法消解的冲突保留 competing claims，降低置信度，并生成针对冲突的 follow-up assignment。最终报告必须显式表达未决冲突和不确定性。

### 4. 质量门禁

每一波完成后检查 coverage、duplicate scope、证据完整性、冲突数、未回答问题和预算；未通过时只针对缺口或冲突生成 follow-up，不重新复制整轮任务。高风险 claim 可安排独立来源或独立方法的双重核验，但普通 claim 不默认重复执行。

## 成本与取舍

- 覆盖矩阵、计划门禁和 claim 归一化增加协议与 Lead 调用成本，但比过度并行后再人工修复更便宜。
- 禁止 Agent 直接写全局状态，牺牲部分实时性，换取可回放、可重试和可解释合并；被否决的是共享可变黑板。
- 冲突不强行自动裁决会保留更多不确定性并触发额外任务，但避免把错误共识伪装成事实。
- 不默认对所有结论做双重核验，以免并行成本翻倍；仅按风险和冲突触发验证。

## 后续扩展路线

1. 扩展 `ResearchAssignment` 与 `ResearchStateSnapshot`，加入 scope/coverage/version/claim 状态字段。
2. 在 `ResearchOrchestrator` 增加计划门禁、幂等 finding 提交、claim 去重和冲突分类。
3. 在 Lead Skill 中加入拆分/合并准则、覆盖矩阵和冲突 follow-up 模板。
4. 前端显示覆盖率、冲突、未回答问题、任务重复和状态版本，而不只显示 Agent 数量。

## 验证口径

当前为设计约定；尚未实现计划门禁、canonical claim reducer 或冲突 follow-up 的端到端验证。
