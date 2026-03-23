#!/usr/bin/env node
/**
 * SessionStart hook — checks if CodeGraph is built and if the current
 * project has an index. Provides setup instructions or status summary.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');

// Check 1: Is the plugin built?
if (!fs.existsSync(cliPath)) {
  console.log(
    `[CodeGraph] Plugin is NOT built. Run:\n` +
    `  cd "${pluginRoot}" && npm install && npm run build`
  );
  process.exit(0);
}

// Check 1b: Can better-sqlite3 native module load? (ABI mismatch detection)
try {
  execFileSync('node', ['-e', 'require("better-sqlite3")'], {
    cwd: pluginRoot,
    timeout: 5000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
} catch {
  console.log(
    `[CodeGraph] Native module ABI mismatch. Run:\n` +
    `  cd "${pluginRoot}" && npm rebuild better-sqlite3`
  );
  process.exit(0);
}

// Check 2: Does the current project have source files worth indexing?
const hasSourceFiles = fs.existsSync(path.join(projectDir, 'tsconfig.json')) ||
  fs.existsSync(path.join(projectDir, 'package.json'));

if (!hasSourceFiles) {
  // Not a code project — skip silently
  process.exit(0);
}

// Check 3: Does the project have a CodeGraph index?
const dbPath = path.join(projectDir, '.codegraph', 'graph.db');
if (!fs.existsSync(dbPath)) {
  console.log(
    `[CodeGraph] No index found for this project.\n` +
    `To enable call-chain analysis, blast radius, and dependency queries, run:\n` +
    `  codegraph index\n` +
    `This typically takes 1-5 seconds. The index is stored in .codegraph/ (add to .gitignore).`
  );
  process.exit(0);
}

// Check 4: Is the index stale?
try {
  const result = execFileSync('node', [cliPath, 'status', '--project', projectDir], {
    encoding: 'utf-8',
    timeout: 10000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Extract stale count from status output
  const staleMatch = result.match(/(\d+)\s+stale/);
  const staleCount = staleMatch ? parseInt(staleMatch[1], 10) : 0;

  if (staleCount > 0) {
    console.log(
      `[CodeGraph] Index has ${staleCount} stale file(s). Run \`codegraph index --incremental\` to update.`
    );
  } else {
    console.log(
      `[CodeGraph] Index is current. Tools available: codegraph_brief, codegraph_blast, codegraph_callers, codegraph_callees, codegraph_depends, codegraph_search, codegraph_status.`
    );
  }
} catch {
  // Status check failed — don't block session start
  console.log(
    `[CodeGraph] Index exists but status check failed. Tools may still work — try \`codegraph_status\`.`
  );
}
