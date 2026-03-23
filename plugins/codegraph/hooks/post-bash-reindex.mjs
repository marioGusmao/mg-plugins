#!/usr/bin/env node
/**
 * PostToolUse hook for Bash — after git commands that change the working tree
 * (pull, checkout, merge, rebase, switch, cherry-pick, stash pop/apply) or
 * dependency installs, triggers an incremental re-index automatically.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

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
  command = input.trim();
}

// Patterns that change the working tree and warrant re-indexing
const reindexTriggers = [
  /\bgit\s+(pull|merge|rebase|checkout|switch|cherry-pick)\b/,
  /\b(npm|pnpm|yarn)\s+install\b/,
  /\bgit\s+stash\s+(pop|apply)\b/,
];

const shouldReindex = reindexTriggers.some(re => re.test(command));

if (!shouldReindex) {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const dbPath = path.join(projectDir, '.codegraph', 'graph.db');

// Only re-index if an index already exists
if (!fs.existsSync(dbPath)) {
  process.exit(0);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');

if (!fs.existsSync(cliPath)) {
  process.exit(0);
}

try {
  execFileSync('node', [cliPath, 'index', '--incremental', '--project', projectDir], {
    encoding: 'utf-8',
    timeout: 15000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  console.log(JSON.stringify({
    result: 'info',
    message: 'CodeGraph: index updated after working tree change.',
  }));
} catch {
  console.log(JSON.stringify({
    result: 'info',
    message: 'CodeGraph: incremental reindex failed after working tree change. Run `codegraph index --incremental` manually.',
  }));
}
