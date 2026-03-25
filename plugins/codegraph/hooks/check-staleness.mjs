#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { resolveProjectRoot, resolvePluginRoot } from './resolve-root.mjs';

let input = '';
try { input = fs.readFileSync('/dev/stdin', 'utf-8'); } catch { process.exit(0); }

let filePath;
try { filePath = JSON.parse(input).file_path; } catch { process.exit(0); }
if (!filePath) process.exit(0);

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = resolvePluginRoot(__dirname);
  const projectDir = resolveProjectRoot();

  // Skip if file is outside the project directory (avoids false positives)
  const absFile = path.resolve(filePath);
  const absProject = path.resolve(projectDir);
  if (!absFile.startsWith(absProject + path.sep) && absFile !== absProject) {
    process.exit(0);
  }
  const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');
  const dbPath = path.join(projectDir, '.codegraph', 'graph.db');

  if (!fs.existsSync(dbPath)) {
    process.exit(0);
  }

  const result = execFileSync('node', [cliPath, 'status', '--check-file', filePath, '--project', projectDir], {
    timeout: 4000,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.includes('stale')) {
    console.log(JSON.stringify({
      result: 'warn',
      message: `CodeGraph index is stale for ${filePath}. Run \`codegraph index --incremental\` to update.`,
    }));
  }
} catch {
  process.exit(0);
}
