# kdoc Plan 2B: CLI Commands — Update, Doctor, Create, Undo

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the remaining 4 CLI commands: update (desired-state diff), doctor (health checks), create (document creation), and undo (safe revert).

**Architecture:** Each command is a thin Commander.js wrapper that orchestrates the foundation modules from Plan 1 and the scaffold engine from Plan 2A.

**Tech Stack:** TypeScript, Commander.js

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md`
**Depends on:** Plan 1 (CLI Foundation), Plan 2A (Scaffold Engine + Init + Add)
**Continues from:** Plan 2A

---

## File Structure (this plan's additions)

```
cli/
├── src/
│   └── commands/
│       ├── update.ts          # Desired-state diff + apply
│       ├── doctor.ts          # Health check across 5 categories
│       ├── create.ts          # Document creation dispatcher
│       └── undo.ts            # Safe revert of all scaffold operations
└── tests/
    └── commands/
        ├── update.test.ts
        ├── doctor.test.ts
        ├── create.test.ts
        └── undo.test.ts
```

---

## Task 7: Update Command

**Files:**
- Create: `cli/src/commands/update.ts`
- Test: `cli/tests/commands/update.test.ts`

### What Update Does

Reads the current `.kdoc.lock` and `.kdoc.yaml`, builds a desired-state manifest from the running kdoc version + config, then diffs to produce 5 operation types: `CREATE`, `UPDATE`, `REMOVE`, `RENAME`, `SKIP`.

- **REMOVE:** file in lock but absent from desired state (template/script was removed from kdoc). If file unmodified (hash matches lock) → delete. If modified → prompt Keep/Delete/Archive; `--yes` defaults to Keep.
- **RENAME:** detected by matching `template` field at a different path (NOT `templateHash` — that only tracks content drift). If unmodified → move + update lock. If modified → prompt Rename/Keep at old path; `--yes` defaults to Rename.
- **UPDATE (created):** compare `templateHash` in lock vs current template hash. If template unchanged → SKIP. If template changed + file unmodified → overwrite. If template changed + file modified → prompt Skip/Overwrite/Diff.
- **UPDATE (merged):** regenerate block, compare with `blockHash`. If block unchanged → SKIP. If changed → apply merge strategy.
- **CREATE:** template/script in desired state but not in lock → apply as new creation (same as init).
- **SKIP:** file in both, no changes needed → no-op.

After applying all operations, update `.kdoc.lock` with new hashes and `kdocVersion`. Never touches user-created documents (ADRs, TLDRs, etc.) — only manages files tracked in `.kdoc.lock`.

### Step 1: Write failing tests

- [ ] Create `cli/tests/commands/update.test.ts`

```typescript
// cli/tests/commands/update.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildDesiredState, diffDesiredState, type DesiredStateManifest, type DiffOperation } from '../../src/commands/update.js';
import { type KdocLock } from '../../src/config/schema.js';

const makeHash = (s: string) => `sha256:${'a'.repeat(63)}${s[0]}`;

function makeBaseLock(overrides: Partial<KdocLock['files']> = {}): KdocLock {
  return {
    lockVersion: 1,
    kdocVersion: '1.0.0',
    installedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: { root: 'Knowledge', packs: [], tools: [] },
    files: overrides,
  };
}

describe('diffDesiredState', () => {
  it('returns SKIP when template hash is unchanged for created file', () => {
    const templateHash = makeHash('a');
    const lock = makeBaseLock({
      'Knowledge/ADR/README.md': {
        action: 'created',
        hash: makeHash('b'),
        templateHash,
        template: 'core/templates/readme-adr.md',
      },
    });
    const desired: DesiredStateManifest = {
      'Knowledge/ADR/README.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: templateHash,
      },
    };
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('SKIP');
  });

  it('returns UPDATE when template hash changed and file is unmodified', () => {
    const oldTemplateHash = makeHash('a');
    const newTemplateHash = makeHash('b');
    const fileHash = makeHash('c');
    const lock = makeBaseLock({
      'Knowledge/ADR/README.md': {
        action: 'created',
        hash: fileHash,
        templateHash: oldTemplateHash,
        template: 'core/templates/readme-adr.md',
      },
    });
    const desired: DesiredStateManifest = {
      'Knowledge/ADR/README.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: newTemplateHash,
        currentFileHash: fileHash, // same as lock hash = unmodified
      },
    };
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('UPDATE');
    expect((ops[0] as { type: 'UPDATE'; userModified: boolean }).userModified).toBe(false);
  });

  it('returns UPDATE with userModified=true when template changed and file is modified', () => {
    const oldTemplateHash = makeHash('a');
    const newTemplateHash = makeHash('b');
    const lock = makeBaseLock({
      'Knowledge/ADR/README.md': {
        action: 'created',
        hash: makeHash('c'),
        templateHash: oldTemplateHash,
        template: 'core/templates/readme-adr.md',
      },
    });
    const desired: DesiredStateManifest = {
      'Knowledge/ADR/README.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: newTemplateHash,
        currentFileHash: makeHash('d'), // differs from lock hash = user modified
      },
    };
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('UPDATE');
    expect((ops[0] as { type: 'UPDATE'; userModified: boolean }).userModified).toBe(true);
  });

  it('returns REMOVE for file in lock but not in desired state', () => {
    const fileHash = makeHash('a');
    const lock = makeBaseLock({
      'Knowledge/oldscript.py': {
        action: 'created',
        hash: fileHash,
        templateHash: makeHash('b'),
        template: 'core/scripts/old_script.py',
      },
    });
    const desired: DesiredStateManifest = {}; // file no longer in desired state
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('REMOVE');
    expect((ops[0] as { type: 'REMOVE'; path: string }).path).toBe('Knowledge/oldscript.py');
  });

  it('returns RENAME when template field matches at different path', () => {
    const lock = makeBaseLock({
      'Knowledge/ADR/README.md': {
        action: 'created',
        hash: makeHash('a'),
        templateHash: makeHash('b'),
        template: 'core/templates/readme-adr.md',
      },
    });
    // Same template, different path in desired state
    const desired: DesiredStateManifest = {
      'Knowledge/ADR/index.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: makeHash('b'),
      },
    };
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('RENAME');
    expect((ops[0] as { type: 'RENAME'; oldPath: string; newPath: string }).oldPath).toBe('Knowledge/ADR/README.md');
    expect((ops[0] as { type: 'RENAME'; oldPath: string; newPath: string }).newPath).toBe('Knowledge/ADR/index.md');
  });

  it('returns CREATE for file in desired state but not in lock', () => {
    const lock = makeBaseLock({});
    const desired: DesiredStateManifest = {
      'Knowledge/Guides/onboarding.md': {
        template: 'packs/nextjs/guides/onboarding.md',
        currentTemplateHash: makeHash('a'),
      },
    };
    const ops = diffDesiredState(lock, desired);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe('CREATE');
  });

  it('version upgrade scenario: produces correct mix of CREATE/UPDATE/REMOVE', () => {
    const lock = makeBaseLock({
      'Knowledge/ADR/README.md': {
        action: 'created',
        hash: makeHash('a'),
        templateHash: makeHash('b'),
        template: 'core/templates/readme-adr.md',
      },
      'scripts/kdoc/old_script.py': {
        action: 'created',
        hash: makeHash('c'),
        templateHash: makeHash('d'),
        template: 'core/scripts/old_script.py',
      },
    });
    const desired: DesiredStateManifest = {
      // ADR/README.md: template changed
      'Knowledge/ADR/README.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: makeHash('z'), // different from lock
        currentFileHash: makeHash('a'), // same as lock = unmodified
      },
      // new script added in this version
      'scripts/kdoc/new_script.py': {
        template: 'core/scripts/new_script.py',
        currentTemplateHash: makeHash('e'),
      },
      // old_script.py absent from desired = REMOVE
    };
    const ops = diffDesiredState(lock, desired);
    const types = ops.map(o => o.type).sort();
    expect(types).toEqual(['CREATE', 'REMOVE', 'UPDATE']);
  });
});
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/update.test.ts`

Expected: FAIL — module not found

### Step 3: Write implementation

- [ ] Create `cli/src/commands/update.ts`

```typescript
// cli/src/commands/update.ts
import { Command } from 'commander';
import { loadConfig } from '../config/loader.js';
import { loadLock, writeLock } from '../config/lock.js';
import { hashFile, hashString } from '../utils/hash.js';
import { readFileSafe } from '../utils/fs.js';
import { type KdocLock } from '../config/schema.js';

// ---- Desired-State Types ----

export interface DesiredEntry {
  /** Which source template produced this file (stable identity key). */
  template: string;
  /** SHA-256 hash of the source template in the running kdoc version. */
  currentTemplateHash: string;
  /**
   * SHA-256 hash of the actual file on disk (for created entries).
   * Absent means: caller didn't read the file (will be treated as missing/unknown).
   */
  currentFileHash?: string;
}

export type DesiredStateManifest = Record<string, DesiredEntry>;

// ---- Diff Operation Types ----

export type DiffOperation =
  | { type: 'SKIP'; path: string }
  | { type: 'CREATE'; path: string; template: string }
  | { type: 'UPDATE'; path: string; template: string; userModified: boolean }
  | { type: 'REMOVE'; path: string; userModified: boolean }
  | { type: 'RENAME'; oldPath: string; newPath: string; template: string; userModified: boolean };

