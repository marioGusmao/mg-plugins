# kdoc Plan 3: Core Content

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write all universal content that gets installed into target projects — 13 templates, 5 validation scripts, 6 governance docs, and 2 schema files. All content is generalized from AVShop2 originals using `{{PLACEHOLDER}}` syntax so the CLI renderer (Plan 1) can substitute project-specific values from `.kdoc.yaml`.

**Architecture:** Pure content authoring — no compilation, no runtime dependencies. The Python scripts read `.kdoc.yaml` for configuration so they work with any project. Templates use `{{KEY}}` placeholder syntax consumed by the renderer in `cli/src/templates/renderer.ts`.

**Source material:** AVShop2 originals live at `/Users/mariosilvagusmao/Documents/Code/MRMProjects/AVShop2/`. Each template and script must be read, generalized, and written to `core/`.

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md`

**Subsystem scope:** This plan covers `core/templates/`, `core/scripts/`, `core/governance/`, and `core/schema/`. It does NOT cover CLI code (Plans 1–2), packs (Plan 4), AI integrations (Plan 5), or dogfooding (Plan 6).

---

## File Structure

```
kdoc/
└── core/
    ├── templates/
    │   ├── adr.md               # ADR template — generalized from AVShop2
    │   ├── tldr.md              # Feature/TLDR template — generalized
    │   ├── phase.md             # Roadmap phase template — generalized
    │   ├── sub-phase.md         # Roadmap sub-phase template — generalized
    │   ├── test-map.md          # Test map template — generalized
    │   ├── runbook.md           # Runbook template — generalized
    │   ├── threat-model.md      # Threat model template — generalized
    │   ├── context-pack.md      # Context pack template — new
    │   ├── guide.md             # Guide template — new
    │   ├── memory.md            # Agent memory template — new
    │   ├── readme-adr.md        # ADR README template — generalized from AVShop2 ADR/README.md
    │   ├── readme-tldr.md       # TLDR README template — generalized from AVShop2 TLDR/README.md
    │   └── readme-roadmap.md    # Roadmap README template — generalized from AVShop2 Roadmap/README.md
    ├── scripts/
    │   ├── check_sync.py        # Knowledge sync validator — generalized from AVShop2
    │   ├── check_wikilinks.py   # Wikilink validator — generalized from AVShop2
    │   ├── build_index.py       # INDEX.md builder — generalized from AVShop2
    │   ├── check_adr_governance.py  # ADR governance checker — generalized from AVShop2
    │   └── governance_health.py # Orchestrator — runs all checks, reports summary
    ├── schema/
    │   ├── knowledge-structure.json   # Canonical directory structure spec
    │   └── frontmatter-schemas.json   # Per-type frontmatter field definitions
    └── governance/
        ├── adr-conventions.md         # ADR lifecycle rules and conventions
        ├── tldr-lifecycle.md          # TLDR status taxonomy and lifecycle
        ├── wikilink-standard.md       # Wikilink format and validation rules
        ├── gap-tracking.md            # Gap-tracking tags reference
        ├── roadmap-conventions.md     # Roadmap phase/sub-phase conventions
        └── merge-strategy.md          # Marker-based merge strategy reference
```

---

### Task 1: Core Templates

**Files:**
- Create: `core/templates/adr.md`
- Create: `core/templates/tldr.md`
- Create: `core/templates/phase.md`
- Create: `core/templates/sub-phase.md`
- Create: `core/templates/test-map.md`
- Create: `core/templates/runbook.md`
- Create: `core/templates/threat-model.md`
- Create: `core/templates/context-pack.md`
- Create: `core/templates/guide.md`
- Create: `core/templates/memory.md`
- Create: `core/templates/readme-adr.md`
- Create: `core/templates/readme-tldr.md`
- Create: `core/templates/readme-roadmap.md`

**Placeholder conventions used across all templates:**

| Placeholder | Source | Example value |
|---|---|---|
| `{{PROJECT_NAME}}` | CLI prompt at `init` time (not in `.kdoc.yaml`) | `MyProject` |
| `{{KNOWLEDGE_ROOT}}` | `.kdoc.yaml` → `root` | `Knowledge` |
| `{{TLDR_SCOPES}}` | `.kdoc.yaml` → `areas.tldr.scopes` (joined with `, `) | `Frontend, Backend, Shared` |
| `{{OWNER}}` | CLI prompt at `init` time (not in `.kdoc.yaml`) | `alice` |
| `{{DATE}}` | Generated at creation time (`new Date().toISOString().slice(0,10)`) | `2026-03-18` |

**Design decision:** `PROJECT_NAME` and `OWNER` are NOT stored in `.kdoc.yaml` — they are asked once during `init` and burned into the generated files. This avoids inventing config keys that the spec doesn't define. If a template needs a value that isn't in `.kdoc.yaml`, the CLI asks the user at creation time and passes it as a render value. No invented config keys.

- [ ] **Step 1: Create `core/templates/adr.md`**

Generalize from `AVShop2/Knowledge/Templates/adr.md`. The original is already minimal and generic. The only AVShop2-specific content is the wikilink path format. Generalize the `Related modules` section to accept any TLDR path structure.

```markdown
---
type: adr
id: ADR-000X
status: proposed
date: YYYY-MM-DD
superseded-by: ''
tags: []
summary: ''
---

# ADR-000X - <Short Title>

## Context

<!-- What problem are we solving? -->

## Decision Drivers

<!-- What forces, constraints, or requirements shaped this decision? -->

## Decision

<!-- What was decided? -->

## Alternatives considered

- Option A —
- Option B —

## Consequences

### Positive

-

### Trade-offs

-

## Related modules

- [[<path-to-related-tldr>|<Module Name>]]
```

- [ ] **Step 2: Create `core/templates/tldr.md`**

Generalize from `AVShop2/Knowledge/Templates/feature.md`. Replace AVShop2-specific paths (`apps/{app}/src/modules/{module-name}`, `packages/{package-name}`) with generic path placeholders. Replace the hardcoded ADR reference `[[ADR/ADR-0001-knowledge-obsidian-standard|ADR-0001]]` with a generic example. The gap-tracking tags comment block is kept verbatim (it is universal). Remove the `security-tier` frontmatter field (it is AVShop2/Next.js-specific — belongs in the nextjs pack, not core).

```markdown
---
type: feature
area: <Area>
id: tldr-<area>-<feature>
status: draft
tags: []
# Gap-tracking tags (add to tags list as needed):
#   has-open-questions — file has unresolved Open Questions
#   missing-test-scenarios — Test Scenarios table is empty
#   missing-acceptance-criteria — Acceptance Criteria is empty
#   blocked-by-decision — an open question blocks implementation
summary: ''
---

# <Feature Name>

## Description

<!-- 3-6 lines: what it does and for whom -->

## Requirements

- [ ]

## Test Scenarios

<!-- What should be tested for this feature? List key scenarios per test level. -->
<!-- Remove this section only if the feature has no testable behavior. -->

