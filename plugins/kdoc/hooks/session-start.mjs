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
 *
 * Note: metadata.filePattern / metadata.bashPattern in SKILL.md frontmatter
 * are kdoc conventions for future tooling — not native Claude Code features.
 * This hook reads .kdoc.yaml directly using Node.js built-ins only.
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Extract a scalar value for a given key from simple YAML content.
 * Handles both unquoted and quoted values.
 * Returns null if the key is not found.
 *
 * @param {string} yaml
 * @param {string} key
 * @returns {string | null}
 */
function extractScalar(yaml, key) {
  const pattern = new RegExp(
    `^${key}:\\s*(?:"([^"]*)"|(\\S[^\\n]*?))\\s*$`,
    'm'
  );
  const match = yaml.match(pattern);
  if (!match) return null;
  return (match[1] ?? match[2] ?? '').trim() || null;
}

/**
 * Extract a list value for a given key from simple YAML content.
 * Handles both inline lists ([a, b, c]) and block lists (- item per line).
 * Returns an empty array if the key is not found.
 *
 * @param {string} yaml
 * @param {string} key
 * @returns {string[]}
 */
function extractList(yaml, key) {
  // Try inline list first: key: [a, b, c]
  const inlinePattern = new RegExp(`^${key}:\\s*\\[([^\\]]+)\\]`, 'm');
  const inlineMatch = yaml.match(inlinePattern);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  // Try block list: key:\n  - item\n  - item
  const blockPattern = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-[^\\n]*\\n?)*)`, 'm');
  const blockMatch = yaml.match(blockPattern);
  if (blockMatch) {
    return blockMatch[1]
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }

  return [];
}

/**
 * Extract enabled area keys from a nested YAML map:
 * areas:
 *   adr:
 *     enabled: true
 *
 * Falls back to list parsing for legacy list-based configs.
 *
 * @param {string} yaml
 * @returns {string[]}
 */
function extractEnabledAreas(yaml) {
  const lines = yaml.split('\n');
  const startIndex = lines.findIndex((line) => /^areas:\s*$/.test(line));
  if (startIndex === -1) {
    return extractList(yaml, 'areas');
  }

  const enabledAreas = [];

  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\S/.test(line)) {
      break;
    }

    const areaMatch = line.match(/^  ([^:\s][^:]*):\s*$/);
    if (!areaMatch) {
      continue;
    }

    const areaName = areaMatch[1].trim();
    let enabled = false;

    for (let j = i + 1; j < lines.length; j += 1) {
      const childLine = lines[j];

      if (/^\S/.test(childLine) || /^  [^:\s][^:]*:\s*$/.test(childLine)) {
        break;
      }

      const enabledMatch = childLine.match(/^\s+enabled:\s*(true|false)\s*$/);
      if (enabledMatch) {
        enabled = enabledMatch[1] === 'true';
        break;
      }
    }

    if (enabled) {
      enabledAreas.push(areaName);
    }
  }

  return enabledAreas.length > 0 ? enabledAreas : extractList(yaml, 'areas');
}

function main() {
  const projectRoot = process.env.CLAUDE_PROJECT_ROOT ?? process.cwd();
  const configPath = join(projectRoot, '.kdoc.yaml');

  if (!existsSync(configPath)) {
    // Project does not use kdoc — exit silently.
    process.exit(0);
  }

  const yaml = readFileSync(configPath, 'utf8');

  const projectName = extractScalar(yaml, 'name') ?? basename(projectRoot) ?? 'this project';
  const areas = extractEnabledAreas(yaml);
  const packs = extractList(yaml, 'packs');
  const tools = extractList(yaml, 'tools');

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
  // Suppress all errors — hook failure must not disrupt session start.
  process.exit(0);
}
