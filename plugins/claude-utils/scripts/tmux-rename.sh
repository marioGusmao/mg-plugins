#!/bin/bash
# Rename the current tmux window to the project name.
# Called on SessionStart so the tab shows what the agent is working on.
# Works for both Claude Code and Codex (both have $PWD).

# Bail if not inside tmux
[[ -z "$TMUX" ]] && exit 0

# Get project name: git repo root basename, or fallback to current dir basename
project=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")

# Rename the current tmux window
tmux rename-window "$project" 2>/dev/null

exit 0