/**
 * Diff a desired-state manifest against the current lock to produce a list
 * of operations. Pure function — no I/O, no side effects.
 */
export function diffDesiredState(
  lock: KdocLock,
  desired: DesiredStateManifest,
): DiffOperation[] {
  const ops: DiffOperation[] = [];

  // Build reverse index: template → lock path (for RENAME detection)
  const templateToLockPath = new Map<string, string>();
  for (const [path, entry] of Object.entries(lock.files)) {
    templateToLockPath.set(entry.template, path);
  }

  // Build set of lock paths that are accounted for (matched to desired)
  const matchedLockPaths = new Set<string>();

  // Process desired entries
  for (const [desiredPath, desiredEntry] of Object.entries(desired)) {
    const lockEntry = lock.files[desiredPath];

    if (lockEntry) {
      // File is in both lock and desired — check if update needed
      matchedLockPaths.add(desiredPath);

      if (lockEntry.action === 'created') {
        const templateChanged = lockEntry.templateHash !== desiredEntry.currentTemplateHash;
        if (!templateChanged) {
          ops.push({ type: 'SKIP', path: desiredPath });
          continue;
        }
        // Template changed — check if user modified the file
        const userModified =
          desiredEntry.currentFileHash !== undefined &&
          desiredEntry.currentFileHash !== lockEntry.hash;
        ops.push({ type: 'UPDATE', path: desiredPath, template: desiredEntry.template, userModified });
      } else {
        // merged entry — block hash comparison handled by executor
        ops.push({ type: 'UPDATE', path: desiredPath, template: desiredEntry.template, userModified: false });
      }
    } else {
      // File not in lock at this path — check if it's a RENAME
      const oldPath = templateToLockPath.get(desiredEntry.template);
      if (oldPath && !matchedLockPaths.has(oldPath)) {
        // Same template found at a different path in the lock → RENAME
        matchedLockPaths.add(oldPath);
        const oldEntry = lock.files[oldPath];
        const userModified =
          oldEntry.action === 'created' &&
          desiredEntry.currentFileHash !== undefined &&
          desiredEntry.currentFileHash !== oldEntry.hash;
        ops.push({
          type: 'RENAME',
          oldPath,
          newPath: desiredPath,
          template: desiredEntry.template,
          userModified,
        });
      } else {
        // Genuinely new file — CREATE
        ops.push({ type: 'CREATE', path: desiredPath, template: desiredEntry.template });
      }
    }
  }

  // Remaining lock paths not matched → REMOVE
  for (const [lockPath, lockEntry] of Object.entries(lock.files)) {
    if (!matchedLockPaths.has(lockPath)) {
      // userModified will be determined at execution time by reading the file and comparing hash
      ops.push({ type: 'REMOVE', path: lockPath, userModified: false });
    }
  }

  return ops;
}

// ---- Commander registration ----

export function registerUpdateCommand(program: Command): void {
  program
    .command('update')
    .description('Update scripts and templates to the current kdoc version')
    .option('--force', 'Overwrite user-modified files without prompting')
    .option('--dry-run', 'Show planned operations without executing them')
    .option('--yes', 'Non-interactive: skip prompts (conflicts default to Skip)')
    .action(async (opts: { force?: boolean; dryRun?: boolean; yes?: boolean }) => {
      const cwd = process.cwd();

      const config = loadConfig(cwd);
      if (!config) {
        console.error('Error: .kdoc.yaml not found. Run `kdoc init` first.');
        process.exit(2);
      }

      const lock = loadLock(cwd);
      if (!lock) {
        console.error('Error: .kdoc.lock not found. No installation found to update.');
        process.exit(2);
      }

      // Build desired state from current kdoc version + config.
      // In the full implementation, this calls the scaffold planner (Plan 2A) with
      // the current templates to produce the desired manifest.
      // This command file registers the Commander subcommand; the heavy lifting
      // (template resolution, execution) is orchestrated through the scaffold engine.
      console.log('kdoc update: computing desired state...');

      if (opts.dryRun) {
        console.log('[dry-run] No changes applied.');
        return;
      }

      console.log('kdoc update complete.');
    });
}
```

> **Note on the REMOVE loop:** The final loop in `diffDesiredState` computes `userModified: false` as a placeholder because file-on-disk reading is an I/O concern handled by the executor at apply time. The executor reads the current file hash before acting on a REMOVE operation and prompts if needed.

### Step 4: Run tests to verify they pass

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/update.test.ts`

Expected: All PASS (pure diff logic; no I/O)

### Step 5: Commit

- [ ] Run:

```bash
git add cli/src/commands/update.ts cli/tests/commands/update.test.ts
git commit -m "feat: update command — desired-state diff engine with CREATE/UPDATE/REMOVE/RENAME/SKIP"
```

---

## Task 8: Doctor Command

**Files:**
- Create: `cli/src/commands/doctor.ts`
- Test: `cli/tests/commands/doctor.test.ts`

### What Doctor Does

Runs 5 check categories and reports health. Each check produces a `CheckResult` with `status: 'pass' | 'fail' | 'warn'`. Overall exit codes: 0 = all pass, 1 = any fail, 2 = config error.

**CONFIG category:**
- `.kdoc.yaml` exists and parses without Zod errors
- `.kdoc.lock` exists and matches config areas
- No `.kdoc.lock.tmp` (interrupted install detected)

**STRUCTURE category** (per enabled area, driven by area expectations from `knowledge-structure.json`):
- `empty-ok`: area dir exists; no further file requirements (guides, runbooks)
- `readme-required`: area dir has `README.md` (adr, tldr, roadmap, design)
- `generated-required`: area has its generated artifact (index area → `INDEX.md`)
- `seed-file-required`: area has its seed file (agent-memory → `MEMORY.md`, context-pack → `ContextPack.md`)
- `content-expected`: area has README but zero user docs → warn (soft nudge, not fail); static file-count check only

**SCRIPTS category:**
- Each expected script file exists in `scripts/kdoc/`
- Script file hash matches the hash from the current kdoc version (outdated if different)

**INTEGRATIONS category:**
- `CLAUDE.md` contains kdoc marker block (if `claude-code` in tools)
- `AGENTS.md` contains kdoc marker block (if `codex` in tools)
- `package.json` has at least one `kdoc:*` script key

**GOVERNANCE category** (only if scripts exist):
- Run `scripts/kdoc/check_adr_governance.py` → interpret exit code
- Run `scripts/kdoc/check_wikilinks.py` → interpret exit code
- Exit code 0 = pass; non-zero = fail with stdout/stderr as message

**JSON output (`--json` flag):**
```json
{
  "version": "1.0.0",
  "status": "healthy" | "issues" | "broken",
  "checks": [
    {
      "category": "config" | "structure" | "scripts" | "integrations" | "governance",
      "name": "string",
      "status": "pass" | "fail" | "warn",
      "message": "string",
      "fix": "optional suggested fix command"
    }
  ],
  "summary": { "pass": 0, "fail": 0, "warn": 0 }
}
```

### Step 1: Write failing tests

- [ ] Create `cli/tests/commands/doctor.test.ts`

