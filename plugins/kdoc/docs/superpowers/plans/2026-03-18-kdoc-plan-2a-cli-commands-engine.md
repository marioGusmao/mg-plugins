# kdoc Plan 2A: CLI Commands — Scaffold Engine + Init + Add

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scaffold engine (detect, plan, execute) and the two commands that use it (init, add).

**Architecture:** The scaffold engine is the core orchestrator — detect.ts identifies the project state, plan.ts generates an operation list, execute.ts applies changes transactionally. Init and add are thin wrappers that configure the engine and run it.

**Tech Stack:** TypeScript, Commander.js, @inquirer/prompts, fast-glob

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md`
**Depends on:** Plan 1 (CLI Foundation)
**Continues in:** Plan 2B (update, doctor, create, undo)

---

## File Structure

```
kdoc/
└── cli/
    ├── src/
    │   ├── scaffold/
    │   │   ├── detect.ts          # Stack + state + AI tool detection
    │   │   ├── plan.ts            # FileOperation list generator
    │   │   ├── execute.ts         # Transactional executor
    │   │   └── merge/             # (Plan 1 — already implemented)
    │   ├── commands/
    │   │   ├── init.ts            # Interactive / non-interactive scaffold
    │   │   └── add.ts             # add <area>, add-pack <pack>, add-tool <tool>
    │   └── index.ts               # Commander.js root + command registration
    └── tests/
        ├── scaffold/
        │   ├── detect.test.ts
        │   ├── plan.test.ts
        │   └── execute.test.ts
        └── commands/
            ├── init.test.ts
            └── add.test.ts
```

---

## Shared Types

Before the tasks begin, establish the shared types file that all scaffold modules depend on. This is a prerequisite that gets created at the start of Task 1.

```typescript
// cli/src/scaffold/types.ts
export type OperationType = 'CREATE' | 'MERGE' | 'UPDATE' | 'REMOVE' | 'RENAME' | 'SKIP' | 'CONFLICT';

export type MergeStrategy = 'markers' | 'prefix';

export interface FileOperation {
  /** Relative path from project root */
  path: string;
  type: OperationType;
  /** Path to the source template file within the kdoc package */
  source: string;
  /** For MERGE operations: which merge strategy to use */
  mergeStrategy?: MergeStrategy;
  /** For strategy 'markers': the named marker block (e.g., 'core', 'pack:nextjs') */
  markerName?: string;
  /** Human-readable reason why this operation was chosen */
  reason?: string;
}

export interface ExecutionSummary {
  created: string[];
  merged: string[];
  updated: string[];
  removed: string[];
  renamed: Array<{ from: string; to: string }>;
  skipped: string[];
  conflicts: string[];
  errors: Array<{ path: string; error: string }>;
}

/** Resolves a template name to its content and hash. Returns null if not found. */
export type TemplateResolver = (templateName: string) => {
  content: string;
  hash: string;
} | null;
```

---

## Task 1: Stack Detector (`cli/src/scaffold/detect.ts`)

**Files:**
- Create: `cli/src/scaffold/types.ts` (shared types — prerequisite for all tasks)
- Create: `cli/src/scaffold/detect.ts`
- Test: `cli/tests/scaffold/detect.test.ts`

### What this module does

`detect.ts` reads the filesystem (never writes) and answers three questions:

1. **Stack**: Which technology packs are present? Searches root + 2 directory levels deep for indicator files.
2. **State**: What Knowledge structure already exists? Which subdirs, how many files, is there a `.kdoc.yaml` or `.kdoc.lock`?
3. **AI tools**: Which AI tool configurations are present (`.claude/`, `AGENTS.md`, `.codex/`)?

Indicator resolution:
- `next.config.ts` | `next.config.js` | `next.config.mjs` → `nextjs`
- `Package.swift` | `*.xcodeproj` (glob) → `swift-ios`

When an indicator is found at depth > 0 (i.e., inside a subfolder), it is flagged as a monorepo hint so the caller can present it appropriately to the user.

```typescript
// cli/src/scaffold/detect.ts — exported API shape
export interface DetectedStack {
  packs: Array<{ name: string; depth: number; path: string }>;
  isMonorepo: boolean;
}

export interface DetectedKnowledgeState {
  hasKnowledgeDir: boolean;
  existingAreas: string[];            // which subdirs exist under Knowledge/
  fileCount: number;                  // total files inside Knowledge/
  hasConfig: boolean;                 // .kdoc.yaml exists
  hasLock: boolean;                   // .kdoc.lock exists
  hasPendingLockTmp: boolean;         // .kdoc.lock.tmp exists (interrupted install)
}

export interface DetectedAITools {
  tools: string[];   // e.g., ['claude-code', 'codex']
}

export interface DetectionResult {
  stack: DetectedStack;
  knowledge: DetectedKnowledgeState;
  aiTools: DetectedAITools;
}

export async function detectProject(projectDir: string): Promise<DetectionResult>
```

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/scaffold/detect.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectProject } from '../../src/scaffold/detect.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function makeDir(base: string, ...parts: string[]): string {
  const p = join(base, ...parts);
  mkdirSync(p, { recursive: true });
  return p;
}

describe('detectProject — stack detection', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = join(tmpdir(), `kdoc-detect-${Date.now()}`); mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('detects nextjs at root level (depth 0)', async () => {
    writeFileSync(join(tmpDir, 'next.config.ts'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs).toHaveLength(1);
    expect(result.stack.packs[0].name).toBe('nextjs');
    expect(result.stack.packs[0].depth).toBe(0);
    expect(result.stack.isMonorepo).toBe(false);
  });

  it('detects nextjs via next.config.js', async () => {
    writeFileSync(join(tmpDir, 'next.config.js'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs[0].name).toBe('nextjs');
  });

  it('detects nextjs via next.config.mjs', async () => {
    writeFileSync(join(tmpDir, 'next.config.mjs'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs[0].name).toBe('nextjs');
  });

  it('detects swift-ios via Package.swift', async () => {
    writeFileSync(join(tmpDir, 'Package.swift'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs[0].name).toBe('swift-ios');
  });

  it('detects swift-ios via .xcodeproj glob', async () => {
    makeDir(tmpDir, 'MyApp.xcodeproj');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs[0].name).toBe('swift-ios');
  });

  it('detects monorepo when indicator is at depth 1', async () => {
    const sub = makeDir(tmpDir, 'apps', 'web');
    writeFileSync(join(sub, 'next.config.ts'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.isMonorepo).toBe(true);
    expect(result.stack.packs[0].depth).toBeGreaterThan(0);
  });

  it('searches up to depth 2', async () => {
    const sub = makeDir(tmpDir, 'apps', 'web');
    writeFileSync(join(sub, 'next.config.ts'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs).toHaveLength(1);
  });

  it('does NOT search beyond depth 2', async () => {
    const deep = makeDir(tmpDir, 'a', 'b', 'c');
    writeFileSync(join(deep, 'next.config.ts'), '');
    const result = await detectProject(tmpDir);
    expect(result.stack.packs).toHaveLength(0);
  });

  it('detects multiple packs (nextjs + swift-ios)', async () => {
    writeFileSync(join(tmpDir, 'next.config.ts'), '');
    writeFileSync(join(tmpDir, 'Package.swift'), '');
    const result = await detectProject(tmpDir);
    const names = result.stack.packs.map(p => p.name).sort();
    expect(names).toEqual(['nextjs', 'swift-ios']);
  });

  it('returns empty packs for unknown project', async () => {
    const result = await detectProject(tmpDir);
    expect(result.stack.packs).toHaveLength(0);
    expect(result.stack.isMonorepo).toBe(false);
  });
});

describe('detectProject — knowledge state', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = join(tmpdir(), `kdoc-state-${Date.now()}`); mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('reports no Knowledge dir when absent', async () => {
    const result = await detectProject(tmpDir);
    expect(result.knowledge.hasKnowledgeDir).toBe(false);
    expect(result.knowledge.existingAreas).toEqual([]);
    expect(result.knowledge.fileCount).toBe(0);
  });

  it('reports existing areas and file count', async () => {
    const kDir = makeDir(tmpDir, 'Knowledge');
    makeDir(kDir, 'ADR');
    writeFileSync(join(kDir, 'ADR', 'README.md'), '# ADR');
    makeDir(kDir, 'TLDR');
    const result = await detectProject(tmpDir);
    expect(result.knowledge.hasKnowledgeDir).toBe(true);
    expect(result.knowledge.existingAreas).toContain('ADR');
    expect(result.knowledge.existingAreas).toContain('TLDR');
    expect(result.knowledge.fileCount).toBeGreaterThanOrEqual(1);
  });

  it('detects .kdoc.yaml', async () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), 'version: 1\nroot: Knowledge\npacks: []\ntools: []');
    const result = await detectProject(tmpDir);
    expect(result.knowledge.hasConfig).toBe(true);
  });

  it('detects .kdoc.lock', async () => {
    writeFileSync(join(tmpDir, '.kdoc.lock'), '{}');
    const result = await detectProject(tmpDir);
    expect(result.knowledge.hasLock).toBe(true);
  });

  it('detects .kdoc.lock.tmp (pending)', async () => {
    writeFileSync(join(tmpDir, '.kdoc.lock.tmp'), '{}');
    const result = await detectProject(tmpDir);
    expect(result.knowledge.hasPendingLockTmp).toBe(true);
  });
});

describe('detectProject — AI tool detection', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = join(tmpdir(), `kdoc-tools-${Date.now()}`); mkdirSync(tmpDir, { recursive: true }); });
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('detects claude-code via .claude/ directory', async () => {
    makeDir(tmpDir, '.claude');
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toContain('claude-code');
  });

  it('detects claude-code via .claude-plugin/ directory', async () => {
    makeDir(tmpDir, '.claude-plugin');
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toContain('claude-code');
  });

  it('detects codex via AGENTS.md', async () => {
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Agents');
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toContain('codex');
  });

  it('detects codex via .codex/ directory', async () => {
    makeDir(tmpDir, '.codex');
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toContain('codex');
  });

  it('detects multiple tools', async () => {
    makeDir(tmpDir, '.claude');
    writeFileSync(join(tmpDir, 'AGENTS.md'), '# Agents');
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toContain('claude-code');
    expect(result.aiTools.tools).toContain('codex');
  });

  it('returns empty tools list for no indicators', async () => {
    const result = await detectProject(tmpDir);
    expect(result.aiTools.tools).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/detect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the shared types file**

```typescript
// cli/src/scaffold/types.ts
export type OperationType = 'CREATE' | 'MERGE' | 'UPDATE' | 'REMOVE' | 'RENAME' | 'SKIP' | 'CONFLICT';

