#!/usr/bin/env bash
# Install codegraph production dependencies into CLAUDE_PLUGIN_DATA
# and symlink node_modules back to CLAUDE_PLUGIN_ROOT for ESM resolution.
#
# Runs on SessionStart. Skips if deps are already installed and up-to-date.
set -euo pipefail

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-}"

# Both vars are required
if [ -z "$PLUGIN_ROOT" ] || [ -z "$PLUGIN_DATA" ]; then
  exit 0
fi

src_pkg="$PLUGIN_ROOT/package.json"
data_pkg="$PLUGIN_DATA/package.json"
symlink="$PLUGIN_ROOT/node_modules"

# Skip if package.json matches AND symlink exists
if diff -q "$src_pkg" "$data_pkg" >/dev/null 2>&1 && [ -L "$symlink" ]; then
  exit 0
fi

# Install production deps into PLUGIN_DATA
cd "$PLUGIN_DATA"
cp "$src_pkg" .
[ -f "$PLUGIN_ROOT/package-lock.json" ] && cp "$PLUGIN_ROOT/package-lock.json" .

if ! npm install --production --no-audit --no-fund 2>&1; then
  echo "[CodeGraph] Failed to install dependencies. Native modules (tree-sitter, better-sqlite3) require a C++ toolchain." >&2
  rm -f "$data_pkg"
  exit 0
fi

# Symlink node_modules into PLUGIN_ROOT for ESM import resolution
ln -sfn "$PLUGIN_DATA/node_modules" "$symlink"

echo "[CodeGraph] Dependencies installed successfully."
