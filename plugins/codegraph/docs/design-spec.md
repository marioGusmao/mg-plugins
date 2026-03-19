# CodeGraph — Cross-Project Code Intelligence Plugin

> Design spec for a reusable code intelligence tool that provides call-chain analysis,
> blast radius queries, and dependency graph traversal via MCP — compatible with
> Claude Code, Codex CLI, Cursor, Windsurf, and any MCP-capable client.

**Date:** 2026-03-17
**Status:** Approved
**License:** MIT

---

## 1. Problem Statement

AI coding agents edit files without understanding the dependency graph. They lack the
ability to answer questions like:

- "Who calls this function?" (caller chains)
- "If I change this symbol, what breaks?" (blast radius)
- "What does this function depend on?" (callee chains)

Existing tools in AVShop2 (`dependency-cruiser`, `eslint-plugin-boundaries`) enforce
boundaries at the **file level** but don't provide **symbol-level** call-chain queries.
GitNexus solves this but has a noncommercial license, stability issues, and conflicts
with existing governance infrastructure.

## 2. Solution Overview

**CodeGraph** is an npm package (`codegraph`) with three entry points:

1. **CLI** — `codegraph index` to parse and index a codebase
2. **MCP Server** — `codegraph mcp` stdio server exposing query tools
3. **Adapters** — Optional per-platform integration (Claude Code plugin, Codex config, Cursor config)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CONSUMERS                         │
│                                                     │
│  Claude Code    Codex CLI    Cursor    Windsurf     │
│  (plugin +      (MCP via     (MCP     (MCP         │
│   skills/hooks)  .mcp.json)   config)  config)     │
└──────┬──────────────┬───────────┬────────┬──────────┘
       │              │           │        │
       ▼              ▼           ▼        ▼
┌─────────────────────────────────────────────────────┐
│              MCP SERVER (stdio)                      │
│                                                     │
│  Tools:                                             │
│  • codegraph_search     — find symbols by name/type │
│  • codegraph_callers    — who calls this symbol?    │
│  • codegraph_callees    — what does this call?      │
│  • codegraph_blast      — full impact radius        │
│  • codegraph_depends    — file dependency tree      │
│  • codegraph_status     — index freshness info      │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                  CORE ENGINE                         │
│                                                     │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │ Indexer    │  │ Query    │  │ Watcher         │ │
│  │ (Tree-     │→ │ Engine   │  │ (hash-based     │ │
│  │  sitter    │  │ (SQLite  │  │  staleness      │ │
│  │  WASM)     │  │  CTEs)   │  │  detection)     │ │
│  └────────────┘  └──────────┘  └─────────────────┘ │
└──────────────────────┬──────────────────────────────┘
                       │
              .codegraph/graph.db
              (SQLite per project)
```

### Design Principles

- **Core knows nothing about consumers** — MCP server is the only interface
- **Local-only** — no network calls, no telemetry, no data leaves the machine
- **Incremental** — hash-based staleness, only re-index changed files
- **Non-invasive** — never auto-modifies CLAUDE.md, AGENTS.md, or user configs without explicit `codegraph setup`
- **MIT licensed** — no commercial restrictions

## 3. Data Model (SQLite)

Storage: `.codegraph/graph.db` (one per project root).

```sql
-- Metadata
CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT
);
-- Keys: 'last_indexed_commit', 'last_indexed_at', 'schema_version'

-- Indexed files
CREATE TABLE files (
  id          INTEGER PRIMARY KEY,
  path        TEXT UNIQUE,          -- relative to project root
  language    TEXT,                 -- 'typescript', 'python', 'go', ...
  hash        TEXT,                 -- SHA-256 of file content (staleness)
  indexed_at  INTEGER               -- unix timestamp
);

-- Symbols (functions, classes, methods, exports)
CREATE TABLE symbols (
  id          INTEGER PRIMARY KEY,
  file_id     INTEGER REFERENCES files ON DELETE CASCADE,
  name        TEXT,
  kind        TEXT,                 -- 'function', 'class', 'method', 'variable', 'type', 'export'
  line_start  INTEGER,
  line_end    INTEGER,
  exported    BOOLEAN DEFAULT FALSE,
  UNIQUE(file_id, name, kind, line_start)
);

