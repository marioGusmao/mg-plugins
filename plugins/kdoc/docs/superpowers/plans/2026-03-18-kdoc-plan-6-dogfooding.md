# kdoc Plan 6: Dogfooding — Self-Documentation

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. No TDD applies — these are all documentation files, not code. Focus on correct structure, frontmatter, and cross-references between documents.

**Goal:** Populate kdoc's own `Knowledge/` directory with the full initial set of ADRs, TLDRs, and supporting files, proving that kdoc's structure works for documenting itself.

**Architecture:** All files follow the standard ADR and TLDR structures. ADRs use the standard format (Title, Status, Context, Decision Drivers, Decision, Alternatives, Consequences, Related documents). TLDRs use the simplified kdoc TLDR format (Description, Requirements with MUST/SHOULD/MAY, CLI Contract, Test Scenarios, Acceptance Criteria, Dependencies, Related ADRs) — note: kdoc TLDRs describe CLI subsystems, not web app features, so frontmatter is adapted accordingly.

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md` (section 9 is the primary reference; sections 4, 6, 7 provide requirements detail for TLDRs)

**Subsystem scope:** This plan covers `Knowledge/ADR/`, `Knowledge/TLDR/`, `Knowledge/ContextPack.md`, `Knowledge/INDEX.md`, and `.kdoc.yaml`. It does NOT cover CLI implementation (Plans 1–2), core content/templates (Plan 3), packs (Plan 4), or AI integrations (Plan 5).

**Note on ADR template:** Plan 3 creates `core/templates/adr.md`. Since Plan 3 may or may not be implemented before Plan 6, the ADR format used here is the standard structure: frontmatter (type, id, status, date, tags, summary) + sections (Context, Decision Drivers, Decision, Alternatives considered, Consequences, Related documents). This is compatible with both the AVShop2 template and the to-be-created `core/templates/adr.md`.

**Note on TLDR format:** kdoc TLDRs describe CLI subsystems, not web app modules. The frontmatter is adapted: no `area`, no `module_path`, no `security-tier`. The sections are: Description, Requirements, CLI Contract (flags/args), Test Scenarios, Acceptance Criteria, Dependencies, Related ADRs.

---

## File Structure Created in This Plan

```
Knowledge/
├── ADR/
│   ├── README.md
│   ├── ADR-0001-marker-based-merging.md
│   ├── ADR-0002-hash-manifest-idempotency.md
│   ├── ADR-0003-cli-plus-plugin-hybrid.md
│   ├── ADR-0004-pack-architecture.md
│   ├── ADR-0005-native-agents-per-tool.md
│   ├── ADR-0006-python-plus-typescript-split.md
│   ├── ADR-0007-yaml-config-format.md
│   └── ADR-0008-dogfooding.md
├── TLDR/
│   ├── README.md
│   ├── cli-init.md
│   ├── cli-add.md
│   ├── cli-update.md
│   ├── cli-doctor.md
│   ├── cli-create.md
│   ├── cli-undo.md
│   ├── merge-strategies.md
│   ├── pack-nextjs.md
│   ├── pack-swift-ios.md
│   ├── integration-claude.md
│   └── integration-codex.md
├── ContextPack.md
└── INDEX.md
.kdoc.yaml                   ← kdoc's own config (reference example)
```

---

## Task 1: Knowledge Directory Structure + README Files

**Files:**
- Create: `Knowledge/ADR/README.md`
- Create: `Knowledge/TLDR/README.md`

### ADR README

- [ ] **Step 1.1: Create `Knowledge/ADR/README.md`**

```markdown
---
type: index
area: ADR
id: adr-index
status: ready
date: 2026-03-18
tags:
  - knowledge
  - adr
  - governance
summary: ADR governance conventions and index for kdoc architectural decisions.
---

# kdoc — Architectural Decision Records

This directory contains the architectural and design decisions made for the kdoc project. Each decision is documented as an ADR that captures context, rationale, alternatives rejected, and consequences.

## Governance Conventions

- **Naming:** `ADR-{NNNN}-{short-kebab-title}.md` — zero-padded to 4 digits
- **Sequential numbering:** Numbers are never reused. Gaps are allowed.
- **Status lifecycle:** `proposed` → `accepted` → (optionally `superseded` or `deprecated`)
- **Authority:** All architectural decisions affecting the CLI, core content, packs, or integrations require an ADR.
- **Cross-references:** ADR documents reference related TLDRs using `[[TLDR/<name>|<Title>]]` wikilinks.

## Status Definitions

| Status | Meaning |
|--------|---------|
| `proposed` | Decision is under discussion, not yet committed |
| `accepted` | Decision is confirmed and governs implementation |
| `superseded` | Replaced by a newer ADR (link to successor) |
| `deprecated` | No longer relevant but preserved for history |

## Index

- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — Marker-based merging for existing files
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — Hash manifest for idempotency
- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — CLI + Plugin hybrid architecture
- [[ADR/ADR-0004-pack-architecture|ADR-0004]] — Technology pack architecture
- [[ADR/ADR-0005-native-agents-per-tool|ADR-0005]] — Native agents per AI tool
- [[ADR/ADR-0006-python-plus-typescript-split|ADR-0006]] — TypeScript + Python language split
- [[ADR/ADR-0007-yaml-config-format|ADR-0007]] — YAML configuration format
- [[ADR/ADR-0008-dogfooding|ADR-0008]] — kdoc documents itself (dogfooding)
```

### TLDR README

- [ ] **Step 1.2: Create `Knowledge/TLDR/README.md`**

```markdown
---
type: index
area: TLDR
id: tldr-index
status: ready
date: 2026-03-18
tags:
  - knowledge
  - tldr
summary: Entry index for all kdoc functional requirement documents.
---

# kdoc — TLDR (Functional Requirements)

kdoc is a hybrid CLI toolkit + Claude Code plugin that scaffolds and maintains Knowledge documentation structures across projects.

This directory contains one TLDR per CLI command and per major subsystem. Each TLDR defines what a component MUST, SHOULD, and MAY do — without implementation-specific code.

## Structure

```text
TLDR/
├── cli-init.md           # kdoc init command
├── cli-add.md            # kdoc add / add-pack / add-tool commands
├── cli-update.md         # kdoc update command
├── cli-doctor.md         # kdoc doctor command
├── cli-create.md         # kdoc create command
├── cli-undo.md           # kdoc undo command
├── merge-strategies.md   # Merge strategy subsystem
├── pack-nextjs.md        # Next.js technology pack
├── pack-swift-ios.md     # Swift/iOS technology pack
├── integration-claude.md # Claude Code integration
└── integration-codex.md  # Codex CLI integration
```

## Normative Language

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in TLDR documents are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## How to Use This Directory

- Each `.md` file describes one CLI command or subsystem without implementation-specific code.
- Requirements use MUST/SHOULD/MAY normative language.
- The CLI Contract section documents all flags, arguments, and their behavior.
- Test Scenarios describe what should be verified — mapping to unit, integration, or E2E test levels.

## Index

- [[TLDR/cli-init|cli-init]] — Interactive scaffold command
- [[TLDR/cli-add|cli-add]] — Add area/pack/tool commands
- [[TLDR/cli-update|cli-update]] — Update scripts/templates command
- [[TLDR/cli-doctor|cli-doctor]] — Health check command
- [[TLDR/cli-create|cli-create]] — Create document command
- [[TLDR/cli-undo|cli-undo]] — Revert installation command
- [[TLDR/merge-strategies|merge-strategies]] — Merge strategy subsystem
- [[TLDR/pack-nextjs|pack-nextjs]] — Next.js technology pack
- [[TLDR/pack-swift-ios|pack-swift-ios]] — Swift/iOS technology pack
- [[TLDR/integration-claude|integration-claude]] — Claude Code integration
- [[TLDR/integration-codex|integration-codex]] — Codex CLI integration
```

---

## Task 2: ADRs 0001–0004 (Merging, Idempotency, Hybrid, Packs)

**Files:**
- Create: `Knowledge/ADR/ADR-0001-marker-based-merging.md`
- Create: `Knowledge/ADR/ADR-0002-hash-manifest-idempotency.md`
- Create: `Knowledge/ADR/ADR-0003-cli-plus-plugin-hybrid.md`
- Create: `Knowledge/ADR/ADR-0004-pack-architecture.md`

### ADR-0001: Marker-Based Merging

- [ ] **Step 2.1: Create `Knowledge/ADR/ADR-0001-marker-based-merging.md`**

```markdown
---
type: adr
id: ADR-0001
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - merge
  - scaffold
  - safety
summary: Use named marker pairs for merging content into existing files (CLAUDE.md, AGENTS.md, .gitignore).
---

# ADR-0001 — Marker-Based Merging

## Context

kdoc must install content into files that already exist and may contain user-authored content (CLAUDE.md, AGENTS.md, .gitignore). A naive "overwrite the whole file" approach would destroy user customizations. We need a merge strategy that is safe, reversible, and gives users control over where kdoc content appears in their files.

## Decision Drivers

- User content outside kdoc blocks must never be touched
- The approach must be reversible (`kdoc undo` must remove exactly what was added)
- Multiple kdoc blocks must coexist in the same file (core block + pack blocks)
- The strategy must be implementable without AST parsing or regex fragility
- Users must be able to manually position kdoc blocks within their files

## Decision

Use named marker pairs to delimit kdoc-managed content within existing files:

- Markdown files: `<!-- kdoc:<name>:start -->` / `<!-- kdoc:<name>:end -->`
- .gitignore and similar plain-text files: `# kdoc:<name>:start` / `# kdoc:<name>:end`

Each logical block has a unique name (e.g., `core`, `pack:nextjs`, `pack:swift-ios`). This allows multiple independent blocks to coexist in the same file.

**Algorithm (per named block):**
1. File does not exist → create file with the block as sole content
2. File exists, no markers for this name → append block at end
3. File exists, markers found → replace content between markers
4. Corrupted markers (only one of the pair) → error with manual fix instructions
5. Duplicate markers for same name → error, ask user which to keep
6. User edited content between markers → hash in `.kdoc.lock` differs → prompt: `[S]kip / [O]verwrite / [D]iff`

The `.kdoc.lock` records `blockHash` (hash of injected block only) and `markerName` for each merged file, enabling targeted update and undo per block.

## Alternatives Considered

- **Full file replacement:** Simple to implement, but destroys all user content. Rejected — too destructive.
- **AST parsing (e.g., unified/remark for Markdown):** Precise structural edits, but fragile across formatting variations and dialects. Rejected — excessive complexity for the benefit.
- **Line-number-based insertion:** Records the line number at install time, reinserts at that position on update. Rejected — line numbers become stale as users edit the file; silent corruption risk.
- **Single global marker (no named blocks):** One `<!-- kdoc:start -->` / `<!-- kdoc:end -->` per file. Simpler, but cannot accommodate core + pack blocks coexisting independently. Rejected — too restrictive for multi-pack projects.
- **Separate side-car files (.kdoc.claude.md, .kdoc.agents.md):** kdoc writes to its own files, then references them from the main file. Avoids merge complexity entirely, but requires users to wire their main config to include side-car files. Rejected — adds friction and diverges from how Claude Code/Codex CLI read their configs.

## Consequences

### Positive

- User content outside markers is guaranteed safe
- Each named block can be updated or removed independently
- `kdoc undo` can precisely remove only kdoc content, leaving user content intact
- Users can move marker blocks to their preferred position in the file
- The approach requires no external parser dependencies

### Trade-offs

- Marker pair corruption (mismatched or duplicate) requires manual intervention
- Users must not modify markers themselves (the names are structural identifiers)
- Content between markers is "claimed" by kdoc — user edits within markers trigger a hash conflict prompt on next `kdoc update`

## Related Documents

- [[TLDR/merge-strategies|merge-strategies]] — Full specification of all merge strategies
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — How hashes track block changes
```

### ADR-0002: Hash Manifest Idempotency

- [ ] **Step 2.2: Create `Knowledge/ADR/ADR-0002-hash-manifest-idempotency.md`**

```markdown
---
type: adr
id: ADR-0002
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - idempotency
  - lock-file
  - safety
summary: Use a SHA-256 hash manifest (.kdoc.lock) to track managed files and enable safe re-runs, updates, and undo.
---

# ADR-0002 — Hash Manifest Idempotency

## Context

Running `kdoc init` or `kdoc update` multiple times on the same project must be safe. Without a tracking mechanism, re-running the scaffold would overwrite user-modified files silently. We need a way to know which files kdoc manages, whether they have been modified by the user, and what the original template content was.

## Decision Drivers

