---
name: repo-bootstrap
description: 初始化新 Git 仓库的协作基础设施：开发决策手记 Skill、GitHub Issue 任务生命周期 hooks、push 后自动关闭 Issue，以及项目级 AGENTS.md 约定。用于新仓库或尚未建立这些约定的仓库；不会覆盖已有配置。
---

# 仓库协作初始化

在目标仓库根目录执行本 Skill 的初始化脚本：

```bash
bash /path/to/repo-bootstrap/scripts/init_repo.sh
```

脚本默认是保护性的：发现目标文件已存在就停止并报告，不覆盖现有内容。只有用户明确要求合并或覆盖时，才使用 `--force`，并先检查已有配置。

初始化完成后：

1. 阅读生成的 `.agents/skills/project-dev-notes/SKILL.md`，按索引只加载与当前任务相关的记录。
2. 运行 `scripts/install-task-hooks.sh` 启用 hooks。
3. 开始开发前，先写一份短计划，再运行 `scripts/start-task.sh "计划标题" <计划文件>` 创建并绑定 GitHub Issue。
4. 每次提交都会追加 `Task-Issue: #<number>` trailer；只有成功 push 后，GitHub Actions 才会关闭对应 Issue。push 失败不关闭。
5. 任务结束时更新开发手记：记录真实文件位置、验证命令和仍待验证的项目，不把计划写成事实。

## 记录边界

开发手记只记录会影响后续实现的决策和事实：为什么这样设计、接口/schema、接入点、取舍、验证证据和后续路线。不要记录逐日流水账、重复代码内容或未经验证的猜测。具体字段模板见 [references/decision-record.md](references/decision-record.md)。

## Issue 边界

一个 Issue 对应一次可独立推送的开发任务，正文必须能让另一位 Agent 在没有聊天上下文时继续工作，至少包含：目标、范围与明确排除项、验收条件、计划文件、仓库/分支/创建提交，以及完成方式。模板见 [references/issue-template.md](references/issue-template.md)。

## 安全与失败处理

- 创建 Issue 需要本机 `gh` 已登录；未登录时停止，不创建半成品绑定文件。
- hooks 只要求活动 Issue 编号有效，不联网；这样离线提交仍能工作。
- 自动关闭由 GitHub Actions 的 `push` 事件完成，并从提交 trailer 解析 Issue；不要用本地 `post-push` 假设替代它。
- 初始化脚本不修改远端、不提交代码、不删除已有文件。
