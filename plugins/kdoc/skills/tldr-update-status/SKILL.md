---
name: kdoc:tldr-update-status
description: Update a TLDR's status frontmatter and remove resolved gap tracking tags. Use when the user says "mark TLDR as done", "update status", or "resolve open question".
metadata:
  filePattern: "Knowledge/TLDR/**/*.md"
  bashPattern: ""
---

# kdoc:tldr-update-status — Update TLDR Status

Use this skill when the user asks to update a TLDR's status, mark it complete, or resolve gap tracking tags.

## When to Use

- "mark TLDR as done" / "update TLDR status" / "TLDR is ready"
- "resolve open question in <TLDR>" / "fill in acceptance criteria"
- "remove gap tag from <TLDR>"

## Workflow

1. Identify the target TLDR file (from context or ask the user for path/module name).

2. Read the current frontmatter and body.

3. Update the `status` field:

   | New Status | When to Use |
   |------------|-------------|
   | `draft` | Initial state, requirements incomplete |
   | `ready` | Requirements complete, implementation not started |
   | `in-progress` | Implementation underway |
   | `done` | Implementation complete and verified |
   | `deprecated` | Module removed or replaced |

4. Remove gap tracking tags from frontmatter when resolved:

   | Tag | Remove When |
   |-----|-------------|
   | `has-open-questions` | All open questions are struck through or removed |
   | `missing-test-scenarios` | Test Scenarios table has at least one row |
   | `missing-acceptance-criteria` | Acceptance Criteria section has content |
   | `blocked-by-decision` | The blocking ADR is accepted/resolved |

5. If resolving an open question: strike it through in the body with `~~question text~~`. If no active questions remain, remove the `has-open-questions` tag.

6. Write the updated file.

## Gap Tag Rules

- Tags live in frontmatter as a YAML list under `gaps:` or as inline tags (project convention may vary).
- When a tag is removed, do NOT remove the section itself — only remove the tag from frontmatter.
- A TLDR with all gaps resolved and `status: done` is considered complete.

## Related Skills

- `kdoc:tldr-create` — create a new TLDR
- `kdoc:governance-check` — validates gap tag consistency across all TLDRs
