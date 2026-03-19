# CodeGraph

> Code intelligence for AI agents — call-chain analysis, blast radius, dependency graphs, and codebase briefings via MCP.

CodeGraph indexes TypeScript/JavaScript codebases into a SQLite knowledge graph and exposes it through MCP tools that any AI coding agent can use. It answers questions like *"who calls this function?"*, *"what breaks if I change this?"*, and *"give me a complete mental model of this codebase"*.

## Why CodeGraph Exists

AI coding agents edit files without understanding the dependency graph. They rename a function without knowing 15 other files depend on it. They refactor a method without seeing the class hierarchy. They make locally sensible changes that break the system globally.

Existing tools like `dependency-cruiser` and `eslint-plugin-boundaries` enforce boundaries at the **file level**, but they can't answer **symbol-level** questions: *"who calls `processPayment`?"* or *"what's the blast radius if I change `useAuth`?"*

[GitNexus](https://github.com/abhigyanpatwari/GitNexus) solves a similar problem but has a noncommercial license (PolyForm), stability issues (segfaults), and aggressively modifies `CLAUDE.md`/`AGENTS.md`. CodeGraph is MIT-licensed, non-invasive, and designed to complement existing tooling.

## Architecture Decisions

### Why Hybrid Indexing (Tree-sitter + TypeScript LanguageService)

We evaluated three approaches:

| Approach | Accuracy | Speed | Multi-language |
|----------|----------|-------|---------------|
| Tree-sitter only | ~70% (syntactic) | Very fast | Yes (200+ languages) |
| TypeScript Compiler API only | ~95% (semantic) | Slow (5-20s for 1000 files) | TS/JS only |
| **Hybrid (our choice)** | **~90%** | **Fast (1-3s)** | **TS/JS semantic + others syntactic** |

Tree-sitter does a fast structural pass (functions, classes, imports, call expressions) producing **syntactic edges**. The TypeScript LanguageService then adds **semantic edges** via `prepareCallHierarchy`/`provideCallHierarchyIncomingCalls` — resolving method calls through inheritance, generics, and overloads that Tree-sitter cannot see.

Semantic edges **overwrite** syntactic edges for the same source/target pair. A `confidence` column on every edge tracks which pipeline produced it.

### Why Native Tree-sitter (not WASM)

The original plan used `web-tree-sitter` (WASM). Research revealed that:
- WASM grammar files **don't ship** in the `tree-sitter-typescript` npm package — they need to be compiled or sourced separately
- Version compatibility between `web-tree-sitter` and grammar WASM files is fragile
- CodeGraph never runs in a browser — WASM portability provides no value
- Native bindings are **3-5x faster**
- `better-sqlite3` already requires native compilation, so there is no new risk category

### Why SQLite (not a Graph Database)

We evaluated SQLite, DuckDB, CozoDB, KuzuDB, and Graphology:

- **SQLite** with recursive CTEs handles call-chain traversal well for codebases up to ~100K symbols
- **DuckDB**'s `USING KEY` CTEs would be better for deep recursion but add a ~20MB dependency
- **CozoDB** (Datalog) is theoretically ideal for graph queries but has a small ecosystem
- **KuzuDB** was archived by its maintainers in Oct 2025

SQLite is the pragmatic choice: single file, zero config, bomb-proof. The depth cap (`MAX_DEPTH=15`) in CTEs prevents runaway queries. A `UNIQUE INDEX ON edges(source_uid, target_uid, kind)` ensures one edge per relationship.

### Why symbol_uid (SCIP-inspired Identity)

Name-based symbol lookup (`sourceName: "render"`) collides on homonymous methods. Inspired by [Sourcegraph's SCIP protocol](https://github.com/sourcegraph/scip), each symbol gets a **deterministic UID**:

```
file_path:container_name:symbol_name:kind:line_start
```

Example: `src/components/Foo.tsx:Foo:render:method:42`

This makes every symbol globally unique, even two `render()` methods in different classes in the same file. MCP tools accept `symbol_uid` for exact lookup, `qualified_name + file` for class-level disambiguation, or plain `symbol` name with auto-disambiguation.

### Why Automatic Blast Radius Gate

The most innovative feature: a `PreToolUse` hook on `Edit` that **automatically** queries the blast radius of symbols being modified and injects the impact into the agent's context **before the edit is applied**.

No agent needs to remember to check — the safety net is invisible. If the blast radius exceeds a threshold (default: 3 callers), the agent sees:

```
⚠ Blast Radius Warning — this edit affects 8 call site(s) across 5 files:
  - handleCheckout at src/checkout/actions.ts:18
  - retryPayment at src/checkout/retry.ts:7
  - ...
```

This turns CodeGraph from a "tool you query" into a "seatbelt you don't think about".

### Why Documentation Indexing

AI agents change code but forget to update the documentation that describes it. CodeGraph solves this by indexing `.md`/`.mdx` files alongside code — when a doc references a symbol in backticks (`` `processPayment` ``), an edge is created linking the doc to the code symbol.

This means `codegraph_blast` shows not only "8 functions call this" but also "2 docs reference this". The blast radius gate hook warns about affected docs before edits. The agent knows which documentation needs updating as part of the change.

The doc indexer runs after code indexing (step 9 in the pipeline) so it has access to the complete set of known symbols. References are matched by name against the symbol table — only backtick references to actual code symbols create edges, avoiding false positives from prose text.

## Installation

### Claude Code (plugin system)

```bash
claude plugin add https://github.com/marioGusmao/codegraph
```

Everything is automatic — skills, hooks, and MCP server are registered by the plugin system.

### Codex CLI / Cursor / Windsurf

```bash
# Install globally
npm install -g codegraph

# Configure for your AI tool
codegraph setup --codex     # Creates .mcp.json + AGENTS.md section
codegraph setup --cursor    # Creates .cursor/mcp.json
codegraph setup --windsurf  # Creates .windsurf/mcp.json
codegraph setup --all       # Auto-detects installed tools
```

### From source (development)

```bash
git clone https://github.com/marioGusmao/codegraph.git
cd codegraph
npm install   # postinstall runs npm run build automatically
```

## Usage

### Index a project

```bash
codegraph index                        # Full index (1-3 seconds)
codegraph index --incremental          # Only changed files (<200ms)
codegraph index --project /path/to/dir # Specify project root
```

The index is stored in `.codegraph/graph.db` in the project root. It is automatically added to `.gitignore` on first index — it's a local cache, never committed.

Indexing covers **both code and documentation**:
- **Code**: `.ts`, `.tsx`, `.js`, `.jsx` — parsed with Tree-sitter + TypeScript LanguageService
- **Docs**: `.md`, `.mdx` — scanned for backtick references to code symbols (e.g., `` `processPayment` ``)
- Doc references appear in blast radius results alongside code callers

### Query via CLI

```bash
# Who calls this function?
codegraph query callers processPayment

# What does this function call?
codegraph query callees handleCheckout

# Full blast radius (callers + callees + affected files)
codegraph query blast useAuth

# File dependency tree
codegraph query depends --file src/modules/auth/index.ts --direction both

# Search for symbols
codegraph query search "payment" --kind function

# Complete codebase briefing
codegraph query brief

# Disambiguate with file, qualified name, or exact UID
codegraph query callers render --file src/components/Foo.tsx
codegraph query callers render --qualified-name Foo.render
codegraph query callers --uid "src/Foo.tsx:Foo:render:method:42"

# JSON output for scripting
codegraph query callers add --json
```

### MCP Tools (for AI agents)

| Tool | Description |
|------|-------------|
| `codegraph_brief` | Complete codebase briefing — architecture, hotspots, risk zones, entry points, module map |
| `codegraph_blast` | Blast radius: callers + callees + affected files + **doc references** for a symbol |
| `codegraph_callers` | Recursive caller chain for a symbol |
| `codegraph_callees` | Recursive callee chain for a symbol |
| `codegraph_depends` | File-level dependency tree (inbound/outbound/both) |
| `codegraph_search` | Search symbols by name substring and kind |
| `codegraph_status` | Index health: file count, stale files, last indexed |

All tools return **dual output**: Markdown (human-readable) + `structuredContent` (JSON for programmatic use).

### Automated Hooks

| Hook | Trigger | What it does |
|------|---------|-------------|
| **SessionStart** | New session | Checks if plugin is built, project is indexed, reports staleness |
| **PreToolUse (Edit)** | Before any edit | **Blast radius gate** — warns if edit affects many call sites |
| **PreToolUse (Bash)** | `git pull/checkout/merge` | Suggests incremental re-index |
| **PostToolUse (Edit/Write)** | After file edit | Warns if edited file is stale in the index |

## How Indexing Works

### Full Index Pipeline (9 steps)

1. **Discover** — glob for `.ts`, `.tsx`, `.js`, `.jsx` files, respecting `.gitignore`
2. **Config Check** — SHA-256 fingerprint `tsconfig.json`, `package.json`, `pnpm-workspace.yaml`. If any changed → full re-index
3. **Diff** — compare file hashes against stored hashes. Skip unchanged files in incremental mode
4. **Parse (Tree-sitter)** — native Tree-sitter extracts symbols and syntactic call edges
5. **Parse (TS LanguageService)** — `ts.createLanguageService()` extracts semantic call hierarchy edges. Resolves through inheritance, generics, overloads
6. **Resolve** — cross-file import resolution (relative paths, tsconfig paths, pnpm workspaces, barrel re-exports up to depth 5)
7. **Persist** — single SQLite transaction: upsert files, insert symbols with `symbol_uid`, insert edges with confidence
8. **Cleanup** — remove DB entries for deleted files (CASCADE)
9. **Index Documentation** — scan `.md`/`.mdx` files for backtick references to known symbols, create `documents` edges linking docs to code

### Incremental Mode

`codegraph index --incremental` is optimized:
- **Hash comparison**: SHA-256 per file vs stored hash — only re-process changed files
- **Git diff**: `git diff --name-only` against last indexed commit
- **Config fingerprinting**: tsconfig/package.json/workspace changes force full re-index automatically
- **Typical time**: <200ms for 3-5 changed files

### Where the Index Lives

```
your-project/
├── .codegraph/          ← local cache (auto-added to .gitignore)
│   └── graph.db         ← SQLite database (~5-15MB)
├── src/
└── ...
```

Each project has its own `.codegraph/`. The plugin is installed once globally; indexes are per-project, never committed, and regenerable in seconds.

## Project Structure

```
codegraph/
├── .claude-plugin/plugin.json    # Claude Code plugin manifest
├── skills/codegraph/SKILL.md     # AI agent skill (when/how to use tools)
├── hooks/
│   ├── hooks.json                # Hook registration
│   ├── blast-gate.mjs            # PreToolUse: blast radius gate
│   ├── auto-index.mjs            # PreToolUse: git operation detection
│   ├── check-staleness.mjs       # PostToolUse: staleness warning
│   └── session-start.mjs         # SessionStart: build/index check
├── mcp/mcp.json                  # MCP server registration
├── src/
│   ├── core/
│   │   ├── types.ts              # Shared types, symbol_uid builder
│   │   ├── db.ts                 # SQLite database layer
│   │   ├── query-engine.ts       # Recursive CTE queries
│   │   ├── formatter.ts          # Markdown output formatting
│   │   ├── indexer.ts            # 8-step hybrid indexing pipeline
│   │   ├── resolver.ts           # Cross-file import resolution
│   │   └── index.ts              # Barrel export
│   ├── extractors/
│   │   ├── extractor.ts          # Extractor registry
│   │   ├── typescript.ts         # Tree-sitter TS/JS extractor
│   │   └── markdown.ts           # Markdown doc reference extractor
│   ├── semantic/
│   │   └── ts-service.ts         # TypeScript LanguageService wrapper
│   ├── mcp/
│   │   └── server.ts             # MCP stdio server (7 tools)
│   └── cli/
│       ├── index.ts              # CLI entry point
│       └── commands/             # index, mcp, query, status, reset, setup
├── tests/                        # 67 tests (Vitest)
├── docs/
│   ├── design-spec.md            # Approved design specification
│   └── implementation-plan.md    # 12-task implementation plan
└── package.json
```

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Parser (structural) | `tree-sitter` (native) | Fast AST parsing, 200+ language grammars |
| Parser (semantic) | `typescript` LanguageService | Call hierarchy, find references, type resolution |
| Storage | `better-sqlite3` | Synchronous, WAL mode, recursive CTEs |
| MCP Server | `@modelcontextprotocol/sdk` (~1.27.0) | Stdio transport, Zod schema validation |
| CLI | `commander` (v14) | ESM-compatible, option groups |
| Tests | `vitest` | Fast, ESM-native, TypeScript support |
| Module system | ESM (`"type": "module"`) | Modern Node.js standard |
| TypeScript | 5.9+ (`module: "Node20"`) | Latest stable with node20 module support |

## Requirements

- **Node.js ≥ 20**
- **Python 3 + C++ build tools** (for native `tree-sitter` and `better-sqlite3` compilation)
  - macOS: `xcode-select --install`
  - Ubuntu: `apt install python3 build-essential`
  - Windows: `npm install -g windows-build-tools`

## License

MIT

## Credits

Designed and built with Claude Code (Opus 4.6). Architecture inspired by [Sourcegraph SCIP](https://github.com/sourcegraph/scip) (symbol identity), [GitHub stack-graphs](https://github.com/github/stack-graphs) (file-incremental indexing), and [codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) (MCP server patterns).