- Re-running any kdoc command must never silently overwrite user modifications
- `kdoc undo` must know exactly which files to remove and which merged blocks to strip
- `kdoc update` must detect when source templates have changed (to offer updates) and when user files have changed (to prompt for resolution)
- The tracking mechanism must survive process crashes without leaving the project in an undiscoverable broken state
- The lock file must be shareable across team members (committed to git)

## Decision

Maintain a `.kdoc.lock` JSON file committed to git. The lock records every file that kdoc created or merged, with:

- `action`: `"created"` or `"merged"`
- `hash`: SHA-256 of the full file content (for `created` files)
- `blockHash`: SHA-256 of the content between markers only (for `merged` files)
- `templateHash`: SHA-256 of the source template at install time (for update drift detection)
- `template`: the relative path to the source template (stable identity key for rename detection)
- `strategy`: merge strategy used (`"markers"` or `"prefix"`)
- `markerName`: the named marker pair used (for `markers` strategy)

**Hash comparison rules:**
- `created` files: compare `hash` to current file content to detect user edits
- `merged` files: compare `blockHash` to current block content only — never full file hash, because user content outside markers is expected to change
- Update drift: compare `templateHash` to current kdoc version's template hash to determine whether the source template has changed

**Crash recovery:** The CLI writes to `.kdoc.lock.tmp` incrementally (appending each file entry as it completes) and atomically renames to `.kdoc.lock` on completion. If the process is killed, `.kdoc.lock.tmp` remains and is detected by `kdoc doctor`. On the next `kdoc init`, the CLI prompts: `"Previous install was interrupted. [R]esume / [U]ndo partial / [S]tart fresh"`.

`.kdoc.backup/` stores pre-install snapshots of merged files and is git-ignored (local-only).

## Alternatives Considered

- **Copier's 3-way merge:** Tracks the "upstream" (template) + "user" (current file) + "previous" (last known upstream) and merges all three. More powerful — handles concurrent edits to both template and user file. Rejected for v1 — significantly more complex to implement and explain; hash manifest is sufficient for the documented use cases.
- **No tracking (always prompt):** Every file operation prompts the user whether to overwrite. Simple, but unusable for non-interactive mode (`--yes`) and produces excessive noise on large installs. Rejected.
- **Git-based tracking (use git history as the "original"):** Compare current file content to git HEAD for the file. Requires the project to be a git repository, cannot handle unstaged changes cleanly, and is fragile on first install (before any commit). Rejected.
- **Content-addressable cache (like npm lockfile):** Store full file hashes in a global cache. Too complex, cross-project state is error-prone. Rejected.

## Consequences

### Positive

- Re-running any command is always safe — the lock prevents silent overwrites
- `kdoc undo` has complete, precise information about what to reverse
- Crash recovery is deterministic — `.kdoc.lock.tmp` always reflects what was actually done
- Team members share the lock (committed to git) — any team member can run `kdoc update` or `kdoc doctor`
- Rename detection is stable via the `template` identity key

### Trade-offs

- `.kdoc.lock` must be committed to git and kept up to date — forgetting to commit it breaks idempotency for other team members
- Schema migrations are required when the lock format changes (protected by `lockVersion` field and major version bump policy)
- Concurrent `kdoc` invocations on the same project are not safe in v1 (no mutual-exclusion lock)

## Related Documents

- [[TLDR/cli-init|cli-init]] — Init command uses the lock to detect re-run state
- [[TLDR/cli-update|cli-update]] — Update command uses templateHash for drift detection
- [[TLDR/cli-undo|cli-undo]] — Undo uses the lock to know what to reverse
- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — blockHash is computed from marker-delimited content
```

### ADR-0003: CLI + Plugin Hybrid

- [ ] **Step 2.3: Create `Knowledge/ADR/ADR-0003-cli-plus-plugin-hybrid.md`**

```markdown
---
type: adr
id: ADR-0003
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - architecture
  - cli
  - plugin
summary: Build kdoc as a hybrid CLI toolkit (npx) + Claude Code plugin, rather than a plugin-only or CLI-only tool.
---

# ADR-0003 — CLI + Plugin Hybrid Architecture

## Context

kdoc needs to integrate into the daily workflow of two distinct actors: humans running commands in a terminal, and AI agents (Claude Code, Codex CLI) performing documentation tasks. A plugin-only approach would make kdoc dependent on Claude Code's availability and API surface. A CLI-only approach would produce a worse experience for AI-assisted workflows that could benefit from skills, agents, and hooks.

## Decision Drivers

- Scaffold operations (init, update, undo) must work without an AI tool running — humans and CI pipelines use them
- AI-native operations (create ADR, validate governance, audit documentation) benefit from interactive AI context
- Claude Code and Codex CLI have different extension models — Claude uses skills/agents/hooks, Codex uses AGENTS.md blocks
- The tool must remain useful even if users do not use Claude Code
- The tool must remain useful even if users run it in headless CI environments

## Decision

Build kdoc as a hybrid:

1. **CLI (`npx kdoc`):** All scaffold operations (init, add, update, doctor, create, undo) are available as standard CLI commands. These work standalone with no AI tool required. The CLI is the source of truth for all file operations.

2. **Claude Code plugin:** 12 skills and 4 agents that leverage Claude Code's interactive capabilities for documentation authoring, governance auditing, and knowledge operations. Skills invoke the CLI when appropriate, but can also operate inline (e.g., filling templates without CLI execution).

3. **Codex CLI integration:** Generated AGENTS.md blocks and `.codex/agents/` templates that give Codex CLI equivalent capabilities using its native multi-stream pattern. No plugin API — everything is text-based instructions.

The CLI and plugin share no runtime — the plugin invokes the CLI as a subprocess when scaffold operations are needed, or reads `.kdoc.yaml` / `.kdoc.lock` directly for context. There is no shared in-process state between CLI and plugin.

## Alternatives Considered

- **CLI-only:** Simple distribution, no Claude Code dependency. But loses the AI-native documentation authoring experience (interactive ADR creation, governance auditing with context). Rejected — the plugin is a significant quality multiplier.
- **Plugin-only (Claude Code):** Richer interactive experience, but excludes Codex CLI users and CI pipelines entirely. Cannot run in headless environments. Rejected — CLI independence is a core goal.
- **Claude Code MCP server:** Run a persistent MCP server that provides tools for scaffold operations. More powerful API surface, can maintain state across operations. Rejected for v1 — MCP adds significant operational complexity (server startup, port management, auth); skills + CLI subprocess is sufficient.
- **Shared in-process library (CLI + plugin share runtime):** Plugin imports CLI internals directly instead of subprocess. Tighter integration, avoids subprocess overhead. Rejected — creates tight coupling between plugin version and CLI version; breaking CLI changes would break plugin immediately.

## Consequences

### Positive

- CLI works in any environment (terminal, CI, headless) without AI dependency
- Claude Code users get a richer interactive experience via skills and agents
- Codex CLI users get equivalent capability via AGENTS.md instructions
- Adding new AI tool integrations is additive — new `integrations/` module, no changes to CLI core
- The plugin delegates scaffold operations to the CLI, ensuring a single source of truth for file operations

### Trade-offs

- Two execution paths to maintain (CLI and plugin invoke the same logical operations differently)
- Plugin skills must handle CLI availability failures gracefully (npx kdoc not installed)
- Documentation must clearly explain the hybrid model to avoid user confusion

## Related Documents

- [[TLDR/integration-claude|integration-claude]] — Claude Code integration specification
- [[TLDR/integration-codex|integration-codex]] — Codex CLI integration specification
- [[ADR/ADR-0005-native-agents-per-tool|ADR-0005]] — Why each AI tool gets native agents
```

### ADR-0004: Pack Architecture

- [ ] **Step 2.4: Create `Knowledge/ADR/ADR-0004-pack-architecture.md`**

```markdown
---
type: adr
id: ADR-0004
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - architecture
  - packs
  - extensibility
summary: Organize technology-specific content into "packs" that compose on top of a universal core, with strict namespace isolation.
---

# ADR-0004 — Pack Architecture

## Context

kdoc must support multiple technology stacks: Next.js projects have different documentation templates than Swift/iOS projects. Approximately 70% of the Knowledge structure (ADR governance, TLDR format, Roadmap conventions, agent memory, guides skeleton) is universal across stacks. The remaining 30% diverges: templates (page-spec vs. screen-spec), scripts (route contract checks vs. SPM dependency checks), guides (Next.js onboarding vs. Xcode onboarding).

We need a composability model that delivers the universal core once and allows stack-specific extensions without coupling or collision.

## Decision Drivers

- The universal 70% should not be duplicated across stacks
- Multi-pack projects (Next.js backend + Swift/iOS client) must not have file collisions
- Pack files must be isolatable — `kdoc undo pack:nextjs` must not affect `pack:swift-ios` files
- Future packs (Python, Go, Rust) should be addable without modifying core
- The `.kdoc.lock` must track pack ownership per file

## Decision

Organize technology-specific content into "packs" under `packs/<name>/`. Each pack has:
- `pack.json` — detection rules, defaults (scopes, enforced-paths, scripts runner), metadata
- `templates/` — additional document templates
- `scripts/` — additional validation scripts
- `guides/` — technology-specific onboarding and reference guides
- `design/` — design tokens and standards

**Unified namespacing rule:** ALL pack content is installed under a pack-named subdirectory in the target project:
- `Knowledge/Templates/<pack>/`
- `Knowledge/Guides/<pack>/`
- `Knowledge/Design/<pack>/<scope>/`
- `scripts/kdoc/<pack>/`

This rule applies even for single-pack projects, ensuring consistent paths regardless of whether a second pack is added later.

**Multi-pack behavior:** When multiple packs are installed, each pack's content lives entirely within its own namespace. Enforced-paths from all packs are combined (set union). Scopes are NOT combined globally — each pack owns its scopes within its namespace.

**Lock tracking:** The `.kdoc.lock` `template` field records `"packs/<name>/..."` for pack files and `"core/..."` for core files, providing clear ownership for update and undo operations.

## Alternatives Considered

- **Separate plugins per stack (`kdoc-nextjs`, `kdoc-swift-ios`):** Each stack gets its own npm package. Cleaner separation, no core coupling. Rejected — users must manage multiple packages, core updates require coordinating across packages, and the universal 70% would still be duplicated (or pulled in as a shared dep).
- **Single plugin with global scopes (no packs):** All templates and guides coexist in a single flat namespace. Simpler, but Next.js and Swift/iOS templates with the same logical name (e.g., `flow-spec.md`) collide. Rejected — collision is inevitable.
- **Pack-specific install paths (nextjs templates at root, swift-ios templates in subfolder):** Different packs use different path conventions. Rejected — inconsistent, makes multi-pack tooling logic conditional on pack identity rather than the uniform namespacing rule.
- **Runtime pack discovery (packs as npm packages):** Each pack is a separately published package, discovered at runtime. More composable for third parties. Rejected for v1 — premature complexity; the pack registry can be added later without changing the core pack contract.

## Consequences

### Positive

- No file collisions between packs, even when multiple packs are installed
- `kdoc undo` of one pack does not affect other pack files
- New packs can be added by creating a `packs/<name>/` directory — no changes to core
- Design paths are consistent: `Knowledge/Design/<pack>/<scope>/` — no path drift when adding a second pack
- Lock tracks ownership cleanly via the `template` field prefix

### Trade-offs

- Single-pack projects have an extra path level (`Knowledge/Templates/nextjs/` instead of `Knowledge/Templates/`) — minor verbosity trade-off for future consistency
- Pack manifest schema must remain stable or include a version field for forward compatibility
- Users cannot install pack templates outside the namespaced path (they always get the namespace even if they prefer a flat structure)

## Related Documents

- [[TLDR/pack-nextjs|pack-nextjs]] — Next.js pack specification
- [[TLDR/pack-swift-ios|pack-swift-ios]] — Swift/iOS pack specification
- [[TLDR/cli-add|cli-add]] — `add-pack` command
- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — Overall CLI architecture
```

---

## Task 3: ADRs 0005–0008 (Native Agents, TS+Python, YAML, Dogfooding)

**Files:**
- Create: `Knowledge/ADR/ADR-0005-native-agents-per-tool.md`
- Create: `Knowledge/ADR/ADR-0006-python-plus-typescript-split.md`
- Create: `Knowledge/ADR/ADR-0007-yaml-config-format.md`
- Create: `Knowledge/ADR/ADR-0008-dogfooding.md`

### ADR-0005: Native Agents Per AI Tool

- [ ] **Step 3.1: Create `Knowledge/ADR/ADR-0005-native-agents-per-tool.md`**

```markdown
---
type: adr
id: ADR-0005
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - agents
  - claude-code
  - codex
  - ai-integration