```typescript
// cli/tests/commands/doctor.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  runConfigChecks,
  runStructureChecks,
  runIntegrationChecks,
  buildDoctorReport,
  type CheckResult,
  type DoctorReport,
} from '../../src/commands/doctor.js';

const areaExpectations = {
  adr: { type: 'readme-required', path: 'ADR' },
  guides: { type: 'empty-ok', path: 'Guides' },
  'agent-memory': { type: 'seed-file-required', path: 'AgentMemory', seedFile: 'MEMORY.md' },
  index: { type: 'generated-required', path: '', file: 'INDEX.md' },
};

describe('runConfigChecks', () => {
  const tmpDir = join(tmpdir(), 'kdoc-doctor-config-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('fails when .kdoc.yaml is missing', () => {
    const results = runConfigChecks(tmpDir);
    const configCheck = results.find(r => r.name === '.kdoc.yaml exists');
    expect(configCheck?.status).toBe('fail');
  });

  it('passes when valid .kdoc.yaml exists', () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), [
      'version: 1',
      'root: Knowledge',
      'packs: []',
      'tools: []',
    ].join('\n'));
    writeFileSync(join(tmpDir, '.kdoc.lock'), JSON.stringify({
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { root: 'Knowledge', packs: [], tools: [] },
      files: {},
    }, null, 2));
    const results = runConfigChecks(tmpDir);
    const configCheck = results.find(r => r.name === '.kdoc.yaml exists');
    expect(configCheck?.status).toBe('pass');
  });

  it('warns when .kdoc.lock.tmp exists (interrupted install)', () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), 'version: 1\nroot: Knowledge\npacks: []\ntools: []');
    writeFileSync(join(tmpDir, '.kdoc.lock.tmp'), '{}');
    const results = runConfigChecks(tmpDir);
    const tmpCheck = results.find(r => r.name === 'No interrupted install');
    expect(tmpCheck?.status).toBe('warn');
  });
});

describe('runStructureChecks', () => {
  const tmpDir = join(tmpdir(), 'kdoc-doctor-struct-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('fails readme-required area when README.md is missing', () => {
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    // ADR dir exists but no README.md
    const results = runStructureChecks(tmpDir, 'Knowledge', { adr: { enabled: true } });
    const adrCheck = results.find(r => r.name.includes('ADR'));
    expect(adrCheck?.status).toBe('fail');
  });

  it('passes readme-required area when README.md exists', () => {
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    writeFileSync(join(tmpDir, 'Knowledge', 'ADR', 'README.md'), '# ADR');
    const results = runStructureChecks(tmpDir, 'Knowledge', { adr: { enabled: true } });
    const adrCheck = results.find(r => r.name.includes('ADR'));
    expect(adrCheck?.status).toBe('pass');
  });

  it('passes empty-ok area even when directory is empty', () => {
    mkdirSync(join(tmpDir, 'Knowledge', 'Guides'), { recursive: true });
    const results = runStructureChecks(tmpDir, 'Knowledge', { guides: { enabled: true } });
    const guidesCheck = results.find(r => r.name.includes('Guides'));
    expect(guidesCheck?.status).toBe('pass');
  });

  it('fails seed-file-required area when seed file is missing', () => {
    mkdirSync(join(tmpDir, 'Knowledge', 'AgentMemory'), { recursive: true });
    const results = runStructureChecks(tmpDir, 'Knowledge', { 'agent-memory': { enabled: true } });
    const memoryCheck = results.find(r => r.name.includes('AgentMemory'));
    expect(memoryCheck?.status).toBe('fail');
  });

  it('skips disabled areas', () => {
    const results = runStructureChecks(tmpDir, 'Knowledge', { adr: { enabled: false } });
    expect(results).toHaveLength(0);
  });
});

describe('runIntegrationChecks', () => {
  const tmpDir = join(tmpdir(), 'kdoc-doctor-int-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('fails when CLAUDE.md is missing kdoc block and claude-code is in tools', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), '# CLAUDE.md\n\nNo kdoc section here.');
    const results = runIntegrationChecks(tmpDir, ['claude-code']);
    const claudeCheck = results.find(r => r.name.includes('CLAUDE.md'));
    expect(claudeCheck?.status).toBe('fail');
  });

  it('passes when CLAUDE.md has kdoc marker block', () => {
    writeFileSync(join(tmpDir, 'CLAUDE.md'), [
      '# CLAUDE.md',
      '<!-- kdoc:core:start -->',
      '## Knowledge Base',
      '<!-- kdoc:core:end -->',
    ].join('\n'));
    const results = runIntegrationChecks(tmpDir, ['claude-code']);
    const claudeCheck = results.find(r => r.name.includes('CLAUDE.md'));
    expect(claudeCheck?.status).toBe('pass');
  });

  it('skips CLAUDE.md check when claude-code not in tools', () => {
    const results = runIntegrationChecks(tmpDir, ['codex']);
    const claudeCheck = results.find(r => r.name.includes('CLAUDE.md'));
    expect(claudeCheck).toBeUndefined();
  });
});

describe('buildDoctorReport', () => {
  it('returns healthy status when all checks pass', () => {
    const checks: CheckResult[] = [
      { category: 'config', name: 'test', status: 'pass', message: 'ok' },
      { category: 'structure', name: 'test2', status: 'pass', message: 'ok' },
    ];
    const report = buildDoctorReport('1.0.0', checks);
    expect(report.status).toBe('healthy');
    expect(report.summary.pass).toBe(2);
    expect(report.summary.fail).toBe(0);
  });

  it('returns issues status when any check warns', () => {
    const checks: CheckResult[] = [
      { category: 'config', name: 'test', status: 'warn', message: 'warning' },
    ];
    const report = buildDoctorReport('1.0.0', checks);
    expect(report.status).toBe('issues');
  });

  it('returns broken status when any check fails', () => {
    const checks: CheckResult[] = [
      { category: 'config', name: 'test', status: 'fail', message: 'error' },
    ];
    const report = buildDoctorReport('1.0.0', checks);
    expect(report.status).toBe('broken');
  });
});
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/doctor.test.ts`

Expected: FAIL — module not found

### Step 3: Write implementation

- [ ] Create `cli/src/commands/doctor.ts`

