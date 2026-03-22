#!/usr/bin/env node
/**
 * kdoc Claude Code integration install script
 *
 * Copies all kdoc Claude Code plugin components into the target project's
 * .claude/ directory and merges a summary block into CLAUDE.md.
 *
 * Usage:
 *   node integrations/claude-code/install.js \
 *     --project-root /path/to/project \
 *     --kdoc-root /path/to/kdoc \
 *     [--dry-run] \
 *     [--yes]
 *
 * Actions (in order):
 * 1. Copy skills from skills/STAR/SKILL.md to projectRoot/.claude/skills/kdoc-NAME/SKILL.md
 * 2. Copy agents from agents/claude-code/STAR.md to projectRoot/.claude/agents/kdoc-NAME.md
 * 3. Merge hooks.json into .claude/hooks/hooks.json
 * 4. Copy hook scripts (session-start.mjs, pre-push-check.mjs) to .claude/hooks/ with kdoc- prefix
 * 5. Merge CLAUDE.md block using kdoc:core:start/end markers
 *
 * Hook JSON merge safety: existing non-kdoc hooks are never removed or altered.
 * The merge only adds new hook groups; identical groups are not duplicated.
 *
 * Uses only Node.js built-ins: fs/promises, path, util (parseArgs).
 */

import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
  access,
} from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { parseArgs } from 'node:util';
import { constants } from 'node:fs';

const START_MARKER = '<!-- kdoc:core:start -->';
const END_MARKER = '<!-- kdoc:core:end -->';

/**
 * Check whether a file or directory exists.
 *
 * @param {string} p
 * @returns {Promise<boolean>}
 */
async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Merge a block (with markers) into existing file content.
 * - If markers exist: replace content between them (inclusive).
 * - If no markers: append the block.
 * - If file is empty: set file to block.
 *
 * @param {string} existing
 * @param {string} block - includes markers
 * @returns {string}
 */
function mergeMarkerBlock(existing, block) {
  const startIdx = existing.indexOf(START_MARKER);
  const endIdx = existing.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + END_MARKER.length).trimStart();
    const parts = [before, block, after].filter((s) => s.length > 0);
    return parts.join('\n\n') + '\n';
  }

  const trimmed = existing.trimEnd();
  if (trimmed.length === 0) {
    return block + '\n';
  }
  return trimmed + '\n\n' + block + '\n';
}

/**
 * Merge source hooks.json into a target hooks object.
 * - Adds new hook groups per event type.
 * - Deduplicates by stringified equality (identical groups are not added twice).
 * - Never removes or alters existing non-kdoc hooks.
 *
 * @param {object} target - existing hooks object (shape: { hooks: { EventName: [...] } })
 * @param {object} source - kdoc hooks object (same shape)
 * @returns {object} merged result
 */
function mergeHooks(target, source) {
  const merged = JSON.parse(JSON.stringify(target));
  if (!merged.hooks) merged.hooks = {};

  for (const [event, groups] of Object.entries(source.hooks ?? {})) {
    if (!merged.hooks[event]) {
      merged.hooks[event] = [];
    }
    for (const group of groups) {
      const groupStr = JSON.stringify(group);
      const isDuplicate = merged.hooks[event].some(
        (existing) => JSON.stringify(existing) === groupStr
      );
      if (!isDuplicate) {
        merged.hooks[event].push(group);
      }
    }
  }

  return merged;
}

/**
 * Generate the CLAUDE.md block for the kdoc integration.
 *
 * @param {string[]} skillNames - list of kdoc skill names (e.g. ["scaffold", "adr-create"])
 * @returns {string}
 */
