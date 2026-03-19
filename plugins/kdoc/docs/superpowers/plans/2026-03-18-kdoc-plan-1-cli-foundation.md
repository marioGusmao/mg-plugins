# kdoc Plan 1: CLI Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core engine — config loading, lock management, merge strategies, template rendering, and utility functions — that all CLI commands depend on.

**Architecture:** TypeScript CLI using Commander.js, with Zod for schema validation, YAML for config, and SHA-256 hashing for idempotency. All file operations go through a safe-fs layer that never overwrites without checking the lock.

**Tech Stack:** TypeScript, tsup (build), Vitest (test), commander, inquirer, yaml, zod, fast-glob, node:crypto (SHA-256)

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md`

**Subsystem scope:** This plan covers `cli/src/config/`, `cli/src/scaffold/merge/`, `cli/src/templates/`, `cli/src/utils/`, and the build/test setup. It does NOT cover commands (Plan 2), content (Plan 3), packs (Plan 4), AI integrations (Plan 5), or dogfooding (Plan 6).

---

## File Structure

```
kdoc/
├── cli/
│   ├── src/
│   │   ├── config/
│   │   │   ├── schema.ts          # Zod schemas for .kdoc.yaml + .kdoc.lock
│   │   │   ├── loader.ts          # Read/write/validate .kdoc.yaml
│   │   │   └── lock.ts            # Read/write/validate .kdoc.lock + .lock.tmp
│   │   ├── scaffold/
│   │   │   └── merge/
│   │   │       ├── markers.ts     # Named marker-based merge (CLAUDE.md, AGENTS.md, .gitignore)
│   │   │       ├── package-json.ts # Key-prefix merge (package.json scripts)
│   │   │       ├── turbo-json.ts  # Task-prefix merge (turbo.json tasks)
│   │   │       └── index.ts       # Strategy dispatcher
│   │   ├── templates/
│   │   │   └── renderer.ts       # {{KEY}} placeholder substitution with escape support
│   │   └── utils/
│   │       ├── hash.ts           # SHA-256 file and string hashing
│   │       ├── fs.ts             # Safe file operations (read, write, ensure-dir, delete-if-empty)
│   │       └── git.ts            # Git status checks (dirty tree detection)
│   ├── package.json
│   ├── tsconfig.json
│   └── tsup.config.ts
├── cli/tests/
│   ├── config/
│   │   ├── schema.test.ts
│   │   ├── loader.test.ts
│   │   └── lock.test.ts
│   ├── scaffold/
│   │   └── merge/
│   │       ├── markers.test.ts
│   │       ├── package-json.test.ts
│   │       └── turbo-json.test.ts
│   ├── templates/
│   │   └── renderer.test.ts
│   └── utils/
│       ├── hash.test.ts
│       ├── fs.test.ts
│       └── git.test.ts
└── package.json                  # Root package.json (workspace root if needed)
```

---

### Task 1: Project Setup (package.json, tsconfig, tsup, vitest)

**Files:**
- Create: `kdoc/cli/package.json`
- Create: `kdoc/cli/tsconfig.json`
- Create: `kdoc/cli/tsup.config.ts`
- Create: `kdoc/package.json` (root)
- Create: `kdoc/.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "kdoc",
  "version": "1.0.0",
  "private": true,
  "description": "Knowledge documentation toolkit — scaffold, maintain, and govern project documentation structures",
  "type": "module",
  "scripts": {
    "build": "cd cli && pnpm build",
    "test": "cd cli && pnpm test",
    "lint": "cd cli && pnpm lint",
    "typecheck": "cd cli && pnpm typecheck"
  },
  "author": "MRM",
  "license": "MIT"
}
```

- [ ] **Step 2: Create cli/package.json**

```json
{
  "name": "kdoc-cli",
  "version": "1.0.0",
  "description": "kdoc CLI — scaffold and maintain Knowledge documentation",
  "type": "module",
  "bin": {
    "kdoc": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "@inquirer/prompts": "^7.0.0",
    "yaml": "^2.6.0",
    "fast-glob": "^3.3.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

- [ ] **Step 3: Create cli/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create cli/tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  dts: true,
  sourcemap: true,
  shims: false,
  banner: { js: '#!/usr/bin/env node' },
});
```

- [ ] **Step 5: Create cli/vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.kdoc.backup/
.kdoc.lock.tmp
*.tsbuildinfo
```

- [ ] **Step 7: Create minimal cli/src/index.ts entry point**

```typescript
import { Command } from 'commander';

const program = new Command();

program
  .name('kdoc')
  .description('Knowledge documentation toolkit')
  .version('1.0.0');

program.parse();
```

- [ ] **Step 8: Install dependencies and verify build**

Run: `cd kdoc/cli && pnpm install && pnpm build`
Expected: `dist/index.js` created with shebang, no errors

- [ ] **Step 9: Verify CLI runs**

Run: `node kdoc/cli/dist/index.js --version`
Expected: `1.0.0`

- [ ] **Step 10: Commit**

```bash
git add cli/ package.json .gitignore
git commit -m "feat: project setup with tsup build and commander entry point"
```

---

### Task 2: Hash Utility

