# kdoc

> Scaffold and maintain Knowledge documentation structures across projects — safely, incrementally, and idempotently.

kdoc is a hybrid CLI toolkit + Claude Code plugin that installs ADR governance, TLDR functional requirements, agent memory, design specs, and governance validation scripts into any project. It merges content into existing files without touching your customizations, tracks every change in a lock file, and can fully undo itself.

## Installation

```bash
npx kdoc init
```

kdoc detects your project stack (Next.js, Swift/iOS), asks what you want to install, and sets everything up. No global install required.

**Requirements:** Node.js 20+ and Python 3.9+ on PATH.

## Quick Start

```bash
# 1. Scaffold your Knowledge structure
npx kdoc init

# 2. Create your first ADR
npx kdoc create adr my-first-decision

# 3. Check everything is healthy
npx kdoc doctor
```

## Commands

| Command | Description |
|---------|-------------|
| `npx kdoc init` | Scaffold Knowledge structure into current project |
| `npx kdoc add <area>` | Add a Knowledge area (adr, tldr, roadmap, ...) |
| `npx kdoc add-pack <pack>` | Add a technology pack (nextjs, swift-ios) |
| `npx kdoc add-tool <tool>` | Add an AI tool integration (claude-code, codex) |
| `npx kdoc update` | Sync scripts and templates to current kdoc version |
| `npx kdoc doctor` | Health check across config, structure, and governance |
| `npx kdoc create <type> <name>` | Create a new ADR, TLDR, guide, or runbook |
| `npx kdoc undo` | Revert all scaffold operations |

### Options (all commands)

| Flag | Behavior |
|------|----------|
| `--yes` | Non-interactive; conflicts default to Skip |
| `--force` | Overwrite user-modified files without prompting |
| `--dry-run` | Show plan without executing |
| `--verbose` | Log each file operation |

## Technology Packs

Packs extend the universal core with stack-specific content:

- **`nextjs`** — Page specs, flow specs, route contract templates, route contract validation, design standards
- **`swift-ios`** — Screen specs, flow specs, API contract templates, SPM module dependency validation, HIG patterns

## AI Tool Integrations

- **Claude Code** — 12 skills, 4 agents (parallel auditing), 2 hooks (session start, pre-push check)
- **Codex CLI** — AGENTS.md block with Knowledge structure, multi-stream audit templates

## How It Works

kdoc uses named marker pairs to inject content into existing files:

```
<!-- kdoc:core:start -->
... kdoc-managed content ...
<!-- kdoc:core:end -->
```

Your content outside the markers is never touched. All managed files are tracked in `.kdoc.lock` (committed to git) with SHA-256 hashes for safe re-runs and precise undo.

## Documentation

- **Design spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md`
- **ADRs:** `Knowledge/ADR/` — 8 architectural decisions
- **TLDRs:** `Knowledge/TLDR/` — 11 functional requirement documents
- **Quick start:** `Knowledge/ContextPack.md`

## Platform

macOS and Linux. Node.js 20+. Python 3.9+ (for governance validation scripts).

## License

MIT