function generateClaudeMdBlock(skillNames) {
  const skillList = skillNames
    .map((n) => `- \`kdoc:${n}\` — invoke with \`/kdoc:${n}\``)
    .join('\n');

  return `${START_MARKER}

## kdoc Knowledge System

This project uses **kdoc** for structured Knowledge documentation.

### Knowledge Structure

\`\`\`
Knowledge/
├── ADR/           # Architecture Decision Records
├── TLDR/          # Functional requirements per module
├── Roadmap/       # Phase + sub-phase tracking
├── Design/        # Page/screen/flow specs
├── Guides/        # Operational guides
├── AgentMemory/   # Cross-session AI memory
└── governance-health.md  # Generated health report
\`\`\`

### AI Agent Rules

- **Sync:** Update the relevant TLDR when making functional code changes.
- **ADR policy:** Create an ADR for architecture, data, or integration decisions.
- **Gap tags:** Remove \`has-open-questions\`, \`missing-test-scenarios\`, \`missing-acceptance-criteria\` tags when sections are filled.
- **Wikilinks:** \`[[Filename]]\` must resolve to existing Knowledge files.
- **Memory:** Save operational facts to \`Knowledge/AgentMemory/\`. Never store secrets.

### Commands

| Command | Description |
|---------|-------------|
| \`npx kdoc doctor\` | Validate Knowledge structure |
| \`npx kdoc init\` | Initialize Knowledge system |
| \`npx kdoc add <area>\` | Add a Knowledge area |
| \`pnpm kdoc:check\` | Run all governance scripts |
| \`pnpm kdoc:index\` | Rebuild INDEX.md |

### kdoc Skills

${skillList}

### kdoc Agents

- \`kdoc-knowledge-auditor\` — full Knowledge audit (orchestrator + 3 sub-agents)

${END_MARKER}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      'project-root': { type: 'string' },
      'kdoc-root': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      yes: { type: 'boolean', default: false },
    },
    strict: true,
  });

  const projectRoot = values['project-root'];
  const kdocRoot = values['kdoc-root'] ?? process.cwd();
  const dryRun = values['dry-run'] ?? false;

  if (!projectRoot) {
    console.error('Error: --project-root is required');
    process.exit(1);
  }

  const claudeDir = join(projectRoot, '.claude');
  const skillsDir = join(claudeDir, 'skills');
  const agentsDir = join(claudeDir, 'agents');
  const hooksDir = join(claudeDir, 'hooks');
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  const targetHooksJsonPath = join(hooksDir, 'hooks.json');

  // --- Discover skills ---
  const sourceSkillsDir = join(kdocRoot, 'skills');
  let skillEntries = [];
  try {
    skillEntries = await readdir(sourceSkillsDir, { withFileTypes: true });
  } catch {
    console.warn(`Warning: skills directory not found at ${sourceSkillsDir}`);
  }
  const skillNames = skillEntries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // --- Discover agents ---
  const sourceAgentsDir = join(kdocRoot, 'agents', 'claude-code');
  let agentEntries = [];
  try {
    agentEntries = await readdir(sourceAgentsDir, { withFileTypes: true });
  } catch {
    console.warn(`Warning: agents directory not found at ${sourceAgentsDir}`);
  }
  const agentFiles = agentEntries
    .filter((e) => e.isFile() && extname(e.name) === '.md')
    .map((e) => e.name);

  // --- Load source hooks.json ---
  const sourceHooksJsonPath = join(kdocRoot, 'hooks', 'hooks.json');
  let sourceHooks = { hooks: {} };
  try {
    const raw = await readFile(sourceHooksJsonPath, 'utf8');
    sourceHooks = JSON.parse(raw);
  } catch {
    console.warn(`Warning: hooks.json not found at ${sourceHooksJsonPath}`);
  }

  // --- Load existing target hooks.json ---
  let targetHooks = { hooks: {} };
  if (await exists(targetHooksJsonPath)) {
    try {
      const raw = await readFile(targetHooksJsonPath, 'utf8');
      targetHooks = JSON.parse(raw);
    } catch {
      console.warn(`Warning: Could not parse existing hooks.json at ${targetHooksJsonPath}`);
    }
  }

  // --- Merge hooks ---
  const mergedHooks = mergeHooks(targetHooks, sourceHooks);

  // --- Load existing CLAUDE.md ---
  let existingClaudeMd = '';
  if (await exists(claudeMdPath)) {
    existingClaudeMd = await readFile(claudeMdPath, 'utf8');
  }

  const claudeMdBlock = generateClaudeMdBlock(skillNames);
  const mergedClaudeMd = mergeMarkerBlock(existingClaudeMd, claudeMdBlock);

  // --- Report plan ---
  console.log('\nkdoc Claude Code Integration Install');
  console.log('=====================================');
  console.log(`Project root: ${projectRoot}`);
  console.log(`kdoc root:    ${kdocRoot}`);
  if (dryRun) console.log('Mode: DRY RUN (no files will be written)\n');

  console.log(`\nSkills to install (${skillNames.length}):`);
  for (const name of skillNames) {
    console.log(`  .claude/skills/kdoc-${name}/SKILL.md`);
  }

  console.log(`\nAgents to install (${agentFiles.length}):`);
  for (const name of agentFiles) {
    const agentName = basename(name, '.md');
    console.log(`  .claude/agents/kdoc-${agentName}.md`);
  }

  console.log(`\nHook scripts to install:`);
  console.log(`  .claude/hooks/kdoc-session-start.mjs`);
  console.log(`  .claude/hooks/kdoc-pre-push-check.mjs`);
  console.log(`  .claude/hooks/hooks.json [merge]`);

  const claudeMdAction =
    existingClaudeMd.includes(START_MARKER) ? 'replace block' :
    existingClaudeMd.length > 0 ? 'append block' : 'create file';
  console.log(`\nCLAUDE.md: ${claudeMdPath} [${claudeMdAction}]`);

  if (dryRun) {
    console.log('\nDry run complete. No files written.');
    process.exit(0);
  }

  // --- Execute ---

  // 1. Copy skills.
  for (const name of skillNames) {
    const sourcePath = join(sourceSkillsDir, name, 'SKILL.md');
    const targetDir = join(skillsDir, `kdoc-${name}`);
    const targetPath = join(targetDir, 'SKILL.md');
    await mkdir(targetDir, { recursive: true });
    await copyFile(sourcePath, targetPath);
  }
  console.log(`\nCopied ${skillNames.length} skill(s) to .claude/skills/`);

  // 2. Copy agents.
  await mkdir(agentsDir, { recursive: true });
  for (const name of agentFiles) {
    const sourcePath = join(sourceAgentsDir, name);
    const agentName = basename(name, '.md');
    const targetPath = join(agentsDir, `kdoc-${agentName}.md`);
    await copyFile(sourcePath, targetPath);
  }
  console.log(`Copied ${agentFiles.length} agent(s) to .claude/agents/`);

  // 3. Merge hooks.json.
  await mkdir(hooksDir, { recursive: true });
  await writeFile(targetHooksJsonPath, JSON.stringify(mergedHooks, null, 2) + '\n', 'utf8');
  console.log(`Wrote merged hooks.json to .claude/hooks/hooks.json`);

  // 4. Copy hook scripts (with kdoc- prefix).
  const hookScripts = ['session-start.mjs', 'pre-push-check.mjs'];
  for (const script of hookScripts) {
    const sourcePath = join(kdocRoot, 'hooks', script);
    const targetPath = join(hooksDir, `kdoc-${script}`);
    await copyFile(sourcePath, targetPath);
  }
  console.log(`Copied hook scripts to .claude/hooks/`);

  // 5. Merge CLAUDE.md.
  await writeFile(claudeMdPath, mergedClaudeMd, 'utf8');
  console.log(`Updated CLAUDE.md (${claudeMdAction})`);

  console.log('\nInstallation complete.');
  console.log('\nNext steps:');
  console.log('  1. Review .claude/skills/ to confirm skill files are in place.');
  console.log('  2. Review CLAUDE.md to confirm the kdoc block looks correct.');
  console.log('  3. Run: npx kdoc doctor  (to verify Knowledge structure)');
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
