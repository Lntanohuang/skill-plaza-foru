# 005 新仓库协作初始化 Skill

- 状态：已实现（GitHub 远端创建与 Actions 关闭仍待真实仓库验证）。
- 动机：新仓库需要一次性建立开发决策手记、任务 Issue 生命周期和项目级协作约定，减少多 Agent 在没有共享上下文时的冲突与遗漏。
- 约定细节：Skill 位于 `.agents/skills/repo-bootstrap/`；`scripts/init_repo.sh` 在目标 Git 仓库内生成 `.agents/skills/project-dev-notes/`、`.githooks/{pre-commit,pre-push,prepare-commit-msg}`、`scripts/{start-task,install-task-hooks}.sh`、`.github/workflows/close-task-issue.yml`，并向 `AGENTS.md` 追加带 marker 的协作规则。开发手记每条记录包含状态、动机、约定细节、成本与取舍、验证、后续路线；Issue 正文包含目标、范围/排除项、验收条件、计划和仓库/分支/创建提交。提交 trailer `Task-Issue: #<number>` 关联 Issue，成功 push 后由 Actions 关闭。
- 成本与取舍：初始化脚本默认不覆盖已有目标，发现冲突时在任何写入前停止；`--force` 作为显式覆盖开关。Issue 创建依赖 `gh` 登录；关闭放在 Actions，因为 Git 没有可靠的原生 post-push hook。没有引入本地自动关闭，避免 push 失败或远端未收到时误关 Issue。
- 验证：`python3 /Users/erichuang/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/repo-bootstrap` 已通过；在 `/private/tmp/repo-bootstrap-test` 完成初始化、无 Issue hook 拦截、重复初始化无写入演练。真实 GitHub Issue 创建、提交 push 和 Actions 关闭待验证。
- 后续扩展路线：在一个可测试的 GitHub 仓库验证 `gh issue create`、提交 trailer、push 事件和 `issues: write` 权限；如团队需要 PR 合并后再关闭，再把关闭触发条件从任意 push 改为 merge/push 策略并更新模板。
