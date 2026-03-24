---
name: codegraph
description: Use when about to refactor, rename, or change function signatures — runs blast radius and caller analysis before editing to understand cross-file impact. Also use when exploring unfamiliar code to trace call chains and dependencies. Use codegraph_brief at the start of sessions for instant codebase understanding.
---

## Prerequisites

- **Node.js** >= 20
- **C++ toolchain**: Required for native Tree-sitter bindings (`npm install` compiles them)
- **CodeGraph CLI**: Build with `cd <plugin-dir> && npm install && npm run build`
- **MCP server**: Registered in `.claude/.mcp.json` or via `codegraph setup --claude`
- **Project indexed**: Run `codegraph index --project <root>` (creates `.codegraph/graph.db`)

# CodeGraph — Code Intelligence Skill

Use the CodeGraph MCP tools to understand code relationships before making changes. CodeGraph indexes both **code** (TS/JS via Tree-sitter + TypeScript LanguageService) and **documentation** (Markdown files that reference code symbols).

## First-Time Setup

If this is the first time using CodeGraph on a project:

1. **Build the plugin** (once, after installation):
   ```bash
   cd <plugin-directory>
   npm install && npm run build
   ```

2. **Index the project**:
   ```bash
   codegraph index --project <project-root>
   ```
   This takes 1-5 seconds. Creates `.codegraph/` (auto-added to `.gitignore`).
   Also indexes `.md`/`.mdx` files — documentation that references code symbols gets linked in the graph.

3. **For Codex CLI / Cursor / Windsurf** (not Claude Code):
   ```bash
   codegraph setup --codex     # or --cursor, --windsurf, --all
   ```

## When to Use

- **Start of session**: Run `codegraph_brief` for instant codebase understanding — architecture, hotspots, risk zones, entry points
- **Before refactoring**: Run `codegraph_blast` to see full impact radius (code callers + doc references)
- **Before changing a function signature**: Run `codegraph_callers` to find all call sites
- **When exploring unfamiliar code**: Run `codegraph_callees` to trace what a function depends on
- **When checking file dependencies**: Run `codegraph_depends` to see import/require tree
- **When searching for a symbol**: Run `codegraph_search` with a name or substring

## Available MCP Tools

| Tool | What it does | Key inputs |
|------|-------------|------------|
| `codegraph_brief` | **Complete codebase briefing** — architecture, hotspots, risk zones, entry points, module map | — |
| `codegraph_blast` | Full impact radius (callers + callees + affected files + **doc references**) | `symbol`, optional `file`/`depth` |
| `codegraph_callers` | Who calls this symbol? (recursive) | `symbol`, optional `file`/`qualified_name`/`symbol_uid`/`depth` |
| `codegraph_callees` | What does this symbol call? (recursive) | `symbol`, optional `file`/`qualified_name`/`symbol_uid`/`depth` |
| `codegraph_depends` | File-level dependency tree | `file`, optional `direction` (in/out/both) |
| `codegraph_search` | Find symbols by name substring | `query`, optional `kind` |
| `codegraph_status` | Index health — file count, stale files, last indexed | — |

## Documentation Indexing

CodeGraph indexes `.md` and `.mdx` files alongside code. When a doc file references a code symbol in backticks (e.g., `` `processPayment` ``), an edge is created linking the doc to the code symbol.

This means:
- `codegraph_blast` shows **which docs reference** the symbol you're changing
- The blast radius gate hook warns about affected docs before edits
- You know which documentation needs updating after code changes

Example blast radius output:
```
### Callers (8)
  - handleCheckout → src/checkout/actions.ts:18
  - ...

### Documentation referencing this symbol (2)
  - docs/TLDR-checkout.md:45 — "The `processPayment` function handles..."
  - docs/ADR-0015.md:23 — "We chose `processPayment` because..."
```

## Disambiguation

When a symbol name is ambiguous (e.g., multiple `render` methods), tools return a disambiguation list. Re-query with one of:
- `file` — narrows to a specific file
- `qualified_name` — e.g., `Foo.render` for class methods (resolves same-file ambiguity)
- `symbol_uid` — exact match, always unambiguous

Priority: `symbol_uid` > `qualified_name + file` > `symbol + file` > `symbol`

## Workflow

1. **Start of session**: Call `codegraph_brief` for full codebase understanding
2. **Check index freshness**: Call `codegraph_status`. If stale files are reported, suggest `codegraph index --incremental`
3. **Search for the symbol**: If you don't know the exact name, use `codegraph_search` with a substring
4. **Disambiguate if needed**: If multiple symbols match, re-query with `file` or `qualified_name`
5. **Analyze impact**: Use `codegraph_blast` for full picture (code + docs), or `codegraph_callers`/`codegraph_callees` for directional analysis
6. **Proceed with edit**: Now you know what will be affected — make changes confidently
7. **Update docs**: If blast radius showed doc references, update those docs too

## Automatic Safety Hooks

These run automatically — no manual action needed:

| Hook | Trigger | What happens |
|------|---------|-------------|
| **SessionStart** | New session | Checks build, native modules (auto-rebuilds on ABI mismatch), index, staleness |
| **PreToolUse (Edit)** | Before any edit to TS/JS files | **Blast radius gate** — warns if edit affects many call sites + docs |
| **PreToolUse (Bash)** | `git pull/merge/rebase/checkout/switch/reset/restore/cherry-pick`, `stash pop/apply`, `npm/pnpm/yarn install` | Suggests incremental re-index |
| **PostToolUse (Edit/Write)** | After file edit | Warns if edited file is stale in the index |
| **PostToolUse (Bash)** | `git pull/merge/rebase/checkout/switch/reset/restore/cherry-pick`, `stash pop/apply`, `npm/pnpm/yarn install` | Triggers incremental re-index automatically |

## Rules

- ALWAYS check blast radius before renaming exported functions or changing their signatures
- ALWAYS check callers before removing or deprecating a public API
- If blast radius includes documentation references, update those docs as part of the change
- If the index is stale, inform the user and suggest reindexing — do NOT proceed with stale data for critical refactoring decisions
- Results show file paths and line numbers — use them to navigate directly to affected code

## Keeping the Index Fresh

- **After edits**: PostToolUse hook warns automatically
- **Quick refresh**: `codegraph index --incremental` (<200ms for a few files)
- **Full rebuild**: `codegraph reset` (deletes index and rebuilds from scratch)
- **Config changes**: `tsconfig.json`, `package.json`, `pnpm-workspace.yaml` changes trigger full re-index automatically in incremental mode