```typescript
// cli/src/commands/doctor.ts
import { Command } from 'commander';
import { existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadConfig } from '../config/loader.js';
import { loadLock, hasPendingLockTmp } from '../config/lock.js';
import { readFileSafe } from '../utils/fs.js';

// ---- Types ----

export type CheckCategory = 'config' | 'structure' | 'scripts' | 'integrations' | 'governance';
export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface CheckResult {
  category: CheckCategory;
  name: string;
  status: CheckStatus;
  message: string;
  fix?: string;
}

export interface DoctorReport {
  version: string;
  status: 'healthy' | 'issues' | 'broken';
  checks: CheckResult[];
  summary: { pass: number; fail: number; warn: number };
}

// ---- Per-area structure expectations ----

type AreaExpectationType =
  | 'empty-ok'
  | 'readme-required'
  | 'generated-required'
  | 'seed-file-required'
  | 'content-expected';

interface AreaExpectation {
  /** Directory path relative to Knowledge root (or empty string for root-level files). */
  path: string;
  type: AreaExpectationType;
  /** For generated-required and seed-file-required: the required filename. */
  file?: string;
}

const AREA_EXPECTATIONS: Record<string, AreaExpectation> = {
  adr: { path: 'ADR', type: 'readme-required' },
  tldr: { path: 'TLDR', type: 'readme-required' },
  roadmap: { path: 'Roadmap', type: 'readme-required' },
  design: { path: 'Design', type: 'readme-required' },
  guides: { path: 'Guides', type: 'empty-ok' },
  'agent-memory': { path: 'AgentMemory', type: 'seed-file-required', file: 'MEMORY.md' },
  runbooks: { path: 'runbooks', type: 'empty-ok' },
  'threat-models': { path: 'runbooks/threat-models', type: 'empty-ok' },
  templates: { path: 'Templates', type: 'empty-ok' },
  governance: { path: '', type: 'empty-ok' }, // scripts live in scripts/kdoc/
  'context-pack': { path: '', type: 'seed-file-required', file: 'ContextPack.md' },
  index: { path: '', type: 'generated-required', file: 'INDEX.md' },
};

// ---- Check runners ----

export function runConfigChecks(projectDir: string): CheckResult[] {
  const results: CheckResult[] = [];

  // Check .kdoc.yaml exists and is valid
  const configPath = join(projectDir, '.kdoc.yaml');
  if (!existsSync(configPath)) {
    results.push({
      category: 'config',
      name: '.kdoc.yaml exists',
      status: 'fail',
      message: '.kdoc.yaml not found',
      fix: 'npx kdoc init',
    });
    return results; // Can't check further without config
  }

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig(projectDir);
    results.push({
      category: 'config',
      name: '.kdoc.yaml exists',
      status: 'pass',
      message: '.kdoc.yaml is valid',
    });
  } catch (err) {
    results.push({
      category: 'config',
      name: '.kdoc.yaml exists',
      status: 'fail',
      message: `.kdoc.yaml is invalid: ${String(err)}`,
      fix: 'Fix validation errors in .kdoc.yaml',
    });
    return results;
  }

  // Check .kdoc.lock exists
  const lockPath = join(projectDir, '.kdoc.lock');
  if (!existsSync(lockPath)) {
    results.push({
      category: 'config',
      name: '.kdoc.lock exists',
      status: 'fail',
      message: '.kdoc.lock not found',
      fix: 'Run `npx kdoc init` to create the lock file',
    });
  } else {
    results.push({
      category: 'config',
      name: '.kdoc.lock exists',
      status: 'pass',
      message: '.kdoc.lock found',
    });
  }

  // Check for interrupted install
  if (hasPendingLockTmp(projectDir)) {
    results.push({
      category: 'config',
      name: 'No interrupted install',
      status: 'warn',
      message: '.kdoc.lock.tmp found — a previous install may have been interrupted',
      fix: 'Run `npx kdoc init` to resume or `npx kdoc undo` to clean up',
    });
  } else {
    results.push({
      category: 'config',
      name: 'No interrupted install',
      status: 'pass',
      message: 'No interrupted install detected',
    });
  }

  return results;
}

export function runStructureChecks(
  projectDir: string,
  knowledgeRoot: string,
  areas: Record<string, { enabled: boolean }>,
): CheckResult[] {
  const results: CheckResult[] = [];
  const kRoot = join(projectDir, knowledgeRoot);

  for (const [areaName, areaConfig] of Object.entries(areas)) {
    if (!areaConfig.enabled) continue;

    const expectation = AREA_EXPECTATIONS[areaName];
    if (!expectation) continue;

    const areaDir = expectation.path ? join(kRoot, expectation.path) : kRoot;
    const displayPath = expectation.path || knowledgeRoot;

    // Directory existence check (applies to all area types with a path)
    if (expectation.path && !existsSync(areaDir)) {
      results.push({
        category: 'structure',
        name: `${displayPath} directory exists`,
        status: 'fail',
        message: `Directory ${displayPath} not found`,
        fix: `npx kdoc add ${areaName}`,
      });
      continue;
    }

    switch (expectation.type) {
      case 'empty-ok':
        results.push({
          category: 'structure',
          name: `${displayPath} directory exists`,
          status: 'pass',
          message: `${displayPath} is present`,
        });
        break;

      case 'readme-required': {
        const readmePath = join(areaDir, 'README.md');
        results.push({
          category: 'structure',
          name: `${displayPath}/README.md exists`,
          status: existsSync(readmePath) ? 'pass' : 'fail',
          message: existsSync(readmePath)
            ? `${displayPath}/README.md found`
            : `${displayPath}/README.md is missing`,
          fix: existsSync(readmePath) ? undefined : `npx kdoc add ${areaName}`,
        });
        // Soft nudge: warn if README exists but zero user docs
        if (existsSync(readmePath)) {
          const entries = readdirSync(areaDir).filter(
            f => f !== 'README.md' && f.endsWith('.md'),
          );
          if (entries.length === 0) {
            results.push({
              category: 'structure',
              name: `${displayPath} has user documents`,
              status: 'warn',
              message: `${displayPath} has README.md but no user-created documents yet`,
            });
          }
        }
        break;
      }

      case 'generated-required':
      case 'seed-file-required': {
        if (!expectation.file) break;
        const targetPath = expectation.path
          ? join(areaDir, expectation.file)
          : join(kRoot, expectation.file);
        results.push({
          category: 'structure',
          name: `${expectation.file} exists`,
          status: existsSync(targetPath) ? 'pass' : 'fail',
          message: existsSync(targetPath)
            ? `${expectation.file} found`
            : `${expectation.file} is missing`,
          fix: existsSync(targetPath) ? undefined : `npx kdoc add ${areaName}`,
        });
        break;
      }
    }
  }

  return results;
}

export function runIntegrationChecks(projectDir: string, tools: string[]): CheckResult[] {
  const results: CheckResult[] = [];

  if (tools.includes('claude-code')) {
    const claudePath = join(projectDir, 'CLAUDE.md');
    const content = readFileSafe(claudePath) ?? '';
    const hasBlock = content.includes('<!-- kdoc:core:start -->');
    results.push({
      category: 'integrations',
      name: 'CLAUDE.md has kdoc block',
      status: hasBlock ? 'pass' : 'fail',
      message: hasBlock
        ? 'CLAUDE.md contains kdoc marker block'
        : 'CLAUDE.md is missing kdoc integration block',
      fix: hasBlock ? undefined : 'npx kdoc add-tool claude-code',
    });
  }

  if (tools.includes('codex')) {
    const agentsPath = join(projectDir, 'AGENTS.md');
    const content = readFileSafe(agentsPath) ?? '';
    const hasBlock = content.includes('<!-- kdoc:core:start -->');
    results.push({
      category: 'integrations',
      name: 'AGENTS.md has kdoc block',
      status: hasBlock ? 'pass' : 'fail',
      message: hasBlock
        ? 'AGENTS.md contains kdoc marker block'
        : 'AGENTS.md is missing kdoc integration block',
      fix: hasBlock ? undefined : 'npx kdoc add-tool codex',
    });
  }

  // Check package.json for kdoc:* scripts
  const pkgPath = join(projectDir, 'package.json');
  if (existsSync(pkgPath)) {
    const pkgContent = readFileSafe(pkgPath);
    if (pkgContent) {
      let pkg: Record<string, unknown>;
      try {
        pkg = JSON.parse(pkgContent);
      } catch {
        pkg = {};
      }
      const scripts = (pkg.scripts ?? {}) as Record<string, string>;
      const kdocScripts = Object.keys(scripts).filter(k => k.startsWith('kdoc:'));
      results.push({
        category: 'integrations',
        name: 'package.json has kdoc:* scripts',
        status: kdocScripts.length > 0 ? 'pass' : 'warn',
        message:
          kdocScripts.length > 0
            ? `Found ${kdocScripts.length} kdoc:* script(s) in package.json`
            : 'No kdoc:* scripts found in package.json',
        fix: kdocScripts.length === 0 ? 'npx kdoc init (re-run to add scripts)' : undefined,
      });
    }
  }

  return results;
}

export function runGovernanceChecks(projectDir: string): CheckResult[] {
  const results: CheckResult[] = [];

  const scripts: Array<{ name: string; script: string; checkName: string }> = [
    {
      name: 'ADR governance valid',
      script: join(projectDir, 'scripts', 'kdoc', 'check_adr_governance.py'),
      checkName: 'ADR numbering and cross-references',
    },
    {
      name: 'Wikilinks valid',
      script: join(projectDir, 'scripts', 'kdoc', 'check_wikilinks.py'),
      checkName: 'Wikilink integrity',
    },
  ];

  for (const { name, script, checkName } of scripts) {
    if (!existsSync(script)) {
      results.push({
        category: 'governance',
        name,
        status: 'warn',
        message: `Governance script not found: ${script}`,
        fix: 'npx kdoc add governance',
      });
      continue;
    }

    try {
      execFileSync('python3', [script], { cwd: projectDir, stdio: 'pipe' });
      results.push({
        category: 'governance',
        name,
        status: 'pass',
        message: `${checkName}: OK`,
      });
    } catch (err: unknown) {
      const execErr = err as { stdout?: Buffer; stderr?: Buffer };
      const output = [
        execErr.stdout?.toString().trim(),
        execErr.stderr?.toString().trim(),
      ]
        .filter(Boolean)
        .join('\n');
      results.push({
        category: 'governance',
        name,
        status: 'fail',
        message: `${checkName}: ${output || 'Script exited with non-zero code'}`,
        fix: `Run: python3 ${script}`,
      });
    }
  }

  return results;
}

export function buildDoctorReport(version: string, checks: CheckResult[]): DoctorReport {
  const summary = { pass: 0, fail: 0, warn: 0 };
  for (const c of checks) {
    summary[c.status]++;
  }

  let status: DoctorReport['status'] = 'healthy';
  if (summary.fail > 0) status = 'broken';
  else if (summary.warn > 0) status = 'issues';

  return { version, status, checks, summary };
}

// ---- Commander registration ----

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('Check the health of your kdoc installation')
    .option('--json', 'Output results as JSON')
    .action(async (opts: { json?: boolean }) => {
      const cwd = process.cwd();

      // CONFIG checks first — if config is broken, skip further checks
      const configChecks = runConfigChecks(cwd);
      const configFailed = configChecks.some(c => c.status === 'fail');

      const allChecks: CheckResult[] = [...configChecks];

      if (!configFailed) {
        const config = loadConfig(cwd);
        if (config) {
          allChecks.push(...runStructureChecks(cwd, config.root, config.areas));
          allChecks.push(...runIntegrationChecks(cwd, config.tools));
          allChecks.push(...runGovernanceChecks(cwd));
        }
      }

      const KDOC_VERSION = '1.0.0';
      const report = buildDoctorReport(KDOC_VERSION, allChecks);

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        const icons: Record<CheckStatus, string> = { pass: '✓', fail: '✗', warn: '⚠' };
        for (const check of report.checks) {
          console.log(`  ${icons[check.status]} [${check.category}] ${check.name}: ${check.message}`);
          if (check.fix) console.log(`    Fix: ${check.fix}`);
        }
        console.log(`\nStatus: ${report.status} (${report.summary.pass} pass, ${report.summary.warn} warn, ${report.summary.fail} fail)`);
      }

      if (configFailed) process.exit(2);
      if (report.summary.fail > 0) process.exit(1);
    });
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/doctor.test.ts`

Expected: All PASS

### Step 5: Commit

- [ ] Run:

```bash
git add cli/src/commands/doctor.ts cli/tests/commands/doctor.test.ts
git commit -m "feat: doctor command — 5-category health checks with JSON output and exit codes"
```

---

## Task 9: Create Command

**Files:**
- Create: `cli/src/commands/create.ts`
- Test: `cli/tests/commands/create.test.ts`

### What Create Does

Creates new Knowledge documents from templates. Dispatches by document type. Does NOT add created files to `.kdoc.lock` — these are user-created documents, not managed files.

**Supported types:**

| Type | --scope required | Output path |
|------|-----------------|-------------|
| `adr` | No | `{root}/ADR/ADR-{NNNN}-{name}.md` |
| `tldr` | Yes | `{root}/TLDR/{scope}/{name}.md` |
| `phase` | No | `{root}/Roadmap/phases/phase-{N}.md` |
| `sub-phase` | No | `{root}/Roadmap/phases/phase-{N}/{M}.md` |
| `guide` | No | `{root}/Guides/{name}.md` |
| `threat-model` | No | `{root}/runbooks/threat-models/{name}.md` |
| `runbook` | No | `{root}/runbooks/{name}.md` |
| `test-map` | No | `{root}/Templates/{name}-test-map.md` |

**ADR numbering:**
1. Glob `{root}/ADR/ADR-*.md`
2. Extract the highest 4-digit number from filenames
3. Next = highest + 1, zero-padded to 4 digits
4. Gaps in numbering are acceptable (concurrent creation can cause gaps)

**TLDR:** `--scope` flag is required; error if missing.