**Files:**
- Create: `cli/src/utils/hash.ts`
- Test: `cli/tests/utils/hash.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/utils/hash.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashString, hashFile, isValidHash } from '../../src/utils/hash.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('hashString', () => {
  it('returns sha256-prefixed hash for a string', () => {
    const result = hashString('hello');
    expect(result).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('returns consistent hash for same input', () => {
    expect(hashString('test')).toBe(hashString('test'));
  });

  it('returns different hash for different input', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('hashFile', () => {
  const tmpDir = join(tmpdir(), 'kdoc-hash-test');

  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('hashes file content', () => {
    const file = join(tmpDir, 'test.txt');
    writeFileSync(file, 'hello');
    const result = hashFile(file);
    expect(result).toBe(hashString('hello'));
  });

  it('throws for non-existent file', () => {
    expect(() => hashFile(join(tmpDir, 'nope.txt'))).toThrow();
  });
});

describe('isValidHash', () => {
  it('accepts valid sha256 hash', () => {
    expect(isValidHash('sha256:' + 'a'.repeat(64))).toBe(true);
  });

  it('rejects bare hex', () => {
    expect(isValidHash('a'.repeat(64))).toBe(false);
  });

  it('rejects wrong length', () => {
    expect(isValidHash('sha256:abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/utils/hash.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/utils/hash.ts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const HASH_PREFIX = 'sha256:';
const HASH_REGEX = /^sha256:[a-f0-9]{64}$/;

export function hashString(content: string): string {
  const hex = createHash('sha256').update(content, 'utf8').digest('hex');
  return `${HASH_PREFIX}${hex}`;
}

export function hashFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf8');
  return hashString(content);
}

export function isValidHash(value: string): boolean {
  return HASH_REGEX.test(value);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/utils/hash.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/hash.ts cli/tests/utils/hash.test.ts
git commit -m "feat: SHA-256 hash utility with file and string support"
```

---

### Task 3: Safe Filesystem Utility

**Files:**
- Create: `cli/src/utils/fs.ts`
- Test: `cli/tests/utils/fs.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/utils/fs.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { safeWriteFile, ensureDir, deleteIfEmpty, readFileSafe } from '../../src/utils/fs.js';
import { existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ensureDir', () => {
  const tmpDir = join(tmpdir(), 'kdoc-fs-test');
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('creates nested directories', () => {
    const deep = join(tmpDir, 'a', 'b', 'c');
    ensureDir(deep);
    expect(existsSync(deep)).toBe(true);
  });

  it('is idempotent for existing directories', () => {
    const dir = join(tmpDir, 'existing');
    mkdirSync(dir, { recursive: true });
    expect(() => ensureDir(dir)).not.toThrow();
  });
});

describe('safeWriteFile', () => {
  const tmpDir = join(tmpdir(), 'kdoc-fs-write-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('creates parent directories and writes file', () => {
    const file = join(tmpDir, 'sub', 'dir', 'file.txt');
    safeWriteFile(file, 'content');
    expect(readFileSafe(file)).toBe('content');
  });

  it('overwrites existing file', () => {
    const file = join(tmpDir, 'file.txt');
    writeFileSync(file, 'old');
    safeWriteFile(file, 'new');
    expect(readFileSafe(file)).toBe('new');
  });
});

describe('readFileSafe', () => {
  it('returns null for non-existent file', () => {
    expect(readFileSafe('/nonexistent/path.txt')).toBeNull();
  });
});

describe('deleteIfEmpty', () => {
  const tmpDir = join(tmpdir(), 'kdoc-fs-delete-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('deletes empty directory', () => {
    const dir = join(tmpDir, 'empty');
    mkdirSync(dir);
    const deleted = deleteIfEmpty(dir);
    expect(deleted).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });

  it('does not delete directory with files', () => {
    const dir = join(tmpDir, 'notempty');
    mkdirSync(dir);
    writeFileSync(join(dir, 'file.txt'), 'content');
    const deleted = deleteIfEmpty(dir);
    expect(deleted).toBe(false);
    expect(existsSync(dir)).toBe(true);
  });

  it('deletes directory with only empty subdirectories', () => {
    const dir = join(tmpDir, 'nested-empty');
    mkdirSync(join(dir, 'sub', 'deep'), { recursive: true });
    const deleted = deleteIfEmpty(dir);
    expect(deleted).toBe(true);
    expect(existsSync(dir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/utils/fs.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/utils/fs.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function safeWriteFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf8');
}

export function readFileSafe(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function deleteIfEmpty(dirPath: string): boolean {
  if (!existsSync(dirPath)) return false;
  return deleteIfEmptyRecursive(dirPath);
}

function deleteIfEmptyRecursive(dirPath: string): boolean {
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) return false;
    if (entry.isDirectory()) {
      const subPath = join(dirPath, entry.name);
      if (!deleteIfEmptyRecursive(subPath)) return false;
    }
  }

  rmSync(dirPath, { recursive: true });
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/utils/fs.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/fs.ts cli/tests/utils/fs.test.ts
git commit -m "feat: safe filesystem utilities with idempotent mkdir and empty-dir cleanup"
```

---

### Task 4: Git Utility

**Files:**
- Create: `cli/src/utils/git.ts`
- Test: `cli/tests/utils/git.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/utils/git.test.ts
import { describe, it, expect } from 'vitest';
import { isGitRepo, hasUncommittedChanges } from '../../src/utils/git.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

describe('isGitRepo', () => {
  it('returns true for a git repo', () => {
    const dir = join(tmpdir(), 'kdoc-git-test-repo');
    mkdirSync(dir, { recursive: true });
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    expect(isGitRepo(dir)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns false for a non-git directory', () => {
    const dir = join(tmpdir(), 'kdoc-git-test-nongit');
    mkdirSync(dir, { recursive: true });
    expect(isGitRepo(dir)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('hasUncommittedChanges', () => {
  it('returns false for clean repo', () => {
    const dir = join(tmpdir(), 'kdoc-git-clean');
    mkdirSync(dir, { recursive: true });
    execFileSync('git', ['init'], { cwd: dir, stdio: 'ignore' });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir, stdio: 'ignore' });
    expect(hasUncommittedChanges(dir)).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/utils/git.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/utils/git.ts
import { execFileSync } from 'node:child_process';

export function isGitRepo(cwd: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--git-dir'], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function hasUncommittedChanges(cwd: string): boolean {
  try {
    const status = execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/utils/git.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/git.ts cli/tests/utils/git.test.ts
git commit -m "feat: git utility for repo detection and dirty tree check"
```