summary: Implement AI capabilities using each tool's native extension model rather than a shared abstraction layer.
---

# ADR-0005 — Native Agents Per AI Tool

## Context

kdoc integrates with two AI tools: Claude Code and Codex CLI. These tools have fundamentally different extension models. Claude Code supports parallel sub-agents, skills (persistent instruction files), and hooks (event-triggered scripts). Codex CLI supports AGENTS.md configuration blocks and multi-stream parallel execution. Building a shared abstraction over both tools would mean implementing the lowest common denominator — losing the unique capabilities of each.

## Decision Drivers

- Claude Code sub-agents enable parallel documentation auditing (ADR auditor + TLDR checker + roadmap builder running simultaneously)
- Codex CLI multi-stream templates enable the same parallel pattern with different primitives
- Skills in Claude Code are persistent instructions that any conversation can invoke — more powerful than generated text instructions
- AGENTS.md blocks in Codex CLI are the canonical way to give Codex domain knowledge — equivalent to Claude Code hooks for session startup

## Decision

Implement AI capabilities using each tool's native extension model:

**Claude Code:**
- 12 skills in `skills/` — each a `SKILL.md` file with trigger patterns, workflow steps, and constraints
- 4 agents in `agents/claude-code/` — orchestrator (`knowledge-auditor`) + 3 sub-agents (`adr-auditor`, `tldr-sync-checker`, `roadmap-builder`)
- 2 hooks in `hooks/` — `session-start.mjs` (SessionStart) + `pre-push-check.mjs` (PreToolUse)
- Plugin manifest in `.claude-plugin/plugin.json`

**Codex CLI:**
- AGENTS.md block (generated with markers) containing Knowledge structure description, rules, multi-stream audit templates, and available commands
- Agent definition in `.codex/agents/knowledge-auditor/instructions.md` using multi-stream patterns

The two integrations are functionally equivalent (same capabilities, different implementations). The equivalence table in the spec (Section 7.3) documents the mapping.

## Alternatives Considered

- **Shared abstraction layer:** Define a common interface (e.g., `AgentTask` type) that both Claude Code and Codex CLI adapters implement. Run the same "logical agent" on either tool. Rejected — the abstraction would paper over meaningful differences (parallel sub-agents vs. multi-stream) and prevent leveraging tool-native optimizations.
- **Claude Code only:** Build full integration for Claude Code, provide basic CLI fallback for Codex users. Simpler to maintain. Rejected — Codex CLI is an equally valid primary tool for many users; first-class Codex support is a goal.
- **MCP server (shared by both):** Expose kdoc operations as MCP tools accessible to both Claude Code and Codex. Unified interface, single implementation. Rejected — MCP adds operational complexity (server lifecycle), and Claude Code skills + direct CLI invocation is sufficient; MCP may be revisited if the operation catalog grows significantly.

## Consequences

### Positive

- Each tool's native strengths are fully leveraged (parallel sub-agents for Claude Code, multi-stream for Codex CLI)
- Skills provide richer, persistent context for Claude Code users
- Codex CLI users get equivalent capability without a separate MCP server
- New AI tool integrations are additive — new `integrations/<tool>/` module

### Trade-offs

- Two implementations to maintain — a change to the governance workflow requires updating both Claude Code skills/agents and Codex AGENTS.md templates
- Equivalence between the two integrations must be manually maintained
- Codex CLI's AGENTS.md block is text-based (less structured than skills) — harder to version and audit

## Related Documents

- [[TLDR/integration-claude|integration-claude]] — Claude Code integration specification
- [[TLDR/integration-codex|integration-codex]] — Codex CLI integration specification
- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — CLI + Plugin hybrid architecture
```

### ADR-0006: TypeScript + Python Split

- [ ] **Step 3.2: Create `Knowledge/ADR/ADR-0006-python-plus-typescript-split.md`**

```markdown
---
type: adr
id: ADR-0006
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - typescript
  - python
  - tech-stack
summary: Use TypeScript for the CLI and Python for validation scripts, choosing each language where it has natural ecosystem strength.
---

# ADR-0006 — TypeScript + Python Language Split

## Context

kdoc has two distinct subsystems with different natural language fits: the CLI (user-facing command dispatcher, file operations, interactive prompts) and the validation scripts (text processing, pattern matching, governance rule enforcement). Forcing both into a single language means either writing Python CLI tooling (against the npm ecosystem grain) or writing TypeScript text-processing scripts (against the Python scientific/text-processing ecosystem grain).

## Decision Drivers

- The CLI is distributed via npm (`npx kdoc`) — TypeScript/Node.js is the natural choice
- Validation scripts do regex-heavy text processing and file scanning — Python excels here
- Python is typically pre-installed on developer machines (macOS, Linux) and in CI environments
- Target projects (Next.js, Swift/iOS) already have Python available for build scripts and CI
- Avoiding a Python runtime dependency in the CLI itself keeps the npm bundle lean

## Decision

Use TypeScript for the CLI and Python for validation scripts:

**TypeScript (CLI):**
- All user-facing commands in `cli/src/commands/`
- Scaffold engine, merge strategies, config loading, lock management
- Template rendering
- Distributed via npm as `kdoc-cli`; built with tsup, tested with Vitest

**Python (validation scripts):**
- `check_sync.py` — Knowledge sync enforcement
- `check_wikilinks.py` — Wikilink integrity validation
- `build_index.py` — INDEX.md generation
- `check_adr_governance.py` — ADR governance validation
- `governance_health.py` — Consolidated health report
- Python 3.9+ required on PATH; no third-party dependencies (standard library only)
- Installed into target projects as `scripts/kdoc/` by the scaffold

The CLI does not import or execute Python at runtime. Python scripts are standalone files that users invoke via `pnpm kdoc:check` (or equivalent). The CLI's `kdoc doctor` invokes them as subprocesses when available, but degrades gracefully if Python is not installed (warns, does not error).

## Alternatives Considered

- **TypeScript for everything:** CLI + validation scripts in TypeScript. Single language, single ecosystem. But TypeScript text-processing is more verbose for regex/glob operations than Python, and shipping scripts as TypeScript requires a build step or ts-node at runtime. Rejected — adds complexity without benefit.
- **Python for everything:** CLI + scripts in Python. Excellent for text processing, but Python CLIs require users to have Python and pip, and are less natural for npm distribution (`npx kdoc`). Rejected — the npm distribution model is a core user experience goal.
- **Shell scripts for validation:** `.sh` scripts instead of Python. Zero dependency, maximum portability. Rejected — shell scripting is harder to maintain, test, and reason about for complex governance logic; Python is more readable and testable.
- **Deno (TypeScript without build step):** Use Deno for scripts that need TypeScript. Avoids the compiled-Python vs. compiled-TypeScript problem. Rejected — Deno is not universally available; adds a new runtime dependency.

## Consequences

### Positive

- Each language is used in its area of strength
- CLI users get a familiar `npx kdoc` experience without Python knowledge
- Validation scripts are readable and maintainable by developers unfamiliar with the CLI internals
- No Python dependency in the CLI npm bundle — lean distribution

### Trade-offs

- Two languages to maintain — contributors must know both TypeScript and Python
- Python 3.9+ must be present for validation scripts to function
- `kdoc doctor` must degrade gracefully when Python is not available
- Testing requires two test frameworks (Vitest for TypeScript, unittest or pytest for Python)

## Related Documents

- [[TLDR/merge-strategies|merge-strategies]] — Implemented in TypeScript
- [[TLDR/cli-doctor|cli-doctor]] — Doctor command invokes Python scripts as subprocesses
```

### ADR-0007: YAML Config Format

- [ ] **Step 3.3: Create `Knowledge/ADR/ADR-0007-yaml-config-format.md`**

```markdown
---
type: adr
id: ADR-0007
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - config
  - yaml
  - ux
summary: Use YAML for the .kdoc.yaml configuration file, and JSON with comments (JSONC) for the .kdoc.lock file.
---

# ADR-0007 — YAML Configuration Format

## Context

kdoc uses two persistent files in the target project: `.kdoc.yaml` (human-authored configuration) and `.kdoc.lock` (machine-written state). These have different audiences and authoring patterns — `.kdoc.yaml` is edited by developers and should be comfortable to hand-edit; `.kdoc.lock` is primarily machine-written and consumed by the CLI.

## Decision Drivers

- `.kdoc.yaml` is edited by humans: must be readable, support inline comments, and have a clean visual structure
- `.kdoc.lock` is machine-written: must be reliable, strongly typed, and easily parsed by Node.js
- The YAML library (`yaml` npm package) is already in the CLI's dependency list for reading pack manifests and other config
- Familiarity: YAML is the established standard for CLI config files in the npm ecosystem (`.eslintrc.yaml`, `.prettierrc.yaml`, GitHub Actions workflows)

## Decision

- **`.kdoc.yaml`:** YAML. Readable, supports inline comments for documentation, consistent with ecosystem conventions. Parsed and written with the `yaml` npm package. Schema validated with Zod after parsing.
- **`.kdoc.lock`:** JSON (JSONC semantics in documentation, but the actual file contains valid JSON). Machine-written, strongly typed, directly serializable as `JSON.stringify`. Supports the `lockVersion` field for schema migration.

Config schema uses Zod `.passthrough()` for forward compatibility — unknown fields in `.kdoc.yaml` are preserved, not rejected, allowing kdoc to be upgraded without breaking existing configs.

## Alternatives Considered

- **JSON for .kdoc.yaml:** Lacks comments, less human-readable. Rejected — developers need to annotate their configuration.
- **TOML for .kdoc.yaml:** Excellent human readability, supports comments. Less familiar to JavaScript developers than YAML, and the TOML npm ecosystem is smaller. Rejected — YAML is more universally recognized in the target ecosystem.
- **JavaScript/TypeScript config file (kdoc.config.ts):** Programmable config, maximum flexibility. Rejected — requires compilation or a TS runtime, adds complexity, and programmable config is not needed for kdoc's simple key-value configuration.
- **YAML for .kdoc.lock:** More human-readable, but not a standard for machine-written lock files (`package-lock.json`, `pnpm-lock.yaml` uses YAML but is an exception). Rejected — JSON is the lingua franca for machine-written lock files; Node.js JSON serialization is trivial.

## Consequences

### Positive

- `.kdoc.yaml` is comfortable to hand-edit and well-documented with inline comments
- `.kdoc.lock` is trivially serializable and parseable in Node.js
- No unexpected YAML-to-JSON type coercion issues (both `yaml` and `JSON.parse` handle their own types correctly)
- Forward-compatible via `.passthrough()` in Zod schema

### Trade-offs

- Two file formats in the same project — contributors must understand both YAML parsing and JSON serialization
- YAML's indentation sensitivity means malformed `.kdoc.yaml` produces cryptic parse errors (mitigated by Zod schema validation with descriptive error messages)
- JSONC conventions in documentation (comments in lock file examples) cannot appear in the actual `.kdoc.lock` file — documentation must be clear about this

## Related Documents

- [[TLDR/cli-init|cli-init]] — Init command writes .kdoc.yaml and .kdoc.lock
- [[TLDR/cli-update|cli-update]] — Update command reads both files
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — .kdoc.lock structure and purpose
```

### ADR-0008: Dogfooding

- [ ] **Step 3.4: Create `Knowledge/ADR/ADR-0008-dogfooding.md`**

```markdown
---
type: adr
id: ADR-0008
status: accepted
date: 2026-03-17
superseded-by: ''
tags:
  - governance
  - dogfooding
  - documentation
summary: kdoc documents itself using its own Knowledge structure, proving the structure works and providing an integrated reference example.
---

# ADR-0008 — Dogfooding

## Context

kdoc produces Knowledge documentation structures for other projects. We need to document kdoc's own architectural decisions, functional requirements, and quick-start context. The obvious choice is to document kdoc using the same structure kdoc installs in target projects. This is "dogfooding" — eating your own cooking.

## Decision Drivers

- kdoc's own architecture has 8 significant decisions (ADRs 0001–0007 + this one) that deserve formal documentation
- kdoc's CLI commands and subsystems have functional requirements that should be captured in TLDRs
- Using kdoc's own structure proves it is suitable for documenting a CLI toolkit (not just web apps)
- The `Knowledge/` directory serves as a worked reference example for users evaluating kdoc
- Maintenance of kdoc's documentation can use the same skills and agents that kdoc installs

## Decision

kdoc's `Knowledge/` directory follows the same structure that kdoc installs in target projects:

