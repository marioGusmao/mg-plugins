#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

let input = '';
try { input = fs.readFileSync('/dev/stdin', 'utf-8'); } catch { process.exit(0); }

let filePath;
try { filePath = JSON.parse(input).file_path; } catch { process.exit(0); }
if (!filePath) process.exit(0);

try {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
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