| Scenario | Test level | Notes |
| -------- | ---------- | ----- |
|          | Unit       |       |
|          | Integration|       |
|          | E2E        |       |

## Acceptance Criteria

<!-- Measurable conditions that must be true for this feature to be complete. -->

- [ ]

## Non-Goals

<!-- What is explicitly out of scope for this feature? -->

## Dependencies

-

## Used by

-

## Open Questions

-

## Related ADRs

-

## Readiness Checklist

<!-- All items must be checked to promote status from draft → ready -->

- [ ] Data model / schema reviewed (or marked N/A)
- [ ] API contract section reviewed (or marked N/A)
- [ ] Dependencies confirmed
- [ ] Test scenarios filled (not empty)
- [ ] Acceptance criteria filled (not empty)
```

- [ ] **Step 3: Create `core/templates/phase.md`**

Generalize from `AVShop2/Knowledge/Templates/phase.md`. Replace AVShop2-specific tooling references (`pnpm changeset`, `pnpm agent:stream:release`, `knowledge-obsidian skill`, `AGENTS.md`, `implementation-review-unified`) with generic equivalents. The roadmap structure (sub-phases, dependency graph, launch groups) is fully universal.

```markdown
---
type: phase
area: Project
id: phase-N
status: pending|in-progress|completed
depends_on: [phase-X, phase-Y]
last_reviewed: YYYY-MM-DD
sub_phases: ['N.1', 'N.2', 'N.3']
work_units_total: 3
next_work_units: ['N.1', 'N.2']
tags:
  - phase
  - execution
summary: <one-line phase goal>
---

# Phase N — <Phase Name>

> **Status:** pending
> **Depends on:** [[{{KNOWLEDGE_ROOT}}/Roadmap/phases/<phase-file>]] _(replace with actual wikilink)_
> **Goal:** <2-3 sentences>

See [[Roadmap/README]] for cross-phase concerns, design principles, and registries.

## Sub-phase Summary

> Sub-phase cards are stored as separate files in `Roadmap/phases/phase-N/N.X.md`.

<!-- SUBPHASE_AUTOGEN:START -->
(will be generated by the roadmap build script)
<!-- SUBPHASE_AUTOGEN:END -->

## Dependency Graph

<!-- machine-readable DAG -->
<!-- dependency-graph
phase-X -> N.1, N.2
N.1 -> N.3
N.2 -> N.3
N.1 || N.2
-->

**Critical path:** N.1 -> N.3

**Launch groups:**

- Group A (start immediately): N.1, N.2
- Group B (after N.1): N.3

**Merge order:** N.1 -> N.2 -> N.3

**WIP limit:** max 2 active sub-phases per phase.

## Phase Gate

<aggregated exit criteria for the whole phase>

## Phase-Level Notes

> These apply to ALL sub-phases in this phase. Sub-phase-specific notes are in each card.

- **Startup:** Read ContextPack -> this phase file -> sub-phase TLDR
- **Isolation:** One branch per sub-phase. Commit incrementally.
- **Blockers:** If blocked, stop, document the blocker, report to orchestrator.

---

## Phase Retrospective

> Filled after phase completion.

- **Completed:** YYYY-MM-DD
- **What went well:** <bullets>
- **What didn't:** <bullets>
- **Improvements for next phase:** <bullets>
```

- [ ] **Step 4: Create `core/templates/sub-phase.md`**

Generalize from `AVShop2/Knowledge/Templates/sub-phase.md`. Remove AVShop2-specific fields: `app: Shop|Admin|Shared|Both`, `security_tier`, `tldr: 'TLDR/App/module-name'`, `module path`, `design spec`. Keep the universal structure: objective, inputs, outputs, scope, anti-scope, file ownership, dependencies table, verification, AI session notes. Replace `[evidence:roadmap.N.X.example-item]` evidence tags with a generic form — these are part of the roadmap evidence system which is universal.

```markdown
---
type: sub-phase
area: Project
id: 'N.X'
parent_phase: phase-N
status: pending
blocked_by: []
parallel_with: []
tags:
  - sub-phase
  - execution
summary: One-line summary of the sub-phase objective.
---

# Sub-phase N.X — <Name>

> **Status:** pending
> **Size:** <Small|Medium|Large>
> **Parent:** [[Roadmap/phases/<phase-file>|Phase N]]

## Objective

What this sub-phase delivers and why.

## Inputs

- [ ] Dependency (Phase N.X) — what it provides

## Outputs

- Files and artifacts created

## Scope

- Feature 1
- Feature 2

## Anti-scope

- Feature explicitly NOT delivered here (delivered in N.X)

## File Ownership

- `path/to/files/` — description

## Dependencies

| Dependency | Type | Source Phase | Status |
| ---------- | ---- | ------------ | ------ |
| Module     | hard | Phase N.X    | exists |

## Verification

- [ ] Verification item 1 [evidence:roadmap.N.X.example-item]
- [ ] Verification item 2 [evidence:roadmap.N.X.example-item-2]

## AI Session Notes

> Notes for agents working on this sub-phase.
```

- [ ] **Step 5: Create `core/templates/test-map.md`**

Generalize from `AVShop2/Knowledge/Templates/test-map.md`. Replace the AVShop2-specific ADR reference (`ADR-0005`) with a generic testing strategy note. Test levels (Unit, Component, Integration, E2E) are universal. The file path convention comments reference AVShop2 paths — generalize to `<module>/<file>.test.<ext>`.

```markdown
# Test Map — <Feature/PR Name>

> Required for all functional PRs. Maps scenarios to test files and tracks implementation status.

## Test Map

| #   | Scenario | Test Level  | File | Status  |
| --- | -------- | ----------- | ---- | ------- |
| 1   |          | Unit        |      | Pending |
| 2   |          | Integration |      | Pending |
| 3   |          | E2E         |      | Pending |

## Status Legend

- **Pending** — test not yet written
- **Written** — test written, not yet passing
- **Passing** — test written and passing
- **N/A** — scenario not applicable at this test level

## Notes

- Test levels: Unit, Component (if UI), Integration (cross-module), E2E (Playwright or equivalent)
- File paths are relative to the project root
- Co-located tests: `<module>/<file>.test.<ext>` next to the source file
- Integration tests: `tests/integration/*.test.<ext>`
- E2E tests: `tests/e2e/*.spec.<ext>`
```

- [ ] **Step 6: Create `core/templates/runbook.md`**

Source is `AVShop2/Knowledge/Templates/runbook.md`. It is already fully generic — copy verbatim, no changes needed.

```markdown
---
type: runbook
status: draft
owner: ''
tags: []
summary: ''
---

# Runbook - <Title>

## Objective

<!-- 1-2 lines -->

## Steps

1.
2.

## Verification

- [ ]

## Rollback

-

## Related links

-
```

- [ ] **Step 7: Create `core/templates/threat-model.md`**

Source is `AVShop2/Knowledge/Templates/threat-model.md`. Replace `area: <Shop|Admin|Shared>` with a generic `area: <Area>`. The STRIDE structure is fully universal.

```markdown
---
type: threat-model
area: <Area>
id: tm-<module>
status: draft
tags: [security, threat-model]
summary: ''
---

