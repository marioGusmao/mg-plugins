#!/usr/bin/env node
/**
 * PreToolUse hook for Bash — detects git operations that change the working
 * tree (pull, checkout, merge, rebase, switch) and triggers incremental
 * re-indexing automatically.
 *
 * Also triggers on `npm install` / `pnpm install` since that can change
 * dependency resolution paths.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// The bash command being executed is passed via stdin as JSON
let input = '';
try {
  input = fs.readFileSync('/dev/stdin', 'utf-8');
} catch {
  process.exit(0);
}

let command = '';
try {
  const parsed = JSON.parse(input);
  command = parsed.command || '';
} catch {
  // Not JSON — might be raw command string
  command = input.trim();
}

// Patterns that change the working tree and warrant re-indexing
const reindexTriggers = [
  /\bgit\s+(pull|merge|rebase|checkout|switch|cherry-pick|reset|restore)\b/,
  /\b(npm|pnpm|yarn)\s+install\b/,
  /\bgit\s+stash\s+(pop|apply)\b/,
];

const shouldReindex = reindexTriggers.some(re => re.test(command));

if (!shouldReindex) {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbPath = path.join(projectDir, '.codegraph', 'graph.db');

// Only re-index if an index already exists (don't create one on first git pull)
if (!fs.existsSync(dbPath)) {
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');

if (!fs.existsSync(cliPath)) {
  process.exit(0);
}

// Schedule re-index AFTER the git command completes (this is PreToolUse,
// so we output a message and let the PostToolUse hook handle staleness)
console.log(JSON.stringify({
  result: 'info',
  message: `CodeGraph: detected \`${command.substring(0, 50)}\` — run \`codegraph index --incremental\` after this completes to update the call graph.`,
}));
