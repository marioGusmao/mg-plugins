---
name: kdoc:tldr-update-status
description: Update TLDR status and gap tags by editing the TLDR file directly and validating the result against the feature schema. Use when the user asks to mark TLDR as done, update TLDR status, resolve open question, or remove gap tag.
metadata:
  filePattern: "Knowledge/TLDR/**"
  bashPattern: "mark TLDR as done|update TLDR status|resolve open question|remove gap tag"
---

# kdoc:tldr-update-status

Use this skill to update TLDR status directly in files.

## Workflow

1. Identify the target TLDR file.
2. Read `core/schema/frontmatter-schemas.json` and use the `feature` definition as the contract.
3. Read the TLDR file.
4. Edit the `status` field and any gap-tracking tags that changed.
5. If open questions are resolved, update the body content accordingly.
6. Post-write validation:
   - Read the updated file.
   - Verify required `feature` frontmatter fields still exist.
   - Verify the new status is allowed by schema.
   - Verify removed tags correspond to actual resolved content changes.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:tldr-create`
- `kdoc:governance-check`