# Threat Model - <Module Name>

## Scope

<!-- Module name, data flows involved, external interfaces -->

## STRIDE Analysis

| Threat | Category | Likelihood | Impact | Mitigation | Status |
| ------ | -------- | ---------- | ------ | ---------- | ------ |
|        |          |            |        |            |        |

<!-- Status: Identified, Mitigated, Accepted (with justification), Deferred (with linked issue) -->

## Attack Surface

<!-- External interfaces, user input points, file uploads, API endpoints -->

## Residual Risks

<!-- Risks accepted with justification -->

## Review History

| Date | Reviewer | Changes |
| ---- | -------- | ------- |
|      |          |         |

## Related links

<!-- Wikilinks to TLDR, ADRs, register -->
```

- [ ] **Step 8: Create `core/templates/context-pack.md`**

New template — does not have a direct AVShop2 counterpart (AVShop2's ContextPack.md is project-specific). Design a generic context pack structure that prompts authors to fill in the project-specific navigation map, recommended startup flow, and authoring standards. Use `{{PROJECT_NAME}}` and `{{KNOWLEDGE_ROOT}}` placeholders.

```markdown
# ContextPack — Quick Start for Agents

> Goal: provide enough context to work on {{PROJECT_NAME}} without opening many files first.
>
> **Knowledge root:** `{{KNOWLEDGE_ROOT}}/` — all wikilinks resolve relative to this directory.

## Where information lives

<!-- Customize these entries for your project's actual Knowledge structure. -->
<!-- Remove areas that are not installed. Add project-specific entries. -->

- Feature requirements: `TLDR/**`
- Decisions: `ADR/**`
- Roadmap: `Roadmap/`
- Guides: `Guides/`
- Runbooks: `runbooks/`
- Agent memory: `AgentMemory/`

## Recommended agent startup flow

1. Read this file.
2. Read `AgentMemory/MEMORY.md` (if agent-memory area is installed).
3. Read `TLDR/README.md`.
4. Open the relevant TLDR modules and follow dependency links.
5. If implementing a phase module, read the relevant phase file and sub-phase card.
6. If the change is structural, review ADRs before writing.
7. If encountering errors, consult `Guides/TROUBLESHOOTING.md` (if guides area is installed).

## Authoring standards

- One TLDR file = one feature.
- Keep docs implementation-agnostic.
- Use wikilinks for internal cross-references.
- Keep frontmatter up to date.
- Every feature file must include all standard sections.

## Fast update checklist

- [ ] Requirements updated
- [ ] Dependencies and Used by sections reviewed
- [ ] Acceptance criteria updated
- [ ] Open questions resolved or escalated
```

- [ ] **Step 9: Create `core/templates/guide.md`**

New template — no direct AVShop2 counterpart (AVShop2's guides are project-specific). Design a generic operational guide template suitable for onboarding, troubleshooting, scripts catalog, and similar reference content.

```markdown
---
type: guide
area: Guides
id: guide-<slug>
status: draft
tags: []
summary: ''
---

# Guide — <Title>

> **Purpose:** <one-line description of what this guide covers>
> **Audience:** <who should read this>

## Overview

<!-- 2-4 lines: what this guide covers and why it exists -->

## Prerequisites

- <tool or knowledge required>

## <Section 1>

<!-- Main content section. Add as many sections as needed. -->

## <Section 2>

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
|         |              |     |

## Related links

-
```

- [ ] **Step 10: Create `core/templates/memory.md`**

New template based on AVShop2's `Knowledge/AgentMemory/MEMORY.md` structure, but generalized. Replace all AVShop2-specific operational details with `{{PROJECT_NAME}}` placeholders and generic section prompts.

```markdown
# {{PROJECT_NAME}} Shared Agent Memory

## Purpose

This directory is the canonical shared memory for AI agents.
Use it for stable, cross-session operational context that should survive chat history reset.

## User Preferences

<!-- Capture communication preferences and workflow rules. -->

