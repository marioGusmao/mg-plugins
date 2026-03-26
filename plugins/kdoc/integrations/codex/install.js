#!/usr/bin/env node
/**
 * kdoc Codex integration install script
 *
 * Merges the kdoc knowledge block into the target project's AGENTS.md and
 * creates a .codex/agents/knowledge-auditor/instructions.md file.
 *
 * Usage:
 *   node integrations/codex/install.js \
 *     --project-root /path/to/project \
 *     --kdoc-root /path/to/kdoc \
 *     [--dry-run] \
 *     [--yes]
 *
 * Merge behavior for AGENTS.md:
 * - If AGENTS.md exists and contains <!-- kdoc:core:start -->: replace the block.
 * - If AGENTS.md exists but no markers: append the block.
 * - If AGENTS.md does not exist: create it with the block.
 *
 * The .codex/agents/knowledge-auditor/instructions.md is only created if it
 * does not already exist (idempotent — never overwrites).
 *
 * Uses only Node.js built-ins: fs/promises, path, util (parseArgs).
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { constants } from 'node:fs';

const START_MARKER = '<!-- kdoc:core:start -->';
const END_MARKER = '<!-- kdoc:core:end -->';

/**
 * Merge a block (with markers) into existing file content.
 * - If markers exist: replace content between them.
 * - If no markers: append the block.
 *
 * @param {string} existing - existing file content (may be empty string)
 * @param {string} block - the block to inject (includes markers)
 * @returns {string}
 */
function mergeMarkerBlock(existing, block) {
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // Replace existing block (including markers and surrounding newlines).
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + END_MARKER.length).trimStart();
    const joined = [before, block, after].filter((s) => s.length > 0).join('\n\n');
    return joined + '\n';
  }

  // Append the block.
  const trimmed = existing.trimEnd();
  if (trimmed.length === 0) {
    return block + '\n';
  }
  return trimmed + '\n\n' + block + '\n';
}

/**
 * Check whether a file exists.
 *
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
async function fileExists(filePath) {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate the knowledge-auditor instructions for Codex agents.
 *
 * @returns {string}
 */
function generateAuditorInstructions() {
  return `# knowledge-auditor — Codex Knowledge Audit Agent

You are the Knowledge Governance Auditor for this project.

## Your Role

Run a full audit of the project's Knowledge documentation using the three
parallel streams defined in AGENTS.md (<!-- kdoc:core:start --> block):

1. **ADR Audit** — validate numbering, frontmatter, supersession chains, wikilinks.
2. **TLDR Sync** — validate gap tags, status lifecycle, wikilink integrity.
3. **Roadmap Dashboard** — generate \`Knowledge/Roadmap/generated/dashboard.md\`.

## Execution

Run all three streams in parallel. Collect results and write a consolidated
report to \`Knowledge/governance-health.md\`.

## Rules

- Streams 1 and 2 are read-only. Stream 3 writes only the dashboard file.
- Do NOT modify ADR, TLDR, or phase files.
- If Knowledge/ does not exist, report "Knowledge area not installed" and exit.
- Report format: structured Markdown with sections for each stream result.
`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'project-root': { type: 'string' },
      'kdoc-root': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      manifest: { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
    },
    strict: true,
  });

  const projectRoot = values['project-root'];
  const kdocRoot = values['kdoc-root'] ?? process.cwd();
  const dryRun = values['dry-run'] ?? false;
  const manifestMode = values.manifest ?? false;

  if (!projectRoot) {
    console.error('Error: --project-root is required');
    process.exit(1);
  }

  // Paths.
  const templatePath = join(kdocRoot, 'agents', 'codex', 'AGENTS-knowledge.md');
  const agentsMdPath = join(projectRoot, 'AGENTS.md');
  const auditorPath = join(projectRoot, '.codex', 'agents', 'knowledge-auditor', 'instructions.md');

  // Read template.
  let templateBlock;
  try {
    templateBlock = await readFile(templatePath, 'utf8');
  } catch {
    console.error(`Error: Cannot read template at ${templatePath}`);
    process.exit(1);
  }

  // Read existing AGENTS.md.
  let existingAgentsMd = '';
  if (await fileExists(agentsMdPath)) {
    existingAgentsMd = await readFile(agentsMdPath, 'utf8');
  }

  const mergedAgentsMd = mergeMarkerBlock(existingAgentsMd, templateBlock.trim());

  // Prepare auditor instructions.
  const auditorExists = await fileExists(auditorPath);
  const auditorContent = generateAuditorInstructions();
  const manifest = {
    created: [],
    merged: [],
    skipped: [],
  };

  // Report plan.
  if (!manifestMode) {
    console.log('\nkdoc Codex Integration Install');
    console.log('================================');
    console.log(`Project root: ${projectRoot}`);
    console.log(`kdoc root:    ${kdocRoot}`);
    if (dryRun) console.log('Mode: DRY RUN (no files will be written)\n');
  }

  const agentsMdAction =
    existingAgentsMd.includes(START_MARKER) ? 'replace block' :
    existingAgentsMd.length > 0 ? 'append block' : 'create file';

  if (!manifestMode) {
    console.log(`AGENTS.md:      ${agentsMdPath} [${agentsMdAction}]`);
    console.log(
      `knowledge-auditor: ${auditorPath} [${auditorExists ? 'skip (exists)' : 'create'}]`
    );
  }

  if (agentsMdAction === 'create file') {
    manifest.created.push('AGENTS.md');
  } else {
    manifest.merged.push('AGENTS.md');
  }

  if (auditorExists) {
    manifest.skipped.push('.codex/agents/knowledge-auditor/instructions.md');
  } else {
    manifest.created.push('.codex/agents/knowledge-auditor/instructions.md');
  }

  if (dryRun) {
    if (manifestMode) {
      process.stdout.write(`${JSON.stringify(manifest)}\n`);
    } else {
      console.log('\nDry run complete. No files written.');
    }
    process.exit(0);
  }

  // Write AGENTS.md.
  await writeFile(agentsMdPath, mergedAgentsMd, 'utf8');
  if (!manifestMode) {
    console.log(`\nWrote: ${agentsMdPath}`);
  }

  // Write knowledge-auditor instructions (idempotent — skip if exists).
  if (!auditorExists) {
    await mkdir(dirname(auditorPath), { recursive: true });
    await writeFile(auditorPath, auditorContent, 'utf8');
    if (!manifestMode) {
      console.log(`Created: ${auditorPath}`);
    }
  } else {
    if (!manifestMode) {
      console.log(`Skipped (exists): ${auditorPath}`);
    }
  }

  if (manifestMode) {
    process.stdout.write(`${JSON.stringify(manifest)}\n`);
    return;
  }

  console.log('\nInstallation complete.');
  console.log('\nNext steps:');
  console.log('  1. Review AGENTS.md to confirm the kdoc block looks correct.');
  console.log('  2. Run: npx kdoc doctor  (to verify Knowledge structure)');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
