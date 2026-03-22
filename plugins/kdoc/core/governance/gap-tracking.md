# Gap-Tracking Tags

Gap-tracking tags are frontmatter `tags` values that flag documentation completeness gaps in TLDR feature files. They enable automated readiness reporting via `INDEX.md`.

## The Four Tags

| Tag | Gap it signals | Detected by |
| --- | -------------- | ----------- |
| `has-open-questions` | Unresolved bullets in `## Open Questions` | `build_index.py` counts active (non-strikethrough) items |
| `missing-test-scenarios` | `## Test Scenarios` table is empty or stub-only | `build_index.py` checks for rows with scenario text |
| `missing-acceptance-criteria` | `## Acceptance Criteria` has no filled items | `build_index.py` checks for `- [ ] <text>` items |
| `blocked-by-decision` | An open question blocks implementation | Manually added; must be removed manually |

## When to Add

- `has-open-questions`: Add when you create an Open Questions bullet that is unresolved. Remove by striking through the question (`~~question text~~`) when resolved.
- `missing-test-scenarios`: Add when the Test Scenarios table has no meaningful scenarios. Remove after filling the table.
- `missing-acceptance-criteria`: Add when the Acceptance Criteria section has no filled items. Remove after adding at least one criterion.
- `blocked-by-decision`: Add when an open question prevents implementation. Remove when the blocking question is resolved.

## Removal Rules

- Strike through resolved open questions: `~~old question~~`. When no active bullets remain, remove `has-open-questions`.
- Do not delete unresolved questions — strike through or move to a deferred section.
- When removing a tag, run `build_index.py` to verify the INDEX.md readiness summary updates.

## Interaction with TLDR Status

A TLDR file is "ready for implementation" when ALL of the following are true:

1. `status: ready` or `status: done`
2. No `has-open-questions` tag
3. No `missing-test-scenarios` tag
4. No `missing-acceptance-criteria` tag

The `INDEX.md` Readiness Summary aggregates these counts across all feature files.

## INDEX.md Readiness Summary

The auto-generated `INDEX.md` includes a section like:

```markdown
## Readiness Summary

- Features with open questions: N/total
- Features with empty test scenarios: N/total
- Features with empty acceptance criteria: N/total
- Features done: N/total
- Features ready for implementation (no gaps): N/total
```

This summary is regenerated each time `build_index.py` runs.
