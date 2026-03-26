#!/usr/bin/env node
/**
 * kdoc SessionStart hook
 *
 * Reads .kdoc.yaml from the project root and outputs a Markdown summary of
 * active Knowledge areas, packs, AI tools, and available skill names.
 *
 * Behaviors:
 * - No .kdoc.yaml found: exit 0 silently (project does not use kdoc).
 * - .kdoc.yaml found: output Markdown summary to stdout.
 * - All errors are suppressed — hook failure must not disrupt session start.
 *
 * Environment:
 * - CLAUDE_PROJECT_ROOT: project root override (falls back to process.cwd())
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(__dirname, '..', 'cli', 'package.json'));
const { parse } = require('yaml');

const SPOOL_DIR = join(homedir(), '.ai-sessions', 'spool');
const SPOOL_FILE = join(SPOOL_DIR, 'events.jsonl');

function formatRelativeAge(iso) {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 'recently';

  const deltaMs = Date.now() - ts;
  if (deltaMs < 0) return 'just now';

  const minutes = Math.floor(deltaMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function loadRecentDriftWarnings() {
  if (!existsSync(SPOOL_DIR) || !existsSync(SPOOL_FILE)) {
    return [];
  }

  const lines = readFileSync(SPOOL_FILE, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const warnings = [];
  for (let index = lines.length - 1; index >= 0 && warnings.length < 5; index -= 1) {
    try {
      const event = JSON.parse(lines[index]);
      if (event?.event_type !== 'kdoc.doc_drift') continue;

      const path = typeof event?.event_data?.path === 'string' ? event.event_data.path : 'Knowledge docs';
      const detectedAt = event.created_at ?? event.timestamp ?? '';
      warnings.push(`${path} may be outdated (detected ${formatRelativeAge(detectedAt)})`);
    } catch {
      // Ignore malformed spool lines
    }
  }

  return warnings.reverse();
}

function main() {
  const projectRoot = process.env.CLAUDE_PROJECT_ROOT ?? process.cwd();
  const configPath = join(projectRoot, '.kdoc.yaml');

  if (!existsSync(configPath)) {
    process.exit(0);
  }

  const config = parse(readFileSync(configPath, 'utf8')) ?? {};

  const projectName = config.name ?? basename(projectRoot) ?? 'this project';

  // Extract enabled areas — supports map ({ adr: { enabled: true } }) or legacy list
  let areas = [];
  if (config.areas && typeof config.areas === 'object' && !Array.isArray(config.areas)) {
    areas = Object.entries(config.areas)
      .filter(([, v]) => v?.enabled === true)
      .map(([k]) => k);
  } else if (Array.isArray(config.areas)) {
    areas = config.areas.map(String);
  }

  const packs = Array.isArray(config.packs) ? config.packs.map(String) : [];
  const tools = Array.isArray(config.tools) ? config.tools.map(String) : [];

  const lines = [];

  lines.push(`## kdoc Knowledge System Active`);
  lines.push('');
  lines.push(`**Project:** ${projectName}`);
  lines.push('');

  if (areas.length > 0) {
    lines.push(`**Active Knowledge areas:** ${areas.join(', ')}`);
  }
  if (packs.length > 0) {
    lines.push(`**Technology packs:** ${packs.join(', ')}`);
  }
  if (tools.length > 0) {
    lines.push(`**AI tool integrations:** ${tools.join(', ')}`);
  }

  const driftWarnings = loadRecentDriftWarnings();
  if (driftWarnings.length > 0) {
    lines.push('');
    lines.push('**Recent drift warnings:**');
    for (const warning of driftWarnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push('**Available kdoc skills:**');
  lines.push('- `kdoc:scaffold` — scaffold or update Knowledge structure');
  lines.push('- `kdoc:governance-check` — run Knowledge health check');
  lines.push('- `kdoc:adr-create` — create a new ADR');
  lines.push('- `kdoc:adr-validate` — validate ADR governance');
  lines.push('- `kdoc:tldr-create` — create a TLDR document');
  lines.push('- `kdoc:tldr-update-status` — update TLDR status and gap tags');
  lines.push('- `kdoc:roadmap-add-phase` — add a roadmap phase or sub-phase');
  lines.push('- `kdoc:roadmap-update` — update roadmap status and dashboard');
  lines.push('- `kdoc:design-create-spec` — create a design specification');
  lines.push('- `kdoc:create-guide` — create an operational guide');
  lines.push('- `kdoc:create-threat-model` — create a STRIDE threat model');
  lines.push('- `kdoc:memory-save` — save to agent memory');
  lines.push('');
  lines.push('**Available commands:** `npx kdoc doctor` | `npx kdoc init` | `npx kdoc add <area>`');

  process.stdout.write(lines.join('\n') + '\n');
  process.exit(0);
}

try {
  main();
} catch {
  process.exit(0);
}
