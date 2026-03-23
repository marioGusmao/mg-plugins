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
abi_marker="$PLUGIN_DATA/.node-abi"

# Current Node ABI version (changes when Node.js major version changes)
current_abi="$(node -e 'process.stdout.write(process.versions.modules)')"

needs_install=false
needs_rebuild=false

# Check if deps are installed and package.json matches
if ! diff -q "$src_pkg" "$data_pkg" >/dev/null 2>&1 || [ ! -L "$symlink" ]; then
  needs_install=true
fi

# Check if Node ABI changed (native modules need rebuild)
if [ -f "$abi_marker" ]; then
  saved_abi="$(cat "$abi_marker")"
  if [ "$saved_abi" != "$current_abi" ]; then
    needs_rebuild=true
  fi
else
  # No marker yet — will be created after install/rebuild
  needs_rebuild=true
fi

# Nothing to do
if [ "$needs_install" = false ] && [ "$needs_rebuild" = false ]; then
  exit 0
fi

cd "$PLUGIN_DATA"

if [ "$needs_install" = true ]; then
  # Full install
  cp "$src_pkg" .
  [ -f "$PLUGIN_ROOT/package-lock.json" ] && cp "$PLUGIN_ROOT/package-lock.json" .

  if ! npm install --production --no-audit --no-fund 2>&1; then
    echo "[CodeGraph] Failed to install dependencies. Native modules (tree-sitter, better-sqlite3) require a C++ toolchain." >&2
    rm -f "$data_pkg" "$abi_marker"
    exit 0
  fi

  # Symlink node_modules into PLUGIN_ROOT for ESM import resolution
  if ! ln -sfn "$PLUGIN_DATA/node_modules" "$symlink" 2>/dev/null; then
    echo "[CodeGraph] Failed to create node_modules symlink at $symlink" >&2
    rm -f "$abi_marker"
    exit 0
  fi
  echo "[CodeGraph] Dependencies installed successfully."

elif [ "$needs_rebuild" = true ]; then
  # ABI changed — rebuild native modules only
  if ! npm rebuild better-sqlite3 tree-sitter tree-sitter-typescript tree-sitter-javascript 2>&1; then
    echo "[CodeGraph] Failed to rebuild native modules after Node.js update. Try: cd \"$PLUGIN_DATA\" && npm rebuild" >&2
    rm -f "$abi_marker"
    exit 0
  fi
  echo "[CodeGraph] Native modules rebuilt for Node ABI $current_abi."
fi

# Save current ABI marker
echo -n "$current_abi" > "$abi_marker"
