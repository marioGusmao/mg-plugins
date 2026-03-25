---
version: "1.0.0"
date: "2026-03-24"
summary: "Defines the canonical roadmap file layout, automation markers, and status semantics."
---

# Roadmap Conventions

The roadmap structure organizes work into phases and sub-phases with machine-readable dependency tracking.

## File Layout

```
Roadmap/
├── README.md              # Entry point — roadmap overview and references
├── generated/
│   └── dashboard.md       # Generated progress dashboard
└── phases/
    ├── phase-1.md         # Phase-level card
    └── phase-1/
        ├── 1.1.md         # Sub-phase card
        └── 1.2.md
```

- Each phase has a phase card in `Roadmap/phases/phase-N.md`.
- Each sub-phase has a card in `Roadmap/phases/phase-N/N.X.md`.
- Use templates `core/templates/phase.md` and `core/templates/sub-phase.md`.

## Phase vs. Sub-phase

| Concept | Scope | Status values |
| ------- | ----- | ------------- |
| Phase | Major milestone (weeks–months) | `pending`, `in-progress`, `completed` |
| Sub-phase | Atomic deliverable (days–week) | `pending`, `in-progress`, `completed` |

## Automation Markers

These comment markers are consumed by `build_index.py` and related roadmap scripts:

| Marker | Location | Purpose |
| ------ | -------- | ------- |
| `<!-- ROADMAP_AUTOGEN:START -->` / `<!-- ROADMAP_AUTOGEN:END -->` | `Roadmap/generated/dashboard.md` | Generated progress dashboard table |
| `<!-- SUBPHASE_AUTOGEN:START -->` / `<!-- SUBPHASE_AUTOGEN:END -->` | Phase cards | Generated sub-phase summary table |
| `<!-- dependency-graph ... -->` | Phase cards | Machine-readable DAG for ordering |

Do not edit content inside `AUTOGEN` blocks manually — it will be overwritten on next build.

## Dependency Graph Format

The `<!-- dependency-graph ... -->` comment uses a simple DSL:

```
<!-- dependency-graph
phase-X -> N.1, N.2    # phase-X must complete before N.1 and N.2 start
N.1 -> N.3              # N.1 must complete before N.3
N.1 || N.2              # N.1 and N.2 can run in parallel
-->
```

## Status Values

Phase and sub-phase `status` frontmatter values:

| Value | Meaning |
| ----- | ------- |
| `pending` | Not started |
| `in-progress` | Actively being worked on |
| `completed` | All verification items checked |
| `completed_with_notes` | Completed with documented deviations (phase-level only) |

## WIP Limit

Maximum 2 active sub-phases per phase at any time. Rationale: limits merge conflicts and ensures focused delivery.

## Evidence Tags

Verification checkboxes in sub-phase cards use evidence tags to enable automated evidence collection:

```markdown
- [ ] Verification item [evidence:roadmap.N.X.item-name]
```

Format: `[evidence:roadmap.<phase>.<sub-phase>.<item-slug>]`. Item slugs are kebab-case, unique within the sub-phase.

## Launch Group Documentation

Each phase card documents launch groups to make parallelism explicit:

```markdown
**Launch groups:**

- Group A (start immediately): N.1, N.2
- Group B (after N.1): N.3
```
