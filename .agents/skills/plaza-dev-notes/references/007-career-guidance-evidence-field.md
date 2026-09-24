# 007 · 就业指导依据转入开发侧 evidence 字段

- 状态：已实现（2026-09-23；真实 career-guidance 会话待回归）。
- 动机：用户明确不需要在最终报告中阅读依据表；依据仍需保留，供开发人员检查模型判断质量和后续优化。
- 约定细节：用户正文只保留结论、缺口/风险、建议、行动和核实问题；`report-meta/1` 新增可选 `evidence[]`，记录岗位要求/用户材料与判断的对应关系，字段包括 `id`、`requirement`、`support`、`status`、`sourceIds`、`sectionId`。`status` 为 `matched/partial/gap/unknown`。服务端解析并校验其来源引用，侧车仍在终态剥离。
- 成本与取舍：增加少量侧车 token 和开发可读结构，换取用户报告更简洁；保持 schema 版本不变，`evidence` 可选以兼容历史记录和缺失依据的旧输出。
- 验证：已完成静态实现与前端构建验证；真实模型是否稳定生成 evidence、开发详情页是否需要单独展示，待回归评估。
- 后续扩展路线：收集三类真实样本后，决定是否在 RunDetailPage 增加 evidence 调试面板，并补充 evidence 与正文结论的一致性检查。
