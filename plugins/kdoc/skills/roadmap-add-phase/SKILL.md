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