**Template rendering:** calls `renderTemplate()` from Plan 1 with values derived from `.kdoc.yaml` and CLI flags. Placeholders: `{{DATE}}` (today's date), `{{PROJECT_NAME}}` (from yaml or directory name), `{{ID}}` (ADR number), `{{TITLE}}` (name flag), `{{SCOPE}}` (scope flag), `{{AREA}}` (type), `{{STATUS}}` (status flag or default).

### Step 1: Write failing tests

- [ ] Create `cli/tests/commands/create.test.ts`

```typescript
// cli/tests/commands/create.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveAdrNumber,
  resolveCreatePath,
  validateCreateArgs,
  type CreateArgs,
} from '../../src/commands/create.js';

describe('resolveAdrNumber', () => {
  const tmpDir = join(tmpdir(), 'kdoc-create-adr-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns 0001 when no ADRs exist', () => {
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });
    expect(resolveAdrNumber(adrDir)).toBe('0001');
  });

  it('increments past the highest existing ADR number', () => {
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, 'ADR-0001-decision-one.md'), '');
    writeFileSync(join(adrDir, 'ADR-0003-decision-three.md'), ''); // gap is fine
    expect(resolveAdrNumber(adrDir)).toBe('0004');
  });

  it('handles single-digit ADR filenames safely (no match → 0001)', () => {
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, 'README.md'), '');
    writeFileSync(join(adrDir, 'not-an-adr.md'), '');
    expect(resolveAdrNumber(adrDir)).toBe('0001');
  });
});

describe('resolveCreatePath', () => {
  it('resolves ADR path correctly', () => {
    const path = resolveCreatePath('adr', 'my-decision', { root: '/project/Knowledge', adrNumber: '0005' });
    expect(path).toBe('/project/Knowledge/ADR/ADR-0005-my-decision.md');
  });

  it('resolves TLDR path with scope', () => {
    const path = resolveCreatePath('tldr', 'auth-module', { root: '/project/Knowledge', scope: 'Admin' });
    expect(path).toBe('/project/Knowledge/TLDR/Admin/auth-module.md');
  });

  it('resolves guide path', () => {
    const path = resolveCreatePath('guide', 'onboarding', { root: '/project/Knowledge' });
    expect(path).toBe('/project/Knowledge/Guides/onboarding.md');
  });

  it('resolves runbook path', () => {
    const path = resolveCreatePath('runbook', 'deploy-rollback', { root: '/project/Knowledge' });
    expect(path).toBe('/project/Knowledge/runbooks/deploy-rollback.md');
  });

  it('resolves threat-model path', () => {
    const path = resolveCreatePath('threat-model', 'auth-threats', { root: '/project/Knowledge' });
    expect(path).toBe('/project/Knowledge/runbooks/threat-models/auth-threats.md');
  });

  it('resolves test-map path', () => {
    const path = resolveCreatePath('test-map', 'checkout', { root: '/project/Knowledge' });
    expect(path).toBe('/project/Knowledge/Templates/checkout-test-map.md');
  });
});

describe('validateCreateArgs', () => {
  it('returns error when TLDR is missing --scope', () => {
    const result = validateCreateArgs({ type: 'tldr', name: 'my-feature' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/--scope/);
  });

  it('accepts TLDR with --scope', () => {
    const result = validateCreateArgs({ type: 'tldr', name: 'my-feature', scope: 'Admin' });
    expect(result.valid).toBe(true);
  });

  it('accepts ADR without --scope', () => {
    const result = validateCreateArgs({ type: 'adr', name: 'my-decision' });
    expect(result.valid).toBe(true);
  });

  it('returns error for unknown type', () => {
    const result = validateCreateArgs({ type: 'unknown-type', name: 'test' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unknown type/i);
  });

  it('returns error when name is missing', () => {
    const result = validateCreateArgs({ type: 'adr', name: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/name/i);
  });
});
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/create.test.ts`

Expected: FAIL — module not found

### Step 3: Write implementation

- [ ] Create `cli/src/commands/create.ts`

```typescript
// cli/src/commands/create.ts
import { Command } from 'commander';
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { loadConfig } from '../config/loader.js';
import { renderTemplate } from '../templates/renderer.js';
import { safeWriteFile } from '../utils/fs.js';
import { readFileSafe } from '../utils/fs.js';

// ---- Supported types ----

const VALID_TYPES = [
  'adr',
  'tldr',
  'phase',
  'sub-phase',
  'guide',
  'threat-model',
  'runbook',
  'test-map',
] as const;

type CreateType = (typeof VALID_TYPES)[number];

export interface CreateArgs {
  type: string;
  name: string;
  scope?: string;
  status?: string;
}

// ---- Validation ----

export function validateCreateArgs(args: CreateArgs): { valid: boolean; error?: string } {
  if (!VALID_TYPES.includes(args.type as CreateType)) {
    return { valid: false, error: `Unknown type "${args.type}". Valid types: ${VALID_TYPES.join(', ')}` };
  }
  if (!args.name || args.name.trim() === '') {
    return { valid: false, error: 'Name is required. Use: kdoc create <type> <name>' };
  }
  if (args.type === 'tldr' && !args.scope) {
    return { valid: false, error: 'TLDR requires --scope flag. Example: kdoc create tldr my-feature --scope Admin' };
  }
  return { valid: true };
}

// ---- ADR numbering ----

export function resolveAdrNumber(adrDir: string): string {
  if (!existsSync(adrDir)) return '0001';

  const entries = readdirSync(adrDir);
  const numbers = entries
    .map(f => {
      const match = f.match(/^ADR-(\d{4})-/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(4, '0');
}

// ---- Path resolution ----

interface ResolvePathOptions {
  root: string;
  adrNumber?: string;
  scope?: string;
}

export function resolveCreatePath(type: string, name: string, opts: ResolvePathOptions): string {
  const { root, adrNumber, scope } = opts;

  switch (type as CreateType) {
    case 'adr':
      return join(root, 'ADR', `ADR-${adrNumber}-${name}.md`);
    case 'tldr':
      return join(root, 'TLDR', scope ?? '_noscope', `${name}.md`);
    case 'phase':
      return join(root, 'Roadmap', 'phases', `${name}.md`);
    case 'sub-phase':
      return join(root, 'Roadmap', 'phases', `${name}.md`);
    case 'guide':
      return join(root, 'Guides', `${name}.md`);
    case 'threat-model':
      return join(root, 'runbooks', 'threat-models', `${name}.md`);
    case 'runbook':
      return join(root, 'runbooks', `${name}.md`);
    case 'test-map':
      return join(root, 'Templates', `${name}-test-map.md`);
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}

// ---- Template loading ----

function loadBuiltinTemplate(type: CreateType, kdocRoot: string): string {
  // In the full implementation, templates are bundled with the CLI (via tsup assets)
  // and resolved relative to the dist directory. For now we provide sensible inline
  // fallbacks that match the spec placeholders for each type.
  const fallbacks: Record<CreateType, string> = {
    adr: `# ADR-{{ID}}: {{TITLE}}\n\n**Date:** {{DATE}}\n**Status:** {{STATUS}}\n\n## Context\n\n## Decision\n\n## Consequences\n`,
    tldr: `---\narea: {{AREA}}\nscope: {{SCOPE}}\nstatus: {{STATUS}}\n---\n\n# {{TITLE}}\n\n## Overview\n\n## Acceptance Criteria\n\n## Test Scenarios\n`,
    phase: `# Phase: {{TITLE}}\n\n**Date:** {{DATE}}\n\n## Goals\n\n## Sub-phases\n`,
    'sub-phase': `# Sub-phase: {{TITLE}}\n\n**Date:** {{DATE}}\n\n## Scope\n\n## Tasks\n`,
    guide: `# {{TITLE}}\n\n**Category:** {{AREA}}\n\n## Overview\n\n## Steps\n`,
    'threat-model': `# Threat Model: {{TITLE}}\n\n**Date:** {{DATE}}\n\n## Scope\n\n## STRIDE Analysis\n`,
    runbook: `# {{TITLE}}\n\n**Date:** {{DATE}}\n\n## Purpose\n\n## Steps\n`,
    'test-map': `# Test Map: {{TITLE}}\n\n**Date:** {{DATE}}\n\n## Scenarios\n\n| Scenario | Level | File | Status |\n|----------|-------|------|--------|\n`,
  };
  return fallbacks[type];
}

// ---- Commander registration ----

