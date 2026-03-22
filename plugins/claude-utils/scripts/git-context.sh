#!/usr/bin/env bash
# git-context.sh — Inject git state into Claude's context on SessionStart.
# Outputs current branch, recent commits, and uncommitted changes.
# Also runs on compact to re-inject after context compaction.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Only run inside a git repo
git -C "$PROJECT_DIR" rev-parse --is-inside-work-tree &>/dev/null || exit 0

BRANCH="$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || echo "detached")"
RECENT="$(git -C "$PROJECT_DIR" log --oneline -5 2>/dev/null || echo "(no commits)")"
STATUS="$(git -C "$PROJECT_DIR" status --short 2>/dev/null || echo "")"

echo "[Git Context] Branch: $BRANCH"
echo ""
echo "Recent commits:"
echo "$RECENT"

if [[ -n "$STATUS" ]]; then
  echo ""
  echo "Uncommitted changes:"
  echo "$STATUS"
fi