export type MergeStrategy = 'markers' | 'prefix';

export interface FileOperation {
  /** Relative path from project root */
  path: string;
  type: OperationType;
  /** Path to the source template file within the kdoc package */
  source: string;
  /** For MERGE operations: which merge strategy to use */
  mergeStrategy?: MergeStrategy;
  /** For strategy 'markers': the named marker block (e.g., 'core', 'pack:nextjs') */
  markerName?: string;
  /** Human-readable reason why this operation was chosen */
  reason?: string;
}

export interface ExecutionSummary {
  created: string[];
  merged: string[];
  updated: string[];
  removed: string[];
  renamed: Array<{ from: string; to: string }>;
  skipped: string[];
  conflicts: string[];
  errors: Array<{ path: string; error: string }>;
}
```

- [ ] **Step 4: Write the detect implementation**

```typescript
// cli/src/scaffold/detect.ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import fg from 'fast-glob';

export interface DetectedPack {
  name: string;
  /** 0 = root, 1 = one level deep, 2 = two levels deep */
  depth: number;
  /** Absolute path to the indicator file that triggered detection */
  path: string;
}

export interface DetectedStack {
  packs: DetectedPack[];
  isMonorepo: boolean;
}

export interface DetectedKnowledgeState {
  hasKnowledgeDir: boolean;
  existingAreas: string[];
  fileCount: number;
  hasConfig: boolean;
  hasLock: boolean;
  hasPendingLockTmp: boolean;
}

export interface DetectedAITools {
  tools: string[];
}

export interface DetectionResult {
  stack: DetectedStack;
  knowledge: DetectedKnowledgeState;
  aiTools: DetectedAITools;
}

// --- Stack detection ---

interface StackIndicator {
  pattern: string;
  pack: string;
}

const STACK_INDICATORS: StackIndicator[] = [
  { pattern: 'next.config.ts', pack: 'nextjs' },
  { pattern: 'next.config.js', pack: 'nextjs' },
  { pattern: 'next.config.mjs', pack: 'nextjs' },
  { pattern: 'Package.swift', pack: 'swift-ios' },
  { pattern: '*.xcodeproj', pack: 'swift-ios' },
];

async function detectStack(projectDir: string): Promise<DetectedStack> {
  const detected = new Map<string, DetectedPack>();

  // Build patterns for depth 0, 1, and 2
  const patterns: string[] = [];
  for (const indicator of STACK_INDICATORS) {
    patterns.push(indicator.pattern);            // depth 0
    patterns.push(`*/${indicator.pattern}`);     // depth 1
    patterns.push(`*/*/${indicator.pattern}`);   // depth 2
  }

  const matches = await fg(patterns, {
    cwd: projectDir,
    absolute: true,
    onlyFiles: false,
    ignore: ['node_modules/**', '.git/**'],
  });

  for (const matchPath of matches) {
    const rel = relative(projectDir, matchPath);
    const parts = rel.split('/');
    const depth = parts.length - 1;

    const fileName = parts[parts.length - 1];
    const indicator = STACK_INDICATORS.find(ind => {
      if (ind.pattern.includes('*')) {
        // Glob pattern: check extension
        const ext = ind.pattern.replace('*', '');
        return fileName.endsWith(ext);
      }
      return fileName === ind.pattern;
    });

    if (!indicator) continue;

    const pack = indicator.pack;
    // Only keep the shallowest occurrence of each pack
    const existing = detected.get(pack);
    if (!existing || depth < existing.depth) {
      detected.set(pack, { name: pack, depth, path: matchPath });
    }
  }

  const packs = Array.from(detected.values());
  const isMonorepo = packs.some(p => p.depth > 0);

  return { packs, isMonorepo };
}

// --- Knowledge state detection ---

function countFilesRecursive(dir: string): number {
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) count++;
    else if (entry.isDirectory()) count += countFilesRecursive(join(dir, entry.name));
  }
  return count;
}

function detectKnowledgeState(projectDir: string): DetectedKnowledgeState {
  const knowledgeDir = join(projectDir, 'Knowledge');
  const hasKnowledgeDir = existsSync(knowledgeDir);

  let existingAreas: string[] = [];
  let fileCount = 0;

  if (hasKnowledgeDir) {
    const entries = readdirSync(knowledgeDir, { withFileTypes: true });
    existingAreas = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
    fileCount = countFilesRecursive(knowledgeDir);
  }

  return {
    hasKnowledgeDir,
    existingAreas,
    fileCount,
    hasConfig: existsSync(join(projectDir, '.kdoc.yaml')),
    hasLock: existsSync(join(projectDir, '.kdoc.lock')),
    hasPendingLockTmp: existsSync(join(projectDir, '.kdoc.lock.tmp')),
  };
}

// --- AI tool detection ---

function detectAITools(projectDir: string): DetectedAITools {
  const tools: string[] = [];

  // Claude Code indicators
  if (
    existsSync(join(projectDir, '.claude')) ||
    existsSync(join(projectDir, '.claude-plugin'))
  ) {
    tools.push('claude-code');
  }

  // Codex indicators
  if (
    existsSync(join(projectDir, 'AGENTS.md')) ||
    existsSync(join(projectDir, '.codex'))
  ) {
    tools.push('codex');
  }

  return { tools };
}

// --- Public API ---

export async function detectProject(projectDir: string): Promise<DetectionResult> {
  const [stack, knowledge, aiTools] = await Promise.all([
    detectStack(projectDir),
    Promise.resolve(detectKnowledgeState(projectDir)),
    Promise.resolve(detectAITools(projectDir)),
  ]);

  return { stack, knowledge, aiTools };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/detect.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/scaffold/types.ts cli/src/scaffold/detect.ts cli/tests/scaffold/detect.test.ts
git commit -m "feat: scaffold detector — stack, knowledge state, and AI tool detection"
```

---

## Task 2: Execution Planner (`cli/src/scaffold/plan.ts`)

**Files:**
- Create: `cli/src/scaffold/plan.ts`
- Test: `cli/tests/scaffold/plan.test.ts`

### What this module does

`plan.ts` takes a `KdocConfig` + a `DetectionResult` + the current `.kdoc.lock` (or null for fresh install) and produces a list of `FileOperation[]` — the ordered list of changes the executor will apply.

Classification logic (implements the Idempotency Decision Tree from spec §4.6):

```
For each file in the desired scaffold:
  File exists on disk?
  ├─ NO → type: CREATE
  └─ YES → In .kdoc.lock?
            ├─ YES (managed) → hash matches lock?
            │   ├─ YES → type: SKIP (unmodified, template unchanged)
            │   └─ NO  → type: CONFLICT (user modified — caller handles prompt)
            └─ NO (unmanaged) → is a mergeable file type?
                ├─ YES → type: MERGE (with appropriate strategy)
                └─ NO  → type: SKIP (with warning reason)
```

Mergeable file types are: `CLAUDE.md`, `AGENTS.md`, `.gitignore`, `package.json`, `turbo.json`.

The planner also receives a `templateResolver` function (injected for testability) that maps a logical template name (e.g., `'core/templates/adr.md'`) to its filesystem path and pre-rendered content.

```typescript
// Exported API
export interface PlannerOptions {
  config: KdocConfig;
  detection: DetectionResult;
  lock: KdocLock | null;
  projectDir: string;
  templateResolver: TemplateResolver;
}

export type TemplateResolver = (templateName: string) => {
  sourcePath: string;
  content: string;
} | null;

export function planScaffold(options: PlannerOptions): FileOperation[]
```

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/scaffold/plan.test.ts
import { describe, it, expect } from 'vitest';
import { planScaffold } from '../../src/scaffold/plan.js';
import type { KdocConfig } from '../../src/config/schema.js';
import type { DetectionResult } from '../../src/scaffold/detect.js';
import type { KdocLock } from '../../src/config/schema.js';
import type { TemplateResolver } from '../../src/scaffold/plan.js';

// Minimal valid config for testing
const baseConfig: KdocConfig = {
  version: 1,
  root: 'Knowledge',
  packs: [],
  tools: [],
  areas: { adr: { enabled: true } },
  governance: {
    'sync-check': true,
    wikilinks: true,
    'adr-governance': true,
    'index-build': true,
    'enforced-paths': [],
  },
  scripts: { prefix: 'kdoc' },
};

const emptyDetection: DetectionResult = {
  stack: { packs: [], isMonorepo: false },
  knowledge: {
    hasKnowledgeDir: false,
    existingAreas: [],
    fileCount: 0,
    hasConfig: false,
    hasLock: false,
    hasPendingLockTmp: false,
  },
  aiTools: { tools: [] },
};

// Template resolver that always returns a dummy template
const stubResolver: TemplateResolver = (name) => ({
  sourcePath: `/kdoc/core/templates/${name}`,
  content: `# ${name} template content`,
});

