#!/usr/bin/env bash
# notify.sh — Cross-platform desktop notification for Claude Code events.
# Receives JSON payload on stdin from Stop / Notification hooks.
# Supports: macOS (terminal-notifier, osascript), Linux (notify-send), fallback (log).

set -euo pipefail

PAYLOAD="$(cat)"

EVENT="$(echo "$PAYLOAD" | jq -r '.hook_event_name // "unknown"')"
CWD="$(echo "$PAYLOAD" | jq -r '.cwd // "unknown"')"
PROJECT="$(basename "$CWD")"

# Detect tmux context
TMUX_SESSION=""
TMUX_WINDOW=""
TMUX_LOC=""
if [[ -n "${TMUX:-}" ]]; then
  TMUX_BIN="$(command -v tmux 2>/dev/null || echo "")"
  if [[ -n "$TMUX_BIN" ]]; then
    TMUX_SESSION="$("$TMUX_BIN" display-message -p '#{session_name}' 2>/dev/null || true)"
    TMUX_WINDOW="$("$TMUX_BIN" display-message -p '#{window_name}' 2>/dev/null || true)"
    TMUX_LOC="$("$TMUX_BIN" display-message -p '#{session_name}:#{window_index}.#{pane_index}' 2>/dev/null || true)"
  fi
fi

# Build title and subtitle
if [[ -n "$TMUX_SESSION" ]]; then
  TITLE="Claude [$TMUX_SESSION:$TMUX_WINDOW]"
else
  TITLE="Claude Code"
fi

if [[ "$EVENT" == "Stop" ]]; then
  SUBTITLE="Task complete"
  SOUND="Glass"
elif [[ "$EVENT" == "Notification" ]]; then
  SUBTITLE="Needs attention"
  SOUND="Sosumi"
else
  SUBTITLE="Event: $EVENT"
  SOUND="Glass"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ─── macOS: terminal-notifier (preferred) ─────────────────────────────────
if command -v terminal-notifier &>/dev/null; then
  NOTIFY_ARGS=(
    -title "$TITLE"
    -subtitle "$SUBTITLE"
    -message "$PROJECT"
    -sound "$SOUND"
    -group "claude-${TMUX_LOC:-default}"
  )
  if [[ -n "$TMUX_LOC" ]]; then
    NOTIFY_ARGS+=(-execute "bash '${CLAUDE_PLUGIN_ROOT:-$SCRIPT_DIR/..}/scripts/go-tmux.sh' '$TMUX_LOC'")
  fi
  terminal-notifier "${NOTIFY_ARGS[@]}" 2>/dev/null || true
  exit 0
fi

# ─── macOS: osascript fallback ────────────────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
  osascript -e "display notification \"$PROJECT — $SUBTITLE\" with title \"$TITLE\" sound name \"$SOUND\"" 2>/dev/null || true
  exit 0
fi

# ─── Linux: notify-send ──────────────────────────────────────────────────
if command -v notify-send &>/dev/null; then
  notify-send "$TITLE" "$SUBTITLE — $PROJECT" --urgency=normal 2>/dev/null || true
  exit 0
fi

# ─── Fallback: log to file ───────────────────────────────────────────────
LOG_DIR="${CLAUDE_PLUGIN_DATA:-/tmp/claude-utils}/logs"
mkdir -p "$LOG_DIR"
printf '%s event=%s project=%s session=%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$EVENT" "$PROJECT" "${TMUX_SESSION:-none}" \
  >> "$LOG_DIR/notifications.log"
