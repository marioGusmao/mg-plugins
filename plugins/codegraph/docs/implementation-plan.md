# CodeGraph Implementation Plan — Phase 1 (TypeScript/JavaScript)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working CodeGraph npm package that indexes TypeScript/JavaScript codebases into a SQLite knowledge graph and exposes call-chain queries via MCP and CLI.

**Architecture:** Hybrid indexing — Tree-sitter (native) for fast structural pass + TypeScript LanguageService (`ts.createLanguageService`) for semantic call hierarchy and type-resolved edges. Both feed the same SQLite graph store with confidence-tagged edges. An MCP stdio server exposes 6 query tools with dual output (Markdown + structuredContent). A Commander.js CLI wraps all operations. Phase 1 covers TS/JS only; other languages are deferred.

**Tech Stack:** TypeScript, better-sqlite3, tree-sitter (native), ts.LanguageService (TypeScript compiler), @modelcontextprotocol/sdk (~1.27.0), Commander.js (v14), Vitest

**Spec:** `docs/design-spec.md` (approved 2026-03-17)

**Target directory:** `/Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph/`

**Already scaffolded:** `.claude-plugin/plugin.json`, `skills/`, `hooks/hooks.json`, `mcp/mcp.json`

---

## Spec Deviations

These are intentional deviations from the design spec, documented for traceability:

| Deviation | Rationale |
|-----------|-----------|
| `codegraph setup` deferred to Phase 2 | Setup command requires detecting multiple AI tools and writing configs. Not core functionality — can be done manually for now. |
| `extractImports()` added to `LanguageExtractor` interface | The spec only defines `extractSymbols` and `extractEdges`. Adding `extractImports` as a third method makes the resolver's job cleaner — it receives structured import data rather than re-parsing the AST. |
| `symbolMap` parameter removed from `extractEdges` | The spec passes `symbolMap: Map<string, Symbol>` to `extractEdges`. We drop it because edge extraction only needs name-pairs (sourceQualifiedName/targetName); the indexer resolves names to IDs after all files are processed, which is architecturally cleaner for cross-file resolution. |
| Hybrid indexing (Tree-sitter + TS LanguageService) | The spec uses Tree-sitter only. We add `ts.createLanguageService()` as a second pipeline for TS/JS — provides call hierarchy, find-references, and type-resolved edges. Tree-sitter handles structural pass and future languages. |
| Symbol identity via `symbol_uid` instead of name-only | The spec's schema uses `name` for symbol lookup. We add `symbol_uid` (deterministic hierarchical ID: `file:container:name:kind:line`) to prevent same-name collisions. Inspired by SCIP protocol. |
| Dual MCP output (Markdown + structuredContent) | The spec returns Markdown only. We add `structuredContent` (JSON) alongside Markdown `content[]` — agents get typed data, humans get readable text. |
| Config fingerprinting for incremental invalidation | The spec only uses file hashes. We add fingerprints for tsconfig.json, package.json workspaces, and barrel files. Config changes invalidate all dependent files. |
| Commander v14, Node >= 20, module: "node20" | Updated from Commander v13 / Node >= 18 / module: "node16" to match current stable versions. |
| `mcp.json` uses `node dist/cli/index.js` instead of spec's `npx codegraph` | Dev-mode path — `npx` requires publishing to npm first. Production form uses `npx codegraph`. |
| `--sqlite-wasm` flag deferred to Phase 2 | The `sql.js` WASM fallback adds complexity. Phase 1 uses `better-sqlite3` only. |
| `tree-sitter` native instead of `web-tree-sitter` WASM | The spec assumes WASM for browser compat, but CodeGraph never runs in a browser (CLI + MCP stdio only). Native bindings are 3-5x faster and grammar packages install normally via npm — no WASM file management. `better-sqlite3` already requires native compilation, so no new risk category. |
| MCP SDK pinned to `~1.27.0` | SDK v2 is imminent (Q1 2026). Pinning avoids accidental breaking upgrade. Migrate to v2 as a separate task. |

---

## File Map

### Create (new files)

| File | Responsibility |
|------|---------------|
| `package.json` | npm manifest, scripts, dependencies, bin entry |
| `tsconfig.json` | TypeScript config (strict, ESM output) |
| `vitest.config.ts` | Test configuration |
| `.gitignore` | Ignore node_modules, dist, .codegraph |
| `src/core/types.ts` | Shared types (Symbol, Edge, File, LanguageExtractor interface) |
| `src/core/db.ts` | SQLite wrapper — open/create DB, schema init, version check, CRUD |
| `src/core/query-engine.ts` | CTE query builders — callers, callees, blast, depends, search |
| `src/core/formatter.ts` | Format query results as Markdown or JSON |
| `src/core/indexer.ts` | Pipeline orchestration — discover, diff, parse, resolve, persist |
| `src/core/resolver.ts` | Cross-file import resolution (relative, tsconfig, workspaces, barrels) |
| `src/extractors/extractor.ts` | Base LanguageExtractor interface + registry |
| `src/extractors/typescript.ts` | TS/JS/TSX/JSX structural extractor using Tree-sitter |
| `src/semantic/ts-service.ts` | TypeScript LanguageService wrapper — call hierarchy + find references |
| `src/mcp/server.ts` | MCP stdio server — 6 tools with dual output |
| `src/cli/index.ts` | Commander.js CLI entry point |
| `src/cli/commands/index-cmd.ts` | `codegraph index` command |
| `src/cli/commands/mcp-cmd.ts` | `codegraph mcp` command |
| `src/cli/commands/query-cmd.ts` | `codegraph query` command |
| `src/cli/commands/status-cmd.ts` | `codegraph status` command |
| `src/cli/commands/reset-cmd.ts` | `codegraph reset` command |
| `tests/fixtures/simple-ts/` | Synthetic TS repo with known call graph |
| `tests/fixtures/monorepo/` | Synthetic workspace monorepo |
| `tests/core/db.test.ts` | DB layer tests |
| `tests/core/query-engine.test.ts` | Query engine tests |
| `tests/core/formatter.test.ts` | Markdown formatter tests |
| `tests/core/resolver.test.ts` | Resolver tests |
| `tests/extractors/typescript.test.ts` | TypeScript extractor tests |
| `tests/semantic/ts-service.test.ts` | TS LanguageService call hierarchy tests |
| `tests/integration/index-and-query.test.ts` | Full pipeline integration test |
| `tests/mcp/server.test.ts` | MCP tool handler tests |
| `tests/mcp/smoke.test.ts` | MCP stdio smoke test (real server) |

### Modify (existing files)

