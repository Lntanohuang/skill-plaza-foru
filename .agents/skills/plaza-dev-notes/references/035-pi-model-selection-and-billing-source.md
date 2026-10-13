# 035 · Pi 通用模型选择与计费来源

**状态**：已实现全局 Pi Skill，项目运行时接入待实现。

## 动机

本轮子 Agent 曾因调用方显式指定第三方路由模型而走错误的计费渠道。模型选择规则应服务于所有日常 Pi 使用，而不是绑定 DeepResearch；同时模型迭代快速，不能把具体型号写成永久默认值。

## 约定细节

- 全局 Pi 专属 Skill：`~/.pi/agent/skills/pi-model-selection/SKILL.md`。
- 不放在项目 `.agents/` 下，不进入项目技能接入点。
- 用户明确指定 provider、模型或 thinking 时优先遵循。
- 未指定时，子 Agent 或新 Pi 进程继承当前会话的 `PI_PROVIDER`、`PI_MODEL` 和同一模型系列。
- 需要降级/升级时先查询当前 Pi catalog 和认证状态，不硬编码具体型号。
- 按 L0–L3 复杂度选择型号与 thinking；简单任务优先轻量和低 thinking，复杂任务优先当前系列中经验证的适配型号。
- 不因为环境中存在 API key 就自动切换 provider；计费来源必须符合用户意图。
- Trace 如需记录路由，只记录 provider、model、thinking、父会话模型和选择原因，不记录凭据。

## 成本与取舍

继承当前会话最能保证认证、上下文窗口和计费可预期，但不一定是所有子任务的最低成本方案；因此允许同 provider、同系列的受控降级。动态查询 catalog 比固定型号多一次检查成本，但可以避免模型下线或型号迭代后的陈旧配置。被否决的是项目内硬编码具体模型，以及把该规则写成只适用于 DeepResearch 的默认 Agent 分工。

## 后续扩展路线

1. 将全局 Skill 规则接入项目 `researchOrchestrator` 的模型选择和预算检查，但不复制 Skill 内容。
2. 在任务 manifest/SSE 中暴露实际 provider、model、thinking 与计费来源。
3. 用日常 Pi 任务和长任务分别验证模型路由、延迟、质量和成本。

## 验证口径

已将 Skill 从项目 `.agents/skills/` 移至 Pi 全局目录 `~/.pi/agent/skills/pi-model-selection/`，删除项目副本；已移除固定型号示例和 DeepResearch 默认分工。当前项目运行时尚未接入该 Skill。
