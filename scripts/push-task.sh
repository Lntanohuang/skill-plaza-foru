#!/usr/bin/env bash
set -euo pipefail

repo_root=$(git rev-parse --show-toplevel)
issue_file="$repo_root/.git/task-issue"
if [[ ! -s "$issue_file" ]]; then
  echo "没有活动 issue。请先执行: scripts/start-task.sh '<计划标题>' <计划文件>" >&2
  exit 1
fi
issue_number=$(tr -d '[:space:]' < "$issue_file")
if [[ ! "$issue_number" =~ ^[0-9]+$ ]]; then
  echo "活动 issue 编号无效: $issue_number" >&2
  exit 1
fi

# 清空 push alias，避免包装器递归；pre-push 仍会执行。
set +e
git -c alias.push= push "$@"
push_status=$?
set -e
if [[ $push_status -ne 0 ]]; then
  echo "push 失败，issue #$issue_number 保持开启。" >&2
  exit "$push_status"
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "push 已成功，但 GitHub CLI 未登录，无法自动关闭 issue #$issue_number。请认证后重试: gh issue close $issue_number" >&2
  exit 1
fi

gh issue close "$issue_number" --comment "对应开发计划已成功推送。"
rm -f "$issue_file" "$repo_root/.git/task-issue-url"
echo "已关闭 issue #$issue_number。"
