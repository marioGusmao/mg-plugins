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