export function registerCreateCommand(program: Command): void {
  program
    .command('create <type> [name]')
    .description('Create a new Knowledge document (adr, tldr, phase, guide, runbook, threat-model, test-map)')
    .option('--scope <scope>', 'Scope for TLDR documents (required for tldr type)')
    .option('--status <status>', 'Initial status (default: proposed for ADR, draft for TLDR)')
    .action(async (type: string, name: string | undefined, opts: { scope?: string; status?: string }) => {
      const cwd = process.cwd();

      const args: CreateArgs = { type, name: name ?? '', scope: opts.scope, status: opts.status };
      const validation = validateCreateArgs(args);
      if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
      }

      const config = loadConfig(cwd);
      if (!config) {
        console.error('Error: .kdoc.yaml not found. Run `kdoc init` first.');
        process.exit(2);
      }

      const knowledgeRoot = join(cwd, config.root);
      let adrNumber: string | undefined;

      if (type === 'adr') {
        adrNumber = resolveAdrNumber(join(knowledgeRoot, 'ADR'));
      }

      const outputPath = resolveCreatePath(type, name!, {
        root: knowledgeRoot,
        adrNumber,
        scope: opts.scope,
      });

      if (existsSync(outputPath)) {
        console.error(`Error: File already exists: ${outputPath}`);
        process.exit(1);
      }

      const templateContent = loadBuiltinTemplate(type as CreateType, cwd);
      const today = new Date().toISOString().slice(0, 10);
      const projectName = dirname(cwd).split('/').pop() ?? 'project';

      const defaultStatus = type === 'adr' ? 'proposed' : 'draft';
      const values: Record<string, string> = {
        ID: adrNumber ?? '',
        TITLE: name!,
        DATE: today,
        STATUS: opts.status ?? defaultStatus,
        SCOPE: opts.scope ?? '',
        AREA: type,
        PROJECT_NAME: projectName,
      };

      const { content, warnings } = renderTemplate(templateContent, values);

      for (const warning of warnings) {
        console.warn(`Warning: ${warning}`);
      }

      safeWriteFile(outputPath, content);
      console.log(`Created: ${outputPath}`);
    });
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/create.test.ts`

Expected: All PASS

### Step 5: Commit

- [ ] Run:

```bash
git add cli/src/commands/create.ts cli/tests/commands/create.test.ts
git commit -m "feat: create command — ADR/TLDR/guide/runbook/threat-model creation with sequential ADR numbering"
```

---

## Task 10: Undo Command

**Files:**
- Create: `cli/src/commands/undo.ts`
- Test: `cli/tests/commands/undo.test.ts`

### What Undo Does

Reverses all scaffold operations recorded in `.kdoc.lock` (or `.kdoc.lock.tmp` if lock is missing).

**Per action type:**

**`created` entries:**
- Hash current file content. If hash matches lock → delete file safely.
- If hash differs (user edited) → prompt Keep/Archive/Delete. `--yes` defaults to Keep. `--force` deletes.
- After file deletion, walk ancestor directories upward (stopping before the Knowledge root). Delete any ancestor that contains only empty subdirectories and no files.

**`merged` + `strategy: markers` entries:**
- Read current file, use `markerName` from lock to find the correct named marker pair.
- Remove the block between markers (inclusive).
- If the file is now empty or whitespace-only → delete the file.
- Otherwise write the cleaned file back.

**`merged` + `strategy: prefix` entries:**
- Read the JSON file (package.json or turbo.json).
- Remove all `kdoc:*` keys from the relevant object (`scripts` or `tasks`).
- Write the file back.

**Cleanup:**
1. Delete `.kdoc.lock` and `.kdoc.lock.tmp` (whichever exist).
2. Delete `.kdoc.backup/` if it exists.
3. Prompt: "Remove .kdoc.yaml too? [Y/n]". `--keep-config` skips this prompt and preserves the file.

### Step 1: Write failing tests

- [ ] Create `cli/tests/commands/undo.test.ts`

```typescript
// cli/tests/commands/undo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, mkdirSync as mkdir } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  undoCreatedEntry,
  undoMergedMarkersEntry,
  undoMergedPrefixEntry,
  type UndoEntryResult,
} from '../../src/commands/undo.js';
import { hashString } from '../../src/utils/hash.js';

const makeHash = (content: string) => hashString(content);

describe('undoCreatedEntry', () => {
  const tmpDir = join(tmpdir(), 'kdoc-undo-created-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('deletes unmodified created file', () => {
    const content = '# ADR README';
    const filePath = join(tmpDir, 'Knowledge', 'ADR', 'README.md');
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    writeFileSync(filePath, content);
    const result = undoCreatedEntry(filePath, makeHash(content), { force: false, yes: true });
    expect(result.action).toBe('deleted');
    expect(existsSync(filePath)).toBe(false);
  });

  it('keeps modified file when --yes is set (safe default)', () => {
    const originalContent = '# original';
    const modifiedContent = '# user modified this';
    const filePath = join(tmpDir, 'Knowledge', 'ADR', 'README.md');
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    writeFileSync(filePath, modifiedContent);
    const result = undoCreatedEntry(filePath, makeHash(originalContent), { force: false, yes: true });
    expect(result.action).toBe('kept');
    expect(existsSync(filePath)).toBe(true);
  });

  it('force-deletes modified file when --force is set', () => {
    const originalContent = '# original';
    const modifiedContent = '# user modified this';
    const filePath = join(tmpDir, 'Knowledge', 'ADR', 'README.md');
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    writeFileSync(filePath, modifiedContent);
    const result = undoCreatedEntry(filePath, makeHash(originalContent), { force: true, yes: true });
    expect(result.action).toBe('deleted');
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns skipped when file does not exist', () => {
    const filePath = join(tmpDir, 'nonexistent.md');
    const result = undoCreatedEntry(filePath, makeHash('content'), { force: false, yes: true });
    expect(result.action).toBe('skipped');
  });
});

describe('undoMergedMarkersEntry', () => {
  const tmpDir = join(tmpdir(), 'kdoc-undo-markers-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('removes marker block from CLAUDE.md', () => {
    const content = [
      '# CLAUDE.md',
      '',
      'User section above.',
      '',
      '<!-- kdoc:core:start -->',
      '## Knowledge Base',
      'kdoc managed content',
      '<!-- kdoc:core:end -->',
      '',
      'User section below.',
    ].join('\n');
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, content);
    const result = undoMergedMarkersEntry(filePath, 'core');
    expect(result.action).toBe('cleaned');
    const remaining = require('node:fs').readFileSync(filePath, 'utf8');
    expect(remaining).not.toContain('kdoc:core:start');
    expect(remaining).not.toContain('kdoc managed content');
    expect(remaining).toContain('User section above');
    expect(remaining).toContain('User section below');
  });

  it('deletes file when it only contained the kdoc block', () => {
    const content = [
      '<!-- kdoc:core:start -->',
      '## Knowledge Base',
      '<!-- kdoc:core:end -->',
    ].join('\n');
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, content);
    const result = undoMergedMarkersEntry(filePath, 'core');
    expect(result.action).toBe('deleted');
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns skipped when markers not found (no-op)', () => {
    const content = '# CLAUDE.md\n\nNo kdoc block here.';
    const filePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(filePath, content);
    const result = undoMergedMarkersEntry(filePath, 'core');
    expect(result.action).toBe('skipped');
  });

  it('returns skipped when file does not exist', () => {
    const filePath = join(tmpDir, 'missing.md');
    const result = undoMergedMarkersEntry(filePath, 'core');
    expect(result.action).toBe('skipped');
  });
});

describe('undoMergedPrefixEntry', () => {
  const tmpDir = join(tmpdir(), 'kdoc-undo-prefix-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('removes kdoc:* keys from package.json scripts', () => {
    const pkg = {
      name: 'test',
      scripts: {
        dev: 'next dev',
        'kdoc:check': 'python3 scripts/kdoc/check_sync.py',
        'kdoc:index': 'python3 scripts/kdoc/build_index.py',
      },
    };
    const filePath = join(tmpDir, 'package.json');
    writeFileSync(filePath, JSON.stringify(pkg, null, 2));
    const result = undoMergedPrefixEntry(filePath);
    expect(result.action).toBe('cleaned');
    const remaining = JSON.parse(require('node:fs').readFileSync(filePath, 'utf8'));
    expect(remaining.scripts.dev).toBe('next dev');
    expect(remaining.scripts['kdoc:check']).toBeUndefined();
    expect(remaining.scripts['kdoc:index']).toBeUndefined();
  });

  it('returns skipped when file does not exist', () => {
    const filePath = join(tmpDir, 'package.json');
    const result = undoMergedPrefixEntry(filePath);
    expect(result.action).toBe('skipped');
  });
});
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/undo.test.ts`

Expected: FAIL — module not found

### Step 3: Write implementation

- [ ] Create `cli/src/commands/undo.ts`

```typescript
// cli/src/commands/undo.ts
import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { hashFile } from '../utils/hash.js';
import { readFileSafe, deleteIfEmpty } from '../utils/fs.js';
import { removeMarkerBlock } from '../scaffold/merge/markers.js';
import { removePackageJsonScripts } from '../scaffold/merge/package-json.js';
import { removeTurboJsonTasks } from '../scaffold/merge/turbo-json.js';
import { loadLock, lockExists, hasPendingLockTmp } from '../config/lock.js';
import { configExists } from '../config/loader.js';

// ---- Entry result types ----

export interface UndoEntryResult {
  path: string;
  action: 'deleted' | 'kept' | 'archived' | 'cleaned' | 'skipped';
  reason?: string;
}

interface UndoOptions {
  force: boolean;
  yes: boolean;
}

// ---- Per-entry undo operations ----

/**
 * Undo a "created" lock entry. Deletes the file if unmodified; otherwise keeps/archives/deletes
 * based on options and interactivity.
 */
export function undoCreatedEntry(
  filePath: string,
  lockedHash: string,
  opts: UndoOptions,
): UndoEntryResult {
  if (!existsSync(filePath)) {
    return { path: filePath, action: 'skipped', reason: 'File does not exist' };
  }

  const currentHash = hashFile(filePath);
  const isUnmodified = currentHash === lockedHash;

  if (isUnmodified || opts.force) {
    rmSync(filePath, { force: true });
    // Walk ancestor directories and delete if empty
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: 'deleted' };
  }

  // File was user-modified and we are in --yes mode → keep (safe default)
  return { path: filePath, action: 'kept', reason: 'File was modified by user (--yes defaults to Keep)' };
}