- `Knowledge/ADR/` — 8 ADRs covering all major architectural decisions
- `Knowledge/TLDR/` — 11 TLDRs covering all CLI commands and major subsystems
- `Knowledge/ContextPack.md` — Quick-start document for anyone maintaining kdoc
- `Knowledge/INDEX.md` — Generated index of all Knowledge files

Additionally, kdoc maintains its own `.kdoc.yaml` configuration file as a reference example of what a fully configured kdoc project looks like. This config documents every available option and serves as the canonical reference for users writing their own config.

**What is NOT dogfooded:**
- kdoc does not install itself via `npx kdoc init` (bootstrapping paradox — the CLI does not exist until Plan 1 is complete)
- The `Knowledge/Templates/`, `Knowledge/Guides/`, and `Knowledge/Roadmap/` areas are not created (kdoc is a single-version toolkit, not a product roadmap project)
- kdoc does not run its own governance scripts on itself during development (scripts are installed in target projects, not in the kdoc repo itself)

## Alternatives Considered

- **Separate `docs/` directory (Markdown outside Knowledge structure):** Documentation lives in `docs/adr/`, `docs/tldr/`, etc., following no particular convention. Simpler — no need to prove the structure works on itself. Rejected — loses the proof-of-concept value; the separation creates a misleading impression that kdoc is not suitable for CLI toolkits.
- **No formal documentation (README only):** kdoc's decisions and requirements live in the README and code comments. Minimalist. Rejected — the design spec (section 9) explicitly requires dogfooding as a success criterion; a toolkit for documentation governance must itself be well-documented.
- **Full dogfooding (run `kdoc init` on itself):** Use the CLI to scaffold kdoc's own Knowledge structure. Maximum proof-of-concept. Rejected for v1 — bootstrapping paradox: the CLI does not exist before Plan 1 is implemented; manually populating the files (this plan) achieves the same result with less complexity.

## Consequences

### Positive

- Proves kdoc's Knowledge structure is suitable for CLI toolkits, not just web apps
- Provides a worked reference example for users evaluating or adopting kdoc
- kdoc's own ADRs and TLDRs can be maintained using the same skills and agents kdoc installs
- Documentation issues in kdoc's own structure surface immediately — they are experienced by maintainers, not just reported by users

### Trade-offs

- Dogfooding requires maintaining the Knowledge files as kdoc evolves — ADRs must be updated when decisions change
- The partial dogfooding (no Roadmap, no Templates, no Guides areas) may be confusing to users who expect a fully populated structure
- The `.kdoc.yaml` reference example in the repo root must be kept in sync with the config schema

## Related Documents

- [[TLDR/integration-claude|integration-claude]] — Skills and agents can maintain kdoc's own Knowledge files
- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — kdoc's hybrid architecture
```

---

## Task 4: TLDRs for CLI Commands (init, add, update, doctor, create, undo)

**Files:**
- Create: `Knowledge/TLDR/cli-init.md`
- Create: `Knowledge/TLDR/cli-add.md`
- Create: `Knowledge/TLDR/cli-update.md`
- Create: `Knowledge/TLDR/cli-doctor.md`
- Create: `Knowledge/TLDR/cli-create.md`
- Create: `Knowledge/TLDR/cli-undo.md`

> **Note on TLDR frontmatter:** kdoc TLDRs use a simplified frontmatter compared to AVShop2 TLDRs. No `area`, `module_path`, or `security-tier` fields — these are CLI subsystems, not web app modules.

### cli-init.md

- [ ] **Step 4.1: Create `Knowledge/TLDR/cli-init.md`**

```markdown
---
type: tldr
id: tldr-cli-init
status: ready
date: 2026-03-18
tags:
  - cli
  - scaffold
summary: Requirements for the kdoc init command — interactive scaffold that installs the Knowledge structure into a target project.
---

# cli-init — Init Command

## Description

`npx kdoc init` is the primary entry point for kdoc. It detects the target project's stack and state, asks the user to confirm configuration, generates a plan of file operations, executes them safely, and produces a report. The command supports both interactive and non-interactive (`--yes`) modes, making it suitable for both first-time setup and CI automation.

## Requirements

- The command MUST detect the project stack by scanning for indicator files (`next.config.*`, `Package.swift`, etc.) at the root and up to 2 levels deep.
- The command MUST detect the current installation state by checking for `.kdoc.yaml`, `.kdoc.lock`, and existing `Knowledge/` subdirectories.
- The command MUST detect installed AI tools by checking for `.claude/`, `.claude-plugin/`, `AGENTS.md`, `.codex/`.
- The command MUST run in interactive mode by default, presenting checkbox prompts for areas and AI tools.
- The command MUST skip all interactive prompts when `--yes` is set, using detected defaults or flag-provided values.
- The command MUST generate a plan (list of file operations with classifications: CREATE / MERGE / SKIP / CONFLICT) and display it before executing.
- The command MUST ask for confirmation before executing the plan (skipped with `--yes`).
- The command MUST create a backup of merged files in `.kdoc.backup/` before the first merge operation.
- The command MUST write `.kdoc.lock.tmp` incrementally during execution and rename to `.kdoc.lock` atomically on completion.
- The command MUST write `.kdoc.yaml` on successful completion.
- The command MUST detect `.kdoc.lock.tmp` on startup and prompt for recovery action: `[R]esume / [U]ndo partial / [S]tart fresh`.
- The command MUST warn if the git working tree has uncommitted changes before executing.
- The command SHOULD support `--dry-run` (shows plan without executing any file operations).
- The command SHOULD support `--verbose` (logs each file operation as it executes).
- The command MAY support `--pack <names>` to pre-select packs without interactive prompt.
- The command MAY support `--tools <names>` to pre-select AI tools without interactive prompt.
- For conflict resolution, `--yes` MUST default to Skip (never overwrites user-modified content without `--force`).
- `--force` MUST imply `--yes` and MUST overwrite user-modified content without asking.

## CLI Contract

```
npx kdoc init [options]

Options:
  --pack <names>     Comma-separated list of packs (e.g., nextjs,swift-ios)
  --tools <names>    Comma-separated list of AI tools (e.g., claude-code,codex)
  --yes              Non-interactive mode; conflicts default to Skip
  --force            Overwrite user-modified files without prompting (implies --yes)
  --dry-run          Show plan without executing
  --verbose          Log each file operation
  -h, --help         Show help
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Blank project: creates full Knowledge structure | Integration | Use temp dir; verify all expected files created |
| Existing project: detects existing dirs, creates only missing | Integration | Pre-populate some dirs; verify no overwrites |
| Re-run on unmodified install: zero file changes | Integration | Run twice; second run exits clean |
| Re-run after user edit: prompts for resolution | Integration | Edit a file; verify prompt appears |
| `--yes` on conflict: defaults to Skip | Integration | Verify user-modified file is not overwritten |
| `--force` on conflict: overwrites | Integration | Verify user-modified file IS overwritten |
| `--dry-run`: shows plan, no files written | Unit | Assert no file system side effects |
| Stack detection: nextjs detected from next.config.ts | Unit | Mock file system |
| Stack detection: swift-ios detected from Package.swift | Unit | Mock file system |
| Crash recovery: `.kdoc.lock.tmp` found → prompts | Integration | Simulate crash by creating .lock.tmp |
| `--pack nextjs`: skips pack selection prompt | Integration | Verify nextjs content is installed |

## Acceptance Criteria

- [ ] `npx kdoc init` on a blank project creates full Knowledge structure in under 30 seconds
- [ ] `npx kdoc init` on AVShop2 detects existing structure and only adds missing pieces
- [ ] Running `npx kdoc init` twice on an unmodified install produces zero file changes and exits cleanly
- [ ] `--dry-run` outputs the operation plan without writing any files
- [ ] `--yes` skips all prompts and defaults to Skip for conflicts
- [ ] `--force` overwrites user-modified content without prompting
- [ ] `.kdoc.yaml` and `.kdoc.lock` are written on successful completion
- [ ] `.kdoc.lock.tmp` is detected and recovery is offered

## Dependencies

- [[TLDR/merge-strategies|merge-strategies]] — Used for CLAUDE.md, AGENTS.md, .gitignore, package.json merging
- [[TLDR/cli-undo|cli-undo]] — Undo uses the lock written by init

## Related ADRs

- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — Merge strategy for existing files
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — Lock file and hash-based idempotency
- [[ADR/ADR-0004-pack-architecture|ADR-0004]] — Pack installation behavior
```

### cli-add.md

- [ ] **Step 4.2: Create `Knowledge/TLDR/cli-add.md`**

```markdown
---
type: tldr
id: tldr-cli-add
status: ready
date: 2026-03-18
tags:
  - cli
  - scaffold
summary: Requirements for the kdoc add, add-pack, and add-tool commands — incrementally extend an existing kdoc installation.
---

# cli-add — Add Commands

## Description

The add commands allow users to extend an existing kdoc installation incrementally, without running `kdoc init` again. Three variants exist: `add <area>` adds a Knowledge area (e.g., threat-models), `add-pack <pack>` adds a technology pack (e.g., nextjs), and `add-tool <tool>` adds an AI tool integration (e.g., codex). All three follow the same transactional pattern: plan → execute → persist config atomically on success.

## Requirements

- All three commands MUST require `.kdoc.yaml` to exist (error if not: "Run `kdoc init` first").
- All three commands MUST validate the argument against the list of valid values.
- All three commands MUST compute the desired `.kdoc.yaml` update in memory before writing, so the config file is only modified on success.
- All three commands MUST follow the same PLAN → EXECUTE flow as `kdoc init`, scoped to the added area/pack/tool.
- All three commands MUST persist `.kdoc.yaml` and `.kdoc.lock` atomically on success.
- On failure, `.kdoc.yaml` MUST remain unchanged — the config never declares areas/packs/tools that were not successfully scaffolded.
- `add-pack <pack>` MUST copy pack templates to `Knowledge/Templates/<pack>/`, guides to `Knowledge/Guides/<pack>/`, scripts to `scripts/kdoc/<pack>/`, and design content to `Knowledge/Design/<pack>/`.
- `add-pack <pack>` MUST merge the pack's enforced-paths into `.kdoc.yaml` (union, deduplicated).
- `add-pack <pack>` MUST update CLAUDE.md and AGENTS.md blocks with pack-specific commands.
- `add-tool <tool>` MUST run the tool's install script (`integrations/<tool>/install.js`).
- The `--yes` and `--force` flags MUST follow the same contract as `kdoc init`.

## CLI Contract

```
npx kdoc add <area> [options]
npx kdoc add-pack <pack> [options]
npx kdoc add-tool <tool> [options]

Valid <area> values:
  adr, tldr, roadmap, design, guides, agent-memory,
  runbooks, threat-models, templates, governance, context-pack, index

Valid <pack> values:
  nextjs, swift-ios

Valid <tool> values:
  claude-code, codex

Options:
  --yes              Non-interactive mode; conflicts default to Skip
  --force            Overwrite user-modified files without prompting (implies --yes)
  -h, --help         Show help
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| `add threat-models`: creates runbooks/threat-models/ | Integration | Pre-existing install without threat-models |
| `add threat-models` when already enabled: no-op or informative | Integration | Verify idempotency |
| `add <invalid>`: error with list of valid values | Unit | Assert error message and exit code 1 |
| No .kdoc.yaml: error message | Unit | Assert error message |
| `add-pack nextjs`: creates all namespaced pack content | Integration | Verify Templates/nextjs/, Guides/nextjs/, etc. |
| `add-pack nextjs` fails midway: .kdoc.yaml unchanged | Integration | Simulate partial failure |
| `add-tool codex`: runs integrations/codex/install.js | Integration | Verify AGENTS.md block created |
| enforced-paths union: no duplicates | Unit | Verify set union logic |

## Acceptance Criteria

- [ ] `add <area>` creates the correct files for the area without affecting other areas
- [ ] `add-pack <pack>` creates all namespaced pack content under `Knowledge/Templates/<pack>/` etc.
- [ ] `add-tool <tool>` runs the tool's install script and updates `.kdoc.yaml`
- [ ] Failure leaves `.kdoc.yaml` unchanged
- [ ] Invalid argument produces a clear error message with valid values listed

## Dependencies

- [[TLDR/cli-init|cli-init]] — `add` requires an existing installation from `init`
- [[TLDR/pack-nextjs|pack-nextjs]] — Content installed by `add-pack nextjs`
- [[TLDR/pack-swift-ios|pack-swift-ios]] — Content installed by `add-pack swift-ios`
- [[TLDR/integration-claude|integration-claude]] — Content installed by `add-tool claude-code`
- [[TLDR/integration-codex|integration-codex]] — Content installed by `add-tool codex`