---

### Task 5: Config Schema (Zod)

**Files:**
- Create: `cli/src/config/schema.ts`
- Test: `cli/tests/config/schema.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/config/schema.test.ts
import { describe, it, expect } from 'vitest';
import { KdocConfigSchema, KdocLockSchema, LockFileEntrySchema } from '../../src/config/schema.js';

describe('KdocConfigSchema', () => {
  const validConfig = {
    version: 1,
    root: 'Knowledge',
    packs: ['nextjs'],
    tools: ['claude-code'],
    areas: {
      adr: { enabled: true },
      tldr: { enabled: true, scopes: ['Admin', 'Shop'] },
      roadmap: { enabled: false },
    },
    governance: {
      'sync-check': true,
      wikilinks: true,
      'adr-governance': true,
      'index-build': true,
      'enforced-paths': ['apps/*/src/modules/'],
    },
    scripts: { prefix: 'kdoc' },
  };

  it('accepts valid config', () => {
    const result = KdocConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('rejects missing version', () => {
    const { version, ...rest } = validConfig;
    const result = KdocConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('preserves unknown fields (passthrough)', () => {
    const result = KdocConfigSchema.safeParse({ ...validConfig, futureField: 'ok' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).futureField).toBe('ok');
    }
  });

  it('provides defaults for optional fields', () => {
    const minimal = { version: 1, root: 'Knowledge', packs: [], tools: [] };
    const result = KdocConfigSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scripts.prefix).toBe('kdoc');
    }
  });

  it('rejects invalid scripts prefix', () => {
    const result = KdocConfigSchema.safeParse({
      ...validConfig,
      scripts: { prefix: 'INVALID PREFIX!' },
    });
    expect(result.success).toBe(false);
  });
});

describe('LockFileEntrySchema', () => {
  it('accepts created entry', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'created',
      hash: 'sha256:' + 'a'.repeat(64),
      templateHash: 'sha256:' + 'b'.repeat(64),
      template: 'core/templates/adr.md',
    });
    expect(result.success).toBe(true);
  });

  it('accepts merged entry with markers', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'merged',
      blockHash: 'sha256:' + 'c'.repeat(64),
      templateHash: 'sha256:' + 'd'.repeat(64),
      template: 'core/templates/readme-adr.md',
      strategy: 'markers',
      markerName: 'core',
    });
    expect(result.success).toBe(true);
  });

  it('rejects created entry with blockHash', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'created',
      hash: 'sha256:' + 'a'.repeat(64),
      blockHash: 'sha256:' + 'c'.repeat(64),
      templateHash: 'sha256:' + 'b'.repeat(64),
      template: 'core/templates/adr.md',
    });
    expect(result.success).toBe(false);
  });

  it('rejects merged entry without strategy', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'merged',
      blockHash: 'sha256:' + 'c'.repeat(64),
      templateHash: 'sha256:' + 'd'.repeat(64),
      template: 'core/templates/readme-adr.md',
    });
    expect(result.success).toBe(false);
  });

  it('rejects markers strategy without markerName', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'merged',
      blockHash: 'sha256:' + 'c'.repeat(64),
      templateHash: 'sha256:' + 'd'.repeat(64),
      template: 'core/templates/readme-adr.md',
      strategy: 'markers',
      // markerName missing — should fail
    });
    expect(result.success).toBe(false);
  });

  it('accepts prefix strategy without markerName', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'merged',
      blockHash: 'sha256:' + 'c'.repeat(64),
      templateHash: 'sha256:' + 'd'.repeat(64),
      template: 'core/templates/readme-adr.md',
      strategy: 'prefix',
      // markerName absent — valid for prefix
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid hash format', () => {
    const result = LockFileEntrySchema.safeParse({
      action: 'created',
      hash: 'badhash',
      templateHash: 'sha256:' + 'b'.repeat(64),
      template: 'core/templates/adr.md',
    });
    expect(result.success).toBe(false);
  });
});

describe('KdocLockSchema', () => {
  it('accepts valid lock', () => {
    const result = KdocLockSchema.safeParse({
      lockVersion: 1,
      kdocVersion: '1.0.0',
      installedAt: '2026-03-17T15:30:00Z',
      updatedAt: '2026-03-17T15:30:00Z',
      config: { root: 'Knowledge', packs: ['nextjs'], tools: ['claude-code'] },
      files: {},
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/config/schema.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/config/schema.ts
import { z } from 'zod';

const hashPattern = /^sha256:[a-f0-9]{64}$/;
const HashString = z.string().regex(hashPattern, 'Must be sha256:<64 hex chars>');
const ScriptPrefix = z.string().regex(/^[a-z][a-z0-9-]*$/, 'Must be lowercase alphanumeric with hyphens');

const AreaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  scopes: z.array(z.string().min(1)).optional(),
}).passthrough();

const GovernanceSchema = z.object({
  'sync-check': z.boolean().default(true),
  wikilinks: z.boolean().default(true),
  'adr-governance': z.boolean().default(true),
  'index-build': z.boolean().default(true),
  'enforced-paths': z.array(z.string().min(1)).default([]),
}).default({});

const ScriptsSchema = z.object({
  prefix: ScriptPrefix.default('kdoc'),
}).default({ prefix: 'kdoc' });

export const KdocConfigSchema = z.object({
  version: z.number().int().positive(),
  root: z.string().min(1).default('Knowledge'),
  packs: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  areas: z.record(z.string(), AreaConfigSchema).default({}),
  governance: GovernanceSchema,
  scripts: ScriptsSchema,
}).passthrough();

export type KdocConfig = z.infer<typeof KdocConfigSchema>;

// Lock file entry: discriminated union on "action"
const CreatedEntrySchema = z.object({
  action: z.literal('created'),
  hash: HashString,
  templateHash: HashString,
  template: z.string().min(1),
});

const MergedEntrySchema = z.object({
  action: z.literal('merged'),
  blockHash: HashString,
  templateHash: HashString,
  template: z.string().min(1),
  strategy: z.enum(['markers', 'prefix']),
  markerName: z.string().optional(),
}).refine(
  (data) => data.strategy !== 'markers' || (data.markerName != null && data.markerName.length > 0),
  { message: 'markerName is required when strategy is "markers"', path: ['markerName'] },
);

export const LockFileEntrySchema = z.discriminatedUnion('action', [
  CreatedEntrySchema,
  MergedEntrySchema,
]);

export type LockFileEntry = z.infer<typeof LockFileEntrySchema>;

const LockConfigSchema = z.object({
  root: z.string(),
  packs: z.array(z.string()),
  tools: z.array(z.string()),
});

export const KdocLockSchema = z.object({
  lockVersion: z.number().int().positive(),
  kdocVersion: z.string().min(1),
  installedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  config: LockConfigSchema,
  files: z.record(z.string(), LockFileEntrySchema),
});

export type KdocLock = z.infer<typeof KdocLockSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/config/schema.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/config/schema.ts cli/tests/config/schema.test.ts
git commit -m "feat: Zod schemas for .kdoc.yaml config and .kdoc.lock with discriminated union"
```