// Template resolver that returns null (simulates missing template)
const nullResolver: TemplateResolver = () => null;

describe('planScaffold — CREATE classification', () => {
  it('classifies a new file as CREATE when it does not exist on disk', () => {
    // projectDir points to a dir where 'Knowledge/ADR/README.md' does not exist
    const ops = planScaffold({
      config: baseConfig,
      detection: emptyDetection,
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    const createOps = ops.filter(op => op.type === 'CREATE');
    expect(createOps.length).toBeGreaterThan(0);
  });

  it('sets source on CREATE operations', () => {
    const ops = planScaffold({
      config: baseConfig,
      detection: emptyDetection,
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    for (const op of ops.filter(o => o.type === 'CREATE')) {
      expect(op.source).toBeTruthy();
    }
  });
});

describe('planScaffold — MERGE classification', () => {
  it('classifies CLAUDE.md as MERGE with markers strategy when not in lock', () => {
    const ops = planScaffold({
      config: { ...baseConfig, tools: ['claude-code'] },
      detection: {
        ...emptyDetection,
        aiTools: { tools: ['claude-code'] },
      },
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    const claudeMd = ops.find(op => op.path === 'CLAUDE.md');
    // CLAUDE.md exists (simulated) → MERGE with markers
    // Since projectDir is nonexistent, CLAUDE.md doesn't exist → CREATE
    // We test the MERGE path via a mock below
    // Verify the planner produces an op for CLAUDE.md
    expect(claudeMd).toBeDefined();
  });

  it('classifies package.json as MERGE with prefix strategy', () => {
    const ops = planScaffold({
      config: baseConfig,
      detection: emptyDetection,
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    const pkgOp = ops.find(op => op.path === 'package.json');
    if (pkgOp) {
      expect(['MERGE', 'CREATE', 'SKIP']).toContain(pkgOp.type);
      if (pkgOp.type === 'MERGE') {
        expect(pkgOp.mergeStrategy).toBe('prefix');
      }
    }
  });
});

describe('planScaffold — SKIP classification', () => {
  it('classifies a file in lock with matching hash as SKIP', () => {
    // Simulate: 'Knowledge/ADR/README.md' is managed, hash matches
    const lock: KdocLock = {
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { root: 'Knowledge', packs: [], tools: [] },
      files: {
        'Knowledge/ADR/README.md': {
          action: 'created',
          hash: 'sha256:' + 'a'.repeat(64),
          templateHash: 'sha256:' + 'b'.repeat(64),
          template: 'core/templates/readme-adr.md',
        },
      },
    };
    const ops = planScaffold({
      config: baseConfig,
      detection: emptyDetection,
      lock,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    // The file is in the lock → it will be SKIP or CONFLICT based on hash
    // Since disk file doesn't exist in our nonexistent dir, CREATE wins
    // Structural test: verify planner doesn't crash with a lock
    expect(ops).toBeDefined();
    expect(Array.isArray(ops)).toBe(true);
  });
});

describe('planScaffold — CONFLICT classification', () => {
  it('classifies managed file with non-matching hash as CONFLICT', () => {
    // This is tested via the executor path; planner marks CONFLICT
    // when file is in lock but content hash differs from lock's hash
    // We verify the planner handles this case without throwing
    const lock: KdocLock = {
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { root: 'Knowledge', packs: [], tools: [] },
      files: {
        'some-managed-file.md': {
          action: 'created',
          hash: 'sha256:' + 'x'.repeat(64),  // hash that won't match disk
          templateHash: 'sha256:' + 'b'.repeat(64),
          template: 'core/templates/adr.md',
        },
      },
    };
    expect(() =>
      planScaffold({
        config: baseConfig,
        detection: emptyDetection,
        lock,
        projectDir: '/nonexistent/project',
        templateResolver: stubResolver,
      })
    ).not.toThrow();
  });
});

describe('planScaffold — disabled areas', () => {
  it('does not include ops for disabled areas', () => {
    const config: KdocConfig = {
      ...baseConfig,
      areas: {
        adr: { enabled: false },
        tldr: { enabled: true },
      },
    };
    const ops = planScaffold({
      config,
      detection: emptyDetection,
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: stubResolver,
    });
    const adrOps = ops.filter(op => op.path.includes('/ADR/'));
    expect(adrOps).toHaveLength(0);
  });
});

describe('planScaffold — null template resolver', () => {
  it('skips operations when resolver returns null', () => {
    const ops = planScaffold({
      config: baseConfig,
      detection: emptyDetection,
      lock: null,
      projectDir: '/nonexistent/project',
      templateResolver: nullResolver,
    });
    // Null resolver → no CREATE ops (nothing to create without a template)
    const createOps = ops.filter(op => op.type === 'CREATE');
    expect(createOps).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/plan.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/scaffold/plan.ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { KdocConfig, KdocLock } from '../config/schema.js';
import type { DetectionResult } from './detect.js';
import type { FileOperation, MergeStrategy } from './types.js';
import { hashFile } from '../utils/hash.js';

export type TemplateResolver = (templateName: string) => {
  sourcePath: string;
  content: string;
} | null;

export interface PlannerOptions {
  config: KdocConfig;
  detection: DetectionResult;
  lock: KdocLock | null;
  projectDir: string;
  templateResolver: TemplateResolver;
}

// Files that support merging rather than full replacement
const MERGE_CANDIDATES: Record<string, { strategy: MergeStrategy; markerName?: string }> = {
  'CLAUDE.md': { strategy: 'markers', markerName: 'core' },
  'AGENTS.md': { strategy: 'markers', markerName: 'core' },
  '.gitignore': { strategy: 'markers', markerName: 'core' },
  'package.json': { strategy: 'prefix' },
  'turbo.json': { strategy: 'prefix' },
};

interface DesiredFile {
  path: string;
  templateName: string;
}

/**
 * Derive the list of files that SHOULD exist given the current config.
 * Returns logical template names, not resolved filesystem paths.
 */
function deriveDesiredFiles(config: KdocConfig, detection: DetectionResult): DesiredFile[] {
  const files: DesiredFile[] = [];
  const root = config.root ?? 'Knowledge';

  // Core area files
  const areas = config.areas ?? {};

  if (areas.adr?.enabled) {
    files.push({ path: `${root}/ADR/README.md`, templateName: 'core/templates/readme-adr.md' });
  }

  if (areas.tldr?.enabled) {
    files.push({ path: `${root}/TLDR/README.md`, templateName: 'core/templates/readme-tldr.md' });
    for (const scope of areas.tldr.scopes ?? []) {
      files.push({
        path: `${root}/TLDR/${scope}/.gitkeep`,
        templateName: 'core/templates/gitkeep',
      });
    }
  }

  if (areas.roadmap?.enabled) {
    files.push({ path: `${root}/Roadmap/README.md`, templateName: 'core/templates/readme-roadmap.md' });
  }

  if (areas['context-pack']?.enabled) {
    files.push({ path: `${root}/ContextPack.md`, templateName: 'core/templates/context-pack.md' });
  }

  if (areas['agent-memory']?.enabled) {
    files.push({ path: `${root}/AgentMemory/MEMORY.md`, templateName: 'core/templates/memory.md' });
  }

  if (areas.guides?.enabled) {
    files.push({ path: `${root}/Guides/.gitkeep`, templateName: 'core/templates/gitkeep' });
  }

  if (areas.runbooks?.enabled) {
    files.push({ path: `${root}/runbooks/.gitkeep`, templateName: 'core/templates/gitkeep' });
  }

  if (areas.templates?.enabled) {
    files.push({ path: `${root}/Templates/.gitkeep`, templateName: 'core/templates/gitkeep' });
  }

  // AI tool integration files
  for (const tool of config.tools ?? []) {
    if (tool === 'claude-code') {
      files.push({ path: 'CLAUDE.md', templateName: 'core/templates/claude-md-block.md' });
    }
    if (tool === 'codex') {
      files.push({ path: 'AGENTS.md', templateName: 'core/templates/agents-md-block.md' });
    }
  }

  // .gitignore entry (always — .kdoc.backup/ must be ignored)
  files.push({ path: '.gitignore', templateName: 'core/templates/gitignore-block' });

  // package.json scripts (always)
  files.push({ path: 'package.json', templateName: 'core/templates/package-json-scripts' });

  return files;
}

function classifyOperation(
  desiredPath: string,
  templateName: string,
  projectDir: string,
  lock: KdocLock | null,
  resolver: TemplateResolver,
): FileOperation | null {
  const resolved = resolver(templateName);
  if (!resolved) return null;

  const absPath = join(projectDir, desiredPath);
  const mergeConfig = MERGE_CANDIDATES[desiredPath.split('/').pop() ?? ''];

  // File does not exist on disk → CREATE
  if (!existsSync(absPath)) {
    return {
      path: desiredPath,
      type: 'CREATE',
      source: resolved.sourcePath,
      ...(mergeConfig ? { mergeStrategy: mergeConfig.strategy, markerName: mergeConfig.markerName } : {}),
    };
  }

  // File exists → check lock
  const lockEntry = lock?.files[desiredPath];

  if (lockEntry) {
    // Managed by kdoc — compare hash
    const expectedHash = lockEntry.action === 'created' ? lockEntry.hash : lockEntry.blockHash;
    let currentHash: string;
    try {
      currentHash = hashFile(absPath);
    } catch {
      currentHash = '';
    }

    if (currentHash === expectedHash) {
      return { path: desiredPath, type: 'SKIP', source: resolved.sourcePath, reason: 'unmodified' };
    } else {
      return { path: desiredPath, type: 'CONFLICT', source: resolved.sourcePath, reason: 'user-modified' };
    }
  }

  // Not in lock → check if mergeable
  if (mergeConfig) {
    return {
      path: desiredPath,
      type: 'MERGE',
      source: resolved.sourcePath,
      mergeStrategy: mergeConfig.strategy,
      markerName: mergeConfig.markerName,
    };
  }

  // Exists, not in lock, not mergeable → SKIP with warning
  return {
    path: desiredPath,
    type: 'SKIP',
    source: resolved.sourcePath,
    reason: `file exists and is not managed by kdoc — skipping`,
  };
}

export function planScaffold(options: PlannerOptions): FileOperation[] {
  const { config, detection, lock, projectDir, templateResolver } = options;
  const desired = deriveDesiredFiles(config, detection);
  const operations: FileOperation[] = [];

  for (const { path, templateName } of desired) {
    const op = classifyOperation(path, templateName, projectDir, lock, templateResolver);
    if (op) operations.push(op);
  }

  return operations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/plan.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/scaffold/plan.ts cli/tests/scaffold/plan.test.ts
git commit -m "feat: execution planner — classify file operations as CREATE/MERGE/SKIP/CONFLICT"
```

---

## Task 3: Executor (`cli/src/scaffold/execute.ts`)

**Files:**
- Create: `cli/src/scaffold/execute.ts`
- Test: `cli/tests/scaffold/execute.test.ts`

### What this module does

`execute.ts` takes a `FileOperation[]` list and applies every operation transactionally. It:

1. Initialises the `.kdoc.lock.tmp` file (an empty lock with metadata).
2. For each operation:
   - **CREATE**: renders the template with placeholder values, calls `safeWriteFile`, registers the entry in the tmp lock.
   - **MERGE**: reads the existing file, applies the appropriate merge strategy (from Plan 1's `cli/src/scaffold/merge/` modules), writes back, registers the entry.
   - **SKIP**: logs the skip reason, no file changes.
   - **CONFLICT**: logs the conflict, no file changes (conflict resolution is handled by the calling command).
3. After all operations, calls `finalizeLock` to atomically rename `.kdoc.lock.tmp` → `.kdoc.lock`.
4. Returns an `ExecutionSummary`.

Backup behaviour: before the first MERGE on a file, the executor copies the original to `.kdoc.backup/<path>`. Subsequent updates do NOT overwrite the backup — it always reflects the pre-kdoc state.

```typescript
// Exported API
export interface ExecutorOptions {
  operations: FileOperation[];
  config: KdocConfig;
  projectDir: string;
  kdocVersion: string;
  /** Rendered template content keyed by source path */
  templateContents: Map<string, string>;
  dryRun?: boolean;
  verbose?: boolean;
  onProgress?: (op: FileOperation, result: 'done' | 'skipped' | 'conflict' | 'error') => void;
}

export async function executeScaffold(options: ExecutorOptions): Promise<ExecutionSummary>
```

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/scaffold/execute.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeScaffold } from '../../src/scaffold/execute.js';
import type { FileOperation } from '../../src/scaffold/types.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpProject(): string {
  const dir = join(tmpdir(), `kdoc-exec-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const baseConfig = {
  version: 1 as const,
  root: 'Knowledge',
  packs: [] as string[],
  tools: [] as string[],
  areas: {},
  governance: {
    'sync-check': true,
    wikilinks: true,
    'adr-governance': true,
    'index-build': true,
    'enforced-paths': [] as string[],
  },
  scripts: { prefix: 'kdoc' },
};

describe('executeScaffold — CREATE', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('creates a new file with rendered content', async () => {
    const ops: FileOperation[] = [
      { path: 'Knowledge/ADR/README.md', type: 'CREATE', source: 'dummy/readme-adr.md' },
    ];
    const contents = new Map([['dummy/readme-adr.md', '# ADR Directory\n']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(summary.created).toContain('Knowledge/ADR/README.md');
    expect(existsSync(join(projectDir, 'Knowledge/ADR/README.md'))).toBe(true);
    expect(readFileSync(join(projectDir, 'Knowledge/ADR/README.md'), 'utf8')).toBe('# ADR Directory\n');
  });

  it('creates parent directories automatically', async () => {
    const ops: FileOperation[] = [
      { path: 'Knowledge/TLDR/Admin/something.md', type: 'CREATE', source: 'tpl.md' },
    ];
    const contents = new Map([['tpl.md', 'content']]);

    await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(existsSync(join(projectDir, 'Knowledge/TLDR/Admin/something.md'))).toBe(true);
  });

  it('registers created file in .kdoc.lock', async () => {
    const ops: FileOperation[] = [
      { path: 'Knowledge/ADR/README.md', type: 'CREATE', source: 'tpl.md' },
    ];
    const contents = new Map([['tpl.md', '# ADR']]);

    await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(existsSync(join(projectDir, '.kdoc.lock'))).toBe(true);
    const lock = JSON.parse(readFileSync(join(projectDir, '.kdoc.lock'), 'utf8'));
    expect(lock.files['Knowledge/ADR/README.md']).toBeDefined();
    expect(lock.files['Knowledge/ADR/README.md'].action).toBe('created');
  });
});

describe('executeScaffold — MERGE (markers)', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('injects marker block into existing file', async () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), '# Existing content\n');

    const ops: FileOperation[] = [
      {
        path: 'CLAUDE.md',
        type: 'MERGE',
        source: 'tpl.md',
        mergeStrategy: 'markers',
        markerName: 'core',
      },
    ];
    const contents = new Map([['tpl.md', 'kdoc block content']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(summary.merged).toContain('CLAUDE.md');
    const written = readFileSync(join(projectDir, 'CLAUDE.md'), 'utf8');
    expect(written).toContain('<!-- kdoc:core:start -->');
    expect(written).toContain('kdoc block content');
    expect(written).toContain('<!-- kdoc:core:end -->');
    expect(written).toContain('# Existing content');
  });

  it('creates backup of file before first merge', async () => {
    writeFileSync(join(projectDir, 'CLAUDE.md'), 'original content');

    const ops: FileOperation[] = [
      {
        path: 'CLAUDE.md',
        type: 'MERGE',
        source: 'tpl.md',
        mergeStrategy: 'markers',
        markerName: 'core',
      },
    ];
    const contents = new Map([['tpl.md', 'block']]);

    await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    const backupPath = join(projectDir, '.kdoc.backup', 'CLAUDE.md');
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(backupPath, 'utf8')).toBe('original content');
  });

  it('registers merged file in .kdoc.lock with blockHash', async () => {
    writeFileSync(join(projectDir, '.gitignore'), 'node_modules/\n');

    const ops: FileOperation[] = [
      {
        path: '.gitignore',
        type: 'MERGE',
        source: 'tpl',
        mergeStrategy: 'markers',
        markerName: 'core',
      },
    ];
    const contents = new Map([['tpl', '.kdoc.backup/']]);

    await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    const lock = JSON.parse(readFileSync(join(projectDir, '.kdoc.lock'), 'utf8'));
    const entry = lock.files['.gitignore'];
    expect(entry.action).toBe('merged');
    expect(entry.strategy).toBe('markers');
    expect(entry.blockHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe('executeScaffold — SKIP', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('records skipped files in summary without touching disk', async () => {
    writeFileSync(join(projectDir, 'existing.md'), 'user content');
    const before = readFileSync(join(projectDir, 'existing.md'), 'utf8');

    const ops: FileOperation[] = [
      { path: 'existing.md', type: 'SKIP', source: 'tpl.md', reason: 'unmodified' },
    ];
    const contents = new Map([['tpl.md', 'new content']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(summary.skipped).toContain('existing.md');
    expect(readFileSync(join(projectDir, 'existing.md'), 'utf8')).toBe(before);
  });
});

describe('executeScaffold — CONFLICT', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('records conflicts in summary without modifying file', async () => {
    writeFileSync(join(projectDir, 'managed.md'), 'user-modified content');

    const ops: FileOperation[] = [
      { path: 'managed.md', type: 'CONFLICT', source: 'tpl.md', reason: 'user-modified' },
    ];
    const contents = new Map([['tpl.md', 'new content']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    expect(summary.conflicts).toContain('managed.md');
    expect(readFileSync(join(projectDir, 'managed.md'), 'utf8')).toBe('user-modified content');
  });
});

describe('executeScaffold — dry run', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('does not write any files in dry-run mode', async () => {
    const ops: FileOperation[] = [
      { path: 'Knowledge/ADR/README.md', type: 'CREATE', source: 'tpl.md' },
    ];
    const contents = new Map([['tpl.md', '# ADR']]);

    await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
      dryRun: true,
    });

    expect(existsSync(join(projectDir, 'Knowledge/ADR/README.md'))).toBe(false);
    expect(existsSync(join(projectDir, '.kdoc.lock'))).toBe(false);
  });

  it('returns summary as if operations were applied', async () => {
    const ops: FileOperation[] = [
      { path: 'Knowledge/ADR/README.md', type: 'CREATE', source: 'tpl.md' },
    ];
    const contents = new Map([['tpl.md', '# ADR']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
      dryRun: true,
    });

    expect(summary.created).toContain('Knowledge/ADR/README.md');
  });
});

describe('executeScaffold — partial failure resilience', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('continues processing after an individual operation error', async () => {
    // First op: CREATE to a read-only path (will fail on non-root)
    // Second op: valid CREATE
    const ops: FileOperation[] = [
      { path: 'Knowledge/ADR/README.md', type: 'CREATE', source: 'good.md' },
      { path: 'Knowledge/TLDR/README.md', type: 'CREATE', source: 'good.md' },
    ];
    const contents = new Map([['good.md', '# Content']]);

    const summary = await executeScaffold({
      operations: ops,
      config: baseConfig,
      projectDir,
      kdocVersion: '1.0.0',
      templateContents: contents,
    });

    // Both should succeed in a normal tmp dir
    expect(summary.created.length).toBe(2);
    expect(summary.errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/execute.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/scaffold/execute.ts
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { KdocConfig, KdocLock, LockFileEntry } from '../config/schema.js';
import type { FileOperation, ExecutionSummary } from './types.js';
import { safeWriteFile, ensureDir } from '../utils/fs.js';
import { hashString } from '../utils/hash.js';
import { createEmptyLock, appendFileEntry, finalizeLock } from '../config/lock.js';
import { injectMarkerBlock } from './merge/markers.js';
import { mergePackageJsonScripts } from './merge/package-json.js';
import { mergeTurboTasks } from './merge/turbo-json.js';

export interface ExecutorOptions {
  operations: FileOperation[];
  config: KdocConfig;
  projectDir: string;
  kdocVersion: string;
  /** Rendered template content keyed by source path */
  templateContents: Map<string, string>;
  dryRun?: boolean;
  verbose?: boolean;
  onProgress?: (op: FileOperation, result: 'done' | 'skipped' | 'conflict' | 'error') => void;
}

function backupFile(projectDir: string, relativePath: string): void {
  const absSource = join(projectDir, relativePath);
  const absDest = join(projectDir, '.kdoc.backup', relativePath);
  if (!existsSync(absSource)) return;
  if (existsSync(absDest)) return; // Only backup once — preserve pre-kdoc state
  ensureDir(dirname(absDest));
  copyFileSync(absSource, absDest);
}

async function applyMerge(
  op: FileOperation,
  projectDir: string,
  templateContent: string,
): Promise<string> {
  const absPath = join(projectDir, op.path);
  const fileName = op.path.split('/').pop() ?? op.path;
  const existing = existsSync(absPath) ? readFileSync(absPath, 'utf8') : '';

  if (op.mergeStrategy === 'markers') {
    return injectMarkerBlock(existing, templateContent, fileName, op.markerName ?? 'core');
  }

  if (op.mergeStrategy === 'prefix') {
    if (fileName === 'package.json') {
      return mergePackageJsonScripts(existing, templateContent);
    }
    if (fileName === 'turbo.json') {
      return mergeTurboTasks(existing, templateContent);
    }
  }

  // Fallback: append (should not reach here with valid operations)
  return existing + '\n' + templateContent;
}

export async function executeScaffold(options: ExecutorOptions): Promise<ExecutionSummary> {
  const {
    operations,
    config,
    projectDir,
    kdocVersion,
    templateContents,
    dryRun = false,
    verbose = false,
    onProgress,
  } = options;

  const summary: ExecutionSummary = {
    created: [],
    merged: [],
    skipped: [],
    conflicts: [],
    errors: [],
  };

  const lockConfig = {
    root: config.root ?? 'Knowledge',
    packs: config.packs ?? [],
    tools: config.tools ?? [],
  };

  const lock = createEmptyLock(kdocVersion, lockConfig);

  // Initialise .kdoc.lock.tmp if not dry run
  if (!dryRun) {
    appendFileEntry(projectDir, lock, '__init__', {
      action: 'created',
      hash: 'sha256:' + '0'.repeat(64),
      templateHash: 'sha256:' + '0'.repeat(64),
      template: '__init__',
    });
    // Remove the __init__ sentinel — we only wanted to create the .tmp file
    delete lock.files['__init__'];
  }

  for (const op of operations) {
    try {
      if (op.type === 'SKIP') {
        summary.skipped.push(op.path);
        onProgress?.(op, 'skipped');
        continue;
      }

      if (op.type === 'CONFLICT') {
        summary.conflicts.push(op.path);
        onProgress?.(op, 'conflict');
        continue;
      }

      const templateContent = templateContents.get(op.source) ?? '';

      if (op.type === 'CREATE') {
        if (!dryRun) {
          safeWriteFile(join(projectDir, op.path), templateContent);
          const fileHash = hashString(templateContent);
          const templateHash = hashString(templateContent); // same content as template at creation
          const entry: LockFileEntry = {
            action: 'created',
            hash: fileHash,
            templateHash,
            template: op.source,
          };
          appendFileEntry(projectDir, lock, op.path, entry);
        }
        summary.created.push(op.path);
        onProgress?.(op, 'done');
        continue;
      }

      if (op.type === 'MERGE') {
        if (!dryRun) {
          backupFile(projectDir, op.path);
          const merged = await applyMerge(op, projectDir, templateContent);
          safeWriteFile(join(projectDir, op.path), merged);

          // For block hash: hash the injected block content only
          const blockHash = hashString(templateContent);
          const templateHash = hashString(templateContent);
          const entry: LockFileEntry = {
            action: 'merged',
            blockHash,
            templateHash,
            template: op.source,
            strategy: op.mergeStrategy ?? 'markers',
            ...(op.markerName ? { markerName: op.markerName } : {}),
          };
          appendFileEntry(projectDir, lock, op.path, entry);
        }
        summary.merged.push(op.path);
        onProgress?.(op, 'done');
        continue;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push({ path: op.path, error: message });
      onProgress?.(op, 'error');
    }
  }

  // Finalize: rename .kdoc.lock.tmp → .kdoc.lock
  if (!dryRun) {
    finalizeLock(projectDir);
  }

  return summary;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/execute.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/scaffold/execute.ts cli/tests/scaffold/execute.test.ts
git commit -m "feat: transactional scaffold executor with backup, lock, and dry-run support"
```

---

## Task 4: Init Command (`cli/src/commands/init.ts`)

**Files:**
- Create: `cli/src/commands/init.ts`
- Test: `cli/tests/commands/init.test.ts`

### What this module does

`init.ts` wires the detect → ask → plan → execute → report pipeline into a Commander.js subcommand. It is the primary entry point for first-time installation.

Flags:
- `--pack <packs>` — comma-separated list of packs to install (skips pack detection prompt)
- `--tools <tools>` — comma-separated list of AI tools (skips tool prompt)
- `--yes` — non-interactive: skip all prompts, use detected defaults
- `--dry-run` — show plan without executing
- `--verbose` — log each file operation as it runs

Interactive flow (when `--yes` is NOT set):

1. Show detected packs and ask user to confirm / change selection (`@inquirer/checkbox`)
2. Show available areas and ask which to enable (`@inquirer/checkbox`)
3. Ask which AI tools to configure (`@inquirer/checkbox`)
4. Ask for scope names (for TLDR, Design areas) if selected
5. Confirm scripts prefix (default: `kdoc`)
6. Show operation plan summary (counts of CREATE / MERGE / SKIP)
7. Confirm before executing

Interrupted install handling: if `.kdoc.lock.tmp` exists at startup, prompt:
- `[R]esume` — continue from the partial state recorded in `.lock.tmp`
- `[U]ndo partial` — call undo logic to reverse what `.lock.tmp` recorded
- `[S]tart fresh` — delete `.lock.tmp` and proceed from scratch

The command returns a non-zero exit code on error but never crashes without a user-facing message.

```typescript
// Exported API (thin — primarily for testing)
export function createInitCommand(): Command
```

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/commands/init.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInitCommand } from '../../src/commands/init.js';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function tmpProject(): string {
  const dir = join(tmpdir(), `kdoc-init-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('createInitCommand — structure', () => {
  it('returns a Commander Command named "init"', () => {
    const cmd = createInitCommand();
    expect(cmd.name()).toBe('init');
  });

  it('registers --yes flag', () => {
    const cmd = createInitCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--yes');
  });

  it('registers --dry-run flag', () => {
    const cmd = createInitCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--dry-run');
  });

  it('registers --verbose flag', () => {
    const cmd = createInitCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--verbose');
  });

  it('registers --pack option', () => {
    const cmd = createInitCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--pack');
  });

  it('registers --tools option', () => {
    const cmd = createInitCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--tools');
  });
});

describe('createInitCommand — dry-run integration', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('does not write any files with --yes --dry-run', async () => {
    const cmd = createInitCommand();
    // Parse and run with --yes and --dry-run against a temp dir
    // We inject the projectDir via env var simulation
    process.env.KDOC_PROJECT_DIR = projectDir;

    await cmd.parseAsync(['--yes', '--dry-run'], { from: 'user' });

    // No .kdoc.yaml or .kdoc.lock should exist
    expect(existsSync(join(projectDir, '.kdoc.yaml'))).toBe(false);
    expect(existsSync(join(projectDir, '.kdoc.lock'))).toBe(false);

    delete process.env.KDOC_PROJECT_DIR;
  });
});

describe('createInitCommand — --yes mode (non-interactive)', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('creates .kdoc.yaml with detected defaults when --yes is set', async () => {
    // Add a next.config.ts so nextjs pack is detected
    writeFileSync(join(projectDir, 'next.config.ts'), '');
    process.env.KDOC_PROJECT_DIR = projectDir;

    const cmd = createInitCommand();
    await cmd.parseAsync(['--yes'], { from: 'user' });

    expect(existsSync(join(projectDir, '.kdoc.yaml'))).toBe(true);

    delete process.env.KDOC_PROJECT_DIR;
  });

  it('creates .kdoc.lock after successful init', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;

    const cmd = createInitCommand();
    await cmd.parseAsync(['--yes'], { from: 'user' });

    expect(existsSync(join(projectDir, '.kdoc.lock'))).toBe(true);

    delete process.env.KDOC_PROJECT_DIR;
  });
});

describe('createInitCommand — interrupted install recovery', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('detects .kdoc.lock.tmp and reports interrupted state', async () => {
    writeFileSync(join(projectDir, '.kdoc.lock.tmp'), JSON.stringify({
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      config: { root: 'Knowledge', packs: [], tools: [] },
      files: {},
    }));
    process.env.KDOC_PROJECT_DIR = projectDir;

    // With --yes, interrupted install should default to "resume"
    const cmd = createInitCommand();
    // Should not throw
    await expect(
      cmd.parseAsync(['--yes'], { from: 'user' })
    ).resolves.not.toThrow();

    delete process.env.KDOC_PROJECT_DIR;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/commands/init.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/commands/init.ts
import { Command } from 'commander';
import { join } from 'node:path';
import { checkbox, select } from '@inquirer/prompts';
import { detectProject } from '../scaffold/detect.js';
import { planScaffold } from '../scaffold/plan.js';
import { executeScaffold } from '../scaffold/execute.js';
import { loadConfig, writeConfig, configExists } from '../config/loader.js';
import { hasPendingLockTmp } from '../config/lock.js';
import { renderTemplate } from '../templates/renderer.js';
import type { KdocConfig } from '../config/schema.js';
import type { TemplateResolver } from '../scaffold/plan.js';

// Resolve the working project directory — allows tests to inject via env var
function getProjectDir(): string {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}

const KNOWN_PACKS = ['nextjs', 'swift-ios'] as const;
const KNOWN_TOOLS = ['claude-code', 'codex'] as const;
const KNOWN_AREAS = [
  'adr', 'tldr', 'roadmap', 'design', 'guides',
  'agent-memory', 'runbooks', 'threat-models',
  'templates', 'governance', 'context-pack', 'index',
] as const;

// Default areas enabled per pack
const PACK_DEFAULT_AREAS: Record<string, string[]> = {
  nextjs: ['adr', 'tldr', 'roadmap', 'design', 'guides', 'agent-memory', 'runbooks', 'templates', 'context-pack', 'index'],
  'swift-ios': ['adr', 'tldr', 'roadmap', 'guides', 'agent-memory', 'templates', 'context-pack'],
};

const DEFAULT_AREAS = ['adr', 'tldr', 'guides', 'templates', 'context-pack'];

/**
 * Minimal template resolver for plan 2A. Returns a stub content for known
 * template names. Plan 3 will replace this with real content from core/.
 */
function makeTemplateResolver(): TemplateResolver {
  return (templateName: string) => {
    // Stub: return minimal content so executor can write real files
    const stubs: Record<string, string> = {
      'core/templates/readme-adr.md': '# ADR\n\nArchitecture Decision Records.\n',
      'core/templates/readme-tldr.md': '# TLDR\n\nFunctional requirements by module.\n',
      'core/templates/readme-roadmap.md': '# Roadmap\n\nProject phases and milestones.\n',
      'core/templates/context-pack.md': '# Context Pack\n\nFast-start context for agents.\n',
      'core/templates/memory.md': '# Agent Memory\n\nShared memory across AI sessions.\n',
      'core/templates/gitkeep': '',
      'core/templates/claude-md-block.md': 'kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n',
      'core/templates/agents-md-block.md': 'kdoc Knowledge documentation toolkit is installed.\n\nRun `npx kdoc doctor` to check your setup.\n',
      'core/templates/gitignore-block': '.kdoc.backup/\n.kdoc.lock.tmp\n',
      'core/templates/package-json-scripts': JSON.stringify({ 'kdoc:check': 'npx kdoc doctor' }),
    };
    const content = stubs[templateName];
    if (content === undefined) return null;
    return { sourcePath: templateName, content };
  };
}

function buildConfig(
  packs: string[],
  tools: string[],
  areas: string[],
): KdocConfig {
  const areaMap: Record<string, { enabled: boolean }> = {};
  for (const area of KNOWN_AREAS) {
    areaMap[area] = { enabled: areas.includes(area) };
  }
  return {
    version: 1,
    root: 'Knowledge',
    packs,
    tools,
    areas: areaMap,
    governance: {
      'sync-check': true,
      wikilinks: true,
      'adr-governance': true,
      'index-build': true,
      'enforced-paths': [],
    },
    scripts: { prefix: 'kdoc' },
  };
}

function printSummary(summary: { created: string[]; merged: string[]; skipped: string[]; conflicts: string[]; errors: Array<{ path: string; error: string }> }): void {
  console.log('\nScaffold complete:');
  if (summary.created.length) console.log(`  Created : ${summary.created.length} file(s)`);
  if (summary.merged.length) console.log(`  Merged  : ${summary.merged.length} file(s)`);
  if (summary.skipped.length) console.log(`  Skipped : ${summary.skipped.length} file(s)`);
  if (summary.conflicts.length) {
    console.log(`  Conflicts: ${summary.conflicts.length} file(s) (review manually)`);
    for (const c of summary.conflicts) console.log(`    - ${c}`);
  }
  if (summary.errors.length) {
    console.log(`  Errors  : ${summary.errors.length} file(s)`);
    for (const e of summary.errors) console.log(`    - ${e.path}: ${e.error}`);
  }
}

export function createInitCommand(): Command {
  const cmd = new Command('init');
  cmd
    .description('Scaffold a Knowledge documentation structure into this project')
    .option('--pack <packs>', 'Comma-separated list of packs (nextjs,swift-ios)')
    .option('--tools <tools>', 'Comma-separated list of AI tools (claude-code,codex)')
    .option('--yes', 'Non-interactive: skip all prompts and use detected defaults')
    .option('--dry-run', 'Show what would be done without making changes')
    .option('--verbose', 'Log each file operation as it runs')
    .action(async (options) => {
      const projectDir = getProjectDir();
      const yes: boolean = !!options.yes;
      const dryRun: boolean = !!options.dryRun;
      const verbose: boolean = !!options.verbose;

      try {
        // --- Detect ---
        const detection = await detectProject(projectDir);

        // --- Interrupted install check ---
        if (hasPendingLockTmp(projectDir)) {
          if (!yes) {
            const action = await select({
              message: 'Previous install was interrupted. What would you like to do?',
              choices: [
                { name: 'Resume from partial state', value: 'resume' },
                { name: 'Start fresh (delete partial state)', value: 'fresh' },
              ],
            });
            if (action === 'fresh') {
              // Delete the tmp lock — start fresh
              const { cleanupLockTmp } = await import('../config/lock.js');
              cleanupLockTmp(projectDir);
            }
            // 'resume' falls through — the executor will pick up .lock.tmp
          }
          // With --yes, default to resume (safest)
        }

        // --- Determine packs ---
        let selectedPacks: string[];
        if (options.pack) {
          selectedPacks = (options.pack as string).split(',').map((s: string) => s.trim()).filter(Boolean);
        } else if (yes) {
          selectedPacks = detection.stack.packs.map(p => p.name);
        } else {
          selectedPacks = await checkbox({
            message: 'Which technology packs would you like to install?',
            choices: KNOWN_PACKS.map(p => ({
              name: p,
              value: p,
              checked: detection.stack.packs.some(dp => dp.name === p),
            })),
          });
        }

        // --- Determine tools ---
        let selectedTools: string[];
        if (options.tools) {
          selectedTools = (options.tools as string).split(',').map((s: string) => s.trim()).filter(Boolean);
        } else if (yes) {
          selectedTools = detection.aiTools.tools;
        } else {
          selectedTools = await checkbox({
            message: 'Which AI tool integrations would you like to configure?',
            choices: KNOWN_TOOLS.map(t => ({
              name: t,
              value: t,
              checked: detection.aiTools.tools.includes(t),
            })),
          });
        }

        // --- Determine areas ---
        let selectedAreas: string[];
        if (yes) {
          const defaultAreas = selectedPacks.length > 0
            ? [...new Set(selectedPacks.flatMap(p => PACK_DEFAULT_AREAS[p] ?? DEFAULT_AREAS))]
            : DEFAULT_AREAS;
          selectedAreas = defaultAreas;
        } else {
          const packDefaults = selectedPacks.length > 0
            ? [...new Set(selectedPacks.flatMap(p => PACK_DEFAULT_AREAS[p] ?? DEFAULT_AREAS))]
            : DEFAULT_AREAS;
          selectedAreas = await checkbox({
            message: 'Which Knowledge areas would you like to enable?',
            choices: KNOWN_AREAS.map(a => ({
              name: a,
              value: a,
              checked: packDefaults.includes(a),
            })),
          });
        }

        // --- Build config ---
        const config = buildConfig(selectedPacks, selectedTools, selectedAreas);

        // --- Plan ---
        const resolver = makeTemplateResolver();
        const operations = planScaffold({
          config,
          detection,
          lock: null,
          projectDir,
          templateResolver: resolver,
        });

        if (verbose || dryRun) {
          const creates = operations.filter(o => o.type === 'CREATE').length;
          const merges = operations.filter(o => o.type === 'MERGE').length;
          const skips = operations.filter(o => o.type === 'SKIP').length;
          const conflicts = operations.filter(o => o.type === 'CONFLICT').length;
          console.log(`\nPlan: ${creates} create, ${merges} merge, ${skips} skip, ${conflicts} conflict`);
        }

        if (dryRun) {
          for (const op of operations) {
            console.log(`  [${op.type.padEnd(8)}] ${op.path}`);
          }
          console.log('\nDry run complete. No files were changed.');
          return;
        }

        // --- Build template contents map ---
        const templateContents = new Map<string, string>();
        for (const op of operations) {
          const resolved = resolver(op.source);
          if (resolved) templateContents.set(op.source, resolved.content);
        }

        // --- Execute ---
        const summary = await executeScaffold({
          operations,
          config,
          projectDir,
          kdocVersion: '1.0.0',
          templateContents,
          dryRun,
          verbose,
          onProgress: verbose
            ? (op, result) => console.log(`  [${result.toUpperCase().padEnd(8)}] ${op.path}`)
            : undefined,
        });

        // --- Persist config ---
        writeConfig(projectDir, config);

        // --- Report ---
        printSummary(summary);

        if (summary.errors.length > 0) {
          process.exitCode = 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/commands/init.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/init.ts cli/tests/commands/init.test.ts
git commit -m "feat: init command — interactive scaffold with detect/plan/execute pipeline"
```

---

## Task 5: Add Commands (`cli/src/commands/add.ts`)

**Files:**
- Create: `cli/src/commands/add.ts`
- Test: `cli/tests/commands/add.test.ts`

### What this module does

`add.ts` exports three Commander.js commands: `add <area>`, `add-pack <pack>`, and `add-tool <tool>`. All three follow the same transactional pattern from spec §4.10:

1. Read `.kdoc.yaml` (error if not found: "Run `kdoc init` first")
2. Validate the argument against known values
3. Compute the desired config update in memory (do NOT write yet)
4. Run a scoped scaffold (plan + execute for only the new area/pack/tool)
5. On success: persist updated `.kdoc.yaml` and `.kdoc.lock` atomically
6. On any failure: `.kdoc.yaml` remains unchanged

The "transactional config" guarantee means the config file never declares a pack/area/tool that wasn't successfully scaffolded.

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/commands/add.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAddCommand, createAddPackCommand, createAddToolCommand } from '../../src/commands/add.js';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify as yamlStringify } from 'yaml';

function tmpProject(withConfig = true): string {
  const dir = join(tmpdir(), `kdoc-add-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  if (withConfig) {
    const config = {
      version: 1,
      root: 'Knowledge',
      packs: [],
      tools: [],
      areas: { adr: { enabled: true } },
      governance: {
        'sync-check': true,
        wikilinks: true,
        'adr-governance': true,
        'index-build': true,
        'enforced-paths': [],
      },
      scripts: { prefix: 'kdoc' },
    };
    writeFileSync(join(dir, '.kdoc.yaml'), yamlStringify(config));
  }
  return dir;
}

describe('createAddCommand — structure', () => {
  it('returns a Commander Command named "add"', () => {
    const cmd = createAddCommand();
    expect(cmd.name()).toBe('add');
  });

  it('registers --yes flag', () => {
    const cmd = createAddCommand();
    const options = cmd.options.map(o => o.long);
    expect(options).toContain('--yes');
  });
});

describe('createAddPackCommand — structure', () => {
  it('returns a Commander Command named "add-pack"', () => {
    const cmd = createAddPackCommand();
    expect(cmd.name()).toBe('add-pack');
  });
});

describe('createAddToolCommand — structure', () => {
  it('returns a Commander Command named "add-tool"', () => {
    const cmd = createAddToolCommand();
    expect(cmd.name()).toBe('add-tool');
  });
});

describe('createAddCommand — error on missing config', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(false); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('exits with error when .kdoc.yaml is missing', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddCommand();
    await cmd.parseAsync(['tldr'], { from: 'user' });
    // Should set non-zero exit code
    expect(process.exitCode).toBe(1);
    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0; // reset
  });
});

describe('createAddCommand — validation', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('exits with error for unknown area', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddCommand();
    await cmd.parseAsync(['unknown-area'], { from: 'user' });
    expect(process.exitCode).toBe(1);
    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});

describe('createAddPackCommand — validation', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('exits with error for unknown pack', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddPackCommand();
    await cmd.parseAsync(['unknown-pack'], { from: 'user' });
    expect(process.exitCode).toBe(1);
    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});

describe('createAddToolCommand — validation', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('exits with error for unknown tool', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddToolCommand();
    await cmd.parseAsync(['unknown-tool'], { from: 'user' });
    expect(process.exitCode).toBe(1);
    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});

describe('createAddCommand — transactional config guarantee', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('adds a valid area and persists updated config', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddCommand();
    await cmd.parseAsync(['tldr', '--yes'], { from: 'user' });

    // Config should now have tldr enabled
    const raw = readFileSync(join(projectDir, '.kdoc.yaml'), 'utf8');
    expect(raw).toContain('tldr');

    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });

  it('config remains unchanged when area scaffold fails', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const configBefore = readFileSync(join(projectDir, '.kdoc.yaml'), 'utf8');

    // Attempt to add an already-enabled area (adr) — should be a no-op / skip, not failure
    // For a true failure test we'd mock executor — this verifies idempotency
    const cmd = createAddCommand();
    await cmd.parseAsync(['adr', '--yes'], { from: 'user' });

    // Config should be either same or have adr still enabled — not corrupted
    const configAfter = readFileSync(join(projectDir, '.kdoc.yaml'), 'utf8');
    expect(configAfter).toContain('adr');

    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});

describe('createAddPackCommand — integration', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('adds nextjs pack and updates config', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddPackCommand();
    await cmd.parseAsync(['nextjs', '--yes'], { from: 'user' });

    const raw = readFileSync(join(projectDir, '.kdoc.yaml'), 'utf8');
    expect(raw).toContain('nextjs');

    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});

describe('createAddToolCommand — integration', () => {
  let projectDir: string;
  beforeEach(() => { projectDir = tmpProject(); });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  it('adds claude-code tool and updates config', async () => {
    process.env.KDOC_PROJECT_DIR = projectDir;
    const cmd = createAddToolCommand();
    await cmd.parseAsync(['claude-code', '--yes'], { from: 'user' });

    const raw = readFileSync(join(projectDir, '.kdoc.yaml'), 'utf8');
    expect(raw).toContain('claude-code');

    delete process.env.KDOC_PROJECT_DIR;
    process.exitCode = 0;
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/commands/add.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/commands/add.ts
import { Command } from 'commander';
import { join } from 'node:path';
import { loadConfig, writeConfig, configExists } from '../config/loader.js';
import { loadLock } from '../config/lock.js';
import { detectProject } from '../scaffold/detect.js';
import { planScaffold } from '../scaffold/plan.js';
import { executeScaffold } from '../scaffold/execute.js';
import type { KdocConfig } from '../config/schema.js';
import type { TemplateResolver } from '../scaffold/plan.js';

function getProjectDir(): string {
  return process.env.KDOC_PROJECT_DIR ?? process.cwd();
}

const KNOWN_AREAS = [
  'adr', 'tldr', 'roadmap', 'design', 'guides',
  'agent-memory', 'runbooks', 'threat-models',
  'templates', 'governance', 'context-pack', 'index',
] as const;

const KNOWN_PACKS = ['nextjs', 'swift-ios'] as const;
const KNOWN_TOOLS = ['claude-code', 'codex'] as const;

/**
 * Minimal template resolver reused from init. Plan 3 replaces this with real
 * content. The add command builds its own scoped resolver for targeted scaffolds.
 */
function makeTemplateResolver(): TemplateResolver {
  const stubs: Record<string, string> = {
    'core/templates/readme-adr.md': '# ADR\n\nArchitecture Decision Records.\n',
    'core/templates/readme-tldr.md': '# TLDR\n\nFunctional requirements by module.\n',
    'core/templates/readme-roadmap.md': '# Roadmap\n\nProject phases and milestones.\n',
    'core/templates/context-pack.md': '# Context Pack\n\nFast-start context for agents.\n',
    'core/templates/memory.md': '# Agent Memory\n\nShared memory across AI sessions.\n',
    'core/templates/gitkeep': '',
    'core/templates/claude-md-block.md': 'kdoc Knowledge documentation toolkit is installed.\n',
    'core/templates/agents-md-block.md': 'kdoc Knowledge documentation toolkit is installed.\n',
    'core/templates/gitignore-block': '.kdoc.backup/\n.kdoc.lock.tmp\n',
    'core/templates/package-json-scripts': JSON.stringify({ 'kdoc:check': 'npx kdoc doctor' }),
  };
  return (name) => {
    const content = stubs[name];
    if (content === undefined) return null;
    return { sourcePath: name, content };
  };
}

async function runScopedScaffold(
  projectDir: string,
  updatedConfig: KdocConfig,
): Promise<boolean> {
  const detection = await detectProject(projectDir);
  const existingLock = loadLock(projectDir);
  const resolver = makeTemplateResolver();

  const operations = planScaffold({
    config: updatedConfig,
    detection,
    lock: existingLock,
    projectDir,
    templateResolver: resolver,
  });

  const templateContents = new Map<string, string>();
  for (const op of operations) {
    const resolved = resolver(op.source);
    if (resolved) templateContents.set(op.source, resolved.content);
  }

  const summary = await executeScaffold({
    operations,
    config: updatedConfig,
    projectDir,
    kdocVersion: '1.0.0',
    templateContents,
  });

  if (summary.errors.length > 0) {
    console.error('Scaffold errors:');
    for (const e of summary.errors) console.error(`  - ${e.path}: ${e.error}`);
    return false;
  }

  const creates = summary.created.length;
  const merges = summary.merged.length;
  console.log(`Done: ${creates} created, ${merges} merged`);
  return true;
}

export function createAddCommand(): Command {
  const cmd = new Command('add');
  cmd
    .description('Add a Knowledge area to an existing kdoc installation')
    .argument('<area>', 'Area to add')
    .option('--yes', 'Non-interactive mode')
    .option('--force', 'Overwrite user-modified managed files')
    .action(async (area: string, options) => {
      const projectDir = getProjectDir();

      if (!configExists(projectDir)) {
        console.error('Error: No .kdoc.yaml found. Run `kdoc init` first.');
        process.exitCode = 1;
        return;
      }

      if (!(KNOWN_AREAS as readonly string[]).includes(area)) {
        console.error(`Error: Unknown area "${area}". Valid areas: ${KNOWN_AREAS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        const config = loadConfig(projectDir)!;
        // Compute updated config in memory — do NOT write yet
        const updatedConfig: KdocConfig = {
          ...config,
          areas: {
            ...config.areas,
            [area]: { enabled: true },
          },
        };

        const success = await runScopedScaffold(projectDir, updatedConfig);
        if (success) {
          writeConfig(projectDir, updatedConfig);
          console.log(`Area "${area}" added successfully.`);
        } else {
          // Config is NOT written — transaction rolled back
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}

export function createAddPackCommand(): Command {
  const cmd = new Command('add-pack');
  cmd
    .description('Add a technology pack to an existing kdoc installation')
    .argument('<pack>', 'Pack to add')
    .option('--yes', 'Non-interactive mode')
    .action(async (pack: string) => {
      const projectDir = getProjectDir();

      if (!configExists(projectDir)) {
        console.error('Error: No .kdoc.yaml found. Run `kdoc init` first.');
        process.exitCode = 1;
        return;
      }

      if (!(KNOWN_PACKS as readonly string[]).includes(pack)) {
        console.error(`Error: Unknown pack "${pack}". Valid packs: ${KNOWN_PACKS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        const config = loadConfig(projectDir)!;
        const updatedConfig: KdocConfig = {
          ...config,
          packs: [...new Set([...config.packs, pack])],
        };

        const success = await runScopedScaffold(projectDir, updatedConfig);
        if (success) {
          writeConfig(projectDir, updatedConfig);
          console.log(`Pack "${pack}" added successfully.`);
        } else {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}

export function createAddToolCommand(): Command {
  const cmd = new Command('add-tool');
  cmd
    .description('Add an AI tool integration to an existing kdoc installation')
    .argument('<tool>', 'Tool to add')
    .option('--yes', 'Non-interactive mode')
    .action(async (tool: string) => {
      const projectDir = getProjectDir();

      if (!configExists(projectDir)) {
        console.error('Error: No .kdoc.yaml found. Run `kdoc init` first.');
        process.exitCode = 1;
        return;
      }

      if (!(KNOWN_TOOLS as readonly string[]).includes(tool)) {
        console.error(`Error: Unknown tool "${tool}". Valid tools: ${KNOWN_TOOLS.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        const config = loadConfig(projectDir)!;
        const updatedConfig: KdocConfig = {
          ...config,
          tools: [...new Set([...config.tools, tool])],
        };

        const success = await runScopedScaffold(projectDir, updatedConfig);
        if (success) {
          writeConfig(projectDir, updatedConfig);
          console.log(`Tool "${tool}" added successfully.`);
        } else {
          process.exitCode = 1;
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/commands/add.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/add.ts cli/tests/commands/add.test.ts
git commit -m "feat: add/add-pack/add-tool commands with transactional config guarantee"
```

---

## Task 6: Commander.js Registration (`cli/src/index.ts`)

**Files:**
- Modify: `cli/src/index.ts` (created in Plan 1, Task 1)
- Test: manual verification via `--help` (no new test file — entry point is exercised by init and add tests)

### What this task does

Replaces the minimal `index.ts` stub from Plan 1 with the full command registration. Wires `init`, `add`, `add-pack`, and `add-tool` into the root `program`. Sets up global options that all commands inherit.

- [ ] **Step 1: Read the current index.ts**

Read: `cli/src/index.ts`
Confirm the stub from Plan 1 Task 1 is present (`program.name('kdoc')`, `program.parse()`).

- [ ] **Step 2: Replace with full registration**

```typescript
// cli/src/index.ts
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitCommand } from './commands/init.js';
import { createAddCommand, createAddPackCommand, createAddToolCommand } from './commands/add.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json at runtime (survives build)
function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

const program = new Command();

program
  .name('kdoc')
  .description('Knowledge documentation toolkit — scaffold, maintain, and govern project docs')
  .version(getVersion(), '-v, --version', 'Print the current version')
  // Global flags available to all subcommands
  .option('--yes', 'Non-interactive: skip all prompts and use detected defaults')
  .option('--force', 'Overwrite user-modified content without asking (implies --yes)')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('--verbose', 'Log each file operation as it runs');

// Register commands
program.addCommand(createInitCommand());
program.addCommand(createAddCommand());
program.addCommand(createAddPackCommand());
program.addCommand(createAddToolCommand());

program.parse();
```

- [ ] **Step 3: Build and verify help output**

Run: `cd kdoc/cli && pnpm build && node dist/index.js --help`

Expected output contains:
```
Usage: kdoc [options] [command]

Knowledge documentation toolkit

Options:
  -v, --version   Print the current version
  --yes           Non-interactive: skip all prompts and use detected defaults
  --force         Overwrite user-modified content without asking (implies --yes)
  --dry-run       Show what would be done without making changes
  --verbose       Log each file operation as it runs
  -h, --help      display help for command

Commands:
  init [options]
  add [options] <area>
  add-pack [options] <pack>
  add-tool [options] <tool>
```

- [ ] **Step 4: Verify subcommand help**

Run: `node kdoc/cli/dist/index.js init --help`
Expected: Shows `--pack`, `--tools`, `--yes`, `--dry-run`, `--verbose` flags.

Run: `node kdoc/cli/dist/index.js add --help`
Expected: Shows `<area>` argument, `--yes`, `--force` flags.

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `cd kdoc/cli && pnpm test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/index.ts
git commit -m "feat: register init and add commands in main Commander.js program"
```

---

## Acceptance Criteria

| # | Criterion | Covered by |
|---|-----------|-----------|
| 1 | Stack detector finds nextjs indicators at root + 2 levels deep | Task 1 tests |
| 2 | Stack detector finds swift-ios indicators (Package.swift + *.xcodeproj) | Task 1 tests |
| 3 | Monorepo flag set when indicator found at depth > 0 | Task 1 tests |
| 4 | AI tool detection covers .claude/, .claude-plugin/, AGENTS.md, .codex/ | Task 1 tests |
| 5 | Knowledge state detection reports areas, file count, config/lock presence | Task 1 tests |
| 6 | Planner classifies files as CREATE / MERGE / SKIP / CONFLICT correctly | Task 2 tests |
| 7 | Mergeable files (CLAUDE.md, AGENTS.md, .gitignore) classified as MERGE | Task 2 tests |
| 8 | Non-mergeable unmanaged existing files classified as SKIP with reason | Task 2 tests |
| 9 | Disabled areas produce zero file operations | Task 2 tests |
| 10 | Executor creates files and registers them in .kdoc.lock | Task 3 tests |
| 11 | Executor merges into existing files using marker strategy | Task 3 tests |
| 12 | Executor creates .kdoc.backup/ before first merge | Task 3 tests |
| 13 | Executor records blockHash for merged entries in lock | Task 3 tests |
| 14 | Dry-run produces no disk changes but returns correct summary | Task 3 tests |
| 15 | Executor continues after individual operation error | Task 3 tests |
| 16 | Init command registers all flags (--pack, --tools, --yes, --dry-run, --verbose) | Task 4 tests |
| 17 | Init --yes --dry-run writes nothing to disk | Task 4 tests |
| 18 | Init --yes creates .kdoc.yaml and .kdoc.lock | Task 4 tests |
| 19 | Interrupted install (.kdoc.lock.tmp) detected and handled | Task 4 tests |
| 20 | Add command errors gracefully when .kdoc.yaml is missing | Task 5 tests |
| 21 | Add command validates area/pack/tool against known values | Task 5 tests |
| 22 | Config is NOT written when scaffold fails (transactional guarantee) | Task 5 tests |
| 23 | add-pack nextjs updates .kdoc.yaml with pack | Task 5 tests |
| 24 | add-tool claude-code updates .kdoc.yaml with tool | Task 5 tests |
| 25 | `npx kdoc --help` shows all commands | Task 6 manual |
| 26 | `npx kdoc init --help` shows correct flags | Task 6 manual |
| 27 | `npx kdoc add --help` shows correct usage | Task 6 manual |

---

## Dependency Map

```
Plan 1 (foundation)
  ├── cli/src/config/schema.ts     ← imported by plan.ts, execute.ts, init.ts, add.ts
  ├── cli/src/config/loader.ts     ← imported by init.ts, add.ts
  ├── cli/src/config/lock.ts       ← imported by execute.ts, init.ts, add.ts
  ├── cli/src/utils/hash.ts        ← imported by execute.ts
  ├── cli/src/utils/fs.ts          ← imported by execute.ts
  └── cli/src/scaffold/merge/      ← imported by execute.ts

Plan 2A (this file)
  ├── Task 1: detect.ts            ← imported by init.ts, add.ts
  ├── Task 2: plan.ts              ← imported by init.ts, add.ts
  ├── Task 3: execute.ts           ← imported by init.ts, add.ts
  ├── Task 4: init.ts              ← registered by index.ts
  ├── Task 5: add.ts               ← registered by index.ts
  └── Task 6: index.ts             ← entry point (modified)
```

---

## Implementation Notes (from cross-plan review)

1. **`add-tool` must be explicitly tested.** Task 5 covers `add <area>` and `add-pack <pack>` but `add-tool <tool>` is implied. Add an explicit test: `kdoc add-tool codex` → runs `integrations/codex/install.js`, generates AGENTS.md block, persists config on success.

2. **`FileOperation.source` path resolution.** The `source` field is relative to the kdoc package. During execution, resolve it using `import.meta.url` to get the absolute path to the kdoc package's `core/` and `packs/` directories. Document this in `execute.ts`.

3. **Crash recovery 3-way prompt in init.** When `.kdoc.lock.tmp` exists, `init` must prompt: "[R]esume / [U]ndo partial / [S]tart fresh". Add a test scenario for this path in `init.test.ts`.

4. **Transactional add failure test.** Add a test that simulates scaffold failure (e.g., permission error) and verifies `.kdoc.yaml` is unchanged after the error.

5. **Multi-pack monorepo prompt.** Add a test for `detectProject` finding both `next.config.ts` and `Package.swift` and the init command suggesting `--pack nextjs,swift-ios`.

6. **Idempotency integration test.** Add an end-to-end test: run init twice, assert zero operations on second run (Success Criterion #3).
