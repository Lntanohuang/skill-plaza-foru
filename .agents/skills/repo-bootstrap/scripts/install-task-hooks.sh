#!/usr/bin/env bash
set -euo pipefail
repo_root=$(git rev-parse --show-toplevel)
git config core.hooksPath .githooks
echo "已启用任务 issue hooks（core.hooksPath=$(git config --get core.hooksPath)）。"