## Related ADRs

- [[ADR/ADR-0004-pack-architecture|ADR-0004]] — Pack content namespacing
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — Lock file update on add
```

### cli-update.md

- [ ] **Step 4.3: Create `Knowledge/TLDR/cli-update.md`**

```markdown
---
type: tldr
id: tldr-cli-update
status: ready
date: 2026-03-18
tags:
  - cli
  - maintenance
summary: Requirements for the kdoc update command — sync scripts and templates to the current kdoc version.
---

# cli-update — Update Command

## Description

`npx kdoc update` brings an existing kdoc installation up to date with the current kdoc version. It diffs the desired state (current kdoc + `.kdoc.yaml`) against the lock file to produce five operation types (CREATE, UPDATE, REMOVE, RENAME, SKIP), shows a plan, and executes safely. The update command never touches user-created documents (ADRs, TLDRs, etc.) — only files that kdoc originally created or merged and tracks in the lock.

## Requirements

- The command MUST require `.kdoc.yaml` AND `.kdoc.lock` to exist (error with fix instructions if either is missing).
- The command MUST compute a desired-state manifest from the current kdoc version + `.kdoc.yaml`.
- The command MUST diff the desired state against `.kdoc.lock` to produce operations: CREATE, UPDATE, REMOVE, RENAME, SKIP.
- For `created` files: the command MUST compare `templateHash` in lock to current template hash to detect drift; if template unchanged, SKIP; if template changed AND file unmodified (hash matches lock), UPDATE; if template changed AND file modified, prompt `[S]kip / [O]verwrite / [D]iff`.
- For `merged` files: the command MUST regenerate the block, compare with `blockHash` in lock; if unchanged, SKIP; if changed, apply merge strategy.
- For REMOVE operations (file in lock but not in desired state): if file unmodified, DELETE; if modified, prompt `[K]eep / [D]elete / [A]rchive`; with `--yes`, default to Keep.
- For RENAME operations (same `template` field, different path): if file unmodified, MOVE; if modified, prompt `[R]ename / [K]eep at old path`; with `--yes`, default to Rename.
- The command MUST NEVER modify user-created documents (files not in `.kdoc.lock`).
- The command MUST support `--force` (overwrites user-modified managed files) and `--dry-run` (shows plan, no changes).
- The command MUST update `.kdoc.lock` with new hashes and the current kdocVersion after successful execution.

## CLI Contract

```
npx kdoc update [options]

Options:
  --force            Overwrite user-modified files without prompting (implies --yes)
  --dry-run          Show plan without executing
  --yes              Non-interactive mode; conflicts default to Skip/Keep (safe)
  -h, --help         Show help
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Template unchanged: SKIP | Unit | Verify no-op when template hash matches |
| Template changed + file unmodified: UPDATE | Integration | Change source template hash; verify file updated |
| Template changed + file modified: prompts | Integration | Verify prompt appears with Diff option |
| REMOVE: file removed from desired state | Integration | Verify deletion when unmodified |
| RENAME: template moved to new path | Integration | Verify file moved, lock updated |
| `--dry-run`: no files written | Unit | Assert no file system side effects |
| User document not in lock: never touched | Integration | Create a user ADR; verify it is not modified |

## Acceptance Criteria

- [ ] Re-running `kdoc update` on an unmodified install produces zero changes (idempotent)
- [ ] `--dry-run` shows the operation plan without writing any files
- [ ] User-created documents (ADRs, TLDRs) are never modified by `update`
- [ ] Template drift (changed source template) is detected and offered to the user
- [ ] RENAME operations move files and update the lock atomically

## Dependencies

- [[TLDR/cli-init|cli-init]] — `update` requires an existing installation
- [[TLDR/merge-strategies|merge-strategies]] — Block regeneration uses merge strategies

## Related ADRs

- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — templateHash and blockHash for drift detection
- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — Merged file block update strategy
```

### cli-doctor.md

- [ ] **Step 4.4: Create `Knowledge/TLDR/cli-doctor.md`**

```markdown
---
type: tldr
id: tldr-cli-doctor
status: ready
date: 2026-03-18
tags:
  - cli
  - health
  - governance
summary: Requirements for the kdoc doctor command — health check across config, structure, scripts, integrations, and governance.
---

# cli-doctor — Doctor Command

## Description

`npx kdoc doctor` performs a comprehensive health check of the kdoc installation in the current project. It validates five categories: config validity, expected directory structure, script presence and freshness, AI tool integration markers, and governance (if scripts are available). Results are presented as a formatted report with pass/fail/warn indicators. Machine-readable JSON output is available via `--json`.

## Requirements

- The command MUST check CONFIG: `.kdoc.yaml` exists and is valid (Zod schema); `.kdoc.lock` exists and matches `.kdoc.yaml` areas; no `.kdoc.lock.tmp` (no interrupted install).
- The command MUST check STRUCTURE: per enabled area, expected directory and required files exist (driven by `knowledge-structure.json` expectation types).
- The command MUST check SCRIPTS: each expected script exists in `scripts/kdoc/`; script content hash matches the current kdoc version's hash (outdated if different).
- The command MUST check INTEGRATIONS: CLAUDE.md has kdoc block (if `claude-code` in tools); AGENTS.md has kdoc block (if `codex` in tools); `package.json` has `kdoc:*` scripts.
- The command MUST check GOVERNANCE: if scripts exist, run `check_adr_governance.py`, `check_wikilinks.py`, and compare INDEX.md to generated output.
- The command MUST output a formatted report with per-check status (✓/✗/⚠), category grouping, and a summary (`N pass, N fail, N warn`).
- The command MUST support `--json` for machine-readable output matching the documented JSON schema.
- The command MUST exit with code 0 if all checks pass, 1 if failures are found, 2 if config is invalid.
- The command SHOULD provide a `fix:` hint for each failed check (suggested command to resolve the issue).
- The command MUST degrade gracefully when Python is not available: skip governance checks, report as warn (not fail).

## CLI Contract

```
npx kdoc doctor [options]

Options:
  --json             Output JSON instead of formatted text
  -h, --help         Show help

Exit codes:
  0   All checks pass
  1   One or more checks failed
  2   Config error (cannot read .kdoc.yaml or .kdoc.lock)
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Healthy installation: all pass | Integration | Full install; verify exit code 0 |
| Missing area directory: fail with fix hint | Integration | Delete a dir; verify check fails |
| Outdated script: warn with version hint | Integration | Modify script hash; verify warn |
| No CLAUDE.md block: fail with fix hint | Integration | Remove markers; verify integration check fails |
| `--json` output: matches JSON schema | Unit | Verify all required fields present |
| Python not available: governance skipped as warn | Unit | Mock Python unavailability |
| `.kdoc.lock.tmp` present: fails config check | Unit | Simulate interrupted install |

## Acceptance Criteria

- [ ] `kdoc doctor` accurately reports health across all five categories
- [ ] `--json` output matches the documented JSON schema exactly
- [ ] Exit code is 0 when healthy, 1 when issues found, 2 on config error
- [ ] Each failed check includes a suggested fix command
- [ ] Python unavailability produces a warning, not a failure

## Dependencies

- [[TLDR/cli-init|cli-init]] — Doctor checks the installation created by init
- [[TLDR/merge-strategies|merge-strategies]] — Integration checks verify marker presence

## Related ADRs

- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — Lock file used by doctor checks
- [[ADR/ADR-0006-python-plus-typescript-split|ADR-0006]] — Doctor invokes Python scripts as subprocesses
```

### cli-create.md

- [ ] **Step 4.5: Create `Knowledge/TLDR/cli-create.md`**

```markdown
---
type: tldr
id: tldr-cli-create
status: ready
date: 2026-03-18
tags:
  - cli
  - documents
summary: Requirements for the kdoc create command — create a new ADR, TLDR, guide, threat model, runbook, or test map from a template.
---

# cli-create — Create Command

## Description

`npx kdoc create <type> [name]` creates a new document from the appropriate template, fills placeholders (date, sequential number, name), and writes the file to the correct path. It does not modify `.kdoc.lock` — user-created documents are explicitly not tracked by the toolkit. The create command is the CLI equivalent of the Claude Code `kdoc:adr-create` and `kdoc:tldr-create` skills.

## Requirements

- The command MUST support these types: `adr`, `tldr`, `phase`, `sub-phase`, `guide`, `threat-model`, `runbook`, `test-map`.
- The command MUST require `name` for all types.
- For `adr`: the command MUST auto-compute the next sequential number by globbing `Knowledge/ADR/ADR-*.md` and taking `max(NNNN) + 1`, zero-padded to 4 digits.
- For `tldr`: the command MUST require `--scope <scope>` and write to `Knowledge/TLDR/<scope>/<name>.md`.
- The command MUST fill all template placeholders (`{{ID}}`, `{{TITLE}}`, `{{DATE}}`, etc.) at creation time.
- The command MUST warn (not error) if a placeholder has no value, leaving the literal `{{KEY}}` text in the output.
- The command MUST print the path of the created file on success.
- The command SHOULD require `.kdoc.yaml` to exist (error if not: "Run `kdoc init` first").
- The command MAY support `--status <status>` for ADR (default: `proposed`) and TLDR (default: `draft`).
- The command MUST NOT overwrite an existing file at the target path — it MUST error and instruct the user to choose a different name.

## CLI Contract

```
npx kdoc create <type> [name] [options]

Types and output paths:
  adr <name>          → Knowledge/ADR/ADR-{NNNN}-{name}.md
  tldr <name>         → Knowledge/TLDR/{scope}/{name}.md    (requires --scope)
  phase <name>        → Knowledge/Roadmap/phases/phase-{N}.md
  sub-phase <name>    → Knowledge/Roadmap/phases/phase-{N}/{M}.md
  guide <name>        → Knowledge/Guides/{name}.md
  threat-model <name> → Knowledge/runbooks/threat-models/{name}.md
  runbook <name>      → Knowledge/runbooks/{name}.md
  test-map <name>     → Knowledge/Templates/{name}-test-map.md

Options:
  --scope <scope>    Required for tldr type; sets TLDR/<scope>/ subdirectory
  --status <status>  Initial status (default: proposed for adr, draft for tldr)
  -h, --help         Show help
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| `create adr my-decision`: creates ADR-0001-my-decision.md | Integration | Blank ADR dir; verify sequential numbering |
| Sequential numbering with gaps: ADR-0003 → ADR-0004 | Unit | Mock glob results with gap |
| `create tldr my-feature --scope Shop`: correct path | Integration | Verify Knowledge/TLDR/Shop/my-feature.md |
| `create tldr` without `--scope`: error | Unit | Verify error message |
| Existing file at target path: error | Unit | Pre-create file; verify error, no overwrite |
| Placeholder substitution: {{DATE}} filled | Unit | Verify date is today's date in output |
| Missing placeholder: warn, leave literal | Unit | Template with unknown key; verify warning |

## Acceptance Criteria

- [ ] `kdoc create adr <name>` creates a correctly numbered ADR with today's date
- [ ] `kdoc create tldr <name> --scope <scope>` creates TLDR at correct path
- [ ] Sequential numbering correctly finds the next available ADR number
- [ ] All standard placeholders (`{{ID}}`, `{{TITLE}}`, `{{DATE}}`) are filled at creation
- [ ] Creating at an existing path errors without overwriting

## Dependencies

- [[TLDR/cli-init|cli-init]] — `create` requires an existing installation

## Related ADRs

- [[ADR/ADR-0007-yaml-config-format|ADR-0007]] — Reads `.kdoc.yaml` to find Knowledge root
```

### cli-undo.md

- [ ] **Step 4.6: Create `Knowledge/TLDR/cli-undo.md`**

