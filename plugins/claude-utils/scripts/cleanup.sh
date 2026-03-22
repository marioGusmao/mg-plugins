#!/usr/bin/env bash
# cleanup.sh — Kill orphaned processes from Claude Code sessions.
# Runs on Stop and SessionEnd hooks.
#
# Safety:
#   - Only kills processes owned by the current user
#   - Only kills processes older than a minimum age threshold
#   - Never kills the current process or its parent

set -euo pipefail

CURRENT_USER_ID="$(id -u)"
CURRENT_PID="$$"
PARENT_PID="${PPID:-0}"

kill_old_processes() {
  local pattern="$1"
  local min_age="${2:-60}"

  local pids
  pids=$(pgrep -u "$CURRENT_USER_ID" -f "$pattern" 2>/dev/null) || return 0

  for pid in $pids; do
    [[ "$pid" == "$CURRENT_PID" || "$pid" == "$PARENT_PID" ]] && continue

    local elapsed
    elapsed=$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ') || continue

    local seconds=0
    if echo "$elapsed" | grep -q '-'; then
      local days
      days=$(echo "$elapsed" | cut -d'-' -f1)
      seconds=$((days * 86400))
      elapsed=$(echo "$elapsed" | cut -d'-' -f2)
    fi
    IFS=':' read -ra parts <<< "$elapsed"
    local n=${#parts[@]}
    case $n in
      1) seconds=$((seconds + parts[0])) ;;
      2) seconds=$((seconds + parts[0] * 60 + parts[1])) ;;
      3) seconds=$((seconds + parts[0] * 3600 + parts[1] * 60 + parts[2])) ;;
    esac

    if [ "$seconds" -gt "$min_age" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

# Browser processes leaked by Playwright/agent-browser
kill_old_processes "chromium" 60
kill_old_processes "playwright" 60
kill_old_processes "agent-browser" 60

# Dev servers left running
kill_old_processes "vite.*--port" 3600

# Test runners that outlived their session
kill_old_processes "vitest" 60
kill_old_processes "jest-worker" 60
kill_old_processes "jest_worker" 60
