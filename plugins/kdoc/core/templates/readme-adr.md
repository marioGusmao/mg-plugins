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