```markdown
---
type: tldr
id: tldr-cli-undo
status: ready
date: 2026-03-18
tags:
  - cli
  - safety
  - undo
summary: Requirements for the kdoc undo command — revert all scaffold operations using the lock file.
---

# cli-undo — Undo Command

## Description

`npx kdoc undo` reverses all file operations recorded in `.kdoc.lock`, returning the project to its pre-kdoc state. For `created` files, it deletes them (with user-edit protection). For `merged` files, it removes the kdoc-injected blocks from the file content. After undoing all file operations, it removes the lock file and optionally removes `.kdoc.yaml`. The command supports `--keep-config` to preserve `.kdoc.yaml` for future re-initialization.

## Requirements

- The command MUST read `.kdoc.lock` (or `.kdoc.lock.tmp` if `.kdoc.lock` is absent).
- For `created` files: the command MUST compare current hash against lock hash; if unmodified, DELETE; if modified (user edited), prompt `[K]eep / [A]rchive to .kdoc.backup/ / [D]elete --force`; with `--yes`, default to Keep.
- For `created` files: after deletion, the command MUST walk ancestor directories up to (but not including) the Knowledge root and delete directories that are empty (no files, tracked or untracked).
- For `merged` files (strategy `markers`): the command MUST find the named markers, remove everything between them (inclusive), and write the file back; if the file is now empty, delete it.
- For `merged` files (strategy `prefix`): the command MUST remove all keys with the `kdoc:` prefix from `package.json` or `turbo.json` scripts/tasks.
- After all file operations, the command MUST delete `.kdoc.lock` and `.kdoc.lock.tmp` (whichever exists).
- The command MUST delete `.kdoc.backup/` if it exists.
- The command MUST prompt: `"Remove .kdoc.yaml too? [Y/n]"` after undoing file operations.
- `--keep-config` MUST skip the `.kdoc.yaml` prompt and preserve the file.
- `--force` MUST delete user-modified created files without prompting.
- The command MUST skip (with warning) any merged file that has been deleted by the user.

## CLI Contract

```
npx kdoc undo [options]

Options:
  --keep-config      Preserve .kdoc.yaml after undo
  --yes              Non-interactive mode; user-modified files default to Keep
  --force            Delete user-modified created files without prompting (implies --yes)
  -h, --help         Show help
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Full undo on unmodified install: all files deleted | Integration | Init then undo; verify clean state |
| User-modified created file: prompts (default Keep) | Integration | Edit a created file; verify prompt |
| `--force` on user-modified file: deletes | Integration | Verify deletion without prompt |
| Marker block removal: removes block, preserves surrounding content | Unit | Verify before/after file content |
| Prefix removal: removes kdoc:* from package.json | Unit | Verify scripts object after undo |
| Empty parent directory cleanup: removed | Integration | Verify parent dirs deleted when empty |
| Deleted merged file: skipped with warning | Integration | Delete merged file; verify warning |
| `--keep-config`: .kdoc.yaml preserved | Integration | Verify .kdoc.yaml present after undo |
| Lock reads .lock.tmp if .lock absent | Unit | Simulate crash; verify recovery |

## Acceptance Criteria

- [ ] `kdoc undo` cleanly reverses all scaffold operations on an unmodified install
- [ ] User-edited created files default to Keep with `--yes` (safe)
- [ ] Marker blocks are removed precisely — surrounding content is untouched
- [ ] `kdoc:*` scripts are removed from `package.json` without touching other keys
- [ ] Empty parent directories are cleaned up after file deletion
- [ ] `.kdoc.yaml` prompt appears at the end; `--keep-config` skips it

## Dependencies

- [[TLDR/cli-init|cli-init]] — `undo` reverses what `init` created
- [[TLDR/merge-strategies|merge-strategies]] — Block removal uses marker strategy logic

## Related ADRs

- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — How marker blocks are identified and removed
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — Lock file provides the undo manifest
```

---

## Task 5: TLDRs for Subsystems (merge-strategies, pack-nextjs, pack-swift-ios, integration-claude, integration-codex)

**Files:**
- Create: `Knowledge/TLDR/merge-strategies.md`
- Create: `Knowledge/TLDR/pack-nextjs.md`
- Create: `Knowledge/TLDR/pack-swift-ios.md`
- Create: `Knowledge/TLDR/integration-claude.md`
- Create: `Knowledge/TLDR/integration-codex.md`

### merge-strategies.md

- [ ] **Step 5.1: Create `Knowledge/TLDR/merge-strategies.md`**

```markdown
---
type: tldr
id: tldr-merge-strategies
status: ready
date: 2026-03-18
tags:
  - merge
  - scaffold
  - safety
summary: Requirements for kdoc's three merge strategies — marker-based, key-prefix, and task-prefix.
---

# merge-strategies — Merge Strategy Subsystem

## Description

The merge strategy subsystem handles safe content injection into files that already exist in the target project. Three strategies cover the three file types that kdoc touches: marker-based for Markdown/plain-text config files, key-prefix for `package.json` scripts, and task-prefix for `turbo.json` tasks. Each strategy is independently implemented and dispatched by the strategy dispatcher based on file type.

## Requirements

### Marker-Based Strategy (CLAUDE.md, AGENTS.md, .gitignore)

- The strategy MUST support named marker pairs per file type:
  - Markdown files: `<!-- kdoc:<name>:start -->` / `<!-- kdoc:<name>:end -->`
  - Plain-text files (.gitignore): `# kdoc:<name>:start` / `# kdoc:<name>:end`
- The strategy MUST handle 6 cases: file does not exist (create), markers absent (append), markers found (replace between), corrupted markers (error), duplicate markers (error), user edited between markers (hash conflict prompt).
- The strategy MUST compute `blockHash` as the SHA-256 of the content between markers (inclusive of the marker lines themselves) after injection.
- The strategy MUST support multiple named blocks coexisting in the same file (core + pack blocks).
- The strategy MUST record `markerName` in `.kdoc.lock` for each merged file.
- On user-edited block detection, the strategy MUST prompt `[S]kip / [O]verwrite / [D]iff`; with `--yes`, default to Skip.

### Key-Prefix Strategy (package.json)

- The strategy MUST identify all keys with the `kdoc:` prefix in the `"scripts"` object.
- On install: the strategy MUST add all `kdoc:*` keys to the scripts object without touching other keys.
- On update: the strategy MUST replace values of `kdoc:*` keys.
- On undo: the strategy MUST remove all `kdoc:*` keys.
- The strategy MUST never touch keys without the `kdoc:` prefix.

### Task-Prefix Strategy (turbo.json)

- The strategy MUST follow the same rules as key-prefix, applied to the `"tasks"` object in `turbo.json`.
- The strategy MUST only be applied if `turbo.json` exists in the project root.

### Strategy Dispatcher

- The dispatcher MUST select the correct strategy based on the file being merged.
- The dispatcher MUST be the single point of entry for all merge operations.
- The dispatcher MUST not expose file-type logic to callers — callers pass the file path and block content.

## CLI Contract

The merge strategies are not directly invoked by the user — they are called by `kdoc init`, `kdoc add`, and `kdoc update` internally.

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Marker append: file exists without markers | Unit | Verify block appended at end |
| Marker replace: file exists with markers | Unit | Verify content between markers replaced |
| Marker create: file does not exist | Unit | Verify file created with block |
| Corrupted marker (only start): error | Unit | Verify error message and no file change |
| Multiple named blocks: both coexist | Unit | core + pack:nextjs in same file |
| User-edited block: hash differs → Skip prompt | Unit | Verify prompt with default Skip |
| key-prefix add: kdoc:* added, other keys untouched | Unit | Verify package.json modification |
| key-prefix undo: kdoc:* removed, other keys intact | Unit | Verify keys removed cleanly |
| task-prefix: only applied if turbo.json exists | Unit | Mock file system with/without turbo.json |

## Acceptance Criteria

- [ ] Marker replace leaves all content outside markers completely unchanged
- [ ] Multiple named blocks coexist in CLAUDE.md without interfering
- [ ] Corrupted markers (only one of the pair) produce an error with actionable instructions
- [ ] `package.json` keys without `kdoc:` prefix are never modified
- [ ] `turbo.json` task-prefix strategy is skipped when `turbo.json` does not exist

## Dependencies

- None (foundational subsystem)

## Related ADRs

- [[ADR/ADR-0001-marker-based-merging|ADR-0001]] — Marker strategy decision
- [[ADR/ADR-0002-hash-manifest-idempotency|ADR-0002]] — blockHash computed by marker strategy
```

### pack-nextjs.md

- [ ] **Step 5.2: Create `Knowledge/TLDR/pack-nextjs.md`**

```markdown
---
type: tldr
id: tldr-pack-nextjs
status: ready
date: 2026-03-18
tags:
  - pack
  - nextjs
summary: Requirements for the kdoc Next.js technology pack — additional templates, scripts, guides, and design standards for Next.js projects.
---

# pack-nextjs — Next.js Technology Pack

## Description

The `nextjs` pack extends the universal kdoc core with documentation artifacts specific to Next.js projects: page and flow specification templates, route contract templates, route contract validation scripts, onboarding guides, and design standards. All content is installed under `Knowledge/Templates/nextjs/`, `Knowledge/Guides/nextjs/`, `Knowledge/Design/nextjs/`, and `scripts/kdoc/nextjs/` — strict namespacing that prevents collision with other packs.

## Requirements

- The pack MUST be auto-detected when `next.config.ts`, `next.config.js`, or `next.config.mjs` is found at the root or up to 2 levels deep, OR when `next` appears in `dependencies` or `devDependencies`.
- The pack MUST install 4 templates: `page-spec.md`, `flow-spec.md`, `route-contract.md`, `recipe.md` — all under `Knowledge/Templates/nextjs/`.
- The pack MUST install 1 script: `check_route_contracts.ts` — under `scripts/kdoc/nextjs/`.
- The pack MUST install 3 guides: `onboarding.md`, `troubleshooting.md`, `module-placement.md` — under `Knowledge/Guides/nextjs/`.
- The pack MUST install design content: `tokens-template.json` under `Knowledge/Design/nextjs/tokens/`; `ui-patterns.md`, `responsive-strategy.md`, `accessibility.md` under `Knowledge/Design/nextjs/standards/`.
- The pack MUST create scope directories under `Knowledge/Design/nextjs/` for each default scope (`Admin`, `Shop`, `Shared`) or user-configured scopes.
- The pack MUST set default enforced-paths to `["apps/*/src/modules/", "apps/*/src/core/", "apps/*/src/app/api/", "packages/*/src/"]`.
- The pack MUST set default scripts-prefix to `kdoc` and scripts-runner to `pnpm`.
- The pack's `pack.json` MUST include detection rules, defaults, and metadata.
- All pack content paths MUST be namespaced under `<pack-name>/` (never installed at root).

## CLI Contract

Activated via:
```
npx kdoc init --pack nextjs
npx kdoc add-pack nextjs
```

Configuration in `.kdoc.yaml`:
```yaml
packs: [nextjs]
areas:
  tldr:
    scopes: [Admin, Shop, Shared]   # default scopes for nextjs pack
governance:
  enforced-paths:
    - apps/*/src/modules/
    - apps/*/src/core/
    - apps/*/src/app/api/
    - packages/*/src/
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Auto-detect: next.config.ts found | Unit | Mock file system |
| Install: all 4 templates created | Integration | Verify paths under Knowledge/Templates/nextjs/ |
| Install: scope directories created | Integration | Verify Knowledge/Design/nextjs/Admin/ etc. |
| `add-pack nextjs`: enforced-paths merged to .kdoc.yaml | Integration | Verify union deduplicated |
| Multi-pack: nextjs + swift-ios no collision | Integration | Verify separate namespaces |

## Acceptance Criteria

- [ ] `npx kdoc init --pack nextjs` creates all nextjs-namespaced content
- [ ] Default scopes (Admin, Shop, Shared) produce corresponding design directories
- [ ] Enforced-paths from pack defaults are merged into `.kdoc.yaml`
- [ ] No file collisions with `pack:swift-ios` content when both are installed

## Dependencies

- [[TLDR/cli-init|cli-init]] — Pack is installed via init or add-pack
- [[TLDR/cli-add|cli-add]] — add-pack nextjs command

## Related ADRs

- [[ADR/ADR-0004-pack-architecture|ADR-0004]] — Pack namespacing and architecture
```

### pack-swift-ios.md

- [ ] **Step 5.3: Create `Knowledge/TLDR/pack-swift-ios.md`**