| File | Change |
|------|--------|
| `hooks/check-staleness.mjs` | Implement actual staleness check (calls `codegraph status --check-file`) |
| `mcp/mcp.json` | Already updated on disk — uses `node ${CLAUDE_PLUGIN_ROOT}/dist/cli/index.js` instead of `npx codegraph` for dev mode |

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph
git init
```

- [ ] **Step 2: Create .gitignore**

```gitignore
node_modules/
dist/
.codegraph/
.DS_Store
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "codegraph",
  "version": "1.0.0",
  "description": "Code intelligence — call-chain analysis, blast radius, dependency graph queries via MCP",
  "license": "MIT",
  "type": "module",
  "bin": {
    "codegraph": "./dist/cli/index.js"
  },
  "exports": {
    ".": "./dist/core/index.js"
  },
  "files": [
    "dist/"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "~1.27.0",
    "better-sqlite3": "^11.0.0",
    "commander": "^14.0.0",
    "glob": "^11.0.0",
    "tree-sitter": "^0.22.0",
    "tree-sitter-javascript": "^0.23.0",
    "tree-sitter-typescript": "^0.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.9.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "Node20",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph && npm install`
Expected: `node_modules/` created, no errors

- [ ] **Step 7: Verify Tree-sitter native grammars installed**

Tree-sitter and grammar packages are already in `dependencies` (not devDependencies) and
were installed in Step 6. No WASM files to manage — native bindings are compiled automatically
by `node-gyp` during `npm install`.

Verify the native bindings compiled successfully:

```bash
node --input-type=module -e "import Parser from 'tree-sitter'; import TS from 'tree-sitter-typescript/typescript.js'; const p = new Parser(); p.setLanguage(TS); const t = p.parse('const x = 1;'); console.log(t.rootNode.type);"
# Expected output: "program"
```

If this fails with a compilation error, ensure you have:
- Python 3 installed
- C++ build tools (`xcode-select --install` on macOS)

The `grammars/` directory from the spec is NO LONGER NEEDED — remove it from `.gitignore` if present.
Native grammars live inside `node_modules/` as compiled `.node` files.

- [ ] **Step 8: Create minimal source file so build doesn't fail**

```bash
mkdir -p src/core
echo 'export {};' > src/core/index.ts
```

Then verify the build works:

Run: `npm run build`
Expected: `dist/core/index.js` created, no errors. This stub is expanded in Task 2.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initialize codegraph project with dependencies"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write types file**

```typescript
import type Parser from 'tree-sitter';

export interface FileRecord {
  id: number;
  path: string;
  language: string;
  hash: string;
  indexed_at: number;
}

export interface SymbolRecord {
  id: number;
  file_id: number;
  symbol_uid: string;       // deterministic ID: "file:container:name:kind:line"
  name: string;
  qualified_name: string;   // dot-separated: "MyClass.render"
  container_name: string;   // parent class/module name, or "" for top-level
  kind: SymbolKind;
  line_start: number;
  line_end: number;
  exported: boolean;
}

export type SymbolKind = 'function' | 'class' | 'method' | 'variable' | 'type' | 'export';

export interface EdgeRecord {
  id: number;
  source_uid: string;       // symbol_uid of the source
  target_uid: string;       // symbol_uid of the target
  kind: EdgeKind;
  confidence: EdgeConfidence;
}

export type EdgeKind = 'calls' | 'imports' | 'extends' | 'implements' | 'uses_type';
export type EdgeConfidence = 'syntactic' | 'semantic';

export interface FileDepRecord {
  id: number;
  source_id: number;
  target_id: number;
  kind: 'import' | 'require' | 'dynamic_import';
}

export interface ExtractedSymbol {
  name: string;
  qualified_name: string;   // "ClassName.methodName" or just "functionName"
  container_name: string;   // parent class/namespace, "" for top-level
  kind: SymbolKind;
  line_start: number;
  line_end: number;
  exported: boolean;
}

export interface ExtractedEdge {
  sourceQualifiedName: string;  // qualified name of the calling symbol
  targetName: string;           // name of the called symbol (resolved by indexer)
  targetImport: string | null;  // import source if cross-file, null if same-file
  kind: EdgeKind;
  confidence: EdgeConfidence;
}

/** Builds a deterministic symbol_uid from components */
export function buildSymbolUid(filePath: string, containerName: string, name: string, kind: SymbolKind, lineStart: number): string {
  return `${filePath}:${containerName || '_'}:${name}:${kind}:${lineStart}`;
}

export interface ExtractedImport {
  specifiers: string[];
  source: string;
  kind: 'import' | 'require' | 'dynamic_import';
}

export interface LanguageExtractor {
  language: string;
  extensions: string[];
  extractSymbols(tree: Parser.Tree, source: string): ExtractedSymbol[];
  extractEdges(tree: Parser.Tree, source: string): ExtractedEdge[];
  extractImports(tree: Parser.Tree, source: string): ExtractedImport[];
}

export interface CallerResult {
  symbolName: string;
  filePath: string;
  lineStart: number;
  depth: number;
}

export interface DependsResult {
  filePath: string;
  kind: string;
  direction: 'in' | 'out';
}

export interface StatusResult {
  totalFiles: number;
  totalSymbols: number;
  totalEdges: number;
  staleFiles: number;
  lastIndexedAt: string | null;
  lastIndexedCommit: string | null;
  schemaVersion: string;
  languages: Record<string, number>;
}

export const SCHEMA_VERSION = '1.0';
export const MAX_DEPTH = 15;
export const MAX_RESULTS = 200;
export const QUERY_TIMEOUT_MS = 5000;
```

- [ ] **Step 2: Verify barrel export stub exists**

`src/core/index.ts` was created in Task 1 Step 8. Verify it exists before proceeding.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts src/core/index.ts
git commit -m "feat: add shared type definitions and barrel export stub"
```

---

## Task 3: Database Layer

**Files:**
- Create: `src/core/db.ts`, `tests/core/db.test.ts`

- [ ] **Step 1: Write failing tests for DB layer**

```typescript
// tests/core/db.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/core/db.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Database', () => {
  let tmpDir: string;
  let db: Database;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-test-'));
    db = new Database(tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates .codegraph directory and graph.db', () => {
    expect(fs.existsSync(path.join(tmpDir, '.codegraph', 'graph.db'))).toBe(true);
  });

  it('stores schema_version in meta', () => {
    expect(db.getMeta('schema_version')).toBe('1.0');
  });

  it('inserts and retrieves a file record', () => {
    const id = db.upsertFile({ path: 'src/index.ts', language: 'typescript', hash: 'abc123' });
    const file = db.getFileByPath('src/index.ts');
    expect(file).toBeDefined();
    expect(file!.id).toBe(id);
    expect(file!.hash).toBe('abc123');
  });

  it('upserts file on duplicate path', () => {
    db.upsertFile({ path: 'src/index.ts', language: 'typescript', hash: 'abc' });
    db.upsertFile({ path: 'src/index.ts', language: 'typescript', hash: 'def' });
    const file = db.getFileByPath('src/index.ts');
    expect(file!.hash).toBe('def');
  });

  it('inserts symbols with unique constraint on symbol_uid', () => {
    const fileId = db.upsertFile({ path: 'a.ts', language: 'typescript', hash: 'x' });
    db.insertSymbol({
      file_id: fileId, symbol_uid: 'a.ts:_:foo:function:1',
      name: 'foo', qualified_name: 'foo', container_name: '',
      kind: 'function', line_start: 1, line_end: 5, exported: true
    });
    const symbols = db.getSymbolsByFile(fileId);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe('foo');
    expect(symbols[0].symbol_uid).toBe('a.ts:_:foo:function:1');
  });

  it('inserts edges between symbols using symbol_uid', () => {
    const fid = db.upsertFile({ path: 'a.ts', language: 'typescript', hash: 'x' });
    db.insertSymbol({
      file_id: fid, symbol_uid: 'a.ts:_:a:function:1',
      name: 'a', qualified_name: 'a', container_name: '',
      kind: 'function', line_start: 1, line_end: 3, exported: false
    });
    db.insertSymbol({
      file_id: fid, symbol_uid: 'a.ts:_:b:function:5',
      name: 'b', qualified_name: 'b', container_name: '',
      kind: 'function', line_start: 5, line_end: 7, exported: false
    });
    db.insertEdge({ source_uid: 'a.ts:_:a:function:1', target_uid: 'a.ts:_:b:function:5', kind: 'calls', confidence: 'syntactic' });
    const edges = db.getEdgesBySourceUid('a.ts:_:a:function:1');
    expect(edges).toHaveLength(1);
    expect(edges[0].kind).toBe('calls');
    expect(edges[0].confidence).toBe('syntactic');
  });

  it('cascades deletes from file to symbols and edges', () => {
    const fid = db.upsertFile({ path: 'a.ts', language: 'typescript', hash: 'x' });
    db.insertSymbol({
      file_id: fid, symbol_uid: 'a.ts:_:a:function:1',
      name: 'a', qualified_name: 'a', container_name: '',
      kind: 'function', line_start: 1, line_end: 3, exported: false
    });
    db.insertSymbol({
      file_id: fid, symbol_uid: 'a.ts:_:b:function:5',
      name: 'b', qualified_name: 'b', container_name: '',
      kind: 'function', line_start: 5, line_end: 7, exported: false
    });
    db.insertEdge({ source_uid: 'a.ts:_:a:function:1', target_uid: 'a.ts:_:b:function:5', kind: 'calls', confidence: 'syntactic' });
    db.deleteFile(fid);
    expect(db.getSymbolsByFile(fid)).toHaveLength(0);
  });

  it('detects stale files by hash comparison', () => {
    db.upsertFile({ path: 'a.ts', language: 'typescript', hash: 'old' });
    const stale = db.getStaleFiles([{ path: 'a.ts', hash: 'new' }]);
    expect(stale).toHaveLength(1);
    expect(stale[0].path).toBe('a.ts');
  });

  it('rejects major version mismatch', () => {
    db.setMeta('schema_version', '2.0');
    expect(() => new Database(tmpDir)).toThrow(/schema version mismatch/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/db.test.ts`
Expected: FAIL — Database module not found

- [ ] **Step 3: Implement db.ts**

Implement the `Database` class. **Updated schema** (differs from spec to support symbol_uid and confidence):

```sql
CREATE TABLE symbols (
  id              INTEGER PRIMARY KEY,
  file_id         INTEGER REFERENCES files ON DELETE CASCADE,
  symbol_uid      TEXT UNIQUE,         -- "file:container:name:kind:line"
  name            TEXT,
  qualified_name  TEXT,                -- "ClassName.methodName"
  container_name  TEXT DEFAULT '',     -- parent class/module
  kind            TEXT,
  line_start      INTEGER,
  line_end        INTEGER,
  exported        BOOLEAN DEFAULT 0
);

CREATE TABLE edges (
  id              INTEGER PRIMARY KEY,
  source_uid      TEXT REFERENCES symbols(symbol_uid) ON DELETE CASCADE,
  target_uid      TEXT REFERENCES symbols(symbol_uid) ON DELETE CASCADE,
  kind            TEXT,
  confidence      TEXT DEFAULT 'syntactic'  -- 'syntactic' | 'semantic'
);

-- Config fingerprints for incremental invalidation
CREATE TABLE config_fingerprints (
  key    TEXT PRIMARY KEY,           -- 'tsconfig', 'package_json', 'pnpm_workspace'
  hash   TEXT                        -- SHA-256 of config file content
);
```

**Key indices:** `symbols(symbol_uid)`, `symbols(name)`, `symbols(qualified_name)`, `edges(source_uid)`, `edges(target_uid)`, `edges(confidence)`.

Methods:
- Constructor: creates `.codegraph/` dir, opens SQLite with WAL mode + foreign keys, runs schema SQL, checks version
- `getMeta(key)` / `setMeta(key, value)` — meta table access
- `upsertFile()` — INSERT OR REPLACE with indexed_at timestamp
- `getFileByPath()` / `getAllFiles()` / `deleteFile()` / `deleteFileSymbolsAndEdges()`
- `insertSymbol()` — with UNIQUE constraint on `symbol_uid`
- `getSymbolByUid()` / `getSymbolsByFile()` / `getSymbolsByName()` / `searchSymbols()`
- `insertEdge()` — with `confidence` field. Semantic edges overwrite syntactic for same source/target pair.
- `getEdgesBySourceUid()` / `getEdgesByTargetUid()`
- `insertFileDep()` / `getStaleFiles()`
- `getConfigFingerprint()` / `setConfigFingerprint()` — for incremental invalidation
- `transaction()` / `getStatus()` / `close()`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/core/db.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/db.ts tests/core/db.test.ts
git commit -m "feat: add database layer with schema, CRUD, and version check"
```

---

## Task 4: Query Engine

**Files:**
- Create: `src/core/query-engine.ts`, `src/core/formatter.ts`, `tests/core/query-engine.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/core/query-engine.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/core/db.js';
import { QueryEngine } from '../../src/core/query-engine.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('QueryEngine', () => {
  let tmpDir: string;
  let db: Database;
  let qe: QueryEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-qe-'));
    db = new Database(tmpDir);
    qe = new QueryEngine(db);

    // Build a test graph:
    // fileA: funcA -> funcB (calls)
    // fileB: funcB -> funcC (calls)
    // fileC: funcC (leaf)
    db.transaction(() => {
      const fA = db.upsertFile({ path: 'src/a.ts', language: 'typescript', hash: 'a' });
      const fB = db.upsertFile({ path: 'src/b.ts', language: 'typescript', hash: 'b' });
      const fC = db.upsertFile({ path: 'src/c.ts', language: 'typescript', hash: 'c' });

      const uidA = 'src/a.ts:_:funcA:function:1';
      const uidB = 'src/b.ts:_:funcB:function:1';
      const uidC = 'src/c.ts:_:funcC:function:1';

      db.insertSymbol({ file_id: fA, symbol_uid: uidA, name: 'funcA', qualified_name: 'funcA', container_name: '', kind: 'function', line_start: 1, line_end: 5, exported: true });
      db.insertSymbol({ file_id: fB, symbol_uid: uidB, name: 'funcB', qualified_name: 'funcB', container_name: '', kind: 'function', line_start: 1, line_end: 5, exported: true });
      db.insertSymbol({ file_id: fC, symbol_uid: uidC, name: 'funcC', qualified_name: 'funcC', container_name: '', kind: 'function', line_start: 1, line_end: 5, exported: true });

      db.insertEdge({ source_uid: uidA, target_uid: uidB, kind: 'calls', confidence: 'syntactic' });
      db.insertEdge({ source_uid: uidB, target_uid: uidC, kind: 'calls', confidence: 'syntactic' });

      db.insertFileDep({ source_id: fA, target_id: fB, kind: 'import' });
      db.insertFileDep({ source_id: fB, target_id: fC, kind: 'import' });
    });
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds callers of funcC at depth 1', () => {
    const results = qe.callers('funcC', undefined, 1);
    expect(results).toHaveLength(1);
    expect(results[0].symbolName).toBe('funcB');
  });

  it('finds callers of funcC at depth 2', () => {
    const results = qe.callers('funcC', undefined, 2);
    expect(results).toHaveLength(2);
    expect(results.map(r => r.symbolName).sort()).toEqual(['funcA', 'funcB']);
  });

  it('finds callees of funcA at depth 1', () => {
    const results = qe.callees('funcA', undefined, 1);
    expect(results).toHaveLength(1);
    expect(results[0].symbolName).toBe('funcB');
  });

  it('finds callees of funcA at depth 2', () => {
    const results = qe.callees('funcA', undefined, 2);
    expect(results).toHaveLength(2);
  });

  it('blast returns union of callers and callees', () => {
    const results = qe.blast('funcB', undefined, 2);
    expect(results.callers).toHaveLength(1); // funcA
    expect(results.callees).toHaveLength(1); // funcC
    expect(results.affectedFiles).toHaveLength(3);
  });

  it('returns disambiguation when multiple symbols match', () => {
    const fD = db.upsertFile({ path: 'src/d.ts', language: 'typescript', hash: 'd' });
    db.insertSymbol({
      file_id: fD, symbol_uid: 'src/d.ts:_:funcC:function:1',
      name: 'funcC', qualified_name: 'funcC', container_name: '',
      kind: 'function', line_start: 1, line_end: 5, exported: true
    });

    const result = qe.callers('funcC');
    expect(result).toEqual({ disambiguation: true, matches: expect.any(Array) });
  });

  it('resolves disambiguation with file parameter', () => {
    const fD = db.upsertFile({ path: 'src/d.ts', language: 'typescript', hash: 'd' });
    db.insertSymbol({
      file_id: fD, symbol_uid: 'src/d.ts:_:funcC:function:1',
      name: 'funcC', qualified_name: 'funcC', container_name: '',
      kind: 'function', line_start: 1, line_end: 5, exported: true
    });

    const results = qe.callers('funcC', 'src/c.ts', 2);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('resolves by symbol_uid directly (no ambiguity possible)', () => {
    const fD = db.upsertFile({ path: 'src/d.ts', language: 'typescript', hash: 'd' });
    db.insertSymbol({
      file_id: fD, symbol_uid: 'src/d.ts:_:funcC:function:1',
      name: 'funcC', qualified_name: 'funcC', container_name: '',
      kind: 'function', line_start: 1, line_end: 5, exported: true
    });

    // Query by uid — always unambiguous, even for same name + same file
    const results = qe.callersByUid('src/c.ts:_:funcC:function:1', 2);
    expect(Array.isArray(results)).toBe(true);
    expect(results).toHaveLength(2);
  });

  it('resolves by qualified_name for methods', () => {
    // Two render() methods in different classes in the same file
    const fE = db.upsertFile({ path: 'src/e.ts', language: 'typescript', hash: 'e' });
    db.insertSymbol({
      file_id: fE, symbol_uid: 'src/e.ts:Foo:render:method:10',
      name: 'render', qualified_name: 'Foo.render', container_name: 'Foo',
      kind: 'method', line_start: 10, line_end: 15, exported: false
    });
    db.insertSymbol({
      file_id: fE, symbol_uid: 'src/e.ts:Bar:render:method:20',
      name: 'render', qualified_name: 'Bar.render', container_name: 'Bar',
      kind: 'method', line_start: 20, line_end: 25, exported: false
    });

    // name 'render' + file 'src/e.ts' is still ambiguous — need qualified_name
    const ambiguous = qe.callers('render', 'src/e.ts');
    expect(ambiguous).toEqual({ disambiguation: true, matches: expect.any(Array) });

    // qualified_name resolves it
    const results = qe.callersByQualifiedName('Foo.render', 'src/e.ts', 1);
    expect(Array.isArray(results)).toBe(true);
  });

  it('handles cycles without infinite recursion', () => {
    // Add a cycle: funcC -> funcA
    db.insertEdge({ source_uid: 'src/c.ts:_:funcC:function:1', target_uid: 'src/a.ts:_:funcA:function:1', kind: 'calls', confidence: 'syntactic' });

    const results = qe.callers('funcC', 'src/c.ts', 5);
    // Should not hang, should deduplicate
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeLessThanOrEqual(3); // Only 3 symbols in the graph
  });

  it('depends returns file dependencies', () => {
    const results = qe.depends('src/b.ts', 'both');
    const inbound = results.filter(r => r.direction === 'in');
    const outbound = results.filter(r => r.direction === 'out');
    expect(inbound).toHaveLength(1); // a.ts imports b.ts
    expect(outbound).toHaveLength(1); // b.ts imports c.ts
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/core/query-engine.test.ts`
Expected: FAIL — QueryEngine not found

- [ ] **Step 3: Implement query-engine.ts**

Implement the `QueryEngine` class with methods: `callers()`, `callees()`, `blast()`, `depends()`, `search()`. Use the recursive CTEs from the design spec (Section 3). Return disambiguation objects when multiple symbols match and no `file` parameter is given. Bind depth to `Math.min(userDepth ?? 5, 15)`.

Key: the `callers` and `callees` methods must first resolve the symbol ID. If multiple symbols match the name and no file is given, return `{ disambiguation: true, matches: [...] }`. Otherwise, run the recursive CTE with the resolved symbol ID.

The CTE must use `UNION` (not `UNION ALL`) for deduplication, `GROUP BY` + `MIN(depth)` for shallowest-depth collapse, and the depth cap as the primary cycle guard.

- [ ] **Step 4: Write failing formatter tests**

```typescript
// tests/core/formatter.test.ts
import { describe, it, expect } from 'vitest';
import { formatCallers, formatDisambiguation, formatStatus } from '../../src/core/formatter.js';

describe('Formatter', () => {
  it('formats callers as Markdown with depth grouping', () => {
    const result = formatCallers('processPayment', 'src/checkout/payment.ts', 42, [
      { symbolName: 'handleCheckout', filePath: 'src/checkout/actions.ts', lineStart: 18, depth: 1 },
      { symbolName: 'retryPayment', filePath: 'src/checkout/retry.ts', lineStart: 7, depth: 1 },
      { symbolName: 'onSubmit', filePath: 'src/checkout/Form.tsx', lineStart: 55, depth: 2 },
    ]);
    expect(result).toContain('## Callers of `processPayment`');
    expect(result).toContain('### Direct (depth 1)');
    expect(result).toContain('`handleCheckout`');
    expect(result).toContain('### Indirect (depth 2)');
    expect(result).toContain('### Impact summary');
    expect(result).toContain('3 symbols across 3 files');
  });

  it('formats disambiguation listing', () => {
    const result = formatDisambiguation('useAuth', [
      { name: 'useAuth', kind: 'function', file_path: 'src/shop/auth.ts', line_start: 5 },
      { name: 'useAuth', kind: 'function', file_path: 'src/admin/auth.ts', line_start: 3 },
    ]);
    expect(result).toContain('## Multiple symbols found for `useAuth`');
    expect(result).toContain('src/shop/auth.ts:5');
    expect(result).toContain('src/admin/auth.ts:3');
    expect(result).toContain('Re-query with `file` parameter');
  });

  it('formats status with language breakdown', () => {
    const result = formatStatus({
      totalFiles: 10, totalSymbols: 50, totalEdges: 30,
      staleFiles: 2, lastIndexedAt: '2026-03-17T10:00:00Z',
      lastIndexedCommit: 'abc123', schemaVersion: '1.0',
      languages: { typescript: 8, javascript: 2 },
    });
    expect(result).toContain('10 files');
    expect(result).toContain('50 symbols');
    expect(result).toContain('2 stale');
    expect(result).toContain('typescript: 8');
  });
});
```

- [ ] **Step 5: Run formatter tests to verify they fail**

Run: `npx vitest run tests/core/formatter.test.ts`
Expected: FAIL — formatter module not found

- [ ] **Step 6: Implement formatter.ts**

Functions: `formatCallers()`, `formatCallees()`, `formatBlast()`, `formatDepends()`, `formatSearch()`, `formatStatus()`, `formatDisambiguation()`. Each takes query results and returns a Markdown string matching the spec's response format (Section 5).

- [ ] **Step 7: Run all Task 4 tests to verify they pass**

Run: `npx vitest run tests/core/query-engine.test.ts tests/core/formatter.test.ts`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/query-engine.ts src/core/formatter.ts tests/core/query-engine.test.ts tests/core/formatter.test.ts
git commit -m "feat: add query engine with recursive CTEs and Markdown formatter"
```

---

## Task 5: TypeScript Extractor

**Files:**
- Create: `src/extractors/extractor.ts`, `src/extractors/typescript.ts`, `tests/extractors/typescript.test.ts`, `tests/fixtures/simple-ts/`

- [ ] **Step 1: Create test fixture — a small TS project with known call graph**

```
tests/fixtures/simple-ts/
├── src/
│   ├── math.ts          # export function add(a, b) { return a + b; }
│   │                     # export function multiply(a, b) { return a * b; }
│   ├── calculator.ts     # import { add, multiply } from './math';
│   │                     # export function calculate(op, a, b) { if (op === '+') return add(a,b); return multiply(a,b); }
│   ├── index.ts          # import { calculate } from './calculator';
│   │                     # export { calculate };
│   │                     # export function main() { return calculate('+', 1, 2); }
│   └── shapes.ts         # class Shape { area(): number { return 0; } }
│                         # class Circle extends Shape { area(): number { return Math.PI * this.r ** 2; } r = 1; }
│                         # export function printArea(s: Shape) { return s.area(); }
└── tsconfig.json
```

Write ALL fixture files including `shapes.ts` (required by Task 6 inheritance test).

- [ ] **Step 2: Write failing tests for extractor**

```typescript
// tests/extractors/typescript.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { TypeScriptExtractor } from '../../src/extractors/typescript.js';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript/typescript';

describe('TypeScriptExtractor', () => {
  let extractor: TypeScriptExtractor;
  let parser: Parser;

  beforeAll(() => {
    parser = new Parser();
    parser.setLanguage(TypeScript);
    extractor = new TypeScriptExtractor();
  });

  it('extracts exported functions', () => {
    const source = 'export function add(a: number, b: number): number { return a + b; }';
    const tree = parser.parse(source);
    const symbols = extractor.extractSymbols(tree, source);
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'add', kind: 'function', exported: true
    }));
  });

  it('extracts non-exported functions', () => {
    const source = 'function helper() { return 1; }';
    const tree = parser.parse(source);
    const symbols = extractor.extractSymbols(tree, source);
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'helper', kind: 'function', exported: false
    }));
  });

  it('extracts classes and methods', () => {
    const source = `export class Calculator {
      add(a: number, b: number) { return a + b; }
    }`;
    const tree = parser.parse(source);
    const symbols = extractor.extractSymbols(tree, source);
    expect(symbols).toContainEqual(expect.objectContaining({ name: 'Calculator', kind: 'class' }));
    expect(symbols).toContainEqual(expect.objectContaining({ name: 'add', kind: 'method' }));
  });

  it('extracts import statements', () => {
    const source = `import { add, multiply } from './math';`;
    const tree = parser.parse(source);
    const imports = extractor.extractImports(tree, source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('./math');
    expect(imports[0].specifiers).toContain('add');
    expect(imports[0].specifiers).toContain('multiply');
  });

  it('extracts arrow function exports', () => {
    const source = 'export const greet = (name: string) => `Hello ${name}`;';
    const tree = parser.parse(source);
    const symbols = extractor.extractSymbols(tree, source);
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'greet', kind: 'function', exported: true
    }));
  });

  it('extracts type exports', () => {
    const source = 'export type User = { name: string; age: number; };';
    const tree = parser.parse(source);
    const symbols = extractor.extractSymbols(tree, source);
    expect(symbols).toContainEqual(expect.objectContaining({
      name: 'User', kind: 'type', exported: true
    }));
  });

  it('extracts re-exports', () => {
    const source = `export { calculate } from './calculator';`;
    const tree = parser.parse(source);
    const imports = extractor.extractImports(tree, source);
    expect(imports).toHaveLength(1);
    expect(imports[0].source).toBe('./calculator');
  });

  it('extracts function call edges within a function body', () => {
    const source = `
      import { add } from './math';
      function calculate() { return add(1, 2); }
    `;
    const tree = parser.parse(source);
    const edges = extractor.extractEdges(tree, source);
    expect(edges).toContainEqual(expect.objectContaining({
      sourceQualifiedName: 'calculate', targetName: 'add', kind: 'calls'
    }));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/extractors/typescript.test.ts`
Expected: FAIL — TypeScriptExtractor not found

- [ ] **Step 4: Implement extractor base and TypeScript extractor**

`src/extractors/extractor.ts` — registry mapping extensions to extractors:
```typescript
const registry = new Map<string, LanguageExtractor>();
export function registerExtractor(ext: LanguageExtractor) { ... }
export function getExtractorForFile(filePath: string): LanguageExtractor | undefined { ... }
```

`src/extractors/typescript.ts` — Tree-sitter AST walker that:
- Walks `function_declaration`, `arrow_function` (in `variable_declarator`), `class_declaration`, `method_definition`, `type_alias_declaration`, `interface_declaration`
- Detects `export` by checking if parent is `export_statement`
- Extracts `import_statement` nodes: parses `import_clause` for named specifiers, `source` for the module path
- Extracts `call_expression` nodes within function bodies: determines the enclosing function (source) and the called identifier (target)
- Handles TSX by using `tree-sitter-typescript/tsx` for `.tsx` files
- Extensions: `.ts`, `.tsx`, `.js`, `.jsx`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/extractors/typescript.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/extractors/ tests/extractors/ tests/fixtures/simple-ts/
git commit -m "feat: add TypeScript/JavaScript extractor with Tree-sitter native"
```

---

## Task 6: TypeScript LanguageService Wrapper

**Files:**
- Create: `src/semantic/ts-service.ts`, `tests/semantic/ts-service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/semantic/ts-service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TSService } from '../../src/semantic/ts-service.js';
import path from 'node:path';

const FIXTURE_ROOT = path.resolve('tests/fixtures/simple-ts');

describe('TSService', () => {
  let service: TSService;

  beforeAll(() => {
    service = new TSService(FIXTURE_ROOT);
  });

  afterAll(() => {
    service.dispose();
  });

  it('finds incoming calls to a function', () => {
    // add() is called by calculate() in calculator.ts
    const callers = service.getIncomingCalls('src/math.ts', 'add');
    expect(callers.length).toBeGreaterThanOrEqual(1);
    expect(callers.some(c => c.callerName === 'calculate')).toBe(true);
  });

  it('finds outgoing calls from a function', () => {
    // calculate() calls add() and multiply()
    const callees = service.getOutgoingCalls('src/calculator.ts', 'calculate');
    expect(callees.length).toBeGreaterThanOrEqual(2);
    expect(callees.some(c => c.calleeName === 'add')).toBe(true);
    expect(callees.some(c => c.calleeName === 'multiply')).toBe(true);
  });

  it('finds all references to a symbol', () => {
    const refs = service.findReferences('src/math.ts', 'add');
    expect(refs.length).toBeGreaterThanOrEqual(2); // definition + at least 1 usage
  });

  it('resolves method calls through class inheritance', () => {
    // Fixture: tests/fixtures/simple-ts/src/shapes.ts contains:
    //   class Shape { area(): number { return 0; } }           // line ~1
    //   class Circle extends Shape { area() { ... } }          // line ~3
    //   export function printArea(s: Shape) { return s.area(); }  // line ~5
    //
    // The TS LanguageService should resolve printArea -> Shape.area
    // Tree-sitter cannot do this — it only sees "s.area()" with no type info.
    //
    // Use qualified_name to avoid ambiguity (Shape.area vs Circle.area in same file):
    const callers = service.getIncomingCallsByQualifiedName('src/shapes.ts', 'Shape.area');
    expect(callers.some(c => c.callerName === 'printArea')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/semantic/ts-service.test.ts`
Expected: FAIL — TSService not found

- [ ] **Step 3: Implement ts-service.ts**

The `TSService` class wraps `ts.createLanguageService()`:

```typescript
// src/semantic/ts-service.ts — key structure
import ts from 'typescript';

export class TSService {
  private service: ts.LanguageService;
  private program: ts.Program;

  constructor(projectRoot: string) {
    // 1. Find tsconfig.json
    // 2. Parse it with ts.parseJsonConfigFileContent()
    // 3. Create a LanguageServiceHost that manages file snapshots
    // 4. Create the LanguageService
  }

  getIncomingCalls(filePath: string, symbolName: string): IncomingCall[] {
    // 1. Find the symbol position in the file
    // 2. Call service.prepareCallHierarchy(filePath, position)
    // 3. Call service.provideCallHierarchyIncomingCalls(filePath, position)
    // 4. Map results to IncomingCall[]
  }

  getOutgoingCalls(filePath: string, symbolName: string): OutgoingCall[] {
    // Same pattern with provideCallHierarchyOutgoingCalls
  }

  findReferences(filePath: string, symbolName: string): Reference[] {
    // Call service.findReferences(filePath, position)
  }

  dispose(): void {
    this.service.dispose();
  }
}
```

**Critical:** Use raw `ts.LanguageService`, NOT ts-morph — ts-morph does not wrap `prepareCallHierarchy` or `provideCallHierarchyIncomingCalls`.

The LanguageServiceHost must implement `getScriptFileNames()`, `getScriptVersion()`, `getScriptSnapshot()`, `getCurrentDirectory()`, `getDefaultLibFileName()`, and `getCompilationSettings()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/semantic/ts-service.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/semantic/ tests/semantic/
git commit -m "feat: add TypeScript LanguageService wrapper for semantic call hierarchy"
```

---

## Task 7: Resolver

**Files:**
- Create: `src/core/resolver.ts`, `tests/core/resolver.test.ts`, `tests/fixtures/monorepo/`

- [ ] **Step 1: Create monorepo test fixture**

```
tests/fixtures/monorepo/
├── package.json           # { "workspaces": ["packages/*", "apps/*"] }
├── tsconfig.json          # { "compilerOptions": { "baseUrl": ".", "paths": { "@shared/*": ["packages/shared/src/*"] } } }
├── packages/
│   └── shared/
│       ├── package.json   # { "name": "@monorepo/shared" }
│       └── src/
│           ├── index.ts   # export { helper } from './utils';
│           └── utils.ts   # export function helper() { return 1; }
└── apps/
    └── web/
        ├── package.json   # { "name": "@monorepo/web" }
        └── src/
            └── app.ts     # import { helper } from '@shared/utils';
                           # export function main() { return helper(); }
```

- [ ] **Step 2: Write failing tests**

```typescript
// tests/core/resolver.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Resolver } from '../../src/core/resolver.js';
import path from 'node:path';

const MONOREPO_ROOT = path.resolve('tests/fixtures/monorepo');

describe('Resolver', () => {
  let resolver: Resolver;

  beforeAll(() => {
    // Constructor takes only projectRoot. It loads tsconfig.json and
    // package.json workspaces internally during construction.
    resolver = new Resolver(MONOREPO_ROOT);
  });

  it('resolves relative imports', () => {
    const resolved = resolver.resolveImportPath(
      './utils',
      path.join(MONOREPO_ROOT, 'packages/shared/src/index.ts')
    );
    expect(resolved).toBe('packages/shared/src/utils.ts');
  });

  it('resolves tsconfig path aliases', () => {
    const resolved = resolver.resolveImportPath(
      '@shared/utils',
      path.join(MONOREPO_ROOT, 'apps/web/src/app.ts')
    );
    expect(resolved).toBe('packages/shared/src/utils.ts');
  });

  it('resolves workspace package names', () => {
    const resolved = resolver.resolveImportPath(
      '@monorepo/shared',
      path.join(MONOREPO_ROOT, 'apps/web/src/app.ts')
    );
    // Should resolve to the package entry point (index.ts)
    expect(resolved).toBe('packages/shared/src/index.ts');
  });

  it('follows barrel re-exports up to depth 5', () => {
    // resolveExportChain traces export { X } from './Y' chains.
    // index.ts re-exports helper from utils.ts — should follow to origin.
    const resolved = resolver.resolveExportChain('helper', 'packages/shared/src/index.ts');
    expect(resolved).toBe('packages/shared/src/utils.ts');
  });

  it('skips node_modules imports', () => {
    const resolved = resolver.resolveImportPath(
      'lodash',
      path.join(MONOREPO_ROOT, 'apps/web/src/app.ts')
    );
    expect(resolved).toBeNull();
  });

  it('skips Node.js built-in imports', () => {
    const resolved = resolver.resolveImportPath(
      'node:fs',
      path.join(MONOREPO_ROOT, 'apps/web/src/app.ts')
    );
    expect(resolved).toBeNull();
  });

  it('returns null for unresolvable imports', () => {
    const resolved = resolver.resolveImportPath(
      './nonexistent',
      path.join(MONOREPO_ROOT, 'apps/web/src/app.ts')
    );
    expect(resolved).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/core/resolver.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement resolver.ts**

The `Resolver` class constructor takes a single argument: `projectRoot: string`. During
construction it loads `tsconfig.json` (with `extends` chain), `package.json` workspaces,
and `pnpm-workspace.yaml` to build internal lookup maps.

**Public methods:**
- `resolveImportPath(importSource: string, importerFilePath: string): string | null` — resolves an import specifier to a relative file path (relative to projectRoot). Returns null if unresolvable (node_modules, builtins).
- `resolveExportChain(symbolName: string, filePath: string, depth?: number): string | null` — follows `export { X } from './Y'` re-export chains up to `depth` levels (default 5) to find the original definition file. Used by the indexer to trace barrel file re-exports.

The indexer calls the resolver after all files are parsed. It passes each file's `ExtractedImport[]` through `resolveImportPath()` to get target file paths, then links symbol names to DB symbol IDs.

**Resolution priority (spec Section 4):**
1. **Relative paths** — `path.resolve()` against source file dir
2. **tsconfig paths** — expand `compilerOptions.paths` aliases against `baseUrl`
3. **Workspace packages** — `package_name -> package_root` map from workspaces config
4. **Barrel re-exports** — follow chains up to depth 5 via `resolveExportChain()`
5. **Skip node_modules and builtins** — return null

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/core/resolver.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/core/resolver.ts tests/core/resolver.test.ts tests/fixtures/monorepo/
git commit -m "feat: add cross-file import resolver with tsconfig and workspace support"
```

---

## Task 8: Indexer Pipeline

**Files:**
- Create: `src/core/indexer.ts`

- [ ] **Step 1: Write failing integration test**

```typescript
// tests/integration/index-and-query.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Indexer } from '../../src/core/indexer.js';
import { Database } from '../../src/core/db.js';
import { QueryEngine } from '../../src/core/query-engine.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Indexer + QueryEngine integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-int-'));
    fs.cpSync(path.resolve('tests/fixtures/simple-ts'), tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('indexes a TS project and answers caller queries', () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();

    const db = new Database(tmpDir);
    const qe = new QueryEngine(db);

    // main() calls calculate(), calculate() calls add() and multiply()
    const callersOfAdd = qe.callers('add', undefined, 3);
    expect(Array.isArray(callersOfAdd)).toBe(true);
    expect(callersOfAdd.length).toBeGreaterThanOrEqual(1);

    // Direct caller of add is calculate
    expect(callersOfAdd.some((r: any) => r.symbolName === 'calculate')).toBe(true);

    db.close();
  });

  it('reports correct status after indexing', () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();

    const db = new Database(tmpDir);
    const status = db.getStatus();
    expect(status.totalFiles).toBe(3); // math.ts, calculator.ts, index.ts
    expect(status.totalSymbols).toBeGreaterThanOrEqual(5);
    expect(status.languages.typescript).toBe(3);

    db.close();
  });

  it('incremental index only re-processes changed files', () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();

    // Modify one file
    const mathPath = path.join(tmpDir, 'src', 'math.ts');
    fs.appendFileSync(mathPath, '\nexport function subtract(a: number, b: number) { return a - b; }\n');

    const stats = indexer.index({ incremental: true });
    expect(stats.filesProcessed).toBe(1); // Only math.ts changed

    const db = new Database(tmpDir);
    const results = db.searchSymbols('subtract');
    expect(results).toHaveLength(1);

    db.close();
  });

  it('tsconfig change triggers full re-index', () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();

    // Modify tsconfig.json (e.g., add a path alias)
    const tsconfigPath = path.join(tmpDir, 'tsconfig.json');
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
    tsconfig.compilerOptions.paths = { '@/*': ['./src/*'] };
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig));

    // Incremental should detect config change and do full re-index
    const stats = indexer.index({ incremental: true });
    expect(stats.filesProcessed).toBe(3); // ALL files re-indexed, not just 0
  });

  it('barrel file export change re-indexes dependents', () => {
    const indexer = new Indexer(tmpDir);
    indexer.index();

    // Modify index.ts barrel to remove an export
    const indexPath = path.join(tmpDir, 'src', 'index.ts');
    fs.writeFileSync(indexPath, `export function main() { return 1; }\n`);

    const stats = indexer.index({ incremental: true });
    // index.ts changed — at minimum that file should be re-processed
    expect(stats.filesProcessed).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/index-and-query.test.ts`
Expected: FAIL — Indexer not found

- [ ] **Step 3: Implement indexer.ts**

The `Indexer` class orchestrates an **8-step hybrid pipeline**:

1. **Discover** — glob for files matching registered extractor extensions, respecting `.gitignore`
2. **Config check** — hash `tsconfig.json`, root `package.json`, `pnpm-workspace.yaml`. Compare with stored `config_fingerprints`. If ANY config changed, invalidate ALL files (full re-index) since path aliases, workspace resolution, and barrel chains may have shifted.
3. **Diff** — compute SHA-256 hash of each file, compare with stored hashes, skip unchanged files in incremental mode
4. **Parse (Tree-sitter)** — parse each file's source with native Tree-sitter, extract symbols (with `qualified_name`, `container_name`) and syntactic edges (`confidence: 'syntactic'`)
5. **Parse (TS LanguageService)** — for TS/JS files, run `TSService.getIncomingCalls()` / `getOutgoingCalls()` to produce semantic edges (`confidence: 'semantic'`). Semantic edges **overwrite** syntactic edges for the same source/target pair.
6. **Resolve** — run the resolver to link cross-file import references
7. **Persist** — within a single transaction: upsert files, insert symbols with `symbol_uid`, insert edges with confidence, insert file deps
8. **Cleanup** — remove DB entries for files that no longer exist on disk (CASCADE)

Returns `{ filesProcessed, symbolsFound, syntacticEdges, semanticEdges }` stats.

For incremental mode: use hash comparison + git diff to find changed files. Delete old symbols/edges for changed files before reinserting. If config fingerprints changed, do full re-index.

**Git integration:**
- After indexing, store `git rev-parse HEAD` in `meta.last_indexed_commit` and timestamp in `meta.last_indexed_at`.
- For incremental mode, also check `git diff --name-only <last_indexed_commit>` to discover changed files.
- If no git repo is detected, fall back to hash-only comparison.
- Integration test must verify `meta.last_indexed_commit` is set after full index.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/integration/index-and-query.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/indexer.ts tests/integration/
git commit -m "feat: add indexer pipeline with incremental support"
```

---

## Task 9: MCP Server

**Files:**
- Create: `src/mcp/server.ts`

- [ ] **Step 1: Implement MCP server**

Use `@modelcontextprotocol/sdk` to create a stdio server with 6 tools matching the JSON Schemas from the spec (Section 5). Each tool handler:

1. Opens the Database for the `--project` directory (defaults to `process.cwd()`)
2. Creates a QueryEngine
3. Runs the appropriate query
4. Formats the result using the formatter
5. Returns **dual output**: `content[].text` (Markdown summary) + `structuredContent` (JSON graph data). Define `outputSchema` on each tool for typed JSON validation.

Handle errors gracefully — if no `.codegraph/graph.db` exists, return a helpful message suggesting `codegraph index`.

The 5-second timeout per query is implemented by wrapping each query in a Promise.race with a timeout rejection.

Register all 6 tools with their JSON Schemas, **updated to include `qualified_name` and `symbol_uid`** as optional disambiguation inputs alongside `symbol` and `file`:

```json
{
  "codegraph_callers": {
    "properties": {
      "symbol": { "type": "string", "description": "Symbol name to find callers of" },
      "file": { "type": "string", "description": "File path to disambiguate" },
      "qualified_name": { "type": "string", "description": "Qualified name (e.g., 'Foo.render') for same-file disambiguation" },
      "symbol_uid": { "type": "string", "description": "Exact symbol UID for unambiguous lookup" },
      "depth": { "type": "integer", "minimum": 1, "maximum": 15, "default": 5 }
    },
    "anyOf": [
      { "required": ["symbol_uid"] },
      { "required": ["qualified_name", "file"] },
      { "required": ["symbol"] }
    ]
  }
}
```

Schema uses `anyOf` — callers can provide: `symbol_uid` alone (exact), `qualified_name + file` (class-level disambiguation), or `symbol` (may require further disambiguation).
Lookup priority in handler: `symbol_uid` (exact) > `qualified_name + file` > `symbol + file` > `symbol` (may disambiguate).
Same pattern for `codegraph_callees` and `codegraph_blast`. The tool names include the `codegraph_` prefix.

**Important:** `server.ts` must serve dual roles:
- Export `createToolHandlers(projectDir: string)` for unit testing (returns an object with handler functions).
- Export `startServer(projectDir: string)` that creates the MCP stdio transport and connects handlers.
- The `mcp-cmd.ts` CLI command calls `startServer()`. Tests call `createToolHandlers()` directly.

- [ ] **Step 2: Write tool handler tests**

```typescript
// tests/mcp/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createToolHandlers } from '../../src/mcp/server.js';
import { Indexer } from '../../src/core/indexer.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('MCP Tool Handlers', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-mcp-'));
    fs.cpSync(path.resolve('tests/fixtures/simple-ts'), tmpDir, { recursive: true });
    const indexer = new Indexer(tmpDir);
    indexer.index();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Handlers return { content: TextContent[], structuredContent?: object }
  // matching the MCP tool response shape. Tests validate both layers.

  it('codegraph_status returns indexed file count in both formats', async () => {
    const handlers = createToolHandlers(tmpDir);
    const result = await handlers.codegraph_status({});
    // Markdown layer
    expect(result.content).toBeDefined();
    expect(result.content[0].text).toContain('3 files');
    // Structured layer
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.totalFiles).toBe(3);
  });

  it('codegraph_search finds symbols by name', async () => {
    const handlers = createToolHandlers(tmpDir);
    const result = await handlers.codegraph_search({ query: 'add' });
    expect(result.content[0].text).toContain('add');
    expect(result.structuredContent.symbols.length).toBeGreaterThanOrEqual(1);
  });

  it('returns helpful error when no index exists', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-empty-'));
    const handlers = createToolHandlers(emptyDir);
    const result = await handlers.codegraph_status({});
    expect(result.content[0].text).toContain('codegraph index');
    fs.rmSync(emptyDir, { recursive: true, force: true });
  });
});
```

Export `createToolHandlers` from `src/mcp/server.ts` so it can be tested without starting stdio transport.

- [ ] **Step 3: Run MCP tests**

Run: `npx vitest run tests/mcp/server.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Write MCP smoke test (real stdio)**

