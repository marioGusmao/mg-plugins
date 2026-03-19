# kdoc Plan 5: AI Tool Integrations

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Claude Code plugin (manifest, 12 skills, 4 agents, 2 hooks) and the Codex CLI integration (install script, AGENTS.md block template, agent template), plus the Claude Code integration install script.

**Architecture:** Skills are SKILL.md files with YAML frontmatter and Markdown body. Agents are Markdown files with YAML frontmatter (description, tools). Hooks are hooks.json + ESM JavaScript files. Integration install scripts are Node.js ESM modules that copy/generate files into target projects.

**Tech Stack:** Markdown, YAML frontmatter, Node.js ESM (hooks + install scripts), no runtime dependencies beyond Node.js 20+

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md` — Section 7 (AI Tool Integrations)

**Subsystem scope:** This plan covers `.claude-plugin/`, `skills/`, `agents/`, `hooks/`, and `integrations/`. It does NOT cover the CLI (Plan 1–2), core content/templates (Plan 3), technology packs (Plan 4), or dogfooding (Plan 6).

**Complexity tier:** standard (markdown files + hook logic + install scripts)

---

## File Structure

```
kdoc/
├── .claude-plugin/
│   └── plugin.json                           # Plugin manifest
│
├── skills/
│   ├── scaffold/
│   │   └── SKILL.md
│   ├── adr-create/
│   │   └── SKILL.md
│   ├── adr-validate/
│   │   └── SKILL.md
│   ├── tldr-create/
│   │   └── SKILL.md
│   ├── tldr-update-status/
│   │   └── SKILL.md
│   ├── roadmap-add-phase/
│   │   └── SKILL.md
│   ├── roadmap-update/
│   │   └── SKILL.md
│   ├── design-create-spec/
│   │   └── SKILL.md
│   ├── governance-check/
│   │   └── SKILL.md
│   ├── memory-save/
│   │   └── SKILL.md
│   ├── create-guide/
│   │   └── SKILL.md
│   └── create-threat-model/
│       └── SKILL.md
│
├── agents/
│   ├── claude-code/
│   │   ├── knowledge-auditor.md
│   │   ├── adr-auditor.md
│   │   ├── tldr-sync-checker.md
│   │   └── roadmap-builder.md
│   └── codex/
│       └── AGENTS-knowledge.md
│
├── hooks/
│   ├── hooks.json
│   ├── session-start.mjs
│   └── pre-push-check.mjs
│
└── integrations/
    ├── claude-code/
    │   └── install.js
    └── codex/
        └── install.js
```

---

## Task 0: Claude Code Plugin API Verification (GATE)

**This is a blocking gate.** Before implementing ANY skill, agent, or hook, verify that the Claude Code plugin API works as assumed.

- [ ] **Step 1: Verify plugin discovery with codegraph**

Test with the existing codegraph plugin at `/Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph/`:

```bash
# Check if Claude Code can load the codegraph plugin
claude --plugin-dir /Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph --help
```

If this works → the plugin API is confirmed. Proceed to Task 1.

- [ ] **Step 2: If plugin discovery fails — activate fallback**

If `--plugin-dir` does not work or the plugin is not discovered:
- The `integrations/claude-code/install.js` approach becomes the PRIMARY mechanism
- `install.js` copies skills to `.claude/skills/`, agents to `.claude/agents/`, hooks to `.claude/hooks/`
- `.claude-plugin/plugin.json` becomes a no-op marker file
- Update all remaining tasks to place files in `.claude/` subdirectories instead of plugin-relative paths

**Gate result:** Record outcome in a file `docs/superpowers/plans/gate-claude-plugin-api.md`:
```markdown
# Gate: Claude Code Plugin API
- Date: YYYY-MM-DD
- Result: CONFIRMED | FALLBACK
- Evidence: <what was tested>
- Impact on Plan 5: <none | install.js is primary>
```

---

## Task 1: Plugin Manifest

**Files:**
- Create: `.claude-plugin/plugin.json`

- [ ] **Step 1: Create .claude-plugin directory and plugin.json**

```json
{
  "name": "kdoc",
  "description": "Knowledge documentation toolkit — scaffold, maintain, and govern project documentation structures",
  "version": "1.0.0",
  "author": {
    "name": "MRM"
  }
}
```

Claude Code auto-discovers this manifest when the plugin directory is registered via `--plugin-dir` or installed via `claude plugins add`. Skills, agents, and hooks are discovered by convention from their respective directories at the plugin root — no explicit registration needed in the manifest.

**Verification:** Confirm `plugin.json` is valid JSON with:
```bash
node -e "require('./.claude-plugin/plugin.json'); console.log('OK')"
```

---

## Task 2: Core Skills — scaffold, governance-check, memory-save

**Files:**
- Create: `skills/scaffold/SKILL.md`
- Create: `skills/governance-check/SKILL.md`
- Create: `skills/memory-save/SKILL.md`

These three are the most frequently invoked skills and serve as the reference implementation for the skill format.

- [ ] **Step 1: Create skills/scaffold/SKILL.md**

```markdown
---
name: kdoc:scaffold
description: Scaffold or update a Knowledge documentation structure in the current project. Use when initializing a new project's Knowledge system, adding a new area to an existing install, or adding a technology pack.
metadata:
  filePattern: ".kdoc.yaml"
  bashPattern: "kdoc init|kdoc add"
---

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
```

- [ ] **Step 2: Create skills/governance-check/SKILL.md**

```markdown
---
name: kdoc:governance-check
description: Run all kdoc validation scripts and report Knowledge health. Use when the user asks for a Knowledge audit, health check, or before pushing changes that affect Knowledge files.
metadata:
  filePattern: "Knowledge/**/*.md"
  bashPattern: "kdoc doctor|kdoc:check|kdoc:governance"
---

# kdoc:governance-check — Knowledge Health Check

Use this skill when the user asks to check Knowledge health, run governance validation, or diagnose Knowledge issues.

## When to Use

- "check knowledge" / "kdoc doctor" / "run governance check"
- Before pushing changes that modify Knowledge files
- After adding a new area or pack
- When wikilink or ADR errors are suspected

## Workflow

1. Run the primary health check: `npx kdoc doctor`
   - Reports: config validity, structure completeness, script freshness, integration markers, governance.
   - Exit codes: 0 = all pass, 1 = failures, 2 = config error.

