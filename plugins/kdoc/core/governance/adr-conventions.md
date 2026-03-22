# ADR Conventions

Architecture Decision Records (ADRs) capture structural decisions and preserve their context over time.

## When to Create an ADR

Create an ADR when a decision impacts one or more of:

- Architecture or module structure
- Data model or consistency rules
- External integrations
- Global standards and conventions
- Multiple TLDR feature modules

## Naming Convention

Use `ADR-NNNN-<short-title>.md` with four-digit zero-padded numbering. Example: `ADR-0001-knowledge-obsidian-standard.md`.

## Required Sections

Every ADR must include:

1. **Context** — What problem are we solving?
2. **Decision Drivers** — What forces or constraints shaped this decision?
3. **Decision** — What was decided?
4. **Alternatives considered** — What other options were evaluated?
5. **Consequences** — What are the positive outcomes and trade-offs?

## Lifecycle States

| State | Meaning |
| ----- | ------- |
| `proposed` | Under review; not yet implemented |
| `accepted` | Approved and in force |
| `deprecated` | No longer recommended; not yet replaced |
| `superseded` | Replaced by a newer ADR (link via `superseded-by`) |

## Acceptance Gate (`proposed` → `accepted`)

All conditions must be met before changing status:

- All required sections are filled with concrete content
- Impacted modules are linked in `Related modules`
- No unresolved blockers remain in the ADR body
- No active (non-strikethrough) bullets in `## Open Questions` (or `open-questions-status: deferred` in frontmatter)
- Cross-doc consistency verified against impacted TLDR files
- Trade-offs are documented alongside positive outcomes
- Final approval explicitly given by repository owner

## Acceptance Workflow

1. Author ADR in `proposed` state
2. Cross-check against related TLDR/ADR documents
3. Request owner approval
4. After approval: set `status: accepted` and `date` to approval date
5. ADR body is now immutable — only frontmatter schema updates permitted

## Decision Authority

- Only the repository owner may approve `proposed → accepted`
- AI agents may draft, review, and update ADRs but cannot self-approve status changes

## Supersession Integrity

- When `superseded-by` is set, `status` **must** be `superseded`
- The successor ADR **must** have a `supersedes` field pointing to the original
- No partial supersession: if only some decisions are overridden, create a new ADR referencing the original

## Traceability

- `## Related ADRs` in TLDR files is the canonical source for TLDR-to-ADR relationships
- `ADR-CROSS-REFERENCES.md` (if present) maps cross-ADR dependencies
