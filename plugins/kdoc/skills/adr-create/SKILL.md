---
name: kdoc:adr-create
description: Create a new Architecture Decision Record (ADR) with sequential numbering. Use when the user says "create ADR", "document this decision", or "new architecture decision".
metadata:
  filePattern: "Knowledge/ADR/ADR-*.md"
  bashPattern: "kdoc create adr"
---

## Prerequisites

- **Node.js** >= 20
- **kdoc CLI**: `npx kdoc --version` must succeed. Install via `pnpm install` in the `cli/` directory if needed.
- **Knowledge directory**: A `Knowledge/` directory should exist at the project root. Run `npx kdoc init` if missing.

# kdoc:adr-create — Create Architecture Decision Record

Use this skill when the user asks to create a new ADR or document an architectural decision.

## When to Use

- "create ADR" / "new decision" / "document this architecture decision"
- "record the decision about <X>"
- After making a significant technical or architectural choice

## Evidence-First: Repo Scan

Before generating any template, scan the repository for evidence that informs the content:

1. **Recent changes**: `git log --oneline -20` and `git diff --stat HEAD~5 HEAD` to understand what was recently modified
2. **Existing patterns**: Read 1-2 existing documents of the same type (ADR/TLDR/guide) to match style, depth, and structure
3. **Module context**: Check package.json, README.md, and directory structure for module descriptions and boundaries
4. **Cross-references**: Search for related ADRs, TLDRs, or guides that should be linked

Use this evidence to pre-populate template fields rather than starting from blank placeholders.

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

## Autonomy Mode

When invoked by an automated agent (workshop orchestrator, CI pipeline, or batch process) rather than interactive user input:

1. **Deterministic inference**: Infer all required parameters from available context (git history, file structure, existing Knowledge/ content) instead of prompting the user. If a parameter cannot be inferred with reasonable confidence, use sensible defaults and note the assumption.

2. **Repo-scan first**: Before generating any content, scan the repository for relevant context:
   - `git log --oneline -20` for recent changes
   - Existing Knowledge/ structure and naming patterns
   - Package.json / project configuration for module names
   - Existing ADRs/TLDRs for numbering and style consistency

3. **Structured output**: Always produce valid frontmatter with all required fields populated. Emit the file path as the first line of output so callers can locate the artifact.