-- Relationships between symbols
CREATE TABLE edges (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER REFERENCES symbols ON DELETE CASCADE,
  target_id   INTEGER REFERENCES symbols ON DELETE CASCADE,
  kind        TEXT                  -- 'calls', 'imports', 'extends', 'implements', 'uses_type'
);

-- File-level dependencies
CREATE TABLE file_deps (
  id          INTEGER PRIMARY KEY,
  source_id   INTEGER REFERENCES files ON DELETE CASCADE,
  target_id   INTEGER REFERENCES files ON DELETE CASCADE,
  kind        TEXT                  -- 'import', 'require', 'dynamic_import'
);

-- Indices
CREATE INDEX idx_symbols_name ON symbols(name);
CREATE INDEX idx_symbols_file ON symbols(file_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_hash ON files(hash);
CREATE INDEX idx_file_deps_source ON file_deps(source_id);
CREATE INDEX idx_file_deps_target ON file_deps(target_id);
```

### Example: Recursive Caller Query (with cycle detection)

```sql
-- The depth cap (c.depth < 10) is the primary cycle terminator —
-- without it, cycles (A→B→A) would produce rows at increasing depths.
-- UNION deduplicates identical (source_id, depth) pairs from different
-- traversal paths. GROUP BY + MIN(depth) in the outer SELECT collapses
-- each symbol to its shallowest reachable depth.
WITH RECURSIVE callers AS (
  SELECT source_id, 1 AS depth
  FROM edges
  WHERE target_id = ? AND kind = 'calls'
  UNION
  SELECT e.source_id, c.depth + 1
  FROM edges e JOIN callers c ON e.target_id = c.source_id
  WHERE e.kind = 'calls' AND c.depth < ?  -- bound to Math.min(userDepth, 15)
)
SELECT s.name, f.path, s.line_start, MIN(c.depth) AS depth
FROM callers c
JOIN symbols s ON s.id = c.source_id
JOIN files f ON f.id = s.file_id
GROUP BY c.source_id
ORDER BY depth, f.path;
```

**Cycle handling:** The `depth < 10` cap is the primary cycle guard — it stops
recursion regardless of graph shape. `UNION` (not `UNION ALL`) deduplicates
identical `(source_id, depth)` pairs that arise from different traversal paths
to the same node at the same depth. The outer `GROUP BY` + `MIN(depth)` collapses
each symbol to a single row at its shallowest reachable depth. **Do not remove
the depth cap** — `UNION` alone cannot prevent cycles between symbols reachable
at different depths (e.g., `A→B→A` produces rows `(A,1)`, `(B,2)`, `(A,3)`).

**Depth binding:** The CTE depth parameter is user-supplied (via MCP tool `depth` field)
and capped at 15 at the query engine layer: `Math.min(userDepth ?? 5, 15)`. The `?`
placeholder in the CTE is bound to this capped value. Default is 5, maximum is 15.

Estimated DB size: 5-15 MB for a project like AVShop2. Negligible.

### Schema Versioning

The `meta` table stores `schema_version` as `MAJOR.MINOR` (e.g., `1.0`). On startup,
the MCP server and CLI compare the DB's `schema_version` against the binary's expected
version:

- **Match:** proceed normally
- **Minor mismatch** (e.g., DB is `1.0`, binary expects `1.1`): auto-migrate (additive
  columns only — `ALTER TABLE ADD COLUMN` is safe in SQLite)
- **Major mismatch** (e.g., DB is `1.x`, binary expects `2.x`): emit clear error
  and prompt `codegraph reset` to rebuild the index from scratch

This is appropriate for a local dev tool — the DB is a cache that can always be
rebuilt from source code. No complex migration framework needed.

## 4. Indexer Pipeline

```
codegraph index [--path .] [--incremental]
    │
    ├─ 1. Discover: glob for files by language (respects .gitignore)
    ├─ 2. Diff: compare SHA-256 hash with files.hash in DB
    │      └─ --incremental: only re-index changed files
    ├─ 3. Parse: Tree-sitter WASM per file
    │      └─ Extract: functions, classes, methods, exports, imports
    ├─ 4. Resolve: link cross-file references
    │      └─ import { X } from './foo' → edge(imports, X_caller, X_def)
    ├─ 5. Persist: upsert to SQLite (single transaction per batch)
    └─ 6. Cleanup: remove entries for deleted files (CASCADE)
```

### Language Extractors

Each language has an extractor module implementing a common interface:

```typescript
interface LanguageExtractor {
  language: string;
  extensions: string[];
  extractSymbols(tree: Tree, source: string): Symbol[];
  extractEdges(tree: Tree, source: string, symbolMap: Map<string, Symbol>): Edge[];
}
```

### Supported Languages (phased)

| Language | Tree-sitter Grammar | Priority |
|----------|-------------------|----------|
| TypeScript/TSX | `tree-sitter-typescript` | P0 |
| JavaScript/JSX | `tree-sitter-javascript` | P0 |
| Python | `tree-sitter-python` | P1 |
| Go | `tree-sitter-go` | P2 |
| Rust | `tree-sitter-rust` | P2 |

### Cross-File Resolution

The resolver links import statements to their target symbol definitions. This is
the most complex step in the pipeline and the foundation for accurate cross-file edges.

**Resolution strategy (ordered by priority):**

1. **Relative paths** — `./foo`, `../bar` resolved directly against the filesystem
2. **tsconfig paths** — Load `tsconfig.json` (+ `extends` chain), parse `compilerOptions.paths` and `baseUrl`. Map `@/modules/*` → `src/modules/*`, `@shared-ui/*` → `packages/shared-ui/src/*`
3. **pnpm/npm workspace packages** — Parse root `package.json` `workspaces` field (or `pnpm-workspace.yaml`). For each workspace, read its `package.json` `name` field to build `package_name → package_root` map. Resolve `@avshop2/shared-types` → `packages/shared-types/src/index.ts`
4. **Barrel file re-exports** — Follow `export { X } from './Y'` chains up to 5 levels deep at indexing time (enforced in `resolver.ts`). If a barrel file re-exports from another barrel, resolve transitively. Chains beyond depth 5 are not indexed and will not appear as edges — no indication is stored in the DB for truncated chains.
5. **Node.js built-ins and node_modules** — Skip (not indexed). Create no edge.

**Build phase:**
1. First pass: collect all exported symbols across all files → `export_name → symbol_id` map
2. Second pass: for each import statement, resolve the path using the strategy above, then look up the target symbol in the export map
3. Create `imports` edges for symbol references and `calls` edges for invocations

**Accepted limitation:** Dynamic imports (`import()`), computed re-exports (`export * from`
in complex chains beyond depth 5), and CommonJS `require()` with variable paths may fail.
~90% accuracy accepted in exchange for simplicity.

### Performance Targets

- Full index (AVShop2-scale): 1-3 seconds
- Incremental (3-5 files): < 200ms

## 5. MCP Server

**Transport:** stdio (universal — works with any MCP client).

**Project discovery:** Receives working directory as argument, looks for `.codegraph/graph.db`. If missing, returns friendly error suggesting `codegraph index`.

### Tools

| Tool | Input | Output |
|------|-------|--------|
| `codegraph_search` | `query: string, kind?: string` | Symbol list with file + line |
| `codegraph_callers` | `symbol: string, file?: string, depth?: number (default 5)` | Recursive caller tree |
| `codegraph_callees` | `symbol: string, file?: string, depth?: number (default 5)` | Recursive callee tree |
| `codegraph_blast` | `symbol: string, file?: string, depth?: number (default 5)` | Callers + callees + affected files (deduplicated union) |
| `codegraph_depends` | `file: string, direction?: 'in'\|'out'\|'both'` | File dependency tree |
| `codegraph_status` | — | Indexed files, stale count, last indexed, languages |

### Tool Input Schemas (JSON Schema)

```json
{
  "codegraph_search": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Symbol name or substring to search" },
      "kind": { "type": "string", "enum": ["function", "class", "method", "variable", "type", "export"], "description": "Filter by symbol kind" }
    },
    "required": ["query"]
  },
  "codegraph_callers": {
    "type": "object",
    "properties": {
      "symbol": { "type": "string", "description": "Symbol name to find callers of" },
      "file": { "type": "string", "description": "File path to disambiguate (required when multiple symbols share the same name)" },
      "depth": { "type": "integer", "minimum": 1, "maximum": 15, "default": 5, "description": "Max recursion depth" }
    },
    "required": ["symbol"]
  },
  "codegraph_callees": {
    "type": "object",
    "properties": {
      "symbol": { "type": "string", "description": "Symbol name to find callees of" },
      "file": { "type": "string", "description": "File path to disambiguate" },
      "depth": { "type": "integer", "minimum": 1, "maximum": 15, "default": 5 }
    },
    "required": ["symbol"]
  },
  "codegraph_blast": {
    "type": "object",
    "properties": {
      "symbol": { "type": "string", "description": "Symbol name to compute blast radius for" },
      "file": { "type": "string", "description": "File path to disambiguate" },
      "depth": { "type": "integer", "minimum": 1, "maximum": 15, "default": 5 }
    },
    "required": ["symbol"]
  },
  "codegraph_depends": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "File path (relative to project root)" },
      "direction": { "type": "string", "enum": ["in", "out", "both"], "default": "both" }
    },
    "required": ["file"]
  },
  "codegraph_status": {
    "type": "object",
    "properties": {},
    "required": [],
    "additionalProperties": false
  }
}
```

### Symbol Disambiguation

When multiple symbols match a name query (e.g., `useAuth` exists in 3 files), the tool
returns a "disambiguation required" response listing all matches:

```markdown
## Multiple symbols found for `useAuth`

1. `useAuth` (function) → apps/shop/src/modules/auth/hooks/useAuth.ts:5
2. `useAuth` (function) → apps/admin/src/modules/auth/hooks/useAuth.ts:3
3. `useAuth` (export) → packages/shared-utils/src/auth/index.ts:12

Re-query with `file` parameter to select a specific symbol.
```

The agent must re-query with `symbol` + `file` to get unambiguous results.

### codegraph_blast Behavior

`codegraph_blast` is a convenience wrapper that returns the union of callers (depth N)
and callees (depth N) with deduplication by `symbol_id`, plus an impact summary
aggregating affected files and modules. It does not perform any analysis beyond
the union — it is strictly `callers ∪ callees` with a formatted summary.

### Response Format

Structured Markdown (not raw JSON) — immediately useful to AI agents:

```markdown
## Callers of `processPayment` (apps/shop/src/modules/checkout/services/payment.ts:42)

### Direct (depth 1)
- `handleCheckout` → apps/shop/src/modules/checkout/actions/checkout.ts:18
- `retryPayment` → apps/shop/src/modules/checkout/actions/retry.ts:7

### Indirect (depth 2)
- `CheckoutPage.onSubmit` → apps/shop/src/modules/checkout/components/CheckoutForm.tsx:55
  ↳ calls `handleCheckout` ↳ calls `processPayment`

### Impact summary
- 3 symbols across 3 files affected
- Modules: checkout
- Apps: shop
```

### Safety Limits

- `depth` capped at 15 (prevents infinite traversal on cycles)
- 5-second timeout per query
- Results capped at 200 symbols (with truncation message)

## 6. Platform Adapters

### Claude Code — Plugin

Uses the Claude Code plugin format as defined by the `plugin-dev:plugin-structure`
skill (Claude Code v1.0.x+). The `.claude-plugin/plugin.json` manifest declares
plugin metadata; `skills/`, `hooks/`, and `mcp/` directories are auto-discovered:

```
codegraph-plugin/
├── .claude-plugin/
│   └── plugin.json            # Plugin manifest (name, description, version, author)
├── skills/
│   └── codegraph/
│       └── SKILL.md           # Guides agent to use blast/callers before refactoring
├── hooks/
│   └── hooks.json             # PostToolUse on Edit/Write → staleness check
└── mcp/
    └── mcp.json               # Registers stdio MCP server
```

**plugin.json:**
```json
{
  "name": "codegraph",
  "description": "Code intelligence — call-chain analysis, blast radius, dependency graph queries via MCP",
  "version": "1.0.0",
  "author": { "name": "MRM" }
}
```

**Skill (`SKILL.md`):** Invoked when the agent needs to understand impact before editing. Guides
the agent to use `codegraph_blast` before refactorings and `codegraph_callers` before
changing signatures.

**Hook (`hooks.json` — PostToolUse on Edit/Write):** After file edit, checks if hash
changed vs DB. If stale, surfaces a notification. Does NOT auto-reindex (avoids
latency surprises). Uses a shell command hook that runs `codegraph status --check-file <path>`
and returns a staleness notification if the file's hash differs from the index.

**MCP config (`mcp.json`):**
```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "npx",
      "args": ["codegraph", "mcp", "--project", "${CLAUDE_PROJECT_DIR}"]
    }
  }
}
```

### Codex CLI

Integration via project-level config:

- **`.mcp.json`** at project root (Codex reads MCP configs from here)
- **`AGENTS.md`** section with instructions for agents to use codegraph tools

```json
{
  "codegraph": {
    "type": "stdio",
    "command": "npx",
    "args": ["codegraph", "mcp"]
  }
}
```

**Note:** `--project` is omitted because Codex sets the working directory via `cwd`.
The MCP server defaults to `process.cwd()` when `--project` is not provided.

### Cursor / Windsurf

Standard MCP config in `.cursor/mcp.json` or equivalent.

### Setup Command

```
codegraph setup [--claude|--codex|--cursor|--all]
  ├─ Detects Claude Code? → installs plugin or suggests installation
  ├─ Detects .codex/?     → writes .mcp.json + patches AGENTS.md
  ├─ Detects .cursor/?    → writes .cursor/mcp.json
  └─ Detects .windsurf/?  → writes equivalent config
```

**Rule:** `codegraph setup` never overwrites existing configs — merges or prompts.

## 7. Staleness Detection

**Strategy: hash-based, no file watchers.**

No `fs.watch` or `chokidar` (memory-hungry, problematic in large monorepos). Instead:

### Three detection layers

1. **Hook trigger (PostToolUse Edit)** — compares file hash vs DB. Stale? Notifies.
2. **MCP query-time check (lazy)** — `codegraph_status` returns stale_files count. Any tool can prefix "Warning: Index has 3 stale files".
3. **Git-based (pre-query)** — `git diff --name-only HEAD` vs `meta.last_indexed_commit`. If diff > 0, warns.

### Incremental Reindex

```
codegraph index --incremental
    │
    ├─ 1. git diff --name-only since last indexed commit
    ├─ 2. Filter for supported file extensions
    ├─ 3. For each changed file:
    │      ├─ Remove old symbols + edges for that file_id
    │      ├─ Re-parse with Tree-sitter
    │      └─ Re-insert symbols + edges
    ├─ 4. For deleted files:
    │      └─ CASCADE delete (file → symbols → edges)
    └─ 5. Update meta.last_indexed_commit
```

**Performance:** Incremental on 3-5 files < 200ms. Non-blocking.

**Rule:** Reindexing is never automatic and silent. The hook warns about staleness;
the agent or user decides when to reindex.

## 8. Package Structure

```
codegraph/
├── package.json
├── src/
│   ├── cli/
│   │   ├── index.ts
│   │   └── commands/
│   │       ├── index-cmd.ts
│   │       ├── mcp-cmd.ts
│   │       ├── query-cmd.ts
│   │       ├── setup-cmd.ts
│   │       └── status-cmd.ts
│   ├── core/
│   │   ├── indexer.ts           # Pipeline orchestration
│   │   ├── db.ts                # SQLite wrapper (better-sqlite3)
│   │   ├── resolver.ts          # Cross-file import resolution
│   │   └── query-engine.ts      # CTE query builders
│   ├── extractors/
│   │   ├── extractor.ts         # Base interface
│   │   ├── typescript.ts
│   │   ├── python.ts
│   │   └── go.ts
│   ├── mcp/
│   │   └── server.ts            # MCP server stdio
│   └── adapters/
│       ├── claude-plugin/       # Plugin template files
│       ├── codex/               # AGENTS.md + .mcp.json templates
│       └── cursor/              # .cursor/mcp.json template
├── grammars/                    # Tree-sitter WASM binaries
│   ├── tree-sitter-typescript.wasm
│   ├── tree-sitter-python.wasm
│   └── tree-sitter-go.wasm
└── tests/
    ├── fixtures/                # Synthetic test repos
    └── *.test.ts                # Vitest
```

### Core Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `tree-sitter` + grammar packages | AST parser (native bindings, 3-5x faster than WASM) | ~2MB |
| `better-sqlite3` | Embedded SQLite (native bindings) | ~2MB |
| `@modelcontextprotocol/sdk` | MCP server stdio | ~100KB |
| `commander` | CLI framework | ~50KB |
| `glob` | File discovery | ~30KB |

**Note on native dependencies:** Both `tree-sitter` and `better-sqlite3` require native
compilation (`node-gyp`). Prebuild binaries for `better-sqlite3` are available
for linux-x64, darwin-arm64, darwin-x64, and win32-x64 on Node.js 18/20/22/24.
If a prebuild is unavailable (uncommon platform or CI without build tools), the
package falls back to compiling from source via `node-gyp` (requires Python + C++ toolchain).

**Fallback strategy:** If `better-sqlite3` fails to load at runtime, CodeGraph emits
a human-readable error with installation instructions and suggests `sql.js` as a
WASM-based alternative (3-5x slower but zero native deps). The `sql.js` fallback is
not bundled by default — it requires `codegraph index --sqlite-wasm` opt-in flag.
This keeps the default path fast while providing an escape hatch for constrained
environments.

## 9. CLI Commands

```
codegraph index [--path .] [--incremental] [--sqlite-wasm]  # Index project
codegraph mcp [--project .]                       # Start MCP server (stdio)
codegraph query <tool> [args...]                  # Run MCP tool from terminal (see below)
codegraph setup [--claude|--codex|--cursor|--all] # Auto-configure tools
codegraph status                                  # Index status
codegraph reset                                   # Delete .codegraph/ and re-index
```

**`codegraph query` syntax:** Exposes MCP tools directly from the terminal. The `<tool>`
argument is one of the MCP tool names with the `codegraph_` prefix stripped
(i.e., `codegraph_callers` → `callers`; see Section 5 for full tool definitions).
Arguments map to tool input fields:

```bash
codegraph query callers processPayment                          # by name
codegraph query callers processPayment --file src/checkout.ts   # disambiguated
codegraph query blast useAuth --depth 10                        # custom depth
codegraph query depends src/modules/auth/index.ts --direction in
codegraph query search "payment" --kind function
```

Output defaults to Markdown (same as MCP response). Add `--json` for machine-readable output.

## 10. Testing Strategy

- **Unit tests (Vitest):** Extractors, query engine, resolver — tested against synthetic fixture repos
- **Integration tests:** Full index → query pipeline on real-world-like repo structures
- **Fixture repos:** Small synthetic repos per language with known call graphs, used to assert query correctness
- **No E2E MCP tests initially** — trust the MCP SDK; test the query engine directly

## 11. Known Limitations (Accepted)

| Limitation | Mitigation |
|-----------|------------|
| Dynamic imports may not resolve | Accept ~90% accuracy; document in tool responses |
| Complex re-exports through barrel files | Best-effort resolution up to depth 5 at indexing time; chains beyond depth 5 produce no edge (silent truncation) |
| Tree-sitter WASM is 3-5x slower than native | Acceptable for dev tooling; full index still < 5s |
| `better-sqlite3` requires native compilation | Standard for Node.js tooling; prebuild binaries available |
| No type-level analysis (generics, overloads) | Out of scope; would require TypeScript Compiler API |
| Monorepo cross-package resolution | Resolve workspace paths via package.json workspaces field |

## 12. Out of Scope

- Semantic/embedding search (vector similarity)
- Web UI / visualization
- CI integration (linting based on graph)
- Real-time file watching (use hash-based staleness instead)
- Type-aware analysis (generics resolution, type narrowing)