```typescript
// tests/mcp/smoke.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { Indexer } from '../../src/core/indexer.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('MCP Smoke Test', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codegraph-smoke-'));
    fs.cpSync(path.resolve('tests/fixtures/simple-ts'), tmpDir, { recursive: true });
    const indexer = new Indexer(tmpDir);
    indexer.index();
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('responds to initialize request via stdio', async () => {
    // Use spawn (not execFileSync) because MCP stdio servers are long-lived —
    // they respond then wait for more input. We send initialize, read the
    // response, then kill the process.
    const proc = spawn('node', ['dist/cli/index.js', 'mcp', '--project', tmpDir]);

    const response = await new Promise<string>((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => { proc.kill(); reject(new Error('MCP server timeout')); }, 5000);

      proc.stdout.on('data', (data: Buffer) => {
        output += data.toString();
        // MCP stdio sends newline-delimited JSON — look for a complete response
        if (output.includes('"result"')) {
          clearTimeout(timeout);
          proc.kill();
          resolve(output);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        // stderr is for logs, ignore
      });

      proc.on('error', (err) => { clearTimeout(timeout); reject(err); });

      // Send initialize request
      const msg = JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: { capabilities: {} }, id: 1 });
      proc.stdin.write(msg + '\n');
    });

    expect(response).toContain('"jsonrpc"');
    expect(response).toContain('"result"');
  });
});
```

