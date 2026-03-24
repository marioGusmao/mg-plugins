---
name: kdoc:scaffold
description: Scaffold or update a Knowledge documentation structure in the current project. Use when initializing a new project's Knowledge system, adding a new area to an existing install, or adding a technology pack.
metadata:
  filePattern: ".kdoc.yaml"
  bashPattern: "kdoc init|kdoc add"
---

## Prerequisites

- **Node.js** >= 20
- **kdoc CLI**: `npx kdoc --version` must succeed. Install via `pnpm install` in the `cli/` directory if needed.
- **Knowledge directory**: A `Knowledge/` directory should exist at the project root. Run `npx kdoc init` if missing.

# kdoc:scaffold — Knowledge Structure Scaffold

Use this skill when the user asks to scaffold Knowledge docs, run `kdoc init`, or add a Knowledge area/pack/tool.

## When to Use

- "scaffold knowledge structure" / "kdoc init" / "set up Knowledge docs"
- "add ADR area" / "add nextjs pack" / "add codex integration"
- First-time Knowledge setup for a new project

## Workflow

1. Check if `.kdoc.yaml` exists in the project root.
   - If yes: this is an `add` or `update` operation, not `init`.
   - If no: this is a fresh `init`.

2. For fresh init:
   - Detect stack: look for `next.config.{ts,js,mjs}` (nextjs), `Package.swift` or `*.xcodeproj` (swift-ios).
   - Suggest detected pack(s) to the user and confirm.
   - Ask which areas to enable (adr, tldr, roadmap, design, guides, agent-memory, runbooks, threat-models, templates, governance, context-pack, index).
   - Ask which AI tools to integrate (claude-code, codex).
   - Run: `npx kdoc init [--pack <pack>] [--yes]`

3. For add-area: `npx kdoc add <area>`
4. For add-pack: `npx kdoc add-pack <pack>`
5. For add-tool: `npx kdoc add-tool <tool>`

## Safety Rules

- Always show the plan (`--dry-run`) before executing if the user has existing Knowledge files.
- Never pass `--force` without explicit user confirmation — it overwrites user-modified files.
- If git tree is dirty, warn the user before scaffolding.
- `.kdoc.lock` is committed to version control — do not gitignore it.

## After Scaffold

- Verify with: `npx kdoc doctor`
- If `adr` area was added: create the first ADR with `kdoc:adr-create`
- If `tldr` area was added: create initial TLDRs per module with `kdoc:tldr-create`

## Related Skills

- `kdoc:governance-check` — health check after scaffold
- `kdoc:adr-create` — create first ADR after scaffold
- `kdoc:tldr-create` — create first TLDR after scaffold

## Autonomy Mode

When invoked by an automated agent (workshop orchestrator, CI pipeline, or batch process) rather than interactive user input:

1. **Deterministic inference**: Infer all required parameters from available context (git history, file structure, existing Knowledge/ content) instead of prompting the user. If a parameter cannot be inferred with reasonable confidence, use sensible defaults and note the assumption.

2. **Repo-scan first**: Before generating any content, scan the repository for relevant context:
   - `git log --oneline -20` for recent changes
   - Existing Knowledge/ structure and naming patterns
   - Package.json / project configuration for module names
   - Existing ADRs/TLDRs for numbering and style consistency

3. **Structured output**: Always produce valid frontmatter with all required fields populated. Emit the file path as the first line of output so callers can locate the artifact.
