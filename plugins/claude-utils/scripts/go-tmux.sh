#!/bin/bash
# go-tmux.sh — Navigate to exact tmux target and activate terminal
# Usage: go-tmux.sh <session:window.pane|pane_id>

set -euo pipefail

activate_terminal() {
  if [[ "$(uname)" == "Darwin" ]]; then
    local app="${TERM_PROGRAM:-iTerm2}"
    case "$app" in
      iTerm*) osascript -e 'tell application "iTerm2" to activate' ;;
      Apple_Terminal) osascript -e 'tell application "Terminal" to activate' ;;
      WezTerm) osascript -e 'tell application "WezTerm" to activate' ;;
      ghostty) osascript -e 'tell application "Ghostty" to activate' ;;
      *) osascript -e "tell application \"$app\" to activate" 2>/dev/null ;;
    esac
  fi
}

navigate() {
  local location="$1"

  if [[ -z "$location" || "$location" == "unknown" ]]; then
    activate_terminal
    return 0
  fi

  local tmux_bin
  tmux_bin=$(command -v tmux || { echo "Error: tmux not found in PATH" >&2; return 1; })

  if [[ "$location" =~ ^%[0-9]+$ ]]; then
    "$tmux_bin" select-pane -t "$location" 2>/dev/null || true
    activate_terminal
    return 0
  fi

  if [[ "$location" =~ ^([^:]+):([0-9]+)(\.([0-9]+))?$ ]]; then
    local session="${BASH_REMATCH[1]}"
    local window="${BASH_REMATCH[2]}"
    local pane="${BASH_REMATCH[4]}"

    "$tmux_bin" select-window -t "$session:$window" 2>/dev/null
    [[ -n "$pane" ]] && "$tmux_bin" select-pane -t "$session:$window.$pane" 2>/dev/null
  fi

  activate_terminal
}

navigate "$1"