- [ ] **Step 5: Run smoke test**

Run: `npm run build && npx vitest run tests/mcp/smoke.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mcp/server.ts tests/mcp/
git commit -m "feat: add MCP stdio server with 6 tools and dual output"
```

---

## Task 10: CLI Commands

**Files:**
- Create: `src/cli/index.ts`, `src/cli/commands/index-cmd.ts`, `src/cli/commands/mcp-cmd.ts`, `src/cli/commands/query-cmd.ts`, `src/cli/commands/status-cmd.ts`, `src/cli/commands/reset-cmd.ts`

- [ ] **Step 1: Implement CLI entry point**

```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { registerIndexCmd } from './commands/index-cmd.js';
import { registerMcpCmd } from './commands/mcp-cmd.js';
import { registerQueryCmd } from './commands/query-cmd.js';
import { registerStatusCmd } from './commands/status-cmd.js';
import { registerResetCmd } from './commands/reset-cmd.js';

const program = new Command()
  .name('codegraph')
  .description('Code intelligence — call-chain analysis, blast radius, dependency graph queries')
  .version('1.0.0');

registerIndexCmd(program);
registerMcpCmd(program);
registerQueryCmd(program);
registerStatusCmd(program);
registerResetCmd(program);

program.parse();
```

- [ ] **Step 2: Implement each command**