/**
 * Undo a "merged" lock entry with strategy "markers". Removes the named marker block.
 * Deletes the file if it becomes empty after removal.
 */
export function undoMergedMarkersEntry(
  filePath: string,
  markerName: string,
): UndoEntryResult {
  if (!existsSync(filePath)) {
    return { path: filePath, action: 'skipped', reason: 'File does not exist' };
  }

  const content = readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop() ?? filePath;

  // Check if markers are present at all
  const startMarker = filePath.endsWith('.gitignore')
    ? `# kdoc:${markerName}:start`
    : `<!-- kdoc:${markerName}:start -->`;

  if (!content.includes(startMarker)) {
    return { path: filePath, action: 'skipped', reason: 'Marker block not found' };
  }

  const cleaned = removeMarkerBlock(content, fileName, markerName);

  if (cleaned.trim() === '') {
    rmSync(filePath, { force: true });
    pruneEmptyAncestors(filePath);
    return { path: filePath, action: 'deleted' };
  }

  writeFileSync(filePath, cleaned, 'utf8');
  return { path: filePath, action: 'cleaned' };
}

/**
 * Undo a "merged" lock entry with strategy "prefix". Removes all kdoc:* keys from
 * the relevant JSON file (package.json scripts or turbo.json tasks).
 */
export function undoMergedPrefixEntry(filePath: string): UndoEntryResult {
  if (!existsSync(filePath)) {
    return { path: filePath, action: 'skipped', reason: 'File does not exist' };
  }

  const content = readFileSync(filePath, 'utf8');
  const fileName = filePath.split('/').pop() ?? '';

  let cleaned: string;
  if (fileName === 'turbo.json') {
    cleaned = removeTurboJsonTasks(content);
  } else {
    // Covers package.json and any other prefix-strategy files
    cleaned = removePackageJsonScripts(content);
  }

  writeFileSync(filePath, cleaned, 'utf8');
  return { path: filePath, action: 'cleaned' };
}

// ---- Ancestor directory pruning ----

/**
 * Walk ancestors of filePath (upward) and delete each directory if it contains
 * only empty subdirectories and no files. Stops at the project root.
 */
function pruneEmptyAncestors(filePath: string): void {
  let current = dirname(resolve(filePath));
  const root = resolve(process.cwd());

  while (current !== root && current !== dirname(current)) {
    const deleted = deleteIfEmpty(current);
    if (!deleted) break;
    current = dirname(current);
  }
}

// ---- Commander registration ----

export function registerUndoCommand(program: Command): void {
  program
    .command('undo')
    .description('Revert all kdoc scaffold operations (reads .kdoc.lock)')
    .option('--keep-config', 'Preserve .kdoc.yaml after undo (skip removal prompt)')
    .option('--yes', 'Non-interactive: modified files default to Keep, config removal defaults to No')
    .option('--force', 'Delete all managed files even if user-modified')
    .action(async (opts: { keepConfig?: boolean; yes?: boolean; force?: boolean }) => {
      const cwd = process.cwd();
      const undoOpts: UndoOptions = { force: !!opts.force, yes: !!opts.yes || !!opts.force };

      const lock = loadLock(cwd);
      if (!lock) {
        console.error('Error: No .kdoc.lock or .kdoc.lock.tmp found. Nothing to undo.');
        process.exit(1);
      }

      const results: UndoEntryResult[] = [];

      // Process each lock entry
      for (const [filePath, entry] of Object.entries(lock.files)) {
        const absolutePath = join(cwd, filePath);

        if (entry.action === 'created') {
          results.push(undoCreatedEntry(absolutePath, entry.hash, undoOpts));
        } else if (entry.action === 'merged' && entry.strategy === 'markers') {
          const markerName = entry.markerName ?? 'core';
          results.push(undoMergedMarkersEntry(absolutePath, markerName));
        } else if (entry.action === 'merged' && entry.strategy === 'prefix') {
          results.push(undoMergedPrefixEntry(absolutePath));
        }
      }

      // Delete lock files
      const lockPath = join(cwd, '.kdoc.lock');
      const lockTmpPath = join(cwd, '.kdoc.lock.tmp');
      if (existsSync(lockPath)) rmSync(lockPath);
      if (existsSync(lockTmpPath)) rmSync(lockTmpPath);

      // Delete backup directory
      const backupDir = join(cwd, '.kdoc.backup');
      if (existsSync(backupDir)) rmSync(backupDir, { recursive: true });

      // Optionally remove .kdoc.yaml
      if (!opts.keepConfig && configExists(cwd)) {
        if (undoOpts.yes) {
          // In --yes mode, default to keeping config (safer)
          console.log('.kdoc.yaml kept (pass --force to remove, or delete manually).');
        } else {
          // In the full implementation, prompt the user here via @inquirer/prompts
          // For now, default to keeping (safe)
          console.log('.kdoc.yaml kept. Remove manually if desired, or re-run with --force.');
        }
      }

      // Report
      const deleted = results.filter(r => r.action === 'deleted').length;
      const cleaned = results.filter(r => r.action === 'cleaned').length;
      const kept = results.filter(r => r.action === 'kept').length;
      const skipped = results.filter(r => r.action === 'skipped').length;

      console.log(`\nUndo complete: ${deleted} deleted, ${cleaned} cleaned, ${kept} kept, ${skipped} skipped.`);

      for (const r of results.filter(r => r.action === 'kept')) {
        console.log(`  [kept] ${r.path}: ${r.reason}`);
      }
    });
}
```

### Step 4: Run tests to verify they pass

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/undo.test.ts`

Expected: All PASS

### Step 5: Commit

- [ ] Run:

```bash
git add cli/src/commands/undo.ts cli/tests/commands/undo.test.ts
git commit -m "feat: undo command — safe revert of created/merged files with ancestor directory cleanup"
```

---

## Task 11: Commander.js Registration

**File:** `cli/src/index.ts`

Register all four commands (update, doctor, create, undo) into the main Commander program. Plan 2A registers init and add; this task extends the program.

### Step 1: Update cli/src/index.ts

- [ ] Edit `cli/src/index.ts` to register the new commands

```typescript
// cli/src/index.ts
import { Command } from 'commander';
import { registerUpdateCommand } from './commands/update.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerCreateCommand } from './commands/create.js';
import { registerUndoCommand } from './commands/undo.js';
// Plan 2A imports (already present after 2A implementation):
// import { registerInitCommand } from './commands/init.js';
// import { registerAddCommand } from './commands/add.js';

const program = new Command();

program
  .name('kdoc')
  .description('Knowledge documentation toolkit — scaffold, maintain, and govern project documentation')
  .version('1.0.0');

// Commands from Plan 2A (uncomment when 2A is implemented)
// registerInitCommand(program);
// registerAddCommand(program);

// Commands from Plan 2B
registerUpdateCommand(program);
registerDoctorCommand(program);
registerCreateCommand(program);
registerUndoCommand(program);

program.parse();
```

### Step 2: Build and verify help output

- [ ] Run: `cd kdoc/cli && pnpm build && node dist/index.js --help`

Expected output includes all 4 commands:
```
Commands:
  update     Update scripts and templates to the current kdoc version
  doctor     Check the health of your kdoc installation
  create     Create a new Knowledge document (...)
  undo       Revert all kdoc scaffold operations (reads .kdoc.lock)
```

### Step 3: Verify each subcommand shows help

- [ ] Run: `node kdoc/cli/dist/index.js update --help`
- [ ] Run: `node kdoc/cli/dist/index.js doctor --help`
- [ ] Run: `node kdoc/cli/dist/index.js create --help`
- [ ] Run: `node kdoc/cli/dist/index.js undo --help`

Expected: Each shows its flags (--dry-run, --json, --scope, --keep-config, etc.)

### Step 4: Commit

- [ ] Run:

```bash
git add cli/src/index.ts
git commit -m "feat: register update, doctor, create, undo commands in CLI entry point"
```

---

## Task 12: Full CLI Integration Test

**Files:**
- Create: `cli/tests/commands/integration.test.ts`

### What This Tests

End-to-end scenario using real temp directories and real file operations. No mocks. Validates the full lifecycle: create a minimal scaffold → run doctor → create a document → run undo.

This test is deliberately scoped to the pure-logic surface (no interactive prompts). It exercises the core modules without requiring a running CLI process.

### Step 1: Write failing tests

- [ ] Create `cli/tests/commands/integration.test.ts`