- Keep code, docs, and commits in English (or your project's language).
- The repository owner is the final decision-maker.
- For complex requests, prefer a clear plan before implementation.

## Dev Environment Quick Reference

<!-- Add project-specific ports, commands, and environment shortcuts here. -->

### Common Commands

-

## Operational Guardrails

- Do not store secrets, credentials, tokens, or personal data in these files.
- Store stable patterns only (not one-off session notes).
- Keep `MEMORY.md` concise and delegate detail to topic files.

## Topic Files

<!-- List companion topic files stored in the same directory. -->
<!-- Example: gotchas-database.md, patterns-testing.md -->

-

## Feedback

<!-- Capture recurring feedback that should affect agent behavior. -->

-
```

- [ ] **Step 11: Create `core/templates/readme-adr.md`**

Generalize from `AVShop2/Knowledge/ADR/README.md`. Replace AVShop2-specific content: owner name (`mariosilvagusmao`), current ADR sequence number, approval queue entries. Use placeholders `{{OWNER}}`, `{{ADR_NEXT_SEQUENCE}}`. Keep all governance rules verbatim — they are universal. The automated check command becomes `kdoc:check:adr-governance` (matching the generic script prefix).

```markdown
# ADR — Architecture Decision Records

Use ADRs to capture structural decisions and preserve decision context over time.

## When to create an ADR

Create an ADR when a decision impacts one or more of the following:

- Architecture
- Data model or consistency rules
- Integrations
- Global standards and conventions
- Multiple TLDR modules

## Naming

Use `ADR-0001-<short-title>.md`.

## Minimum structure

- Context
- Decision Drivers
- Decision
- Alternatives considered
- Consequences and trade-offs
- Links to impacted TLDR modules

## Lifecycle

- `proposed`
- `accepted`
- `deprecated`
- `superseded`

## Decision Authority

- Final approval authority for ADR status changes is the repository owner: `{{OWNER}}`
- AI agents can draft, review, and update ADRs, but cannot self-approve `proposed -> accepted`

## Acceptance Gate (`proposed` -> `accepted`)

All items below must be true before changing status:

- Decision is complete: sections for Context, Decision Drivers, Decision, Alternatives considered, and Consequences are filled with concrete content
- Scope is explicit: impacted modules are linked in `Related modules`
- No unresolved decision blockers remain inside the ADR
- **No active Open Questions:** An accepted ADR must not have active (non-strikethrough) bullets in its `## Open Questions` section. If questions exist but are deferred, add `open-questions-status: deferred` to frontmatter.
- Cross-doc consistency is verified against impacted TLDR files and related ADRs
- Trade-offs are documented (not only positive outcomes)
- Final approval is explicitly given by the repository owner

## Acceptance Workflow

1. Author or update ADR in `proposed` state
2. Perform cross-check against related TLDR/ADR documents
3. Request owner approval
4. After approval, change `status` to `accepted` and set `date` to the approval date
5. From this point, ADR body becomes immutable (frontmatter-only schema updates allowed)

## Supersession Integrity

- When `superseded-by` is set on an ADR, its `status` **must** be `superseded`.
- The successor ADR **must** have a reciprocal `supersedes` field pointing back to the original.
- **No partial supersession:** If only specific decisions are overridden, create a standalone ADR referencing the original.

## Traceability

- **TLDR `## Related ADRs`** is the canonical source of truth for TLDR-to-ADR relationships.

## ADR Sequence

Next available: **{{ADR_NEXT_SEQUENCE}}**

## Current Approval Queue

- (empty)

## ADR Governance Validation

Run `kdoc:check:adr-governance` after creating or modifying ADRs.

| Check | What it validates | Severity |
| ----- | ----------------- | -------- |
| G1    | Accepted ADRs have required sections | high |
| G2    | Every ADR has a Dependency Map line in ADR-CROSS-REFERENCES.md | medium |
| G3    | README.md sequence number = highest ADR + 1 | low |
| G4    | README.md approval queue matches ADRs with `status: proposed` | low |
```

- [ ] **Step 12: Create `core/templates/readme-tldr.md`**

Generalize from `AVShop2/Knowledge/TLDR/README.md`. Replace AVShop2-specific content: the project description, the Shop/Admin/Shared module list. Use `{{PROJECT_NAME}}` and `{{TLDR_SCOPES}}` placeholders. Keep all governance rules, status taxonomy, gap-tracking tags, and readiness checklist verbatim — they are universal. The module list becomes a placeholder comment with an example.

```markdown
---
type: index
area: TLDR
id: tldr-index
status: ready
tags:
  - knowledge
  - tldr
summary: Entry index for all TLDR feature modules.
---

# {{PROJECT_NAME}} — TLDR (Functional Requirements)

<!-- One paragraph describing this project and its major areas. Replace this comment. -->

## Structure

```text
TLDR/
{{TLDR_STRUCTURE_COMMENT}}
```

## Normative Language

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in TLDR documents are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## How to use this directory

- Each `.md` file describes one feature without implementation-specific code.
- Canonical links use wikilinks with path, for example `[[TLDR/<Area>/<feature>]]`.
- Every feature note must include all standard sections: Description, Requirements, Test Scenarios, Acceptance Criteria, Non-Goals, Dependencies, Used by, Open Questions, Related ADRs.
- If an AI detects flaws or improvement opportunities in requirements, it must report to the user.
- **Status definitions:**
  - `draft` — requirements documented but not yet validated for implementation
  - `in_progress` — module is under active implementation
  - `ready` — passed full readiness checklist, cleared for implementation
  - `done` — implementation complete; TLDR is stable
  - `blocked` — cannot proceed due to unresolved dependency or external blocker
- **Gap-tracking tags** (in frontmatter `tags`):
  - `has-open-questions` — file has unresolved Open Questions
  - `missing-test-scenarios` — Test Scenarios table is empty
  - `missing-acceptance-criteria` — Acceptance Criteria is empty
  - `blocked-by-decision` — an open question blocks implementation

## Index

> **Live status:** Per-file status is tracked in `INDEX.md` (auto-generated). This index lists modules only.

<!-- Add wikilinks to feature modules here. Example: -->
<!-- - [[TLDR/<Area>/<feature>|Feature Name]] -->
```

- [ ] **Step 13: Create `core/templates/readme-roadmap.md`**

Generalize from `AVShop2/Knowledge/Roadmap/README.md`. Replace the phase list with a placeholder comment instructing authors to add phases. Keep the Progress Dashboard structure with the `ROADMAP_AUTOGEN` comment block — this is consumed by `build_index.py`. Replace AVShop2-specific phases and dependency graph with generic examples.

```markdown
---
type: reference
area: Project
id: roadmap
status: active
tags:
  - planning
  - roadmap
  - phases
summary: Implementation roadmap — entry point with progress dashboard and links to phases.
---

# Roadmap

> **Living document** — updated as phases are completed or reprioritized.
> Per-phase details live in `Roadmap/phases/phase-N.md` files. Sub-phase cards live in `Roadmap/phases/phase-N/N.X.md`.

## Progress Dashboard

<!-- ROADMAP_AUTOGEN:START -->

| Phase | Name | Status | Progress | Next Up | Details |
| ----- | ---- | ------ | -------- | ------- | ------- |
| 1     | <!-- Phase name --> | pending | 0/1 | 1.1 | [[Roadmap/phases/phase-1]] |

**Overall:** 0/1 done, 0 in progress, 1 remaining.

<!-- ROADMAP_AUTOGEN:END -->

## Cross-Phase Dependency Graph

```text
<!-- Add dependency graph here. Example: -->
<!-- 1 → 2 → 3 -->
```

## Reference Documents

<!-- Add links to reference docs as your roadmap grows. -->
<!-- Example: [[Roadmap/reference/design-principles|Design Principles]] -->
```

---

### Task 2: Schema Files

**Files:**
- Create: `core/schema/knowledge-structure.json`
- Create: `core/schema/frontmatter-schemas.json`

- [ ] **Step 1: Create `core/schema/knowledge-structure.json`**

This file describes the canonical directory structure that kdoc creates. It is the machine-readable contract consumed by `kdoc doctor` to detect drift. Each area lists its required files, optional files, and the template that generates each one. Designed to match the areas in `.kdoc.yaml`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "description": "Canonical Knowledge directory structure managed by kdoc",
  "version": "1",
  "areas": {
    "adr": {
      "description": "Architecture Decision Records",
      "directory": "ADR",
      "required": ["README.md"],
      "optional": ["ADR-CROSS-REFERENCES.md"],
      "templates": {
        "README.md": "core/templates/readme-adr.md",
        "ADR-*.md": "core/templates/adr.md"
      }
    },
    "tldr": {
      "description": "Functional requirements (one file per feature)",
      "directory": "TLDR",
      "required": ["README.md"],
      "scoped": true,
      "templates": {
        "README.md": "core/templates/readme-tldr.md",
        "**/*.md": "core/templates/tldr.md"
      }
    },
    "roadmap": {
      "description": "Phase-based project roadmap",
      "directory": "Roadmap",
      "required": ["README.md"],
      "optional": ["phases/"],
      "templates": {
        "README.md": "core/templates/readme-roadmap.md",
        "phases/phase-*.md": "core/templates/phase.md",
        "phases/*/*.md": "core/templates/sub-phase.md"
      }
    },
    "guides": {
      "description": "Operational guides and references",
      "directory": "Guides",
      "required": [],
      "templates": {
        "**/*.md": "core/templates/guide.md"
      }
    },
    "runbooks": {
      "description": "Operational runbooks",
      "directory": "runbooks",
      "required": [],
      "templates": {
        "**/*.md": "core/templates/runbook.md"
      }
    },
    "threat-models": {
      "description": "STRIDE threat models per security-critical module",
      "directory": "ThreatModels",
      "required": [],
      "templates": {
        "**/*.md": "core/templates/threat-model.md"
      }
    },
    "templates": {
      "description": "User-facing document templates",
      "directory": "Templates",
      "required": [],
      "templates": {}
    },
    "agent-memory": {
      "description": "Shared AI agent memory (persists across sessions)",
      "directory": "AgentMemory",
      "required": ["MEMORY.md"],
      "templates": {
        "MEMORY.md": "core/templates/memory.md"
      }
    },
    "context-pack": {
      "description": "Single-file quick-start context for AI agents",
      "directory": ".",
      "required": ["ContextPack.md"],
      "templates": {
        "ContextPack.md": "core/templates/context-pack.md"
      }
    },
    "index": {
      "description": "Auto-generated navigation index",
      "directory": ".",
      "required": ["INDEX.md"],
      "templates": {}
    },
    "governance": {
      "description": "Governance reference documents (installed into Knowledge/governance/)",
      "directory": "governance",
      "required": [],
      "templates": {}
    }
  }
}
```

- [ ] **Step 2: Create `core/schema/frontmatter-schemas.json`**

Documents the expected frontmatter fields for each `type` value. This is reference schema only — it is consumed by `kdoc doctor` for validation and by the Claude Code `adr-validate` and `tldr-create` skills for field checking. Not a JSON Schema draft — use a simple custom format that matches what the Python scripts can parse without external dependencies.

```json
{
  "description": "Frontmatter field definitions per document type. Consumed by kdoc doctor and governance scripts.",
  "version": "1",
  "types": {
    "adr": {
      "required": ["type", "id", "status", "date", "summary"],
      "optional": ["superseded-by", "supersedes", "open-questions-status", "linear", "tags"],
      "status_values": ["proposed", "accepted", "deprecated", "superseded"],
      "id_pattern": "^ADR-\\d{4}$"
    },
    "feature": {
      "required": ["type", "area", "id", "status", "summary"],
      "optional": ["linear", "tags", "module_path", "package_path", "core_paths", "api_paths"],
      "status_values": ["draft", "in_progress", "ready", "done", "blocked"],
      "gap_tracking_tags": [
        "has-open-questions",
        "missing-test-scenarios",
        "missing-acceptance-criteria",
        "blocked-by-decision"
      ]
    },
    "phase": {
      "required": ["type", "area", "id", "status", "summary"],
      "optional": ["depends_on", "last_reviewed", "sub_phases", "work_units_total", "next_work_units", "tags"],
      "status_values": ["pending", "in-progress", "completed", "completed_with_notes"]
    },
    "sub-phase": {
      "required": ["type", "area", "id", "parent_phase", "status", "summary"],
      "optional": ["blocked_by", "parallel_with", "tags"],
      "status_values": ["pending", "in-progress", "completed"]
    },
    "runbook": {
      "required": ["type", "status", "summary"],
      "optional": ["owner", "linear", "tags"],
      "status_values": ["draft", "active", "deprecated"]
    },
    "threat-model": {
      "required": ["type", "area", "id", "status", "summary"],
      "optional": ["linear", "tags"],
      "status_values": ["draft", "reviewed", "approved"]
    },
    "reference": {
      "required": ["type", "area", "id", "status", "summary"],
      "optional": ["linear", "tags"]
    },
    "index": {
      "required": ["type", "area", "id", "status", "summary"],
      "optional": ["linear", "tags"]
    }
  }
}
```

---

### Task 3: Governance Docs

**Files:**
- Create: `core/governance/adr-conventions.md`
- Create: `core/governance/tldr-lifecycle.md`
- Create: `core/governance/wikilink-standard.md`
- Create: `core/governance/gap-tracking.md`
- Create: `core/governance/roadmap-conventions.md`
- Create: `core/governance/merge-strategy.md`

These are reference documents installed into `{{KNOWLEDGE_ROOT}}/governance/` in the target project. They are NOT templates (no placeholders) — they are static reference content. The goal is to give project teams authoritative governance rules in-repo so AI agents can read them without fetching external docs.

- [ ] **Step 1: Create `core/governance/adr-conventions.md`**

Distilled from `AVShop2/Knowledge/ADR/README.md`. Remove AVShop2-specific entries (specific ADR numbers, owner name, approval queue). Keep the full lifecycle rules, acceptance gate, supersession integrity rules, and traceability precedence — these are universal.

Content covers:
- When to create an ADR
- Naming convention
- Required sections
- Lifecycle states with transition rules
- Acceptance gate checklist
- Acceptance workflow steps
- Immutability rule for accepted ADRs
- Supersession integrity constraints (superseded-by ↔ supersedes symmetry, no partial supersession)
- Traceability precedence (TLDR `## Related ADRs` as canonical source)
- Decision authority (owner approval required for `proposed → accepted`)

- [ ] **Step 2: Create `core/governance/tldr-lifecycle.md`**

Distilled from `AVShop2/Knowledge/TLDR/README.md`. Remove AVShop2-specific module lists, wikilinks, and command references. Keep the full status taxonomy, readiness checklist, dependency classification, gap-tracking tags, and normative language rules.

Content covers:
- Status values: `draft`, `in_progress`, `ready`, `done`, `blocked` — with definitions
- Readiness checklist (mandatory to promote `draft → ready`)
- Dependency classification: Hard, Integration, Architectural — with rules
- Gap-tracking tags: `has-open-questions`, `missing-test-scenarios`, `missing-acceptance-criteria`, `blocked-by-decision` — with rules for resolution and tag removal
- Normative language (RFC 2119 keywords)
- Required sections per feature file
- `## Related ADRs` as canonical source for traceability

- [ ] **Step 3: Create `core/governance/wikilink-standard.md`**

Derived from the wikilink validation logic in `AVShop2/scripts/check_knowledge_wikilinks.py` and usage patterns across AVShop2 Knowledge files. Documents the wikilink format, resolution rules, and forbidden patterns.

Content covers:
- Wikilink syntax: `[[path/to/file]]` and `[[path/to/file|Display Text]]`
- Section anchors: `[[path/to/file#section]]`
- Resolution rules: paths resolve relative to Knowledge root if first segment matches a known directory; fall back to current file's directory
- Placeholder/example links: `[[TLDR/<Area>/<note>]]` are exempt from validation
- Forbidden patterns: absolute paths (`/Users/...`, `file://`), Windows absolute paths
- Escaped pipes in tables: `[[path\|text]]` is valid inside markdown tables
- `.md` extension is optional — validator normalizes automatically
- How to fix broken wikilinks: check casing, spelling; use `kdoc:check:wikilinks` to find all issues

- [ ] **Step 4: Create `core/governance/gap-tracking.md`**

Focused reference for the gap-tracking tag system. Complements `tldr-lifecycle.md`. Derived from the gap detection logic in `AVShop2/scripts/build_knowledge_index.py` and the TLDR README.

Content covers:
- The four gap-tracking tags and their meaning
- When each tag is added (automatically detected vs. manually added)
- Rules for removing each tag (conditions + verification)
- How the INDEX.md readiness summary uses these tags
- Interaction with TLDR `status` field: a file is "ready for implementation" only when `status: ready` AND no gap-tracking tags are present

- [ ] **Step 5: Create `core/governance/roadmap-conventions.md`**

Distilled from `AVShop2/Knowledge/Roadmap/README.md` and the phase/sub-phase templates. Documents the roadmap structure, dependency graph format, WIP limits, and automation markers.

Content covers:
- Phase vs. sub-phase distinction
- Sub-phase card file placement convention: `Roadmap/phases/phase-N/N.X.md`
- `ROADMAP_AUTOGEN` and `SUBPHASE_AUTOGEN` comment block markers — consumed by `build_index.py`
- Dependency graph machine-readable format (`<!-- dependency-graph ... -->`)
- Status values for phases and sub-phases
- WIP limit convention and rationale
- Evidence tag format: `[evidence:roadmap.N.X.item-name]` on verification checkboxes
- Launch group documentation pattern

- [ ] **Step 6: Create `core/governance/merge-strategy.md`**

Documents the marker-based merge strategy used by kdoc's CLI. This is installed in the target project so team members understand how `CLAUDE.md`, `AGENTS.md`, and `.gitignore` are managed. Derived from the design spec (Section 4.3).

Content covers:
- Named marker pairs: `<!-- kdoc:core:start -->` / `<!-- kdoc:core:end -->`, pack variants
- `.gitignore` variant: `# kdoc:core:start` / `# kdoc:core:end`
- Algorithm: create / append / replace / error on corruption / prompt on user-modified content
- Hash comparison: `blockHash` tracks only the injected block, not the full file
- Update safety: `[S]kip / [O]verwrite / [D]iff` prompt when user-modified
- When `--force` applies: unconditional overwrite without prompt
- How to identify managed blocks: look for marker pairs in the file
- How to "unmanage" a block: remove markers, then run `kdoc undo` to clean up `.kdoc.lock`

---

### Task 4: Python Validation Scripts

**Files:**
- Create: `core/scripts/check_sync.py`
- Create: `core/scripts/check_wikilinks.py`
- Create: `core/scripts/build_index.py`
- Create: `core/scripts/check_adr_governance.py`
- Create: `core/scripts/governance_health.py`

**Key generalization pattern for all scripts:**

All four existing AVShop2 scripts hardcode paths relative to the repository root. In the generalized versions, paths are read from `.kdoc.yaml`. A shared `load_kdoc_config()` helper reads the config file. Scripts locate `.kdoc.yaml` by walking up from the script's location (or `cwd`) until found — this mirrors how tools like `pyproject.toml` are discovered.

**Config discovery algorithm (used by all scripts):**

```python
def find_kdoc_config(start: Path) -> Path:
    """Walk up from start looking for .kdoc.yaml."""
    current = start.resolve()
    while True:
        candidate = current / ".kdoc.yaml"
        if candidate.exists():
            return candidate
        parent = current.parent
        if parent == current:
            raise FileNotFoundError("No .kdoc.yaml found. Is this a kdoc-managed project?")
        current = parent

def load_kdoc_config(config_path: Path) -> dict:
    """Load and parse .kdoc.yaml using stdlib (no PyYAML dependency)."""
    # Use a minimal YAML parser for the subset of YAML used by .kdoc.yaml.
    # .kdoc.yaml uses only: string scalars, lists, nested mappings.
    # No anchors, no multi-line strings, no complex types needed.
    ...
```

Note: the scripts must avoid external Python dependencies (no `pyyaml`, no `tomllib` on Python <3.11). The existing AVShop2 scripts use pure stdlib — preserve this pattern. Write a minimal YAML loader for the `.kdoc.yaml` subset (the same frontmatter parser logic already in the AVShop2 scripts can be adapted).

- [ ] **Step 1: Create `core/scripts/check_sync.py`**

Generalize from `AVShop2/scripts/check_knowledge_sync.py`.

**Changes from original:**
1. Remove hardcoded `ROOT = Path(__file__).resolve().parents[1]` — discover root via `.kdoc.yaml`
2. Remove hardcoded `KNOWLEDGE_DIR = ROOT / "Knowledge"` — read `root` from config
3. Remove hardcoded `FUNCTIONAL_PATTERNS` list — read `governance.enforced-paths` from config, compile to regex at runtime
4. The `CODE_EXTENSIONS` set (`{".ts", ".tsx"}`) should also be configurable via `governance.code-extensions` in `.kdoc.yaml` (with `[".ts", ".tsx"]` as default). This allows Python projects to set `[".py"]` without forking the script.
5. Keep all git diff logic, area key extraction, TLDR index loading, and coherence check logic verbatim — these are stack-agnostic.
6. The script locates `.kdoc.yaml` relative to the repository root (using `find_kdoc_config(Path.cwd())`). The repository root is the directory containing `.kdoc.yaml`.

**Config keys consumed:**
```yaml
root: Knowledge           # KNOWLEDGE_DIR = ROOT / root
governance:
  enforced-paths:         # FUNCTIONAL_PATTERNS compiled from this list
    - apps/*/src/modules/
    - apps/*/src/core/
    - packages/*/src/
  code-extensions:        # CODE_EXTENSIONS (optional, default: [".ts", ".tsx"])
    - .ts
    - .tsx
```

- [ ] **Step 2: Create `core/scripts/check_wikilinks.py`**

Generalize from `AVShop2/scripts/check_knowledge_wikilinks.py`.

**Changes from original:**
1. Remove hardcoded `ROOT`, `KNOWLEDGE_DIR`, `TLDR_DIR`, `ADR_DIR` — derive from `.kdoc.yaml`
2. Load `root` from config: `KNOWLEDGE_DIR = ROOT / config["root"]`
3. `TLDR_DIR` and `ADR_DIR` paths derive from the `areas` config:
   - `TLDR_DIR = KNOWLEDGE_DIR / config["areas"]["tldr"]["directory"]` (default: `"TLDR"`)
   - `ADR_DIR = KNOWLEDGE_DIR / config["areas"]["adr"]["directory"]` (default: `"ADR"`)
4. The validation logic (normalize_target, suggest_similar, is_example_link, main scan loop) is kept verbatim — it is fully generic.
5. The `is_example_link` function already handles `{{...}}` placeholders via the `"{{" in target` check — no changes needed.

**Config keys consumed:**
```yaml
root: Knowledge
areas:
  tldr: { enabled: true }   # if disabled, skip TLDR_DIR existence check
  adr:  { enabled: true }   # if disabled, skip ADR_DIR existence check
```

- [ ] **Step 3: Create `core/scripts/build_index.py`**

Generalize from `AVShop2/scripts/build_knowledge_index.py`.

**Changes from original:**
1. Remove hardcoded `ROOT`, `KNOWLEDGE_DIR`, `OUTPUT_FILE` — derive from `.kdoc.yaml`
2. `KNOWLEDGE_DIR = ROOT / config["root"]`
3. `OUTPUT_FILE = KNOWLEDGE_DIR / "INDEX.md"` — keep as-is (INDEX.md location is always at root)
4. `VALID_STATUSES` set is universal — no change needed
5. The `collect_rows()` function's `"Templates" in relative_to_knowledge.parts` exclusion: read the templates area path from `knowledge-structure.json` (`areas.templates.path = "Templates"`)
6. All gap detection logic (open questions, test scenarios, acceptance criteria), table rendering, and readiness summary are kept verbatim
7. The generated header comment references `kdoc:build:index` instead of `scripts/build_knowledge_index.py`

**Config keys consumed (only existing spec keys):**
```yaml
root: Knowledge          # from .kdoc.yaml
areas:                   # from .kdoc.yaml — only index enabled areas
  adr: { enabled: true }
  tldr: { enabled: true }
  # ...
```
**Path resolution:** Uses `core/schema/knowledge-structure.json` for area path mappings. Does NOT add `directory` keys to `.kdoc.yaml`.

- [ ] **Step 4: Create `core/scripts/check_adr_governance.py`**

Generalize from `AVShop2/scripts/check_adr_governance.py`.

**Changes from original:**
1. Remove hardcoded `ROOT`, `KNOWLEDGE_DIR`, `ADR_DIR`, `CROSS_REF_FILE`, `README_FILE`
2. Derive paths from `.kdoc.yaml` `root` field + `core/schema/knowledge-structure.json` area definitions:
   - `ADR_DIR = Path(root) / knowledge_structure["areas"]["adr"]["path"]`  (resolves to `Knowledge/ADR`)
   - `CROSS_REF_FILE = ADR_DIR / "ADR-CROSS-REFERENCES.md"` (hardcoded filename — not configurable)
   - `README_FILE = ADR_DIR / "README.md"`
3. The `KNOWN_EXCEPTIONS_G1` set is kept empty (project-specific exceptions are not part of the core script)
4. All check logic (G1–G4), frontmatter parsing, and reporting are kept verbatim

**Config keys consumed (only existing spec keys):**
```yaml
root: Knowledge          # from .kdoc.yaml
areas:
  adr:
    enabled: true        # from .kdoc.yaml — skip all checks if false
```

**Path resolution:** Uses `core/schema/knowledge-structure.json` for area path mappings (e.g., `adr.path = "ADR"`). Does NOT invent new `.kdoc.yaml` config keys like `directory` or `cross-ref-file`.

- [ ] **Step 5: Create `core/scripts/governance_health.py`**

New script — no AVShop2 equivalent. This is the orchestrator that runs all enabled governance checks and produces a unified health report. It replaces the need for multiple individual script invocations during `kdoc doctor`.

**Behavior:**
1. Load `.kdoc.yaml` to determine which checks are enabled
2. For each enabled check, invoke the corresponding script as a subprocess (or import and call directly)
3. Collect exit codes and stderr output
4. Render a consolidated report: `OK / WARN / FAIL` per check
5. Exit non-zero if any check failed (respects `--mode warn|block` like the individual scripts)

**Checks orchestrated:**

| Config key | Script | Description |
|---|---|---|
| `governance.sync-check` | `check_sync.py` | Knowledge sync with code changes |
| `governance.wikilinks` | `check_wikilinks.py` | Wikilink integrity |
| `governance.index-build` | `build_index.py` | Rebuild INDEX.md |
| `governance.adr-governance` | `check_adr_governance.py` | ADR governance invariants |

**CLI interface:**
```
python3 governance_health.py [--mode warn|block] [--json]
```
- `--mode warn` (default): exit 0 even with failures, print summary
- `--mode block`: exit 1 if any check fails
- `--json`: emit machine-readable JSON report (consumed by `kdoc doctor --json`)

**JSON output schema:**
```json
{
  "timestamp": "2026-03-18T10:00:00Z",
  "overall": "pass|warn|fail",
  "checks": [
    {
      "name": "sync-check",
      "status": "pass|warn|fail|skipped",
      "message": "..."
    }
  ]
}
```

---

### Task 5: Template Rendering Tests

**Files:**
- Create: `cli/tests/templates/core-content.test.ts`

These tests verify that every template in `core/templates/` renders correctly when passed representative sample values through the `renderer.ts` from Plan 1. They test the content contract (does the template produce expected output?) not the renderer logic (which is tested in Plan 1's `renderer.test.ts`).

**Note on TDD for this task:** The renderer must exist (from Plan 1) before these tests can be written. If Plan 1 is not yet complete, write the tests first as RED (import will fail, which is the expected failing state) and return to GREEN after Plan 1's renderer is merged.

- [ ] **Step 1: Write failing tests (RED)**

For each template, write one test that:
1. Reads the template file from `core/templates/<name>.md`
2. Calls `render(content, values)` with a complete set of sample values
3. Asserts that all `{{PLACEHOLDER}}` tokens are replaced (no `{{` remains in output)
4. Asserts key structural content is present (e.g., for `adr.md`, that `## Context` is in output)

```typescript
// cli/tests/templates/core-content.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render } from '../../src/templates/renderer.js';

const CORE_TEMPLATES = resolve(__dirname, '../../../core/templates');

function readTemplate(name: string): string {
  return readFileSync(join(CORE_TEMPLATES, name), 'utf-8');
}

const SAMPLE_VALUES = {
  PROJECT_NAME: 'MyProject',
  KNOWLEDGE_ROOT: 'Knowledge',
  OWNER: 'alice',
  ADR_NEXT_SEQUENCE: 'ADR-0002',
  TLDR_SCOPES: 'Frontend, Backend, Shared',
  TLDR_STRUCTURE_COMMENT: '|- Frontend/\n|- Backend/\n\\- Shared/',
};

const TEMPLATES_WITH_PLACEHOLDERS = [
  'adr.md',
  'tldr.md',
  'phase.md',
  'sub-phase.md',
  'test-map.md',
  'runbook.md',
  'threat-model.md',
  'context-pack.md',
  'guide.md',
  'memory.md',
  'readme-adr.md',
  'readme-tldr.md',
  'readme-roadmap.md',
];

describe('core templates — no unresolved placeholders', () => {
  for (const name of TEMPLATES_WITH_PLACEHOLDERS) {
    it(`${name} renders without residual {{...}} tokens`, () => {
      const content = readTemplate(name);
      const rendered = render(content, SAMPLE_VALUES);
      expect(rendered).not.toMatch(/\{\{[A-Z_]+\}\}/);
    });
  }
});

describe('core templates — structural integrity', () => {
  it('adr.md contains required sections', () => {
    const rendered = render(readTemplate('adr.md'), SAMPLE_VALUES);
    expect(rendered).toContain('## Context');
    expect(rendered).toContain('## Decision Drivers');
    expect(rendered).toContain('## Decision');
    expect(rendered).toContain('## Alternatives considered');
    expect(rendered).toContain('## Consequences');
  });

  it('tldr.md contains required sections', () => {
    const rendered = render(readTemplate('tldr.md'), SAMPLE_VALUES);
    expect(rendered).toContain('## Description');
    expect(rendered).toContain('## Requirements');
    expect(rendered).toContain('## Test Scenarios');
    expect(rendered).toContain('## Acceptance Criteria');
    expect(rendered).toContain('## Non-Goals');
    expect(rendered).toContain('## Dependencies');
    expect(rendered).toContain('## Open Questions');
    expect(rendered).toContain('## Related ADRs');
    expect(rendered).toContain('## Readiness Checklist');
  });

  it('phase.md contains dependency graph marker', () => {
    const rendered = render(readTemplate('phase.md'), SAMPLE_VALUES);
    expect(rendered).toContain('dependency-graph');
    expect(rendered).toContain('SUBPHASE_AUTOGEN:START');
  });

  it('readme-roadmap.md contains ROADMAP_AUTOGEN markers', () => {
    const rendered = render(readTemplate('readme-roadmap.md'), SAMPLE_VALUES);
    expect(rendered).toContain('ROADMAP_AUTOGEN:START');
    expect(rendered).toContain('ROADMAP_AUTOGEN:END');
  });

  it('readme-adr.md substitutes OWNER placeholder', () => {
    const rendered = render(readTemplate('readme-adr.md'), SAMPLE_VALUES);
    expect(rendered).toContain('alice');
    expect(rendered).toContain('ADR-0002');
  });

  it('readme-tldr.md substitutes PROJECT_NAME placeholder', () => {
    const rendered = render(readTemplate('readme-tldr.md'), SAMPLE_VALUES);
    expect(rendered).toContain('MyProject');
  });

  it('context-pack.md substitutes PROJECT_NAME and KNOWLEDGE_ROOT', () => {
    const rendered = render(readTemplate('context-pack.md'), SAMPLE_VALUES);
    expect(rendered).toContain('MyProject');
    expect(rendered).toContain('Knowledge');
  });

  it('memory.md substitutes PROJECT_NAME', () => {
    const rendered = render(readTemplate('memory.md'), SAMPLE_VALUES);
    expect(rendered).toContain('MyProject');
  });

  it('threat-model.md contains STRIDE table', () => {
    const rendered = render(readTemplate('threat-model.md'), SAMPLE_VALUES);
    expect(rendered).toContain('## STRIDE Analysis');
    expect(rendered).toContain('## Attack Surface');
    expect(rendered).toContain('## Residual Risks');
  });

  it('test-map.md contains Status Legend', () => {
    const rendered = render(readTemplate('test-map.md'), SAMPLE_VALUES);
    expect(rendered).toContain('## Status Legend');
    expect(rendered).toContain('Pending');
    expect(rendered).toContain('Passing');
  });
});

describe('core templates — frontmatter validity', () => {
  const TEMPLATES_WITH_FRONTMATTER = [
    'adr.md',
    'tldr.md',
    'phase.md',
    'sub-phase.md',
    'runbook.md',
    'threat-model.md',
    'readme-adr.md',
    'readme-tldr.md',
    'readme-roadmap.md',
    'memory.md',
    'guide.md',
  ];

  for (const name of TEMPLATES_WITH_FRONTMATTER) {
    it(`${name} starts with YAML frontmatter delimiter`, () => {
      const content = readTemplate(name);
      expect(content.startsWith('---\n')).toBe(true);
    });
  }
});
```

- [ ] **Step 2: Verify GREEN after Plan 1's renderer is available**

Run: `pnpm test -- core-content`

Expected: all tests pass. If renderer is not yet available, tests will fail at import — this is the expected RED state.

- [ ] **Step 3: Commit**

```bash
git add core/ cli/tests/templates/core-content.test.ts
git commit -m "feat(core): add 13 templates, 5 scripts, 6 governance docs, 2 schemas, and rendering tests"
```

---

## Acceptance Criteria

- [ ] All 13 template files exist in `core/templates/` and contain no unresolved `{{PLACEHOLDER}}` tokens when rendered with the sample values in Task 5
- [ ] All templates with frontmatter start with `---\n`
- [ ] `adr.md` contains all 5 required sections (Context, Decision Drivers, Decision, Alternatives considered, Consequences)
- [ ] `tldr.md` contains all 9 required sections and the gap-tracking comment block
- [ ] `phase.md` contains `SUBPHASE_AUTOGEN` markers and `dependency-graph` comment block
- [ ] `readme-roadmap.md` contains `ROADMAP_AUTOGEN` markers
- [ ] `readme-adr.md` uses `{{OWNER}}` and `{{ADR_NEXT_SEQUENCE}}` placeholders
- [ ] All 5 Python scripts exist in `core/scripts/` and run without error on a project with a valid `.kdoc.yaml`
- [ ] `check_sync.py` reads `root` and `governance.enforced-paths` from `.kdoc.yaml` instead of hardcoded paths
- [ ] `check_wikilinks.py` reads `root` from `.kdoc.yaml` and area paths from `knowledge-structure.json`
- [ ] `build_index.py` reads `root` and `areas` (enabled list) from `.kdoc.yaml`, area paths from `knowledge-structure.json`
- [ ] `check_adr_governance.py` reads `root` and `areas.adr.enabled` from `.kdoc.yaml`, ADR path from `knowledge-structure.json`
- [ ] `governance_health.py` orchestrates all enabled checks and produces a JSON report with `--json` flag
- [ ] All 6 governance docs exist in `core/governance/` and cover their documented topics
- [ ] Both schema files exist in `core/schema/` and are valid JSON
- [ ] `knowledge-structure.json` lists all 11 areas defined in the `.kdoc.yaml` spec
- [ ] `frontmatter-schemas.json` defines required/optional fields for all 8 document types
- [ ] All rendering tests in `cli/tests/templates/core-content.test.ts` pass (GREEN) when Plan 1's renderer is available

---

## Implementation Notes (from cross-plan review)

1. **Python scripts need full implementation, not just descriptions.** The 5 validation scripts (`check_sync.py`, `check_wikilinks.py`, `build_index.py`, `check_adr_governance.py`, `governance_health.py`) are load-bearing governance logic. The implementer MUST read the AVShop2 originals at the source paths listed above, generalize them (replace hardcoded AVShop2 paths with `.kdoc.yaml` config reads), and produce complete, runnable scripts. This is a content-authoring task that requires AVShop2 repository access.

2. **Python scripts should have acceptance tests.** AVShop2 has test suites for its validators (`pnpm knowledge:check:validators:test`). The generalized versions should inherit equivalent tests. Add a pytest or unittest file per script that verifies the script reads `.kdoc.yaml` correctly and produces expected exit codes.

3. **`linear` field removed from all core templates.** The `linear: ''` frontmatter field was project-specific (requires Linear issue tracker). Removed from adr.md, tldr.md, runbook.md, and threat-model.md. Projects that use Linear can add it via pack-level overrides.

4. **README.md for the kdoc repo.** Assigned to Plan 6, Task 8. Not this plan's responsibility.
