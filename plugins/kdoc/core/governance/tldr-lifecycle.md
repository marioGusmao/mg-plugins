---
version: "1.0.0"
date: "2026-03-24"
summary: "Defines the TLDR status lifecycle, readiness rules, and gap-tracking expectations."
---

# TLDR Lifecycle

TLDR files document functional requirements for individual features. This reference covers status taxonomy, readiness rules, and gap-tracking conventions.

## Status Values

| Status | Meaning |
| ------ | ------- |
| `draft` | Requirements documented but not yet validated for implementation |
| `in_progress` | Module is under active implementation |
| `ready` | Passed full readiness checklist; cleared for implementation |
| `done` | Implementation complete; TLDR is stable |
| `blocked` | Cannot proceed due to unresolved dependency or external blocker |

## Readiness Checklist (`draft` → `ready`)

All items must be true before promoting status:

- [ ] Data model / schema reviewed (or marked N/A)
- [ ] API contract section reviewed (or marked N/A)
- [ ] Dependencies section confirmed (all deps exist and are ready or in-progress)
- [ ] Test scenarios filled (not empty)
- [ ] Acceptance criteria filled (not empty)

## Required Sections

Every TLDR feature file must include:

1. Description
2. Requirements
3. Test Scenarios
4. Acceptance Criteria
5. Non-Goals
6. Dependencies
7. Used by
8. Open Questions
9. Related ADRs
10. Readiness Checklist

## Gap-Tracking Tags

Add to the frontmatter `tags` list when the corresponding gap exists:

| Tag | Meaning | Remove when |
| --- | ------- | ----------- |
| `has-open-questions` | Unresolved bullets in `## Open Questions` | All questions are resolved (strike through) or moved to deferred |
| `missing-test-scenarios` | `## Test Scenarios` table is empty or stub-only | Table has at least one scenario with a description |
| `missing-acceptance-criteria` | `## Acceptance Criteria` has no filled items | At least one `- [ ] <text>` item exists |
| `blocked-by-decision` | An open question blocks implementation | The blocking question is resolved or the `blocked` status is set |

## Dependency Classification

| Type | Meaning | Rule |
| ---- | ------- | ---- |
| Hard | Feature cannot start without this dependency | Must be `ready` or `done` before implementation begins |
| Integration | Feature can start but must coordinate on shared interfaces | Must have agreed contract before integration points are built |
| Architectural | Depends on an ADR or global standard | ADR must be `accepted` before dependent code is written |

## Normative Language

Keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** in TLDR documents follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## Traceability

- `## Related ADRs` in each TLDR file is the canonical source for TLDR-to-ADR relationships
- Cross-references between TLDR files use wikilinks: `[[TLDR/<Area>/<feature>|Feature Name]]`
