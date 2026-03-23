#!/usr/bin/env node
/**
 * PreToolUse hook on Edit — Automatic Blast Radius Gate
 *
 * Before an edit is applied, this hook:
 * 1. Reads the old_string being replaced to find which symbols are affected
 * 2. Queries the CodeGraph index for each symbol's blast radius
 * 3. If total impact > threshold, injects a warning with the full impact list
 *
 * The agent sees the impact BEFORE the edit is applied — invisible safety net.
 * Uses execFileSync (not exec) to prevent command injection.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// --- Configuration ---
const BLAST_THRESHOLD = 3;
const MAX_SYMBOLS_TO_CHECK = 5;
const TIMEOUT_MS = 8000;

// --- Parse hook input ---
let input = '';
try {
  input = fs.readFileSync('/dev/stdin', 'utf-8');
} catch {
  process.exit(0);
}

let toolInput;
try {
  toolInput = JSON.parse(input);
} catch {
  process.exit(0);
}

const filePath = toolInput.file_path;
const oldString = toolInput.old_string;

if (!filePath || !oldString) {
  process.exit(0);
}

// Skip non-indexed file types — avoid false positives on Bash/YAML/JSON
const fileExt = path.extname(filePath).toLowerCase();
const indexedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
if (!indexedExtensions.has(fileExt)) {
  process.exit(0);
}

// Skip blast-gate on very large edits — regex would be too slow
if (oldString.length > 10000) {
  process.exit(0);
}

// --- Setup paths ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');
const dbPath = path.join(projectDir, '.codegraph', 'graph.db');

if (!fs.existsSync(cliPath) || !fs.existsSync(dbPath)) {
  process.exit(0);
}

// --- Extract symbol names from the edit ---
const symbolPatterns = [
  /\bfunction\s+(\w+)\s*\(/g,
  /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w]+)\s*=>/g,
  /\b(?:const|let|var)\s+(\w+)\s*=/g,
  /\bclass\s+(\w+)/g,
  /\bexport\s+(?:default\s+)?(?:function|const|let|var|class)\s+(\w+)/g,
  /\b(?:type|interface)\s+(\w+)/g,
  /^\s*(?:async\s+)?(\w+)\s*\(/gm,
];

const skipWords = new Set(['if', 'for', 'while', 'switch', 'return', 'new', 'true', 'false', 'null', 'undefined', 'async', 'await', 'const', 'let', 'var']);
const symbolNames = new Set();

for (const pattern of symbolPatterns) {
  let match;
  while ((match = pattern.exec(oldString)) !== null) {
    const name = match[1];
    if (name && name.length > 1 && !skipWords.has(name)) {
      symbolNames.add(name);
    }
  }
}

if (symbolNames.size === 0) {
  process.exit(0);
}

// --- Query blast radius for each symbol ---
const startTime = Date.now();
const impacts = [];
let totalCallers = 0;
const affectedFilesSet = new Set();

const symbolsToCheck = Array.from(symbolNames).slice(0, MAX_SYMBOLS_TO_CHECK);

for (const symbolName of symbolsToCheck) {
  if (Date.now() - startTime > TIMEOUT_MS) break;

  try {
    // execFileSync — no shell, no injection risk
    const result = execFileSync('node', [
      cliPath, 'query', 'blast', symbolName,
      '--file', filePath,
      '--project', projectDir,
      '--json',
    ], {
      encoding: 'utf-8',
      timeout: 3000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const data = JSON.parse(result);

    if (data.callers && data.callers.length > 0) {
      totalCallers += data.callers.length;
      for (const c of data.callers) {
        affectedFilesSet.add(c.filePath);
      }
      impacts.push({
        symbol: symbolName,
        callerCount: data.callers.length,
        calleeCount: data.callees?.length || 0,
        callers: data.callers.slice(0, 5),
        docReferences: data.docReferences || [],
      });
    }
  } catch {
    // Query failed — skip silently
  }
}

// --- Decide whether to warn ---
if (totalCallers <= BLAST_THRESHOLD) {
  process.exit(0);
}

// --- Build warning message ---
const lines = [
  `Blast Radius Warning — this edit affects ${totalCallers} call site(s) across ${affectedFilesSet.size} file(s):`,
  '',
];

for (const impact of impacts) {
  lines.push(`### \`${impact.symbol}\` — ${impact.callerCount} caller(s), ${impact.calleeCount} callee(s)`);
  for (const caller of impact.callers) {
    lines.push(`  - \`${caller.symbolName}\` at ${caller.filePath}:${caller.lineStart}`);
  }
  if (impact.callerCount > 5) {
    lines.push(`  - ... and ${impact.callerCount - 5} more`);
  }
  if (impact.docReferences && impact.docReferences.length > 0) {
    lines.push(`  ${impact.docReferences.length} doc(s) reference this symbol:`);
    for (const doc of impact.docReferences.slice(0, 3)) {
      lines.push(`    - ${doc.docFile}:${doc.line}`);
    }
    if (impact.docReferences.length > 3) {
      lines.push(`    - ... and ${impact.docReferences.length - 3} more`);
    }
  }
  lines.push('');
}

lines.push(`Affected files: ${Array.from(affectedFilesSet).join(', ')}`);

const totalDocRefs = impacts.reduce((sum, imp) => sum + (imp.docReferences?.length || 0), 0);
if (totalDocRefs > 0) {
  lines.push(`Documentation: ${totalDocRefs} doc reference(s) may need updating.`);
}

lines.push('');
lines.push('Review these call sites after applying the edit to ensure they still work correctly.');

console.log(JSON.stringify({
  result: 'warn',
  message: lines.join('\n'),
}));
