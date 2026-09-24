#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "用法: scripts/start-task.sh <计划标题> <计划文件>" >&2
  exit 2
fi

title=$1
plan_file=$2
if [[ ! -f "$plan_file" ]]; then
  echo "计划文件不存在: $plan_file" >&2
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI 未登录或令牌已失效，请先执行: gh auth login -h github.com" >&2
  exit 1
fi

repo_root=$(git rev-parse --show-toplevel)
branch=$(git symbolic-ref --quiet --short HEAD || git rev-parse --short HEAD)
base_body=$(mktemp)
trap 'rm -f "$base_body"' EXIT
{
  echo "## 总结后的开发计划"
  echo
  cat "$plan_file"
  echo
  echo "## 开发上下文"
  echo
  echo "- 仓库: $(gh repo view --json nameWithOwner --jq .nameWithOwner)"
  echo "- 分支: $branch"
  echo "- 创建时提交: $(git rev-parse --short HEAD)"
  echo "- 完成方式: 成功执行 git push 后由 GitHub Actions 自动关闭此 issue。"
} > "$base_body"

issue_url=$(gh issue create --title "开发计划：$title" --body-file "$base_body")
issue_number=${issue_url##*/}
if [[ ! "$issue_number" =~ ^[0-9]+$ ]]; then
  echo "无法从 gh issue create 输出解析 issue 编号: $issue_url" >&2
  exit 1
fi

printf '%s\n' "$issue_number" > "$repo_root/.git/task-issue"
printf '%s\n' "$issue_url" > "$repo_root/.git/task-issue-url"
echo "已创建并绑定 issue #$issue_number: $issue_url"
