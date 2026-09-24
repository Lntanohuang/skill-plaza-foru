#!/usr/bin/env bash
set -euo pipefail

force=false
if [[ "${1:-}" == "--force" ]]; then force=true; shift; fi
[[ $# -eq 0 ]] || { echo "用法: init_repo.sh [--force]" >&2; exit 2; }
repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "请在 Git 仓库内运行。" >&2; exit 1; }
script_dir=$(cd "$(dirname "$0")" && pwd)
template_dir=$(cd "$script_dir/../templates" && pwd)

copy_file() {
  local src=$1 dst=$2
  if [[ -e "$dst" && "$force" != true ]]; then
    echo "目标已存在，未覆盖: $dst" >&2; return 1
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
}

targets=(
  "$repo_root/.agents/skills/project-dev-notes/SKILL.md"
  "$repo_root/.agents/skills/project-dev-notes/references/decision-record-format.md"
  "$repo_root/.githooks/pre-commit"
  "$repo_root/.githooks/pre-push"
  "$repo_root/.githooks/prepare-commit-msg"
  "$repo_root/scripts/start-task.sh"
  "$repo_root/scripts/install-task-hooks.sh"
  "$repo_root/.github/workflows/close-task-issue.yml"
)
if [[ "$force" != true ]]; then
  for target in "${targets[@]}"; do
    if [[ -e "$target" ]]; then
      echo "目标已存在，未执行任何写入: $target" >&2
      exit 1
    fi
  done
fi
copy_file "$template_dir/repo-dev-notes/SKILL.md" "$repo_root/.agents/skills/project-dev-notes/SKILL.md"
copy_file "$template_dir/repo-dev-notes/references/decision-record-format.md" "$repo_root/.agents/skills/project-dev-notes/references/decision-record-format.md"
for hook in pre-commit pre-push prepare-commit-msg; do
  copy_file "$template_dir/githooks/$hook" "$repo_root/.githooks/$hook"
  chmod +x "$repo_root/.githooks/$hook"
done
copy_file "$script_dir/start-task.sh" "$repo_root/scripts/start-task.sh"
copy_file "$script_dir/install-task-hooks.sh" "$repo_root/scripts/install-task-hooks.sh"
chmod +x "$repo_root/scripts/start-task.sh" "$repo_root/scripts/install-task-hooks.sh"
copy_file "$template_dir/close-task-issue.yml" "$repo_root/.github/workflows/close-task-issue.yml"

agents_file="$repo_root/AGENTS.md"
marker_start='<!-- repo-bootstrap:start -->'
marker_end='<!-- repo-bootstrap:end -->'
if [[ ! -f "$agents_file" ]]; then touch "$agents_file"; fi
if ! grep -Fq "$marker_start" "$agents_file"; then
  cat >> "$agents_file" <<'BLOCK'

<!-- repo-bootstrap:start -->
## 仓库协作约定

- 涉及架构、协议、schema、跨模块接入或协作边界的任务，先读 `.agents/skills/project-dev-notes/SKILL.md` 及相关记录。
- 开发前先写计划并运行 `scripts/start-task.sh "计划标题" <计划文件>` 创建 GitHub Issue。
- 提交和推送需要活动 Issue；提交信息会包含 `Task-Issue: #<number>`，成功 push 后由 GitHub Actions 关闭 Issue。
- 完成任务时更新开发手记，写入真实文件位置、验证命令和仍待验证事项。
<!-- repo-bootstrap:end -->
BLOCK
fi

( cd "$repo_root" && git config core.hooksPath .githooks )
echo "仓库协作基础设施初始化完成：$repo_root"
echo "下一步：写计划后运行 scripts/start-task.sh，再提交并 push。"
