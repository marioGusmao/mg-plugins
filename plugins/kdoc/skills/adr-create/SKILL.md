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
