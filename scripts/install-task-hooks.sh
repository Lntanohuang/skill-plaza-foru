#!/usr/bin/env bash
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel)
git config core.hooksPath .githooks
printf '已启用任务 issue 流程（core.hooksPath=%s）。\n' "$(git config --get core.hooksPath)"
printf '开始任务: scripts/start-task.sh "计划标题" <计划文件>\n'