```typescript
// cli/tests/commands/integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Config layer (Plan 1)
import { writeConfig } from '../../src/config/loader.js';
import { createEmptyLock, appendFileEntry, finalizeLock, loadLock } from '../../src/config/lock.js';
import { hashString } from '../../src/utils/hash.js';

// Commands (Plan 2B)
import { runConfigChecks, runStructureChecks, buildDoctorReport } from '../../src/commands/doctor.js';
import { resolveAdrNumber, resolveCreatePath, validateCreateArgs } from '../../src/commands/create.js';
import { undoCreatedEntry, undoMergedMarkersEntry } from '../../src/commands/undo.js';
import { diffDesiredState } from '../../src/commands/update.js';

const makeHash = (s: string) => hashString(s);

describe('Full lifecycle integration', () => {
  const tmpDir = join(tmpdir(), 'kdoc-integration-test');

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('doctor reports broken when no .kdoc.yaml exists', () => {
    const checks = runConfigChecks(tmpDir);
    const report = buildDoctorReport('1.0.0', checks);
    expect(report.status).toBe('broken');
    const configCheck = checks.find(c => c.name === '.kdoc.yaml exists');
    expect(configCheck?.status).toBe('fail');
  });

  it('doctor reports healthy after simulated init', () => {
    // Simulate what init would do: write config + lock + create Knowledge dirs
    writeConfig(tmpDir, {
      version: 1,
      root: 'Knowledge',
      packs: [],
      tools: [],
      areas: { adr: { enabled: true }, guides: { enabled: true } },
      governance: { 'sync-check': false, wikilinks: false, 'adr-governance': false, 'index-build': false, 'enforced-paths': [] },
      scripts: { prefix: 'kdoc' },
    });

    const lock = createEmptyLock('1.0.0', { root: 'Knowledge', packs: [], tools: [] });

    // Create ADR README (simulating init)
    const adrReadmePath = join(tmpDir, 'Knowledge', 'ADR', 'README.md');
    mkdirSync(join(tmpDir, 'Knowledge', 'ADR'), { recursive: true });
    writeFileSync(adrReadmePath, '# ADRs\n');

    appendFileEntry(tmpDir, lock, 'Knowledge/ADR/README.md', {
      action: 'created',
      hash: makeHash('# ADRs\n'),
      templateHash: makeHash('template-content'),
      template: 'core/templates/readme-adr.md',
    });

    // Create Guides dir (simulating init)
    mkdirSync(join(tmpDir, 'Knowledge', 'Guides'), { recursive: true });

    finalizeLock(tmpDir);

    const configChecks = runConfigChecks(tmpDir);
    const structureChecks = runStructureChecks(tmpDir, 'Knowledge', {
      adr: { enabled: true },
      guides: { enabled: true },
    });
    const allChecks = [...configChecks, ...structureChecks];
    const report = buildDoctorReport('1.0.0', allChecks);

    // Should be healthy or issues (warn from ADR having no user docs yet), not broken
    expect(report.summary.fail).toBe(0);
  });

  it('create ADR increments number correctly', () => {
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });
    writeFileSync(join(adrDir, 'ADR-0001-first.md'), '');
    writeFileSync(join(adrDir, 'ADR-0002-second.md'), '');

    const nextNumber = resolveAdrNumber(adrDir);
    expect(nextNumber).toBe('0003');

    const path = resolveCreatePath('adr', 'third-decision', {
      root: join(tmpDir, 'Knowledge'),
      adrNumber: nextNumber,
    });
    expect(path).toContain('ADR-0003-third-decision.md');
  });

  it('idempotency: diffDesiredState returns all SKIP when nothing changed', () => {
    const templateHash = makeHash('template-v1');
    const fileHash = makeHash('rendered-content');

    const lock = {
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { root: 'Knowledge', packs: [], tools: [] },
      files: {
        'Knowledge/ADR/README.md': {
          action: 'created' as const,
          hash: fileHash,
          templateHash,
          template: 'core/templates/readme-adr.md',
        },
      },
    };

    const desired = {
      'Knowledge/ADR/README.md': {
        template: 'core/templates/readme-adr.md',
        currentTemplateHash: templateHash, // same as lock
        currentFileHash: fileHash,         // same as lock
      },
    };

    const ops = diffDesiredState(lock, desired);
    expect(ops.every(o => o.type === 'SKIP')).toBe(true);
  });

  it('undo leaves project clean after simulated install', () => {
    // Setup: create a file and a marker-merged file
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });

    const adrContent = '# ADRs\n';
    const adrPath = join(adrDir, 'README.md');
    writeFileSync(adrPath, adrContent);

    const claudeContent = [
      '# CLAUDE.md',
      '',
      '<!-- kdoc:core:start -->',
      '## Knowledge Base',
      '<!-- kdoc:core:end -->',
    ].join('\n');
    const claudePath = join(tmpDir, 'CLAUDE.md');
    writeFileSync(claudePath, claudeContent);

    // Undo the created file
    const createdResult = undoCreatedEntry(adrPath, makeHash(adrContent), { force: false, yes: true });
    expect(createdResult.action).toBe('deleted');
    expect(existsSync(adrPath)).toBe(false);

    // Undo the merged file
    const mergedResult = undoMergedMarkersEntry(claudePath, 'core');
    expect(mergedResult.action).toBe('cleaned');
    const remaining = readFileSync(claudePath, 'utf8');
    expect(remaining).not.toContain('kdoc:core:start');
    expect(remaining).toContain('CLAUDE.md');
  });

  it('undo with modified file keeps it (--yes safe default)', () => {
    const adrDir = join(tmpDir, 'Knowledge', 'ADR');
    mkdirSync(adrDir, { recursive: true });

    const originalContent = '# ADRs\n';
    const modifiedContent = '# ADRs\n\nUser added this paragraph.\n';
    const adrPath = join(adrDir, 'README.md');
    writeFileSync(adrPath, modifiedContent); // file has been edited

    const result = undoCreatedEntry(adrPath, makeHash(originalContent), { force: false, yes: true });
    expect(result.action).toBe('kept');
    expect(existsSync(adrPath)).toBe(true);
  });
});
```

### Step 2: Run tests to verify they fail

- [ ] Run: `cd kdoc/cli && pnpm test -- tests/commands/integration.test.ts`

Expected: FAIL — modules not found

### Step 3: Run full test suite after all commands are implemented

- [ ] Run: `cd kdoc/cli && pnpm test`

Expected: All tests pass (hash, fs, git, schema, loader, lock, renderer, markers, package-json, turbo-json, update, doctor, create, undo, integration)

### Step 4: Run typecheck

- [ ] Run: `cd kdoc/cli && pnpm typecheck`

Expected: No errors

### Step 5: Run build

- [ ] Run: `cd kdoc/cli && pnpm build`

Expected: `dist/index.js` created successfully with all 4 commands registered

### Step 6: Verify all commands appear in help

- [ ] Run: `node kdoc/cli/dist/index.js --help`

Expected: All commands listed (update, doctor, create, undo; plus init and add from Plan 2A)

### Step 7: Commit

- [ ] Run:

```bash
git add cli/tests/commands/integration.test.ts
git commit -m "test: full CLI lifecycle integration test — init, doctor, create ADR, idempotency, undo"
```

---

## Summary

This plan delivers the remaining 4 CLI commands on top of the foundation from Plan 1 and the scaffold engine from Plan 2A:

| Component | Key Capability | Test Coverage |
|-----------|---------------|---------------|
| `update.ts` | Desired-state diff engine (5 operation types) | 6 unit tests covering all operation types and version upgrade scenario |
| `doctor.ts` | 5-category health checks, JSON output, exit codes | 9 unit tests for config/structure/integration checks and report building |
| `create.ts` | Document creation with sequential ADR numbering, TLDR scope validation | 9 unit tests for ADR numbering, path resolution, and arg validation |
| `undo.ts` | Safe revert of created/merged files, ancestor directory cleanup | 8 unit tests for all 3 action types and edge cases |
| `integration.test.ts` | Full lifecycle: doctor → create → idempotency → undo | 5 integration scenarios |

**Architecture rule followed:** Each command is a thin Commander.js wrapper. Business logic lives in exported pure functions (`diffDesiredState`, `runConfigChecks`, `resolveAdrNumber`, `undoCreatedEntry`, etc.) that are independently testable without spawning a child process.

**TDD evidence:** Each task follows RED → GREEN → REFACTOR. Tests are written and verified failing before implementation is added.

**Idempotency:** The `diffDesiredState` function returns `SKIP` for all entries when the template hash and file hash are both unchanged — verified by the integration test "idempotency" scenario.

**Safety invariants maintained:**
- `undoCreatedEntry` defaults to Keep for user-modified files in `--yes` mode
- `undoMergedMarkersEntry` is a no-op when markers are absent
- `doctor` exits with code 2 on config error (config layer broken), code 1 on check failures
- `create` errors rather than silently overwriting existing files

---

## Implementation Notes (from cross-plan review)

1. **Undo directory-walk cleanup needs tests.** Add test scenarios in `undo.test.ts` for ancestor directory pruning: (a) empty parent deleted after file removal, (b) parent with untracked user file preserved, (c) nested empty dirs cleaned up, (d) stops at Knowledge/ root.

2. **Update command orchestration.** The `registerUpdateCommand` action body is a stub. The implementer must wire `loadLock` → `buildDesiredState` → `diffDesiredState` → `execute` → `writeLock`. This is the full update flow — not just the diff function.

3. **Doctor area expectation types.** Add explicit test scenarios for each type: `empty-ok` (guides — no warn when empty), `readme-required` (adr — fail when no README), `generated-required` (index — fail when no INDEX.md), `seed-file-required` (agent-memory — fail when no MEMORY.md), `content-expected` (adr — warn when README but zero ADR files).

4. **Phase and sub-phase numbering in create.** Add test scenarios for `kdoc create phase` and `kdoc create sub-phase` with sequential number detection (same pattern as ADR numbering).

5. **Lock schema migration.** Add a stub migration handler in `update.ts`: if `lock.lockVersion < CURRENT_LOCK_VERSION`, run migration. For v1, this is a no-op since there's only version 1, but the hook point must exist.
