#!/usr/bin/env bash
# daemon-health.sh — Verify ai-sessions daemon is running and compatible
#
# Called on SessionStart. Checks:
# 1. Daemon process is running
# 2. Native modules match current Node version
# 3. Source version matches installed version (if dev repo detected)
#
# Outputs warnings to stderr (shown as hook output). Fixes silently when possible.

set -euo pipefail

readonly INSTALL_DIR="$HOME/.ai-sessions"
readonly NODE_VERSION_FILE="$INSTALL_DIR/.node-version"
readonly DAEMON_MATCH="[.]ai-sessions/dist/server[.]js"
readonly PLIST_LABEL="io.devpilot.mg.daemon"
readonly PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

# Exit silently if daemon not installed
[[ -d "$INSTALL_DIR" ]] || exit 0
[[ -f "$INSTALL_DIR/dist/server.js" ]] || exit 0

daemon_running() {
  local count=0
  while IFS= read -r line; do
    [[ "$line" == *codex* ]] && continue
    [[ "$line" == *"claude "* ]] && continue
    count=$((count + 1))
  done < <(pgrep -fl "$DAEMON_MATCH" 2>/dev/null || true)
  [[ "$count" -gt 0 ]]
}

current_node_module_version() {
  node -e "console.log(process.versions.modules)" 2>/dev/null || echo "unknown"
}

installed_node_module_version() {
  [[ -f "$NODE_VERSION_FILE" ]] && cat "$NODE_VERSION_FILE" || echo "unknown"
}

warnings=()

# Check 1: Native module compatibility
current_ver="$(current_node_module_version)"
installed_ver="$(installed_node_module_version)"
if [[ "$current_ver" != "$installed_ver" && "$installed_ver" != "unknown" ]]; then
  # Auto-fix: rebuild native modules
  (cd "$INSTALL_DIR" && npm rebuild 2>/dev/null) || true
  echo "$current_ver" > "$NODE_VERSION_FILE"
  warnings+=("Rebuilt ai-sessions native modules (Node MODULE_VERSION: $installed_ver → $current_ver)")
fi

# Check 2: Daemon running
if ! daemon_running; then
  # Auto-fix: try to start it
  if [[ "$(uname)" == "Darwin" && -f "$PLIST_PATH" ]]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH" 2>/dev/null || true
    sleep 1
  fi
  if ! daemon_running; then
    # Try direct start as fallback
    if [[ -f "$INSTALL_DIR/launch-daemon.sh" ]]; then
      nohup bash "$INSTALL_DIR/launch-daemon.sh" &>/dev/null & disown
      sleep 1
    else
      nohup node "$INSTALL_DIR/dist/server.js" &>/dev/null & disown
      sleep 1
    fi
  fi
  if daemon_running; then
    warnings+=("ai-sessions daemon was not running — auto-started")
  else
    warnings+=("ai-sessions daemon failed to start — check ~/.ai-sessions/logs/daemon.err")
  fi
fi

# Check 3: Version drift (only in dev repo)
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
DEV_PKG="${REPO_ROOT:+$REPO_ROOT/packages/ai-sessions/package.json}"
if [[ -f "$DEV_PKG" ]]; then
  source_ver="$(node -e "console.log(require('$DEV_PKG').version)" 2>/dev/null || echo "0.0.0")"
  installed_ver="$(node -e "console.log(require('$INSTALL_DIR/package.json').version)" 2>/dev/null || echo "0.0.0")"
  if [[ "$source_ver" != "$installed_ver" ]]; then
    warnings+=("ai-sessions version drift: source=$source_ver installed=$installed_ver — run: bash packages/ai-sessions/scripts/install.sh")
  fi
fi

# Output warnings
if [[ ${#warnings[@]} -gt 0 ]]; then
  echo "## ai-sessions daemon health"
  for w in "${warnings[@]}"; do
    echo "- $w"
  done
fi