Each command file exports a `register*Cmd(program: Command)` function:

- **index-cmd.ts** — `codegraph index [--project .] [--incremental]`. Creates an `Indexer` and runs `index()`. Prints stats to stdout. Note: `--sqlite-wasm` is deferred to Phase 2 — do not implement this flag.
- **mcp-cmd.ts** — `codegraph mcp [--project .]`. Starts the MCP stdio server. `--project` defaults to `process.cwd()`.
- **query-cmd.ts** — `codegraph query <tool> [symbol] [--project .] [--file] [--qualified-name] [--uid] [--depth] [--direction] [--kind] [--json]`. Opens DB, creates QueryEngine, runs the named query. Disambiguation: `--uid` (exact) > `--qualified-name + --file` > `symbol + --file` > `symbol` (may disambiguate). Output: Markdown by default, JSON with `--json`. Tool names strip `codegraph_` prefix (see spec Section 9).
- **status-cmd.ts** — `codegraph status [--project .] [--check-file <path>]`. Prints index status. `--check-file` computes the SHA-256 of the given file and compares with the DB — outputs "stale" or "current" (used by the PostToolUse hook).
- **reset-cmd.ts** — `codegraph reset [--project .]`. Deletes `.codegraph/` directory, then runs full index.

All commands use `--project` consistently to specify the project root (defaults to `process.cwd()`).

