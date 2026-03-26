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
- Canonical links use wikilinks with path, for example `[[{{WIKILINK_PREFIX}}TLDR/<Area>/<feature>]]`.
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
<!-- - [[{{WIKILINK_PREFIX}}TLDR/<Area>/<feature>|Feature Name]] -->