---

### Task 6: Config Loader (.kdoc.yaml)

**Files:**
- Create: `cli/src/config/loader.ts`
- Test: `cli/tests/config/loader.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/config/loader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, writeConfig, configExists, loadConfigDocument, writeConfigDocument } from '../../src/config/loader.js';
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('config loader', () => {
  const tmpDir = join(tmpdir(), 'kdoc-config-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('returns null when no config exists', () => {
    expect(loadConfig(tmpDir)).toBeNull();
  });

  it('configExists returns false when no config', () => {
    expect(configExists(tmpDir)).toBe(false);
  });

  it('loads valid YAML config', () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), `
version: 1
root: Knowledge
packs: [nextjs]
tools: [claude-code]
areas:
  adr: { enabled: true }
scripts:
  prefix: kdoc
`);
    const config = loadConfig(tmpDir);
    expect(config).not.toBeNull();
    expect(config!.packs).toEqual(['nextjs']);
    expect(config!.areas.adr.enabled).toBe(true);
  });

  it('throws on invalid config', () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), 'version: "not a number"');
    expect(() => loadConfig(tmpDir)).toThrow();
  });

  it('preserves comments on document roundtrip', () => {
    writeFileSync(join(tmpDir, '.kdoc.yaml'), `
version: 1
root: Knowledge
packs: [nextjs]
tools: [claude-code]
# This is a user comment
areas:
  adr: { enabled: true } # inline comment
scripts:
  prefix: kdoc
`);
    const doc = loadConfigDocument(tmpDir);
    expect(doc).not.toBeNull();
    // Mutate via Document API
    doc!.setIn(['packs', 1], 'swift-ios');
    writeConfigDocument(tmpDir, doc!);
    // Read back raw text — comments should be preserved
    const raw = readFileSync(join(tmpDir, '.kdoc.yaml'), 'utf8');
    expect(raw).toContain('# This is a user comment');
    expect(raw).toContain('# inline comment');
    expect(raw).toContain('swift-ios');
  });

  it('writes config and reads it back', () => {
    const config = {
      version: 1,
      root: 'Knowledge',
      packs: ['swift-ios'],
      tools: ['codex'],
      areas: { adr: { enabled: true } },
      governance: {},
      scripts: { prefix: 'kdoc' },
    };
    writeConfig(tmpDir, config);
    expect(configExists(tmpDir)).toBe(true);
    const loaded = loadConfig(tmpDir);
    expect(loaded!.packs).toEqual(['swift-ios']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/config/loader.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/config/loader.ts
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument, stringify as stringifyYaml } from 'yaml';
import type { Document } from 'yaml';
import { KdocConfigSchema, type KdocConfig } from './schema.js';

const CONFIG_FILENAME = '.kdoc.yaml';

export function configPath(projectDir: string): string {
  return join(projectDir, CONFIG_FILENAME);
}

export function configExists(projectDir: string): boolean {
  return existsSync(configPath(projectDir));
}

/**
 * Load and validate .kdoc.yaml. Returns parsed config.
 * Use loadConfigDocument() when you need to preserve comments on write-back.
 */
export function loadConfig(projectDir: string): KdocConfig | null {
  const path = configPath(projectDir);
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, 'utf8');
  const doc = parseDocument(raw);
  const parsed = doc.toJSON();
  const result = KdocConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid .kdoc.yaml: ${result.error.issues.map(i => i.message).join(', ')}`);
  }

  return result.data;
}

/**
 * Load .kdoc.yaml as a YAML Document (preserves comments and formatting).
 * Use this when you need to mutate config and write back without losing comments.
 * After mutation, call writeConfigDocument() to persist.
 */
export function loadConfigDocument(projectDir: string): Document | null {
  const path = configPath(projectDir);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  return parseDocument(raw);
}