- [ ] **Step 3: Build and test CLI manually**

```bash
npm run build
node dist/cli/index.js --help
node dist/cli/index.js index --project tests/fixtures/simple-ts
node dist/cli/index.js status --project tests/fixtures/simple-ts
node dist/cli/index.js query callers add --project tests/fixtures/simple-ts
```

Expected: Help text, successful index, status output, query results in Markdown

- [ ] **Step 4: Commit**

```bash
git add src/cli/
git commit -m "feat: add CLI with index, mcp, query, status, and reset commands"
```

---

## Task 11: Hook Implementation

**Files:**
- Modify: `hooks/check-staleness.mjs`

- [ ] **Step 1: Implement the staleness check hook**

Replace the placeholder with a script that:
1. Receives the edited file path as argument
2. Runs `codegraph status --check-file <path>` via `execFileSync` (NOT `execSync` — avoids shell injection)
3. If the output indicates staleness, outputs a JSON notification to stdout
4. Timeout: 4 seconds (leaves 1s margin within the 5s hook timeout)

```javascript
#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const filePath = process.argv[2];
if (!filePath) process.exit(0);

try {
  // Use CLAUDE_PLUGIN_ROOT to find the built CLI — works in dev without npm publish
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');
  const cliPath = path.join(pluginRoot, 'dist', 'cli', 'index.js');
  const result = execFileSync('node', [cliPath, 'status', '--check-file', filePath], {
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
  // Silently ignore — codegraph not installed or no index
  process.exit(0);
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/check-staleness.mjs
git commit -m "feat: implement staleness check hook for PostToolUse"
```

