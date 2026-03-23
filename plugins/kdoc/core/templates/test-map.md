---
title: "{{TITLE}}"
type: test-map
status: draft
date: {{DATE}}
scope: {{SCOPE}}
tags: [testing]
aliases: ["{{TITLE}}"]
intent: ""
summary: ""
---

# Test Map — {{TITLE}}

> Required for all functional PRs. Maps scenarios to test files and tracks implementation status.

## Why

<!-- Why is this test map necessary? What behavior, regression risk, or release gate does it protect? -->

## Test Map

| # | Scenario | Test Level | File | Status |
| - | -------- | ---------- | ---- | ------ |
| 1 |          | Unit       |      | Pending |
| 2 |          | Integration |     | Pending |
| 3 |          | E2E        |      | Pending |

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

## Related

- <!-- [[TLDR/relevant-feature]] -->
- <!-- [[runbooks/relevant-runbook]] -->