2. If `package.json` has `kdoc:check`, also run: `pnpm kdoc:check` (or the equivalent for the project's package manager).
   - This invokes `check_sync.py` + `check_wikilinks.py` + `check_adr_governance.py`.

3. If `package.json` has `kdoc:governance`, run: `pnpm kdoc:governance`
   - This invokes `governance_health.py` for a consolidated report.

4. Interpret and surface:
   - PASS items: summarize count only.
   - WARN items: list each with suggested fix.
   - FAIL items: list each with required action and the relevant `fix` command from JSON output.

5. If `--json` output is available, parse it for structured reporting; otherwise parse stdout.

## Interpreting Results

| Status | Action |
|--------|--------|
| `pass` | No action needed |
| `warn` | Inform user; suggest fix but do not block |
| `fail` | Report as blocking; provide `fix` command |

## Common Failures and Fixes

| Failure | Fix |
|---------|-----|
| ADR numbering gap | Rename files to fill gap or accept gap (gaps are allowed) |
| Broken wikilink | Find and fix the `[[TARGET]]` reference |
| Missing TLDR for module | `kdoc:tldr-create` for that module |
| INDEX.md stale | `pnpm kdoc:index` or `npx kdoc doctor` will suggest |
| CLAUDE.md missing kdoc block | `npx kdoc add-tool claude-code` |

## Related Skills

- `kdoc:scaffold` — if structure is missing, scaffold it
- `kdoc:adr-validate` — focused ADR governance check
- `kdoc:tldr-update-status` — if TLDRs have stale status
```

- [ ] **Step 3: Create skills/memory-save/SKILL.md**

```markdown
---
name: kdoc:memory-save
description: Save a piece of operational knowledge to the project's AgentMemory. Use when the user says "remember this", "save to memory", or asks to persist a gotcha, pattern, or operational note.
metadata:
  filePattern: "Knowledge/AgentMemory/**"
  bashPattern: "memory:sync|memory:check"
---

# kdoc:memory-save — Save to Agent Memory

Use this skill when the user asks to persist knowledge to agent memory, save a gotcha, or update operational notes.

## When to Use

- "save to memory" / "remember this" / "add this to agent memory"
- "save this gotcha" / "note this pattern"
- After discovering a non-obvious operational fact that future AI sessions should know

## Workflow

1. Determine the memory category:
   - **Gotcha**: Non-obvious fact that could cause bugs if unknown → `gotchas-<topic>.md`
   - **Pattern**: Reusable approach or convention → `patterns-<topic>.md`
   - **Operational**: Environment, commands, ports, credentials format → `MEMORY.md` (Dev Environment section)
   - **Feedback**: Preference about how AI should behave → `feedback_<topic>.md`

2. Read the existing file for the category (or `MEMORY.md` if new).

3. Add the new entry:
   - For gotchas: numbered list item under the relevant section heading.
   - For patterns: numbered list item with description and example.
   - For MEMORY.md sections: add inline or create a new section.

4. Write the updated file.

5. If `package.json` has `memory:sync` and `memory:check`, run both:
   - `pnpm memory:sync`
   - `pnpm memory:check`
   These sync the canonical `Knowledge/AgentMemory/` to the AI tool's mirror directory.

## Memory File Conventions

- `Knowledge/AgentMemory/MEMORY.md` — top-level index and Dev Environment quick reference
- `Knowledge/AgentMemory/gotchas-<topic>.md` — numbered list of gotchas per topic area
- `Knowledge/AgentMemory/patterns-<topic>.md` — numbered list of reusable patterns
- `Knowledge/AgentMemory/feedback_<name>.md` — single-purpose preference notes

## Safety Rules

- NEVER store secrets, credentials, tokens, or personal data.
- Store stable patterns only — not one-off session notes.
- Keep MEMORY.md concise; delegate detail to topic files.
- Canonical source is `Knowledge/AgentMemory/*`. The external AI mirror is a synchronized copy, not a source of truth.

## Related Skills

- `kdoc:governance-check` — validates AgentMemory structure
- `kdoc:create-guide` — for detailed operational guides (not memory snippets)
```

---

## Task 3: ADR Skills — adr-create, adr-validate

**Files:**
- Create: `skills/adr-create/SKILL.md`
- Create: `skills/adr-validate/SKILL.md`

- [ ] **Step 1: Create skills/adr-create/SKILL.md**

```markdown
---
name: kdoc:adr-create
description: Create a new Architecture Decision Record (ADR) with sequential numbering. Use when the user says "create ADR", "document this decision", or "new architecture decision".
metadata:
  filePattern: "Knowledge/ADR/ADR-*.md"
  bashPattern: "kdoc create adr"
---

# kdoc:adr-create — Create Architecture Decision Record

Use this skill when the user asks to create a new ADR or document an architectural decision.

## When to Use

- "create ADR" / "new decision" / "document this architecture decision"
- "record the decision about <X>"
- After making a significant technical or architectural choice

## Workflow

1. Determine the next sequential ADR number:
   - Glob `Knowledge/ADR/ADR-*.md`
   - Extract the highest NNNN from filenames (format: `ADR-{NNNN}-*.md`)
   - Next = highest + 1, zero-padded to 4 digits (e.g., `0012`)
   - If no ADRs exist yet: start at `0001`

2. Ask the user (or infer from context):
   - **Title**: Short descriptive phrase (e.g., "Marker-based file merging")
   - **Status**: `proposed` (default) | `accepted` | `supersedes: ADR-XXXX`
   - **Context**: Why does this decision need to be made?
   - **Decision**: What was decided?
   - **Rationale**: Why this option over alternatives?
   - **Consequences**: Trade-offs, risks, follow-up actions

3. Alternatively, use the CLI: `npx kdoc create adr "<title>" [--status proposed]`
   This handles sequential numbering automatically.

4. The output file path: `Knowledge/ADR/ADR-{NNNN}-{kebab-title}.md`
   - Convert title to kebab-case for the filename slug.

5. Fill the ADR template (from `core/governance/adr-conventions.md`):

```text
---
id: ADR-{NNNN}
title: "{Title}"
date: {YYYY-MM-DD}
status: proposed
---

# ADR-{NNNN}: {Title}

## Context

{Why this decision is needed}

## Decision

{What was decided}

## Rationale

{Why this option over alternatives}

## Consequences

{Trade-offs, risks, follow-up actions}
```

6. After creation, run `kdoc:adr-validate` to confirm numbering integrity.

## Status Lifecycle

```
proposed → accepted → superseded (by ADR-XXXX)
         → rejected
```

- An ADR in `proposed` state is visible but not yet binding.
- `accepted` means the decision is in effect.
- `superseded` means a newer ADR replaces it — add `supersedes: ADR-XXXX` to the new ADR's frontmatter.

## Naming Rules

- File: `ADR-{NNNN}-{kebab-case-title}.md` (no uppercase in slug)
- Title in frontmatter: Title Case
- Gaps in numbering are allowed (concurrent creation may produce gaps)

## Related Skills

- `kdoc:adr-validate` — validate numbering and cross-references after creation
- `kdoc:governance-check` — full health check including ADR governance
```

- [ ] **Step 2: Create skills/adr-validate/SKILL.md**

```markdown
---
name: kdoc:adr-validate
description: Validate all ADRs for numbering integrity, cross-references, supersession chains, and status lifecycle. Use when suspecting ADR numbering issues or before a PR review.
metadata:
  filePattern: "Knowledge/ADR/ADR-*.md"
  bashPattern: "kdoc:adr:check|check_adr_governance"
---

# kdoc:adr-validate — Validate ADR Governance

Use this skill when the user asks to validate ADRs, check ADR numbering, or audit the ADR directory.

## When to Use

- "validate ADRs" / "check ADR governance" / "audit ADR directory"
- After creating or modifying ADRs
- Before a PR that includes ADR changes

## Workflow

1. Run the ADR governance script if available:
   ```bash
   pnpm kdoc:adr:check
   ```
   Or directly: `python3 scripts/kdoc/check_adr_governance.py`

2. If the script is not installed, perform manual checks:

   **Numbering integrity:**
   - Glob `Knowledge/ADR/ADR-*.md` and sort.
   - Extract NNNN from each filename.
   - Verify no duplicates (same number, different slug).
   - Report gaps (non-sequential numbers) — gaps are allowed but should be noted.

   **Frontmatter completeness:**
   - Each ADR must have: `id`, `title`, `date`, `status`.
   - `id` in frontmatter must match the filename NNNN.

   **Status validity:**
   - Valid statuses: `proposed`, `accepted`, `rejected`, `superseded`.
   - If status is `superseded`, the file should reference the superseding ADR.

   **Supersession chain integrity:**
   - If ADR-X says `supersedes: ADR-Y`, then ADR-Y must exist and its status should be `superseded`.
   - No circular supersession chains.

   **Cross-reference validity:**
   - Wikilinks `[[ADR-NNNN]]` inside ADRs must resolve to existing files.

3. Report all findings:
   - PASS: "ADR numbering is sequential (N ADRs, no duplicates)"
   - WARN: "Gap detected at NNNN" (acceptable, just informational)
   - FAIL: "Duplicate number", "Missing frontmatter field", "Broken supersession chain"

## What to Do on Failures

| Failure | Fix |
|---------|-----|
| Duplicate NNNN | Renumber one ADR and update all references |
| Missing frontmatter field | Add the field with correct value |
| Broken supersession | Fix the `supersedes` reference or update status |
| Broken wikilink | Fix the `[[ADR-NNNN]]` reference in the file |

## Related Skills

- `kdoc:adr-create` — create a new ADR
- `kdoc:governance-check` — full Knowledge health check
```

---

## Task 4: TLDR Skills — tldr-create, tldr-update-status

**Files:**
- Create: `skills/tldr-create/SKILL.md`
- Create: `skills/tldr-update-status/SKILL.md`

- [ ] **Step 1: Create skills/tldr-create/SKILL.md**

```markdown
---
name: kdoc:tldr-create
description: Create a new TLDR (functional requirements document) for a module, feature, or area. Use when the user says "create TLDR", "document module", or "write requirements for <X>".
metadata:
  filePattern: "Knowledge/TLDR/**/*.md"
  bashPattern: "kdoc create tldr"
---

# kdoc:tldr-create — Create TLDR Document

Use this skill when the user asks to create a TLDR, document a module, or write functional requirements.

## When to Use

- "create TLDR" / "document module" / "write requirements for <X>"
- "create a feature doc" / "add TLDR for <module>"
- When a module exists but lacks a corresponding Knowledge document

## Detecting Scope and Module

1. Check `.kdoc.yaml` for configured scopes (e.g., `[Admin, Shop, Shared]` for nextjs).
2. If context makes the scope obvious (user is discussing an admin feature), use that scope.
3. Otherwise ask: "Which scope? (e.g., Admin, Shop, Shared)"
4. Module name: infer from context or ask the user.

## Workflow

1. Determine output path: `Knowledge/TLDR/{scope}/{module-name}.md`
   - scope: lowercased kebab (e.g., `admin`, `shop`, `shared`)
   - module-name: kebab-case (e.g., `coupon-management`, `authentication`)

2. Alternatively, use the CLI: `npx kdoc create tldr "<name>" --scope <scope>`

3. Fill the TLDR template:

```text
---
area: {scope}
module: {module-name}
status: draft
---

# {Module Title} — TLDR

## Purpose

{One paragraph describing what this module does and why it exists}

## Functional Requirements

{Numbered list of what the module must do}

## Acceptance Criteria

{Testable criteria that define "done"}

## Test Scenarios

| Scenario | Level | File | Status |
|----------|-------|------|--------|
| | | | |

## Open Questions

{Unresolved questions — remove section if none}

## Related

- [[ADR-XXXX]] (if relevant decisions exist)
```

4. If the module has obvious gaps (empty sections), add gap tags to frontmatter:
   - `missing-test-scenarios` — Test Scenarios table is empty
   - `missing-acceptance-criteria` — Acceptance Criteria is empty
   - `has-open-questions` — Open Questions section has items

## Status Lifecycle

```
draft → ready → in-progress → done → deprecated
```

- New TLDRs start at `draft`.
- Use `kdoc:tldr-update-status` to advance the status.

## Related Skills

- `kdoc:tldr-update-status` — update status and remove gap tags
- `kdoc:governance-check` — validate all TLDRs
- `kdoc:adr-create` — if the TLDR reveals a decision that needs an ADR
```

- [ ] **Step 2: Create skills/tldr-update-status/SKILL.md**

```markdown
---
name: kdoc:tldr-update-status
description: Update a TLDR's status frontmatter and remove resolved gap tracking tags. Use when the user says "mark TLDR as done", "update status", or "resolve open question".
metadata:
  filePattern: "Knowledge/TLDR/**/*.md"
  bashPattern: ""
---

# kdoc:tldr-update-status — Update TLDR Status

Use this skill when the user asks to update a TLDR's status, mark it complete, or resolve gap tracking tags.

## When to Use

- "mark TLDR as done" / "update TLDR status" / "TLDR is ready"
- "resolve open question in <TLDR>" / "fill in acceptance criteria"
- "remove gap tag from <TLDR>"

## Workflow

1. Identify the target TLDR file (from context or ask the user for path/module name).

2. Read the current frontmatter and body.

3. Update the `status` field:

   | New Status | When to Use |
   |------------|-------------|
   | `draft` | Initial state, requirements incomplete |
   | `ready` | Requirements complete, implementation not started |
   | `in-progress` | Implementation underway |
   | `done` | Implementation complete and verified |
   | `deprecated` | Module removed or replaced |

4. Remove gap tracking tags from frontmatter when resolved:

   | Tag | Remove When |
   |-----|-------------|
   | `has-open-questions` | All open questions are struck through or removed |
   | `missing-test-scenarios` | Test Scenarios table has at least one row |
   | `missing-acceptance-criteria` | Acceptance Criteria section has content |
   | `blocked-by-decision` | The blocking ADR is accepted/resolved |

5. If resolving an open question: strike it through in the body with `~~question text~~`. If no active questions remain, remove the `has-open-questions` tag.

6. Write the updated file.

## Gap Tag Rules

- Tags live in frontmatter as a YAML list under `gaps:` or as inline tags (project convention may vary).
- When a tag is removed, do NOT remove the section itself — only remove the tag from frontmatter.
- A TLDR with all gaps resolved and `status: done` is considered complete.

## Related Skills

- `kdoc:tldr-create` — create a new TLDR
- `kdoc:governance-check` — validates gap tag consistency across all TLDRs
```

---

## Task 5: Roadmap Skills — roadmap-add-phase, roadmap-update

**Files:**
- Create: `skills/roadmap-add-phase/SKILL.md`
- Create: `skills/roadmap-update/SKILL.md`

- [ ] **Step 1: Create skills/roadmap-add-phase/SKILL.md**

```markdown
---
name: kdoc:roadmap-add-phase
description: Add a new phase or sub-phase to the project roadmap. Use when the user says "add phase to roadmap", "create roadmap phase", or "add sub-phase".
metadata:
  filePattern: "Knowledge/Roadmap/phases/**"
  bashPattern: "kdoc create phase|kdoc create sub-phase"
---

# kdoc:roadmap-add-phase — Add Roadmap Phase

Use this skill when the user asks to add a phase or sub-phase to the project roadmap.

## When to Use

- "add phase to roadmap" / "create roadmap phase" / "new roadmap entry"
- "add sub-phase to phase N"
- When planning a new development cycle or milestone

## Workflow — Adding a Phase

1. Determine the next phase number:
   - Glob `Knowledge/Roadmap/phases/phase-*.md`
   - Find the highest N, next = highest + 1.

2. Alternatively: `npx kdoc create phase "<phase-name>"`

3. Create `Knowledge/Roadmap/phases/phase-{N}.md`:

```text
---
phase: {N}
title: "{Phase Title}"
status: planned
startDate: ""
endDate: ""
---

# Phase {N}: {Phase Title}

## Goal

{What this phase achieves}

## Sub-Phases

| # | Name | Status | Notes |
|---|------|--------|-------|
| | | planned | |

## Exit Criteria

{What must be true for this phase to be complete}

## Retrospective

{Empty until phase completes}
```

## Workflow — Adding a Sub-Phase

1. Determine the parent phase number and sub-phase number:
   - Read the parent phase file's Sub-Phases table.
   - Next sub-phase M = count of existing rows + 1.

2. Alternatively: `npx kdoc create sub-phase "<name>" --phase <N>`

3. Create `Knowledge/Roadmap/phases/phase-{N}/{M}.md`:

```text
---
phase: {N}
sub-phase: {M}
title: "{Sub-Phase Title}"
status: planned
---

# Phase {N}.{M}: {Sub-Phase Title}

## Goal

{What this sub-phase achieves}

## Tasks

- [ ] Task 1

## Acceptance Criteria

{What must be true for this sub-phase to be complete}

## Evidence Files

{Files that provide implementation evidence (listed after completion)}
```

4. Update the parent phase file's Sub-Phases table to include the new entry.

## Status Values

`planned` → `in-progress` → `complete` | `skipped`

## Related Skills

- `kdoc:roadmap-update` — update phase/sub-phase status
- `kdoc:tldr-create` — create TLDRs for modules planned in this phase
```

- [ ] **Step 2: Create skills/roadmap-update/SKILL.md**

```markdown
---
name: kdoc:roadmap-update
description: Update a roadmap phase or sub-phase status and regenerate the dashboard. Use when the user says "update phase status", "mark phase complete", or "roadmap update".
metadata:
  filePattern: "Knowledge/Roadmap/**"
  bashPattern: "kdoc:index|roadmap"
---

# kdoc:roadmap-update — Update Roadmap Status

Use this skill when the user asks to update a roadmap phase status, mark a phase complete, or generate the roadmap dashboard.

## When to Use

- "update phase status" / "mark phase complete" / "phase N is done"
- "sub-phase N.M is in progress"
- "generate roadmap dashboard" / "update roadmap"

## Workflow

1. Identify the target phase or sub-phase file from context.
   - Phase: `Knowledge/Roadmap/phases/phase-{N}.md`
   - Sub-phase: `Knowledge/Roadmap/phases/phase-{N}/{M}.md`

2. Update the `status` frontmatter field:
   - `planned` → `in-progress` → `complete` | `skipped`

3. For completed phases:
   - Set `endDate` to today's date (ISO format: `YYYY-MM-DD`).
   - Add a Retrospective section if it is empty.

4. If `startDate` is empty and setting to `in-progress`: set `startDate` to today.

5. Update the parent phase's Sub-Phases table if updating a sub-phase.

6. Regenerate the dashboard if the `kdoc:index` script is available:
   ```bash
   pnpm kdoc:index
   ```
   Or: `python3 scripts/kdoc/build_index.py`

7. Check if `Knowledge/Roadmap/generated/` should be updated — the roadmap builder agent (`kdoc-knowledge-auditor`) can do a deeper regeneration.

## Dashboard Location

- `Knowledge/Roadmap/generated/dashboard.md` (generated by `roadmap-builder` agent)
- `Knowledge/INDEX.md` (generated by `build_index.py`)

## Related Skills

- `kdoc:roadmap-add-phase` — add a new phase
- `kdoc:governance-check` — full health check that validates roadmap consistency
```

---

## Task 6: Design + Document Skills — design-create-spec, create-guide, create-threat-model

**Files:**
- Create: `skills/design-create-spec/SKILL.md`
- Create: `skills/create-guide/SKILL.md`
- Create: `skills/create-threat-model/SKILL.md`

- [ ] **Step 1: Create skills/design-create-spec/SKILL.md**

```markdown
---
name: kdoc:design-create-spec
description: Create a design specification (page spec, screen spec, or flow spec) for a UI component or user flow. Detects the active pack and uses the correct template.
metadata:
  filePattern: "Knowledge/Design/**/*.md"
  bashPattern: "kdoc create"
---

# kdoc:design-create-spec — Create Design Specification

Use this skill when the user asks to create a page spec, screen spec, or flow spec.

## When to Use

- "create page spec" / "create screen spec" / "design spec for <X>"
- "spec the checkout flow" / "document the onboarding flow"
- "create route contract for <API endpoint>"

## Pack Detection

Check `.kdoc.yaml` for the active pack(s):
- `nextjs` — use `page-spec.md` or `flow-spec.md` from `Knowledge/Templates/nextjs/`
- `swift-ios` — use `screen-spec.md` or `flow-spec.md` from `Knowledge/Templates/swift-ios/`
- Multi-pack — ask the user which platform this spec is for.

## Output Path Convention

Design specs are always namespaced by pack:
- nextjs page: `Knowledge/Design/nextjs/{scope}/{page-name}.md`
- nextjs flow: `Knowledge/Design/nextjs/{scope}/{flow-name}-flow.md`
- swift-ios screen: `Knowledge/Design/swift-ios/{scope}/{screen-name}.md`
- swift-ios flow: `Knowledge/Design/swift-ios/{scope}/{flow-name}-flow.md`

The scope is the app area (e.g., `admin`, `shop`, `app`, `shared`).

## Workflow

1. Detect pack from `.kdoc.yaml`.
2. Ask (or infer from context): spec type (page/screen/flow), scope, name.
3. Read the appropriate template from `Knowledge/Templates/{pack}/`.
4. Fill in available fields from context; leave unfilled sections as placeholders.
5. Write to the correct path under `Knowledge/Design/{pack}/{scope}/`.

## nextjs Page Spec Template Fields

| Field | Description |
|-------|-------------|
| Route | URL path (e.g., `/admin/coupons`) |
| Layout | Which layout wraps this page |
| Components | List of main components |
| Data sources | Server Actions or API calls |
| Tokens | Design tokens used |
| Responsive | Breakpoint behavior |
| Accessibility | WCAG requirements |

## swift-ios Screen Spec Template Fields

| Field | Description |
|-------|-------------|
| Navigation | How the user arrives at this screen |
| Components | UIKit/SwiftUI components |
| State | Screen state variants |
| Accessibility | VoiceOver / Dynamic Type |

## Related Skills

- `kdoc:tldr-create` — create requirements doc alongside spec
- `kdoc:governance-check` — validates Design area structure
```

- [ ] **Step 2: Create skills/create-guide/SKILL.md**

```markdown
---
name: kdoc:create-guide
description: Create an operational guide (onboarding, troubleshooting, how-to) in the Knowledge/Guides directory. Use when the user asks to create a guide, onboarding doc, or how-to.
metadata:
  filePattern: "Knowledge/Guides/**/*.md"
  bashPattern: "kdoc create guide"
---

# kdoc:create-guide — Create Operational Guide

Use this skill when the user asks to create an operational guide, onboarding document, or how-to reference.

## When to Use

- "create onboarding guide" / "write a troubleshooting guide" / "create how-to for <X>"
- "document how to set up the dev environment"
- "write a guide for <process>"

## Output Path

Guides may be pack-specific or project-wide:
- Pack-specific: `Knowledge/Guides/{pack}/{guide-name}.md` (e.g., `Knowledge/Guides/nextjs/onboarding.md`)
- General: `Knowledge/Guides/{guide-name}.md`

Ask the user or infer from context whether the guide is pack-specific.

## Workflow

1. Determine guide type: onboarding, troubleshooting, how-to, recipe, reference.
2. Determine if pack-specific (check context / ask).
3. Fill the guide template:

```text
---
title: "{Guide Title}"
category: onboarding | troubleshooting | how-to | recipe | reference
---

# {Guide Title}

## Overview

{One paragraph describing what this guide covers and who it is for}

## Prerequisites

{What the reader needs before starting}

## Steps

### 1. {First Step}

{Instructions}

### 2. {Second Step}

{Instructions}

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| | | |

## Related

- [[link to related guide or ADR]]
```

4. Write the file to the determined path.

## Related Skills

- `kdoc:create-threat-model` — for security-focused documentation
- `kdoc:tldr-create` — for functional requirements (not operational guides)
```

- [ ] **Step 3: Create skills/create-threat-model/SKILL.md**

```markdown
---
name: kdoc:create-threat-model
description: Create a STRIDE threat model document for a module or feature. Use when the user asks for a threat model, security analysis, or "threat model for <X>".
metadata:
  filePattern: "Knowledge/runbooks/threat-models/**"
  bashPattern: "kdoc create threat-model"
---

# kdoc:create-threat-model — Create Threat Model

Use this skill when the user asks to threat model a feature, create a security analysis, or document attack vectors.

## When to Use

- "threat model for auth" / "security analysis for checkout" / "create threat model for <X>"
- "document attack vectors for <module>"
- Before implementing security-critical features

## Output Path

`Knowledge/runbooks/threat-models/{module-name}.md`

## Workflow

1. Identify the module or feature to threat model (from context or ask).
2. Ask for the security tier: critical (auth, payments, PII) | high (user data, admin access) | standard.
3. Fill the STRIDE threat model template:

```text
---
area: {scope}
module: {module-name}
tier: critical | high | standard
date: {YYYY-MM-DD}
---

# Threat Model: {Module Title}

## Scope

{What is being analyzed — components, data flows, trust boundaries}

## Assets

{What needs to be protected — data, sessions, secrets}

## Trust Boundaries

{Where trust transitions occur — auth boundaries, API perimeters}

## STRIDE Analysis

### Spoofing

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Tampering

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Repudiation

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Information Disclosure

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Denial of Service

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Elevation of Privilege

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

## Open Risks

{Accepted risks with rationale}

## Related

- [[ADR-XXXX]] (relevant security decisions)
```

4. Write the file.

## Tier-Based Depth

| Tier | STRIDE Rows | Reviewer Required |
|------|-------------|------------------|
| `critical` | 3+ per category | Human security review |
| `high` | 2+ per category | Peer review |
| `standard` | 1+ per category | Self-review |

## Related Skills

- `kdoc:governance-check` — validates threat-models area
- `kdoc:create-guide` — for operational security guides (not attack analysis)
```

---

## Task 7: Agents — knowledge-auditor and 3 sub-agents

**Files:**
- Create: `agents/claude-code/knowledge-auditor.md`
- Create: `agents/claude-code/adr-auditor.md`
- Create: `agents/claude-code/tldr-sync-checker.md`
- Create: `agents/claude-code/roadmap-builder.md`

- [ ] **Step 1: Create agents/claude-code/knowledge-auditor.md**

```markdown
---
description: Orchestrator agent that runs all Knowledge governance scripts, launches specialized sub-agents in parallel, consolidates their findings, and writes a governance-health.md report. Use when the user asks for a full Knowledge audit or "knowledge-auditor".
tools:
  - Read
  - Write
  - Bash
  - Task
color: purple
---

# knowledge-auditor — Knowledge Governance Orchestrator

You are the Knowledge Governance Orchestrator for this project. Your job is to run a comprehensive audit of the project's Knowledge documentation structure, coordinate specialized sub-agents, consolidate findings, and produce a governance-health.md report.

## Invocation

Use this agent when the user asks for:
- "full Knowledge audit" / "run knowledge-auditor" / "audit all docs"
- "generate governance health report"
- When `kdoc:governance-check` finds issues that need deeper investigation

## Workflow

### Phase 1: Script Execution

Run all available governance scripts in parallel (via Bash):

1. `pnpm kdoc:check` or `python3 scripts/kdoc/check_sync.py` — Knowledge sync check
2. `python3 scripts/kdoc/check_wikilinks.py` — Wikilink integrity
3. `python3 scripts/kdoc/check_adr_governance.py` — ADR governance
4. `python3 scripts/kdoc/governance_health.py` — Consolidated health (if available)
5. `pnpm kdoc:index` or `python3 scripts/kdoc/build_index.py` — Index freshness check

Collect all stdout/stderr output and exit codes.

### Phase 2: Parallel Sub-Agent Launch

After scripts complete, launch 3 sub-agents in parallel using the Task tool:

- Task("adr-auditor", "Validate all ADRs: numbering, frontmatter, cross-refs, supersession chains. Report findings in structured format.")
- Task("tldr-sync-checker", "Validate all TLDRs: gap tags vs content, status lifecycle, wikilink references, coverage against modules. Report findings in structured format.")
- Task("roadmap-builder", "Read all roadmap phase files + TLDRs + evidence files. Generate a dashboard showing phase status, completion percentages, and any mismatches. Report findings in structured format.")

Wait for all three to complete before proceeding.

### Phase 3: Consolidation

Consolidate all findings into a single report:

1. Script results (pass/warn/fail per check)
2. ADR audit findings (from adr-auditor)
3. TLDR sync findings (from tldr-sync-checker)
4. Roadmap dashboard (from roadmap-builder)

### Phase 4: Report Generation

Write the consolidated report to `Knowledge/governance-health.md`.

The report structure:

```text
---
generated: {YYYY-MM-DD HH:MM}
status: healthy | issues | broken
---

# Knowledge Governance Health Report

Generated: {date}
Status: {overall status}

## Summary

| Check | Status | Findings |
|-------|--------|---------|
| Knowledge sync | pass/warn/fail | N issues |
| Wikilinks | pass/warn/fail | N broken |
| ADR governance | pass/warn/fail | N issues |
| TLDR sync | pass/warn/fail | N gaps |
| Roadmap | pass/warn/fail | N mismatches |

## ADR Audit

{adr-auditor output}

## TLDR Sync

{tldr-sync-checker output}

## Roadmap Dashboard

{roadmap-builder output}

## Script Results

{Raw script output summary}

## Action Items

{Prioritized list of required actions}
```

## Rules

- ALWAYS run scripts before launching sub-agents (scripts provide ground truth).
- ALWAYS launch the 3 sub-agents in parallel, not sequentially.
- NEVER modify Knowledge files during the audit — read and report only (exception: roadmap-builder writes the dashboard).
- If a script is not installed, note it in the report and continue.
- Overall status: `healthy` (all pass), `issues` (any warn), `broken` (any fail).
```

- [ ] **Step 2: Create agents/claude-code/adr-auditor.md**

```markdown
---
description: Sub-agent that validates all ADRs in the Knowledge/ADR directory for numbering integrity, frontmatter completeness, cross-references, and supersession chain integrity. Called by knowledge-auditor in parallel with other sub-agents.
tools:
  - Read
  - Glob
---

# adr-auditor — ADR Governance Sub-Agent

You are the ADR Auditor. Your job is to validate all Architecture Decision Records in `Knowledge/ADR/` and report findings in structured format to the orchestrating knowledge-auditor agent.

## Input

You receive a task description from knowledge-auditor. Operate on `Knowledge/ADR/`.

## Workflow

1. **Discover files:** Glob `Knowledge/ADR/ADR-*.md` and sort by filename.

2. **For each ADR file, check:**

   a. Filename format: Must match `ADR-{NNNN}-{slug}.md` (4-digit number, kebab-case slug).
   b. Frontmatter completeness: Must have `id`, `title`, `date`, `status`.
   c. ID consistency: `id` in frontmatter must match NNNN in filename.
   d. Status validity: Must be one of `proposed`, `accepted`, `rejected`, `superseded`.
   e. Supersession integrity:
      - If `status: superseded` and the file has a `superseded-by` reference, verify that target ADR exists.
      - If ADR-X has `supersedes: ADR-Y`, verify ADR-Y exists.
      - No circular chains.
   f. Wikilink references: For any `[[ADR-NNNN]]` in the file body, verify the target exists.

3. **Number sequence analysis:**
   - Extract all NNNNs.
   - Report any duplicates as FAIL.
   - Report any gaps as INFO (allowed — just informational).

## Output Format

Return a structured markdown report for consolidation:

```text
## ADR Audit Results

Total ADRs: N
Status breakdown: proposed: N, accepted: N, rejected: N, superseded: N

### Failures (blocking)
- ADR-XXXX: {description of failure}

### Warnings
- ADR-XXXX: {description of warning}

### Info
- Number gaps detected: {list}

### All Clear
- {checks that passed cleanly}
```

## Rules

- Read-only: do NOT modify any ADR files.
- Be precise: report exact filenames and field names in failures.
- If `Knowledge/ADR/` does not exist or is empty: report "ADR area not installed or empty".
```

- [ ] **Step 3: Create agents/claude-code/tldr-sync-checker.md**

```markdown
---
description: Sub-agent that validates all TLDRs in Knowledge/TLDR for gap tag consistency, status lifecycle correctness, wikilink references, and coverage against project modules. Called by knowledge-auditor in parallel with other sub-agents.
tools:
  - Read
  - Glob
  - Bash
---

# tldr-sync-checker — TLDR Sync Sub-Agent

You are the TLDR Sync Checker. Your job is to validate all TLDR documents in `Knowledge/TLDR/` and report findings to the orchestrating knowledge-auditor agent.

## Input

You receive a task description from knowledge-auditor. Operate on `Knowledge/TLDR/`.

## Workflow

1. **Discover files:** Glob `Knowledge/TLDR/**/*.md` (excluding `README.md`).

2. **For each TLDR, check:**

   a. Frontmatter completeness: Must have `area`, `status`. Should have `module`.
   b. Status validity: Must be one of `draft`, `ready`, `in-progress`, `done`, `deprecated`.
   c. Gap tag consistency:
      - If frontmatter has `has-open-questions`: Open Questions section must have non-struck-through items.
      - If `missing-test-scenarios`: Test Scenarios table must be empty or absent.
      - If `missing-acceptance-criteria`: Acceptance Criteria section must be empty or absent.
      - Section filled but tag still present → WARN (stale tag).
      - Section empty but tag absent → WARN (missing tag).
   d. Status vs content alignment:
      - `done` status with `has-open-questions` tag → WARN.
      - `done` status with empty Test Scenarios → WARN.
   e. Wikilink references: For any `[[TARGET]]` in the file body, verify the target file exists.

3. **Module coverage check (best-effort):**
   - If detectable module directories exist (e.g., `apps/*/src/modules/*/`), compare module names against TLDR filenames.
   - Report modules without TLDRs as INFO (not a failure).

## Output Format

Return a structured markdown report for consolidation:

```text
## TLDR Sync Results

Total TLDRs: N
Status breakdown: draft: N, ready: N, in-progress: N, done: N, deprecated: N

### Failures (blocking)
- {path}: {description}

### Warnings (should fix)
- {path}: Stale gap tag `{tag}` — section appears filled
- {path}: Status `done` but has-open-questions still set

### Info
- Modules without TLDR: {list}

### All Clear
- {checks that passed}
```

## Rules

- Read-only: do NOT modify any TLDR files.
- If `Knowledge/TLDR/` does not exist: report "TLDR area not installed".
- Module coverage check is best-effort — skip and note if directories cannot be reliably detected.
```

- [ ] **Step 4: Create agents/claude-code/roadmap-builder.md**

```markdown
---
description: Sub-agent that reads all roadmap phase files, cross-references TLDRs and evidence files, and generates a dashboard showing phase completion status and health. Called by knowledge-auditor in parallel with other sub-agents.
tools:
  - Read
  - Glob
  - Write
---

# roadmap-builder — Roadmap Dashboard Sub-Agent

You are the Roadmap Builder. Your job is to read all roadmap phase files, cross-reference them with TLDRs and evidence, and generate an updated roadmap dashboard.

## Input

You receive a task description from knowledge-auditor. Operate on `Knowledge/Roadmap/`.

## Workflow

1. **Discover phase files:** Glob `Knowledge/Roadmap/phases/phase-*.md` (top-level phases only).

2. **Discover sub-phase files:** Glob `Knowledge/Roadmap/phases/phase-*/*.md`.

3. **For each phase, read and extract:**
   - `phase`, `title`, `status`, `startDate`, `endDate` from frontmatter.
   - Sub-Phases table (list of sub-phases with status).
   - Exit Criteria section.

4. **Cross-reference with TLDRs:**
   - Check if TLDRs mentioned in phase/sub-phase tasks exist and their status.
   - Report mismatches: a phase marked `complete` but referencing TLDRs with `draft` status.

5. **Evidence check (if Evidence Files section exists in sub-phases):**
   - Check if listed evidence files exist.
   - Report missing evidence as WARN for `complete` sub-phases.

6. **Generate dashboard:** Write or update `Knowledge/Roadmap/generated/dashboard.md` with:
   - Phase overview table (phase, title, status, sub-phase count, completion %)
   - Detailed status per phase with sub-phases table
   - Health section: mismatches and coverage summary

## Output Format

Return a summary for consolidation AND write the dashboard file:

```text
## Roadmap Dashboard Results

Phases total: N (complete: N, in-progress: N, planned: N)
Overall completion: X%

### Mismatches
- {list of mismatches}

### Dashboard written to
- Knowledge/Roadmap/generated/dashboard.md
```

## Rules

- Write ONLY `Knowledge/Roadmap/generated/dashboard.md`.
- Read all other files — do NOT modify phase files.
- If `Knowledge/Roadmap/` does not exist: report "Roadmap area not installed".
- Completion percentage = complete phases / total phases * 100.
```

---

## Task 8: Hooks — hooks.json, session-start.mjs, pre-push-check.mjs

**Files:**
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.mjs`
- Create: `hooks/pre-push-check.mjs`

**Design notes for hooks:**
- `SessionStart` fires at the beginning of each Claude Code session. The hook's stdout is injected into session context.
- `PreToolUse` with matcher `Bash` fires before any Bash tool call. The hook inspects the command string and can output a warning that the agent sees. Hooks cannot abort tool calls — they are advisory only.
- `pre-push-check.mjs` is a Claude Code hook only (fires when Claude uses the Bash tool to run `git push`). It does not fire when the user pushes from a terminal. Terminal coverage requires a separate git `pre-push` hook (documented in project guides).
- `${CLAUDE_PLUGIN_ROOT}` is set by Claude Code to the plugin directory at runtime.
- Both hooks have zero external npm dependencies — they use only Node.js built-ins.

- [ ] **Step 1: Create hooks/hooks.json**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\"",
            "timeout": 5000
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.mjs\" \"$TOOL_INPUT_COMMAND\"",
            "timeout": 3000
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Create hooks/session-start.mjs**

The hook reads `.kdoc.yaml` from the project root and outputs a structured summary of active Knowledge areas and available commands. It uses a custom YAML scalar/list extractor (no external deps).

Key behaviors:
- If `.kdoc.yaml` is not found: exit 0 silently (project does not use kdoc).
- If `.kdoc.yaml` is found: output a Markdown summary with active areas, packs, tools, available commands, and skill names.
- `CLAUDE_PROJECT_ROOT` env var sets the project root (falls back to `process.cwd()`).
- All errors are suppressed — hook failure must not disrupt session start.

Implementation details:
- `extractScalar(yaml, key)` — regex-based extraction of `key: value` patterns (handles quoted and unquoted values).
- `extractList(yaml, key)` — handles both inline lists (`[a, b, c]`) and YAML block lists.
- Outputs Markdown headings and bullet lists for readability in Claude Code's session context.

- [ ] **Step 3: Create hooks/pre-push-check.mjs**

The hook receives the bash command as `process.argv[2]`. It checks whether the command contains `git push`, and if so, checks whether `kdoc:check` has been run since the last commit.

Key behaviors:
- Non-push commands: exit 0 silently.
- No `.kdoc.yaml` in project: exit 0 silently.
- `git push` detected: compare mtime of `Knowledge/governance-health.md` against timestamp of last git commit.
  - If health file is older than last commit: output a multi-line warning reminding to run `pnpm kdoc:check`.
  - If health file is newer or equal: exit 0 (check was run, no warning needed).
- All errors (git not available, no commits, missing files): exit 0 silently.
- Exit code is always 0 — this is a reminder, not a block.

Implementation note on `isGitPush(cmd)`:
```javascript
function isGitPush(cmd) {
  return /\bgit\s+push\b/.test(cmd);
}
```
This matches `git push`, `git push origin main`, `git push --force`, etc.

Implementation note on timestamp comparison:
- Get last commit time via `git log -1 --format=%ct` (Unix timestamp in seconds).
- Get governance-health.md mtime via `fs.stat().mtimeMs` (milliseconds).
- Warning condition: `healthFileMtime < lastCommitTime * 1000`.

The subprocess call to git uses a hardcoded command string with no user-controlled input — no injection risk.

---

## Task 9: Codex Integration

**Files:**
- Create: `agents/codex/AGENTS-knowledge.md`
- Create: `integrations/codex/install.js`

### AGENTS-knowledge.md Template

This file is the block template that `integrations/codex/install.js` merges into the target project's `AGENTS.md`. It uses `<!-- kdoc:core:start -->` / `<!-- kdoc:core:end -->` markers for safe re-injection.

- [ ] **Step 1: Create agents/codex/AGENTS-knowledge.md**

The template contains three sections:
1. **Knowledge Structure** — directory layout and descriptions.
2. **Rules for Codex Agents** — sync rules, ADR policy, gap tag rules, wikilink rules.
3. **Multi-Stream Knowledge Audit Templates** — three stream definitions for parallel Codex auditing.

Multi-stream template definitions (the core Codex-specific value):

**Stream 1 — ADR Audit:** Glob ADR files, check numbering/frontmatter/supersession/wikilinks. Read-only.

**Stream 2 — TLDR Sync:** Glob TLDR files, check frontmatter/status/gap tags/wikilinks. Read-only.

**Stream 3 — Roadmap Dashboard:** Glob roadmap files, extract status, cross-reference TLDRs, write `Knowledge/Roadmap/generated/dashboard.md`. This is the only stream that writes a file.

The template is wrapped in `<!-- kdoc:core:start -->` / `<!-- kdoc:core:end -->` markers so the install script can safely replace the block on subsequent runs.

- [ ] **Step 2: Create integrations/codex/install.js**

The install script:
1. Reads the `AGENTS-knowledge.md` template from the kdoc package.
2. Merges it into the target project's `AGENTS.md` using marker-based replace or append.
3. Creates `.codex/agents/knowledge-auditor/instructions.md` from a generated agent instructions string.
4. Outputs an installation summary and next steps.

Arguments: `--project-root`, `--kdoc-root`, `--dry-run`, `--yes`.

Merge behavior:
- If `AGENTS.md` exists and contains `<!-- kdoc:core:start -->`: replace the block between markers.
- If `AGENTS.md` exists but no markers: append the block.
- If `AGENTS.md` does not exist: create it with the block.

`.codex/agents/knowledge-auditor/instructions.md`:
- Only created if the file does not already exist (idempotent — never overwrites).
- Contains a focused version of the multi-stream audit template formatted for Codex agent instructions.

Uses only Node.js built-ins: `fs/promises`, `path`, `util` (`parseArgs`).

---

## Task 10: Claude Code Integration Install

**Files:**
- Create: `integrations/claude-code/install.js`

- [ ] **Step 1: Create integrations/claude-code/install.js**

The install script copies all Claude Code plugin components into the target project's `.claude/` directory and merges a summary block into `CLAUDE.md`.

Arguments: `--project-root`, `--kdoc-root`, `--dry-run`, `--yes`.

Actions in order:
1. **Copy skills:** For each `skills/*/SKILL.md` in the kdoc package, copy to `{projectRoot}/.claude/skills/kdoc-{skillName}/SKILL.md`. Prefix with `kdoc-` to namespace and avoid collisions with the project's own skills.
2. **Copy agents:** For each `agents/claude-code/*.md`, copy to `{projectRoot}/.claude/agents/kdoc-{agentName}.md`.
3. **Merge hooks.json:** Read the source `hooks/hooks.json`. Read the target `.claude/hooks/hooks.json` (or empty `{ "hooks": {} }` if not found). Merge hook arrays per event type, deduplicating by stringified equality. Write the merged result.
4. **Copy hook .mjs files:** Copy `session-start.mjs` and `pre-push-check.mjs` to `.claude/hooks/kdoc-session-start.mjs` and `.claude/hooks/kdoc-pre-push-check.mjs`.
5. **Merge CLAUDE.md block:** Using `<!-- kdoc:core:start -->` / `<!-- kdoc:core:end -->` markers — replace existing block, or append if absent, or create file if missing.

The `CLAUDE.md` block includes: Knowledge structure summary, AI agent rules (sync, ADR, gap tags), commands table, skill list, and agent name.

Hook JSON merge safety rule: existing non-kdoc hooks are never removed or altered. The merge only adds new hook groups; if an identical group already exists, it is not duplicated.

Uses only Node.js built-ins: `fs/promises`, `path`, `util` (`parseArgs`).

---

## Validation

After implementing all tasks, run the following checks:

- [ ] **Syntax check all JSON files:**
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))"
  node -e "JSON.parse(require('fs').readFileSync('hooks/hooks.json','utf8'))"
  ```

- [ ] **Verify hooks are valid ESM (no syntax errors):**
  ```bash
  node --check hooks/session-start.mjs
  node --check hooks/pre-push-check.mjs
  ```

- [ ] **Verify install scripts are valid ESM:**
  ```bash
  node --check integrations/claude-code/install.js
  node --check integrations/codex/install.js
  ```

- [ ] **Verify all SKILL.md files have required frontmatter (name + description):**
  ```bash
  for f in skills/*/SKILL.md; do
    grep -q "^name:" "$f" && grep -q "^description:" "$f" || echo "MISSING frontmatter: $f"
  done
  echo "All skills checked"
  ```

- [ ] **Verify all agent .md files have required frontmatter (description + tools):**
  ```bash
  for f in agents/claude-code/*.md; do
    grep -q "^description:" "$f" && grep -q "^tools:" "$f" || echo "MISSING frontmatter: $f"
  done
  echo "All agents checked"
  ```

- [ ] **Smoke-test session-start.mjs with no .kdoc.yaml (silent exit):**
  ```bash
  cd /tmp && node /absolute/path/to/kdoc/hooks/session-start.mjs
  echo "Exit code: $?"   # Expected: 0
  ```

- [ ] **Smoke-test pre-push-check.mjs with a non-push command:**
  ```bash
  node hooks/pre-push-check.mjs "git status"
  echo "Exit code: $?"   # Expected: 0, no output
  ```

- [ ] **Smoke-test pre-push-check.mjs with a push command:**
  ```bash
  node hooks/pre-push-check.mjs "git push origin main"
  echo "Exit code: $?"   # Expected: 0; may output warning if governance-health.md is stale
  ```

- [ ] **Dry-run test of Claude Code install script:**
  ```bash
  node integrations/claude-code/install.js \
    --project-root /tmp/test-project \
    --kdoc-root . \
    --dry-run
  ```

- [ ] **Dry-run test of Codex install script:**
  ```bash
  node integrations/codex/install.js \
    --project-root /tmp/test-project \
    --kdoc-root . \
    --dry-run
  ```

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|-------------|
| AC-1 | `.claude-plugin/plugin.json` is valid JSON with name, description, version, author | `JSON.parse` check |
| AC-2 | All 12 `skills/*/SKILL.md` files exist with `name:` and `description:` frontmatter | Frontmatter grep |
| AC-3 | All 12 skills have `metadata.filePattern` or `metadata.bashPattern` for trigger detection | Content review |
| AC-4 | All 4 `agents/claude-code/*.md` files exist with `description:` and `tools:` frontmatter | Frontmatter grep |
| AC-5 | `knowledge-auditor.md` uses the Task tool for parallel sub-agent launch | Content review |
| AC-6 | `hooks/hooks.json` is valid JSON using `SessionStart` and `PreToolUse` event names | JSON parse + review |
| AC-7 | `session-start.mjs` exits 0 silently when `.kdoc.yaml` not found | Smoke test in /tmp |
| AC-8 | `session-start.mjs` outputs Knowledge summary when `.kdoc.yaml` is found | Smoke test with fixture |
| AC-9 | `pre-push-check.mjs` exits 0 silently for non-push bash commands | Smoke test |
| AC-10 | `pre-push-check.mjs` outputs a warning for `git push` when governance-health.md is stale | Smoke test |
| AC-11 | `integrations/codex/install.js --dry-run` exits 0 and shows plan without writing | Dry-run test |
| AC-12 | `integrations/codex/install.js` merges AGENTS.md using `<!-- kdoc:core:start/end -->` markers | Content review |
| AC-13 | `integrations/claude-code/install.js --dry-run` exits 0 and shows plan without writing | Dry-run test |
| AC-14 | `integrations/claude-code/install.js` copies skills to `.claude/skills/kdoc-*/SKILL.md` | File existence check |
| AC-15 | Hook JSON merge preserves existing non-kdoc hooks and does not duplicate identical hooks | Merge logic review |
| AC-16 | `agents/codex/AGENTS-knowledge.md` contains 3 multi-stream audit template definitions | Content review |
| AC-17 | All hooks are self-contained ESM with no external npm dependencies | Dependency review |
| AC-18 | All install scripts use only Node.js built-ins (fs/promises, path, util) | Dependency review |

---

## TDD Notes

**Complexity tier:** standard — hook scripts and install scripts contain logic that benefits from tests.

**No TDD for Markdown content files:** Skills, agents, and `AGENTS-knowledge.md` are documentation files verified by the frontmatter grep checks above.

**Logic units that benefit from unit tests:**

| Unit | File | Key Logic |
|------|------|-----------|
| `extractScalar` | `session-start.mjs` | Regex YAML scalar extraction |
| `extractList` | `session-start.mjs` | Inline and block YAML list parsing |
| `isGitPush` | `pre-push-check.mjs` | Git push command detection |
| Hook JSON merge | `install.js` (claude-code) | Deduplication of hook arrays |
| CLAUDE.md marker merge | `install.js` (claude-code) | Replace vs append vs create |
| AGENTS.md marker merge | `install.js` (codex) | Replace vs append vs create |

**Test file placement** (if Vitest is configured at repo level per Plan 1):
- `tests/hooks/session-start.test.mjs`
- `tests/hooks/pre-push-check.test.mjs`
- `tests/integrations/install-merge.test.mjs`

**Key test scenarios:**

| Scenario | Test File | Red Phase Assert |
|----------|-----------|------------------|
| `extractScalar` finds unquoted value | session-start.test.mjs | `name: myproject` → `"myproject"` |
| `extractScalar` finds quoted value | session-start.test.mjs | `name: "my project"` → `"my project"` |
| `extractScalar` returns null on missing key | session-start.test.mjs | Missing → `null` |
| `extractList` parses inline list | session-start.test.mjs | `packs: [nextjs, swift-ios]` → `["nextjs", "swift-ios"]` |
| `extractList` parses block list | session-start.test.mjs | YAML block → array |
| `extractList` returns empty on missing key | session-start.test.mjs | Missing → `[]` |
| `isGitPush` true for `git push origin main` | pre-push-check.test.mjs | Returns true |
| `isGitPush` true for `git push --force` | pre-push-check.test.mjs | Returns true |
| `isGitPush` false for `git status` | pre-push-check.test.mjs | Returns false |
| `isGitPush` false for `git pull` | pre-push-check.test.mjs | Returns false |
| Hook merge: new hook added to empty target | install-merge.test.mjs | Source hooks appear in merged output |
| Hook merge: duplicate not added | install-merge.test.mjs | Identical hook not duplicated |
| Hook merge: different hook preserved | install-merge.test.mjs | Both hooks present in merged output |
| CLAUDE.md merge: appended when no markers | install-merge.test.mjs | Block present at end of file |
| CLAUDE.md merge: replaced when markers exist | install-merge.test.mjs | Old content replaced, surrounding preserved |
| CLAUDE.md merge: file created when absent | install-merge.test.mjs | New file created with block |

**Note:** These test files are not created in this plan — this plan covers content files and script specifications. Implement the tests concurrently with Task 9/10 (install scripts) since the test scenarios map 1:1 to exported helper functions. If the test runner is not set up (Plan 1 prerequisite), stub the test files and mark them as pending.

---

## Self-Improvement Notes

- **Skill trigger semantics:** The `metadata.filePattern` and `metadata.bashPattern` fields in SKILL.md frontmatter follow the Claude Code plugin convention, but the exact matching behavior is not fully specified in public docs. Flag for review when Claude Code plugin documentation is more detailed.
- **Hook output format:** The session-start hook outputs Markdown. Claude Code injects hook stdout into session context — verify in practice that Markdown headings render or are interpretable as-is in context.
- **`node:util` `parseArgs`:** Requires Node.js 18+. Design spec requires Node.js 20+, so this is safe across all supported environments.
- **`CLAUDE_PLUGIN_ROOT` and `CLAUDE_PROJECT_ROOT`:** These environment variables are set by Claude Code at hook execution time. If names change in future Claude Code versions, the hooks and hooks.json commands need updating. Document this as a known dependency in the integration guide.

---

## Implementation Notes (from cross-plan review)

1. **Claude Code plugin API must be verified before implementation.** The plugin discovery mechanism (`--plugin-dir`, `claude plugins add`) described in the spec is based on current understanding but may differ from the actual API. Before implementing, verify by testing with the codegraph plugin at `/Users/mariosilvagusmao/Documents/Code/MarioProjects/Plugins/codegraph/` — it uses the same conventions. If the API differs, fall back to `integrations/claude-code/install.js` which copies skills into `.claude/skills/` directly.

2. **`metadata.filePattern` / `metadata.bashPattern` are a plugin hook convention,** not native Claude Code. Document as a convention that the kdoc hooks can consume, rather than implying Claude Code natively matches these patterns.

3. **Hooks and install scripts need smoke tests.** Add at minimum: (a) create temp dir, run `install.js`, verify expected files with correct markers; (b) test `session-start.mjs` outputs valid markdown given `.kdoc.yaml`; (c) test `pre-push-check.mjs` logic with mock governance-health.md.

4. **`kdoc:design-create-spec` skill must guard for missing pack templates.** Surface clear error if pack not installed instead of silently producing nothing.

5. **`require()` in ESM context.** The project uses `"type": "module"`. Use `JSON.parse(readFileSync(...))` instead of `require()` for JSON validation in verification steps.