/**
 * Write config from scratch (no comment preservation).
 * Used only by `kdoc init` when creating the config for the first time.
 */
export function writeConfig(projectDir: string, config: KdocConfig): void {
  const path = configPath(projectDir);
  const yaml = stringifyYaml(config, { lineWidth: 120 });
  writeFileSync(path, yaml, 'utf8');
}

/**
 * Write a YAML Document back to disk, preserving comments and formatting.
 * Used by add/add-pack/add-tool/update to mutate config without losing comments.
 */
export function writeConfigDocument(projectDir: string, doc: Document): void {
  const path = configPath(projectDir);
  writeFileSync(path, doc.toString({ lineWidth: 120 }), 'utf8');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/config/loader.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/config/loader.ts cli/tests/config/loader.test.ts
git commit -m "feat: config loader with YAML parse, Zod validation, and write support"
```

---

### Task 7: Lock Manager (.kdoc.lock)

**Files:**
- Create: `cli/src/config/lock.ts`
- Test: `cli/tests/config/lock.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/config/lock.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadLock, writeLock, lockExists, createEmptyLock, appendFileEntry, finalizeLock, hasPendingLockTmp } from '../../src/config/lock.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('lock manager', () => {
  const tmpDir = join(tmpdir(), 'kdoc-lock-test');
  beforeEach(() => mkdirSync(tmpDir, { recursive: true }));
  afterEach(() => rmSync(tmpDir, { recursive: true, force: true }));

  it('lockExists returns false when no lock', () => {
    expect(lockExists(tmpDir)).toBe(false);
  });

  it('creates empty lock', () => {
    const lock = createEmptyLock('1.0.0', { root: 'Knowledge', packs: ['nextjs'], tools: ['claude-code'] });
    expect(lock.lockVersion).toBe(1);
    expect(lock.kdocVersion).toBe('1.0.0');
    expect(lock.files).toEqual({});
  });

  it('writes and reads lock roundtrip', () => {
    const lock = createEmptyLock('1.0.0', { root: 'Knowledge', packs: [], tools: [] });
    writeLock(tmpDir, lock);
    expect(lockExists(tmpDir)).toBe(true);
    const loaded = loadLock(tmpDir);
    expect(loaded!.kdocVersion).toBe('1.0.0');
  });

  it('appendFileEntry writes to .lock.tmp', () => {
    const lock = createEmptyLock('1.0.0', { root: 'Knowledge', packs: [], tools: [] });
    appendFileEntry(tmpDir, lock, 'Knowledge/ADR/README.md', {
      action: 'created',
      hash: 'sha256:' + 'a'.repeat(64),
      templateHash: 'sha256:' + 'b'.repeat(64),
      template: 'core/templates/readme-adr.md',
    });
    expect(hasPendingLockTmp(tmpDir)).toBe(true);
  });

  it('finalizeLock renames .lock.tmp to .lock', () => {
    const lock = createEmptyLock('1.0.0', { root: 'Knowledge', packs: [], tools: [] });
    appendFileEntry(tmpDir, lock, 'test.md', {
      action: 'created',
      hash: 'sha256:' + 'a'.repeat(64),
      templateHash: 'sha256:' + 'b'.repeat(64),
      template: 'core/templates/adr.md',
    });
    finalizeLock(tmpDir);
    expect(lockExists(tmpDir)).toBe(true);
    expect(hasPendingLockTmp(tmpDir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/config/lock.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/config/lock.ts
import { readFileSync, writeFileSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { KdocLockSchema, type KdocLock, type LockFileEntry } from './schema.js';

const LOCK_FILENAME = '.kdoc.lock';
const LOCK_TMP_FILENAME = '.kdoc.lock.tmp';

export function lockPath(projectDir: string): string {
  return join(projectDir, LOCK_FILENAME);
}

function lockTmpPath(projectDir: string): string {
  return join(projectDir, LOCK_TMP_FILENAME);
}

export function lockExists(projectDir: string): boolean {
  return existsSync(lockPath(projectDir));
}

export function hasPendingLockTmp(projectDir: string): boolean {
  return existsSync(lockTmpPath(projectDir));
}

export function createEmptyLock(
  kdocVersion: string,
  config: { root: string; packs: string[]; tools: string[] },
): KdocLock {
  const now = new Date().toISOString();
  return {
    lockVersion: 1,
    kdocVersion,
    installedAt: now,
    updatedAt: now,
    config,
    files: {},
  };
}

export function loadLock(projectDir: string): KdocLock | null {
  const path = lockExists(projectDir) ? lockPath(projectDir) : lockTmpPath(projectDir);
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const result = KdocLockSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`Invalid lock file: ${result.error.issues.map(i => i.message).join(', ')}`);
  }

  return result.data;
}

export function writeLock(projectDir: string, lock: KdocLock): void {
  lock.updatedAt = new Date().toISOString();
  const json = JSON.stringify(lock, null, 2) + '\n';
  writeFileSync(lockPath(projectDir), json, 'utf8');
}

export function appendFileEntry(
  projectDir: string,
  lock: KdocLock,
  filePath: string,
  entry: LockFileEntry,
): void {
  lock.files[filePath] = entry;
  lock.updatedAt = new Date().toISOString();
  const json = JSON.stringify(lock, null, 2) + '\n';
  writeFileSync(lockTmpPath(projectDir), json, 'utf8');
}

export function finalizeLock(projectDir: string): void {
  const tmp = lockTmpPath(projectDir);
  if (!existsSync(tmp)) return;
  renameSync(tmp, lockPath(projectDir));
}

export function cleanupLockTmp(projectDir: string): void {
  const tmp = lockTmpPath(projectDir);
  if (existsSync(tmp)) unlinkSync(tmp);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/config/lock.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/config/lock.ts cli/tests/config/lock.test.ts
git commit -m "feat: lock manager with incremental write, finalize, and crash recovery"
```

---

### Task 8: Template Renderer

**Files:**
- Create: `cli/src/templates/renderer.ts`
- Test: `cli/tests/templates/renderer.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/templates/renderer.test.ts
import { describe, it, expect } from 'vitest';
import { renderTemplate } from '../../src/templates/renderer.js';

describe('renderTemplate', () => {
  it('substitutes simple placeholders', () => {
    const result = renderTemplate('Hello {{NAME}}!', { NAME: 'World' });
    expect(result.content).toBe('Hello World!');
    expect(result.warnings).toEqual([]);
  });

  it('substitutes multiple placeholders', () => {
    const result = renderTemplate('{{A}} and {{B}}', { A: 'foo', B: 'bar' });
    expect(result.content).toBe('foo and bar');
  });

  it('warns on missing key and leaves placeholder', () => {
    const result = renderTemplate('Hello {{MISSING}}!', {});
    expect(result.content).toBe('Hello {{MISSING}}!');
    expect(result.warnings).toContain('Placeholder {{MISSING}} has no value — left as literal');
  });

  it('escapes \\{{KEY}} as literal {{KEY}}', () => {
    const result = renderTemplate('Use \\{{KEY}} for templates', { KEY: 'value' });
    expect(result.content).toBe('Use {{KEY}} for templates');
    expect(result.warnings).toEqual([]);
  });

  it('handles mixed escape and substitution', () => {
    const result = renderTemplate('{{A}} and \\{{B}}', { A: 'real', B: 'ignored' });
    expect(result.content).toBe('real and {{B}}');
  });

  it('handles empty values', () => {
    const result = renderTemplate('{{A}}', { A: '' });
    expect(result.content).toBe('');
    expect(result.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/templates/renderer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/templates/renderer.ts

export interface RenderResult {
  content: string;
  warnings: string[];
}

export function renderTemplate(
  template: string,
  values: Record<string, string>,
): RenderResult {
  const warnings: string[] = [];

  // Step 1: Replace escaped \{{...}} with a sentinel
  const SENTINEL = '\0KDOC_ESCAPE\0';
  let result = template.replace(/\\\{\{/g, SENTINEL);

  // Step 2: Replace {{KEY}} with values
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (key in values) {
      return values[key];
    }
    warnings.push(`Placeholder {{${key}}} has no value — left as literal`);
    return `{{${key}}}`;
  });

  // Step 3: Restore escaped {{ from sentinel
  result = result.replaceAll(SENTINEL, '{{');

  return { content: result, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/templates/renderer.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/templates/renderer.ts cli/tests/templates/renderer.test.ts
git commit -m "feat: template renderer with placeholder substitution, escape support, and warnings"
```

---

### Task 9: Marker-based Merge Strategy

**Files:**
- Create: `cli/src/scaffold/merge/markers.ts`
- Test: `cli/tests/scaffold/merge/markers.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/scaffold/merge/markers.test.ts
import { describe, it, expect } from 'vitest';
import { injectMarkerBlock, removeMarkerBlock, extractMarkerBlock, getDelimiters } from '../../../src/scaffold/merge/markers.js';

describe('getDelimiters', () => {
  it('uses HTML comments for .md files', () => {
    const d = getDelimiters('CLAUDE.md', 'core');
    expect(d.start).toBe('<!-- kdoc:core:start -->');
    expect(d.end).toBe('<!-- kdoc:core:end -->');
  });

  it('uses hash comments for .gitignore', () => {
    const d = getDelimiters('.gitignore', 'core');
    expect(d.start).toBe('# kdoc:core:start');
    expect(d.end).toBe('# kdoc:core:end');
  });

  it('includes pack name in delimiters', () => {
    const d = getDelimiters('CLAUDE.md', 'pack:nextjs');
    expect(d.start).toBe('<!-- kdoc:pack:nextjs:start -->');
  });
});

describe('injectMarkerBlock', () => {
  it('appends block to empty file', () => {
    const result = injectMarkerBlock('', 'block content', 'CLAUDE.md', 'core');
    expect(result).toContain('<!-- kdoc:core:start -->');
    expect(result).toContain('block content');
    expect(result).toContain('<!-- kdoc:core:end -->');
  });

  it('appends block to existing content', () => {
    const result = injectMarkerBlock('existing\ncontent', 'new block', 'CLAUDE.md', 'core');
    expect(result).toMatch(/^existing\ncontent\n\n<!-- kdoc:core:start -->/);
  });

  it('replaces existing block between markers', () => {
    const existing = 'before\n<!-- kdoc:core:start -->\nold block\n<!-- kdoc:core:end -->\nafter';
    const result = injectMarkerBlock(existing, 'new block', 'CLAUDE.md', 'core');
    expect(result).toContain('new block');
    expect(result).not.toContain('old block');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('preserves multiple different marker blocks', () => {
    const existing = '<!-- kdoc:core:start -->\ncore\n<!-- kdoc:core:end -->\n<!-- kdoc:pack:nextjs:start -->\nnextjs\n<!-- kdoc:pack:nextjs:end -->';
    const result = injectMarkerBlock(existing, 'updated core', 'CLAUDE.md', 'core');
    expect(result).toContain('updated core');
    expect(result).toContain('nextjs');
  });
});

describe('removeMarkerBlock', () => {
  it('removes block and markers', () => {
    const content = 'before\n<!-- kdoc:core:start -->\nblock\n<!-- kdoc:core:end -->\nafter';
    const result = removeMarkerBlock(content, 'CLAUDE.md', 'core');
    expect(result).not.toContain('block');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('returns content unchanged if no markers found', () => {
    const result = removeMarkerBlock('no markers here', 'CLAUDE.md', 'core');
    expect(result).toBe('no markers here');
  });

  it('returns empty string if file was only the block', () => {
    const content = '<!-- kdoc:core:start -->\nonly block\n<!-- kdoc:core:end -->';
    const result = removeMarkerBlock(content, 'CLAUDE.md', 'core');
    expect(result.trim()).toBe('');
  });
});

describe('extractMarkerBlock', () => {
  it('extracts content between markers', () => {
    const content = 'before\n<!-- kdoc:core:start -->\nblock content\n<!-- kdoc:core:end -->\nafter';
    const result = extractMarkerBlock(content, 'CLAUDE.md', 'core');
    expect(result).toBe('block content');
  });

  it('returns null if no markers', () => {
    expect(extractMarkerBlock('no markers', 'CLAUDE.md', 'core')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/merge/markers.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/scaffold/merge/markers.ts

export interface Delimiters {
  start: string;
  end: string;
}

export function getDelimiters(fileName: string, markerName: string): Delimiters {
  const isGitignore = fileName === '.gitignore' || fileName.endsWith('.gitignore');

  if (isGitignore) {
    return {
      start: `# kdoc:${markerName}:start`,
      end: `# kdoc:${markerName}:end`,
    };
  }

  return {
    start: `<!-- kdoc:${markerName}:start -->`,
    end: `<!-- kdoc:${markerName}:end -->`,
  };
}

export function injectMarkerBlock(
  fileContent: string,
  blockContent: string,
  fileName: string,
  markerName: string,
): string {
  const { start, end } = getDelimiters(fileName, markerName);
  const fullBlock = `${start}\n${blockContent}\n${end}`;

  // Check if markers already exist for this name
  if (fileContent.includes(start) && fileContent.includes(end)) {
    const startIdx = fileContent.indexOf(start);
    const endIdx = fileContent.indexOf(end) + end.length;
    return fileContent.slice(0, startIdx) + fullBlock + fileContent.slice(endIdx);
  }

  // Append to end
  if (fileContent.length === 0) {
    return fullBlock;
  }

  const separator = fileContent.endsWith('\n') ? '\n' : '\n\n';
  return fileContent + separator + fullBlock;
}

export function removeMarkerBlock(
  fileContent: string,
  fileName: string,
  markerName: string,
): string {
  const { start, end } = getDelimiters(fileName, markerName);

  if (!fileContent.includes(start) || !fileContent.includes(end)) {
    return fileContent;
  }

  const startIdx = fileContent.indexOf(start);
  const endIdx = fileContent.indexOf(end) + end.length;

  const before = fileContent.slice(0, startIdx);
  const after = fileContent.slice(endIdx);

  return (before + after).replace(/\n{3,}/g, '\n\n').trim();
}

export function extractMarkerBlock(
  fileContent: string,
  fileName: string,
  markerName: string,
): string | null {
  const { start, end } = getDelimiters(fileName, markerName);

  if (!fileContent.includes(start) || !fileContent.includes(end)) {
    return null;
  }

  const startIdx = fileContent.indexOf(start) + start.length;
  const endIdx = fileContent.indexOf(end);

  return fileContent.slice(startIdx, endIdx).trim();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/merge/markers.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/scaffold/merge/markers.ts cli/tests/scaffold/merge/markers.test.ts
git commit -m "feat: named marker-based merge with inject, remove, and extract operations"
```

---

### Task 10: Package.json Merge Strategy

**Files:**
- Create: `cli/src/scaffold/merge/package-json.ts`
- Test: `cli/tests/scaffold/merge/package-json.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// cli/tests/scaffold/merge/package-json.test.ts
import { describe, it, expect } from 'vitest';
import { mergePackageJsonScripts, removePackageJsonScripts } from '../../../src/scaffold/merge/package-json.js';

describe('mergePackageJsonScripts', () => {
  it('adds kdoc scripts to existing package.json', () => {
    const existing = { name: 'test', scripts: { dev: 'next dev' } };
    const kdocScripts = { 'kdoc:check': 'python3 scripts/kdoc/check_sync.py' };
    const result = mergePackageJsonScripts(JSON.stringify(existing, null, 2), kdocScripts);
    const parsed = JSON.parse(result);
    expect(parsed.scripts.dev).toBe('next dev');
    expect(parsed.scripts['kdoc:check']).toBe('python3 scripts/kdoc/check_sync.py');
  });

  it('updates existing kdoc scripts', () => {
    const existing = { scripts: { 'kdoc:check': 'old command', dev: 'next dev' } };
    const kdocScripts = { 'kdoc:check': 'new command' };
    const result = mergePackageJsonScripts(JSON.stringify(existing, null, 2), kdocScripts);
    const parsed = JSON.parse(result);
    expect(parsed.scripts['kdoc:check']).toBe('new command');
    expect(parsed.scripts.dev).toBe('next dev');
  });

  it('creates scripts section if missing', () => {
    const existing = { name: 'test' };
    const kdocScripts = { 'kdoc:check': 'command' };
    const result = mergePackageJsonScripts(JSON.stringify(existing, null, 2), kdocScripts);
    const parsed = JSON.parse(result);
    expect(parsed.scripts['kdoc:check']).toBe('command');
  });

  it('never touches non-kdoc scripts', () => {
    const existing = { scripts: { dev: 'original' } };
    const kdocScripts = { 'kdoc:check': 'new' };
    const result = mergePackageJsonScripts(JSON.stringify(existing, null, 2), kdocScripts);
    const parsed = JSON.parse(result);
    expect(parsed.scripts.dev).toBe('original');
  });
});

describe('removePackageJsonScripts', () => {
  it('removes all kdoc-prefixed scripts', () => {
    const existing = { scripts: { dev: 'next dev', 'kdoc:check': 'cmd', 'kdoc:index': 'cmd2' } };
    const result = removePackageJsonScripts(JSON.stringify(existing, null, 2));
    const parsed = JSON.parse(result);
    expect(parsed.scripts.dev).toBe('next dev');
    expect(parsed.scripts['kdoc:check']).toBeUndefined();
    expect(parsed.scripts['kdoc:index']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/merge/package-json.test.ts`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```typescript
// cli/src/scaffold/merge/package-json.ts

export function mergePackageJsonScripts(
  fileContent: string,
  kdocScripts: Record<string, string>,
): string {
  const pkg = JSON.parse(fileContent);
  if (!pkg.scripts) pkg.scripts = {};

  for (const [key, value] of Object.entries(kdocScripts)) {
    pkg.scripts[key] = value;
  }

  return JSON.stringify(pkg, null, 2) + '\n';
}

export function removePackageJsonScripts(fileContent: string): string {
  const pkg = JSON.parse(fileContent);
  if (!pkg.scripts) return fileContent;

  for (const key of Object.keys(pkg.scripts)) {
    if (key.startsWith('kdoc:')) {
      delete pkg.scripts[key];
    }
  }

  return JSON.stringify(pkg, null, 2) + '\n';
}

export function getKdocScriptKeys(fileContent: string): string[] {
  const pkg = JSON.parse(fileContent);
  if (!pkg.scripts) return [];
  return Object.keys(pkg.scripts).filter(k => k.startsWith('kdoc:'));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd kdoc/cli && pnpm test -- tests/scaffold/merge/package-json.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/scaffold/merge/package-json.ts cli/tests/scaffold/merge/package-json.test.ts
git commit -m "feat: package.json merge strategy with kdoc: prefix isolation"
```

---

### Task 11: Turbo.json Merge Strategy + Strategy Dispatcher

**Files:**
- Create: `cli/src/scaffold/merge/turbo-json.ts`
- Create: `cli/src/scaffold/merge/index.ts`

- [ ] **Step 1: Create turbo-json.ts** (same pattern as package-json, but for `tasks`)

```typescript
// cli/src/scaffold/merge/turbo-json.ts

export function mergeTurboJsonTasks(
  fileContent: string,
  kdocTasks: Record<string, object>,
): string {
  const turbo = JSON.parse(fileContent);
  if (!turbo.tasks) turbo.tasks = {};

  for (const [key, value] of Object.entries(kdocTasks)) {
    turbo.tasks[key] = value;
  }

  return JSON.stringify(turbo, null, 2) + '\n';
}

export function removeTurboJsonTasks(fileContent: string): string {
  const turbo = JSON.parse(fileContent);
  if (!turbo.tasks) return fileContent;

  for (const key of Object.keys(turbo.tasks)) {
    if (key.startsWith('kdoc:')) {
      delete turbo.tasks[key];
    }
  }

  return JSON.stringify(turbo, null, 2) + '\n';
}
```

- [ ] **Step 2: Create strategy dispatcher**

```typescript
// cli/src/scaffold/merge/index.ts
export { injectMarkerBlock, removeMarkerBlock, extractMarkerBlock, getDelimiters } from './markers.js';
export { mergePackageJsonScripts, removePackageJsonScripts, getKdocScriptKeys } from './package-json.js';
export { mergeTurboJsonTasks, removeTurboJsonTasks } from './turbo-json.js';

export type MergeStrategy = 'markers' | 'prefix';

export function getMergeStrategy(fileName: string): MergeStrategy | null {
  const base = fileName.split('/').pop() ?? fileName;

  switch (base) {
    case 'CLAUDE.md':
    case 'AGENTS.md':
    case '.gitignore':
      return 'markers';
    case 'package.json':
    case 'turbo.json':
      return 'prefix';
    default:
      return null;
  }
}
```

- [ ] **Step 3: Verify all tests still pass**

Run: `cd kdoc/cli && pnpm test`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add cli/src/scaffold/merge/
git commit -m "feat: turbo.json merge strategy and merge strategy dispatcher"
```

---

### Task 12: Full Test Suite Run + Final Verification

- [ ] **Step 1: Run full test suite**

Run: `cd kdoc/cli && pnpm test`
Expected: All tests pass (hash, fs, git, schema, loader, lock, renderer, markers, package-json)

- [ ] **Step 2: Run typecheck**

Run: `cd kdoc/cli && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `cd kdoc/cli && pnpm build`
Expected: `dist/index.js` created successfully

- [ ] **Step 4: Verify CLI executes**

Run: `node kdoc/cli/dist/index.js --help`
Expected: Shows help with kdoc description

- [ ] **Step 5: Commit any remaining adjustments**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, build clean, CLI functional"
```

---

## Summary

This plan produces a fully tested CLI foundation with:
- **3 utilities** (hash, fs, git) — building blocks for all commands
- **3 config modules** (schema, loader, lock) — the state management layer
- **1 template engine** (renderer) — placeholder substitution with escape/warning support
- **4 merge strategies** (markers, package-json, turbo-json, dispatcher) — the file injection layer

All modules are independently testable and have no dependencies on commands, content, packs, or AI integrations. Plan 2 (CLI Commands) consumes these modules.