---

## Task 12: Final Integration Test + Polish

- [ ] **Step 1: Build the package**

Run: `npm run build`
Expected: `dist/` created with compiled JS, no errors. Build MUST succeed before any smoke/E2E tests that depend on `dist/`.

- [ ] **Step 2: Run full test suite (unit + integration)**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Test the full CLI flow end-to-end (requires build from Step 1)**

```bash
# Index the simple-ts fixture
node dist/cli/index.js index --project tests/fixtures/simple-ts

# Query callers
node dist/cli/index.js query callers add --project tests/fixtures/simple-ts

# Query blast radius
node dist/cli/index.js query blast calculate --project tests/fixtures/simple-ts

# Check status
node dist/cli/index.js status --project tests/fixtures/simple-ts

# Reset and re-index
node dist/cli/index.js reset --project tests/fixtures/simple-ts
```

Verify each command produces sensible output matching the spec format.

- [ ] **Step 4: Update core barrel export**

Update the stub `src/core/index.ts` (created in Task 2) to re-export `Database`, `QueryEngine`, `Indexer` for programmatic use.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete CodeGraph Phase 1 — TS/JS indexing, MCP server, CLI"
```

---

## Deferred to Phase 2

- Python extractor (`src/extractors/python.ts`)
- Go extractor (`src/extractors/go.ts`)
- Rust extractor (`src/extractors/rust.ts`)
- `codegraph setup` command (auto-configure Claude Code, Codex, Cursor)
- `sql.js` WASM fallback (`--sqlite-wasm` flag)
- npm publish preparation (README, CI, release workflow)
- Test coverage mapping (`--COVERS-->` edges)
- Change coupling analysis (git log mining)
- Complexity hotspots (cyclomatic complexity x change frequency)
- Dead code detection (unreachable functions)
- DuckDB swap for deep recursion performance
- Vector embeddings for semantic search