```markdown
---
type: tldr
id: tldr-pack-swift-ios
status: ready
date: 2026-03-18
tags:
  - pack
  - swift-ios
summary: Requirements for the kdoc Swift/iOS technology pack — additional templates, scripts, guides, and design standards for Swift/iOS projects.
---

# pack-swift-ios — Swift/iOS Technology Pack

## Description

The `swift-ios` pack extends the universal kdoc core with documentation artifacts specific to Swift/iOS projects: screen and flow specification templates, API contract templates, SPM module dependency validation scripts, onboarding guides, and iOS-specific design standards (HIG patterns, accessibility). All content is installed under namespaced paths to prevent collision with other packs.

## Requirements

- The pack MUST be auto-detected when `Package.swift`, `*.xcodeproj`, or `*.xcworkspace` is found at the root or up to 2 levels deep.
- The pack MUST install 4 templates: `screen-spec.md`, `flow-spec.md`, `api-contract.md`, `recipe.md` — all under `Knowledge/Templates/swift-ios/`.
- The pack MUST install 1 script: `check_module_deps.sh` — under `scripts/kdoc/swift-ios/`. This script uses Xcode tooling and is macOS-only.
- The pack MUST install 3 guides: `onboarding.md`, `troubleshooting.md`, `module-placement.md` — under `Knowledge/Guides/swift-ios/`.
- The pack MUST install design content: `tokens-template.json` under `Knowledge/Design/swift-ios/tokens/`; `hig-patterns.md`, `accessibility.md` under `Knowledge/Design/swift-ios/standards/`.
- The pack MUST create scope directories under `Knowledge/Design/swift-ios/` for each default scope (`App`, `Shared`) or user-configured scopes.
- The pack MUST set default enforced-paths to `["Sources/*/Modules/", "Sources/*/Core/", "Packages/*/Sources/"]`.
- The pack MUST set default scripts-runner to `make` (SPM projects typically use Makefiles, not pnpm).
- The pack's `pack.json` MUST document `check_module_deps.sh` as macOS-only.

## CLI Contract

Activated via:
```
npx kdoc init --pack swift-ios
npx kdoc add-pack swift-ios
```

Configuration in `.kdoc.yaml`:
```yaml
packs: [swift-ios]
areas:
  tldr:
    scopes: [App, Shared]   # default scopes for swift-ios pack
governance:
  enforced-paths:
    - Sources/*/Modules/
    - Sources/*/Core/
    - Packages/*/Sources/
scripts:
  runner: make
```

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| Auto-detect: Package.swift found | Unit | Mock file system |
| Auto-detect: .xcodeproj found | Unit | Mock file system with glob |
| Install: all 4 templates created | Integration | Verify paths under Knowledge/Templates/swift-ios/ |
| Install: scope directories created | Integration | Verify Knowledge/Design/swift-ios/App/ etc. |
| `add-pack swift-ios`: enforced-paths merged | Integration | Verify union with existing paths |
| check_module_deps.sh installed with macOS note | Integration | Verify file and pack.json metadata |

## Acceptance Criteria

- [ ] `npx kdoc init --pack swift-ios` creates all swift-ios-namespaced content
- [ ] Default scopes (App, Shared) produce corresponding design directories
- [ ] `check_module_deps.sh` is documented as macOS-only in `pack.json`
- [ ] No file collisions with `pack:nextjs` content when both are installed

## Dependencies

- [[TLDR/cli-init|cli-init]] — Pack is installed via init or add-pack
- [[TLDR/cli-add|cli-add]] — add-pack swift-ios command

## Related ADRs

- [[ADR/ADR-0004-pack-architecture|ADR-0004]] — Pack namespacing and architecture
- [[ADR/ADR-0006-python-plus-typescript-split|ADR-0006]] — check_module_deps.sh is the one shell script exception (pack-specific, macOS tooling)
```

### integration-claude.md

- [ ] **Step 5.4: Create `Knowledge/TLDR/integration-claude.md`**

```markdown
---
type: tldr
id: tldr-integration-claude
status: ready
date: 2026-03-18
tags:
  - integration
  - claude-code
  - plugin
summary: Requirements for the Claude Code integration — plugin manifest, 12 skills, 4 agents, and 2 hooks.
---

# integration-claude — Claude Code Integration

## Description

The Claude Code integration provides a rich AI-native documentation experience via the kdoc Claude Code plugin. It consists of a plugin manifest, 12 skills for common Knowledge operations, 4 agents for documentation auditing (including parallel sub-agents), and 2 hooks for session startup and pre-push validation. The plugin is installed by `add-tool claude-code` or `kdoc init --tools claude-code`.

## Requirements

### Plugin Manifest

- The plugin MUST have a `.claude-plugin/plugin.json` manifest with name, description, version, and author.
- The manifest MUST declare identity only; skills, agents, hooks, and MCP servers are discovered by convention from their directories at the plugin root.

### Skills (12)

The integration MUST provide 12 skills, each as a `SKILL.md` file in `skills/<name>/`:

| Skill | Trigger Patterns | Produces |
|-------|-----------------|----------|
| `kdoc:scaffold` | "scaffold knowledge", "kdoc init" | Invokes CLI or scaffolds inline |
| `kdoc:adr-create` | "create ADR", "new decision" | Filled ADR at correct sequential path |
| `kdoc:adr-validate` | "validate ADRs" | Governance report from check_adr_governance.py |
| `kdoc:tldr-create` | "create TLDR", "document module" | Filled TLDR at correct scoped path |
| `kdoc:tldr-update-status` | "mark TLDR as done" | Updated frontmatter + removed gap tags |
| `kdoc:roadmap-add-phase` | "add phase to roadmap" | Phase + sub-phase files from templates |
| `kdoc:roadmap-update` | "update phase status" | Updated frontmatter status + dashboard |
| `kdoc:design-create-spec` | "create page spec", "create screen spec" | Pack-correct spec file |
| `kdoc:governance-check` | "check knowledge", "kdoc doctor" | All validation scripts run and reported |
| `kdoc:memory-save` | "save to memory", "remember" | Created/updated file in AgentMemory/ |
| `kdoc:create-guide` | "create onboarding guide" | Filled guide template |
| `kdoc:create-threat-model` | "threat model for auth" | Filled STRIDE threat-model template |

- Each skill MUST include trigger patterns, a workflow description, and constraints.
- The `kdoc:adr-create` skill MUST auto-compute the next sequential ADR number using the same algorithm as the CLI `create adr` command.
- The `kdoc:design-create-spec` skill MUST detect the active pack from `.kdoc.yaml` and use the correct template (page-spec for nextjs, screen-spec for swift-ios).

### Agents (4)

The integration MUST provide 4 agent definitions in `agents/claude-code/`:

| Agent | Type | Leverages |
|-------|------|-----------|
| `knowledge-auditor` | Orchestrator | Parallel sub-agents |
| `adr-auditor` | Sub-agent | Mass ADR file reading + governance rules |
| `tldr-sync-checker` | Sub-agent | Gap tag analysis + wikilink validation |
| `roadmap-builder` | Sub-agent | Phase + TLDR + evidence aggregation |

- The `knowledge-auditor` agent MUST launch all 3 sub-agents in parallel.
- The `knowledge-auditor` agent MUST consolidate sub-agent reports into a `governance-health.md` file.

### Hooks (2)

The integration MUST provide 2 hooks in `hooks/`:

| Hook | Event | Behavior |
|------|-------|----------|
| `session-start.mjs` | `SessionStart` | Reads `.kdoc.yaml`, injects active areas summary and available commands |
| `pre-push-check.mjs` | `PreToolUse` (Bash with git push) | Warns if `kdoc:check` not run since last commit |

- The `pre-push-check.mjs` hook MUST only fire when `git push` is executed via Claude's Bash tool (not terminal git push).

## CLI Contract

Installed via:
```
npx kdoc init --tools claude-code
npx kdoc add-tool claude-code
```

What is written to the target project:
- `skills/` directory with 12 skill SKILL.md files
- `agents/claude-code/` directory with 4 agent markdown files
- `hooks/hooks.json` + 2 hook scripts
- `.claude-plugin/plugin.json`
- CLAUDE.md block (via markers) documenting kdoc commands and Knowledge areas

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| `add-tool claude-code`: all files installed | Integration | Verify all skill, agent, hook files present |
| CLAUDE.md block injected with correct content | Integration | Verify marker presence and commands |
| Plugin manifest valid JSON | Unit | Parse and validate structure |
| `undo` removes integration: CLAUDE.md block stripped | Integration | Verify undo removes block |

## Acceptance Criteria

- [ ] `add-tool claude-code` installs all 12 skills, 4 agents, 2 hooks, and plugin manifest
- [ ] CLAUDE.md block is injected via markers and contains kdoc commands reference
- [ ] `kdoc undo` removes the CLAUDE.md block and all installed files
- [ ] Plugin manifest is valid JSON matching the documented schema

## Dependencies

- [[TLDR/cli-add|cli-add]] — `add-tool claude-code` command
- [[TLDR/merge-strategies|merge-strategies]] — CLAUDE.md block injection

## Related ADRs

- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — CLI + Plugin hybrid rationale
- [[ADR/ADR-0005-native-agents-per-tool|ADR-0005]] — Claude Code native agents decision
```

### integration-codex.md

- [ ] **Step 5.5: Create `Knowledge/TLDR/integration-codex.md`**

```markdown
---
type: tldr
id: tldr-integration-codex
status: ready
date: 2026-03-18
tags:
  - integration
  - codex
summary: Requirements for the Codex CLI integration — generated AGENTS.md block and .codex/agents/ audit template.
---

# integration-codex — Codex CLI Integration

## Description

The Codex CLI integration provides equivalent kdoc capabilities to Claude Code, using Codex's native extension model: AGENTS.md blocks for persistent domain knowledge and multi-stream agent templates for parallel auditing. There is no plugin, skill, or hook system — everything is text-based instructions. The integration is installed by `add-tool codex` or `kdoc init --tools codex`.

## Requirements

- The integration MUST generate an AGENTS.md block (using markers) containing:
  - Knowledge structure description (areas, paths, what each area contains)
  - Rules for when to update Knowledge documents
  - Multi-stream audit templates (3 streams: ADR auditor, TLDR checker, roadmap builder)
  - Available validation commands (kdoc:check, kdoc:index, etc.)
- The AGENTS.md block MUST use the marker name `core` (consistent with Claude Code integration).
- The integration MUST generate a `.codex/agents/knowledge-auditor/instructions.md` file with multi-stream audit instructions equivalent to the Claude Code `knowledge-auditor` agent.
- The integration MUST be implemented in `integrations/codex/install.js` (a Node.js script, not a shell script).
- The integration MUST update `.kdoc.lock` on successful installation with the merged AGENTS.md entry.

## CLI Contract

Installed via:
```
npx kdoc init --tools codex
npx kdoc add-tool codex
```

What is written to the target project:
- AGENTS.md block (via markers) documenting kdoc commands, Knowledge structure, and audit templates
- `.codex/agents/knowledge-auditor/instructions.md` with multi-stream audit instructions

## Test Scenarios

| Scenario | Test Level | Notes |
|----------|-----------|-------|
| `add-tool codex`: AGENTS.md block injected | Integration | Verify marker presence and content |
| AGENTS.md block contains multi-stream template | Unit | Assert 3 stream references in generated content |
| `.codex/agents/knowledge-auditor/` created | Integration | Verify file exists and has content |
| `undo`: AGENTS.md block stripped cleanly | Integration | Verify block removal, surrounding content intact |
| Codex integration + Claude Code integration coexist | Integration | Both tools in .kdoc.yaml; both blocks present |

## Acceptance Criteria

- [ ] `add-tool codex` injects AGENTS.md block with Knowledge structure and multi-stream templates
- [ ] `.codex/agents/knowledge-auditor/instructions.md` is created with audit instructions
- [ ] `kdoc undo` removes the AGENTS.md block and `.codex/agents/knowledge-auditor/` files
- [ ] Codex and Claude Code integrations can coexist in the same project without conflict

## Dependencies

- [[TLDR/cli-add|cli-add]] — `add-tool codex` command
- [[TLDR/merge-strategies|merge-strategies]] — AGENTS.md block injection

## Related ADRs

- [[ADR/ADR-0003-cli-plus-plugin-hybrid|ADR-0003]] — CLI + Plugin hybrid rationale
- [[ADR/ADR-0005-native-agents-per-tool|ADR-0005]] — Native agents per AI tool decision
```

---

## Task 6: ContextPack.md + .kdoc.yaml Reference Config

**Files:**
- Create: `Knowledge/ContextPack.md`
- Create: `.kdoc.yaml`

### ContextPack.md

- [ ] **Step 6.1: Create `Knowledge/ContextPack.md`**

```markdown
---
type: context-pack
id: context-pack-kdoc
status: ready
date: 2026-03-18
tags:
  - onboarding
  - quick-start
summary: Quick-start context for anyone (human or AI) maintaining kdoc.
---

# kdoc — ContextPack

**What is kdoc?** A hybrid CLI toolkit + Claude Code plugin that scaffolds and maintains Knowledge documentation structures across projects. It installs ADR governance, TLDR functional requirements, Roadmap, design specs, guides, agent memory, and governance validation into any project — safely, incrementally, and idempotently.

## Quick Navigation

| Goal | Where to Look |
|------|--------------|
| Understand a CLI command | `Knowledge/TLDR/cli-<name>.md` |
| Understand a design decision | `Knowledge/ADR/ADR-00NN-*.md` |
| Understand merge strategies | `Knowledge/TLDR/merge-strategies.md` |
| Understand pack content | `Knowledge/TLDR/pack-<name>.md` |
| Understand Claude Code integration | `Knowledge/TLDR/integration-claude.md` |
| Understand Codex CLI integration | `Knowledge/TLDR/integration-codex.md` |
| Full design spec | `docs/superpowers/specs/2026-03-17-kdoc-design.md` |

## Repository Layout

```
kdoc/
├── cli/                 # TypeScript CLI (commands, scaffold, config, utils)
├── core/                # Universal content (templates, scripts, schemas, governance)
├── packs/               # Technology packs (nextjs, swift-ios)
│   ├── nextjs/
│   └── swift-ios/
├── integrations/        # AI tool install scripts
│   ├── claude-code/
│   └── codex/
├── skills/              # Claude Code skills (12)
├── agents/              # AI agents (claude-code/, codex/)
├── hooks/               # Claude Code hooks (session-start, pre-push-check)
├── Knowledge/           # kdoc's own documentation (dogfooding)
│   ├── ADR/             # Architectural decisions (8)
│   ├── TLDR/            # Functional requirements (11)
│   ├── ContextPack.md   # This file
│   └── INDEX.md         # Auto-generated index
├── .kdoc.yaml           # kdoc's own config (reference example)
└── docs/superpowers/    # Design specs and implementation plans
```

## Key Concepts

### Idempotency
All commands can be run multiple times safely. The `.kdoc.lock` file tracks managed files. Re-running produces no changes when files are unmodified.

### Marker-Based Merging
kdoc injects content into CLAUDE.md, AGENTS.md, and .gitignore using named marker pairs (`<!-- kdoc:core:start -->` / `<!-- kdoc:core:end -->`). Content outside markers is never touched.

### Packs
Technology-specific content (templates, scripts, guides) is organized into packs. Each pack's content is installed under a namespaced path (e.g., `Knowledge/Templates/nextjs/`). Multiple packs coexist without collision.

### Lock File
`.kdoc.lock` records every file kdoc created or merged, with SHA-256 hashes for change detection. Committed to git — shared by all team members.

## ADR Index

- ADR-0001: Marker-based merging
- ADR-0002: Hash manifest idempotency
- ADR-0003: CLI + Plugin hybrid
- ADR-0004: Pack architecture
- ADR-0005: Native agents per AI tool
- ADR-0006: TypeScript + Python split
- ADR-0007: YAML config format
- ADR-0008: Dogfooding

## TLDR Index

- cli-init, cli-add, cli-update, cli-doctor, cli-create, cli-undo
- merge-strategies
- pack-nextjs, pack-swift-ios
- integration-claude, integration-codex

## Dev Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build CLI (tsup) |
| `pnpm test` | Run Vitest tests |
| `pnpm typecheck` | TypeScript --noEmit |
| `pnpm lint` | ESLint |
| `node cli/dist/index.js --help` | Test built CLI |
```

### .kdoc.yaml Reference Config

- [ ] **Step 6.2: Create `.kdoc.yaml` at the kdoc repo root**

```yaml
# kdoc's own .kdoc.yaml — reference example showing all available options.
# This is the configuration used by kdoc to document itself (dogfooding).
# See Knowledge/TLDR/cli-init.md for full option documentation.

version: 1
root: Knowledge
packs: []           # kdoc itself is not a Next.js or Swift project
tools: []           # kdoc manages this config manually (no AI tool blocks)

areas:
  adr:            { enabled: true }
  tldr:           { enabled: true }
  roadmap:        { enabled: false }    # not used for a CLI toolkit
  design:         { enabled: false }    # not used (no UI)
  guides:         { enabled: false }    # guides are in docs/, not Knowledge/
  agent-memory:   { enabled: false }    # not used
  runbooks:       { enabled: false }    # not used
  threat-models:  { enabled: false }    # not used
  templates:      { enabled: false }    # templates are in core/, not Knowledge/
  governance:     { enabled: false }    # governance scripts are in core/scripts/
  context-pack:   { enabled: true }
  index:          { enabled: true }

governance:
  sync-check: false       # kdoc is the source, not a target project
  wikilinks: true
  adr-governance: true
  index-build: true
  enforced-paths: []      # no enforced module paths for a CLI repo

scripts:
  prefix: kdoc
```

---

## Task 7: Generate INDEX.md

**Files:**
- Create: `Knowledge/INDEX.md`

- [ ] **Step 7.1: Check if `scripts/build_index.py` exists (from Plan 3)**

If `core/scripts/build_index.py` exists and is runnable, run it to generate INDEX.md:

```bash
python3 core/scripts/build_index.py --config .kdoc.yaml --output Knowledge/INDEX.md
```

If the script does not exist yet (Plan 3 not implemented), proceed to Step 7.2.

- [ ] **Step 7.2: Create `Knowledge/INDEX.md` manually (if script unavailable)**

```markdown
---
type: index
generated: true
generated-at: 2026-03-18
id: knowledge-index
status: ready
tags:
  - index
  - generated
summary: Auto-generated index of all kdoc Knowledge files.
---

# kdoc — Knowledge Index

> **Note:** This file is auto-generated by `python3 core/scripts/build_index.py`. Do not edit manually — run the script to regenerate after adding new files.

## ADR

| File | ID | Status | Summary |
|------|----|--------|---------|
| `Knowledge/ADR/README.md` | — | ready | ADR governance conventions and index |
| `Knowledge/ADR/ADR-0001-marker-based-merging.md` | ADR-0001 | accepted | Marker-based merging for existing files |
| `Knowledge/ADR/ADR-0002-hash-manifest-idempotency.md` | ADR-0002 | accepted | Hash manifest for idempotency |
| `Knowledge/ADR/ADR-0003-cli-plus-plugin-hybrid.md` | ADR-0003 | accepted | CLI + Plugin hybrid architecture |
| `Knowledge/ADR/ADR-0004-pack-architecture.md` | ADR-0004 | accepted | Technology pack architecture |
| `Knowledge/ADR/ADR-0005-native-agents-per-tool.md` | ADR-0005 | accepted | Native agents per AI tool |
| `Knowledge/ADR/ADR-0006-python-plus-typescript-split.md` | ADR-0006 | accepted | TypeScript + Python language split |
| `Knowledge/ADR/ADR-0007-yaml-config-format.md` | ADR-0007 | accepted | YAML configuration format |
| `Knowledge/ADR/ADR-0008-dogfooding.md` | ADR-0008 | accepted | kdoc documents itself |

## TLDR

| File | ID | Status | Summary |
|------|----|--------|---------|
| `Knowledge/TLDR/README.md` | — | ready | TLDR governance conventions and index |
| `Knowledge/TLDR/cli-init.md` | tldr-cli-init | ready | Init command requirements |
| `Knowledge/TLDR/cli-add.md` | tldr-cli-add | ready | Add commands requirements |
| `Knowledge/TLDR/cli-update.md` | tldr-cli-update | ready | Update command requirements |
| `Knowledge/TLDR/cli-doctor.md` | tldr-cli-doctor | ready | Doctor command requirements |
| `Knowledge/TLDR/cli-create.md` | tldr-cli-create | ready | Create command requirements |
| `Knowledge/TLDR/cli-undo.md` | tldr-cli-undo | ready | Undo command requirements |
| `Knowledge/TLDR/merge-strategies.md` | tldr-merge-strategies | ready | Merge strategy subsystem |
| `Knowledge/TLDR/pack-nextjs.md` | tldr-pack-nextjs | ready | Next.js pack requirements |
| `Knowledge/TLDR/pack-swift-ios.md` | tldr-pack-swift-ios | ready | Swift/iOS pack requirements |
| `Knowledge/TLDR/integration-claude.md` | tldr-integration-claude | ready | Claude Code integration |
| `Knowledge/TLDR/integration-codex.md` | tldr-integration-codex | ready | Codex CLI integration |

## Root Documents

| File | Status | Summary |
|------|--------|---------|
| `Knowledge/ContextPack.md` | ready | Quick-start for kdoc maintainers |

---
_Generated: 2026-03-18 | ADR count: 8 | TLDR count: 11_
```

---

## Acceptance Criteria

All items in this checklist must be satisfied before this plan is considered complete:

- [ ] `Knowledge/ADR/` contains `README.md` + 8 ADR files (ADR-0001 through ADR-0008)
- [ ] `Knowledge/TLDR/` contains `README.md` + 11 TLDR files (cli-*, merge-strategies, pack-*, integration-*)
- [ ] `Knowledge/ContextPack.md` exists and provides a quick-start for any maintainer
- [ ] `Knowledge/INDEX.md` exists and lists all ADR and TLDR files with status
- [ ] `.kdoc.yaml` exists at the repo root as a reference configuration
- [ ] All ADRs include frontmatter (type, id, status, date, tags, summary) and all required sections (Context, Decision Drivers, Decision, Alternatives Considered, Consequences, Related Documents)
- [ ] All TLDRs include frontmatter (type, id, status, date, tags, summary) and all required sections (Description, Requirements with MUST/SHOULD/MAY, CLI Contract or N/A, Test Scenarios, Acceptance Criteria, Dependencies, Related ADRs)
- [ ] All cross-references between ADRs and TLDRs use wikilink format: `[[ADR/ADR-000N-...|ADR-000N]]` and `[[TLDR/<name>|<Title>]]`
- [ ] ADR README index lists all 8 ADRs with wikilinks
- [ ] TLDR README index lists all 11 TLDRs with wikilinks
- [ ] No broken wikilinks (all referenced files exist in the Knowledge structure)
- [ ] `.kdoc.yaml` has all areas, packs, tools, governance, and scripts sections with inline comments

---

## Notes for the Implementer

1. **Order matters for cross-references:** Write README files first (Task 1), then ADRs (Tasks 2–3), then TLDRs (Tasks 4–5), then ContextPack + config (Task 6), then INDEX (Task 7). This ensures cross-references can be verified as files are created.

2. **Wikilink format for kdoc:** kdoc uses relative wikilinks without the full Knowledge/ prefix (e.g., `[[ADR/ADR-0001-marker-based-merging|ADR-0001]]` not `[[Knowledge/ADR/ADR-0001-...|ADR-0001]]`). The Knowledge root is the base for resolution.

3. **No TDD:** These are documentation files. There is no code to test. Verification is done by reading the files and confirming structure, frontmatter, and cross-references are correct.

4. **INDEX.md regeneration:** If Plan 3 has been implemented, run `build_index.py` after all files are created to get a properly generated INDEX.md. If not, the manually created INDEX.md from Step 7.2 is correct as a starting state.

5. **Do not commit:** Per plan instructions, write files only — no git operations.

---

## Implementation Notes (from cross-plan review)

1. **`.kdoc.yaml` must be created.** Add a task to create kdoc's own `.kdoc.yaml` with: `version: 1`, `root: Knowledge`, `packs: []`, `tools: []`, areas enabled: `adr`, `tldr`, `context-pack`, `index`. This is needed for `npx kdoc doctor` to work on the kdoc repo itself.

2. **ContextPack.md must be created.** It is listed in the file structure but no task covers it. Add a task with quick-start content for kdoc maintainers (where things live, key commands, design principles).

3. **Wikilink format consistency.** Standardize on `[[ADR/ADR-0001-...|ADR-0001]]` (path relative to Knowledge root). Ensure `check_wikilinks.py` from Plan 3 resolves this format.

4. **ADR-0002 migration policy.** Add a brief note to ADR-0002 Consequences: "CLI reads `lockVersion`. If > supported → error asking to upgrade kdoc. If < minimum → run migration function."

5. **README.md for kdoc repo — ASSIGNED TO THIS PLAN (Task 8).** Create `README.md` at the repo root with: project description, installation (`npx kdoc init`), quick start, commands reference, link to spec. This is the kdoc "front door" for GitHub. Not assigned to any other plan — Plan 6 owns it.

### Task 8: Root README.md (assigned by cross-plan review)

**Files:**
- Create: `README.md` (repo root)

- [ ] **Step 1: Create README.md**

Content should include:
- Project name and one-line description
- Installation: `npx kdoc init`
- Quick start (3 steps: init → create adr → doctor)
- Commands table (init, add, update, doctor, create, undo)
- Link to spec: `docs/superpowers/specs/2026-03-17-kdoc-design.md`
- Platform: macOS + Linux (Node.js 20+, Python 3.9+)
- License: MIT

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add root README with quick start and commands reference"
```
