---
name: kdoc:roadmap-update
description: Update roadmap phase or sub-phase status and keep the generated roadmap dashboard path consistent. Use when the user asks to update roadmap, update phase status, mark phase complete, or generate roadmap dashboard.
metadata:
  filePattern: "Knowledge/Roadmap/**"
  bashPattern: "update roadmap|update phase status|mark phase complete|generate roadmap dashboard"
---

# kdoc:roadmap-update

Use this skill to update roadmap status directly in files.

## Workflow

1. Identify the target phase or sub-phase file under `Knowledge/Roadmap/phases/`.
2. Read `core/schema/frontmatter-schemas.json` and validate against the `phase` or `sub-phase` contract.
3. Read the current roadmap file and any parent phase file that needs updating.
4. Edit the relevant frontmatter fields and supporting body content.
5. Keep the dashboard reference aligned to `Knowledge/Roadmap/generated/dashboard.md`.
6. Post-write validation:
   - Read the updated file.
   - Verify status values are allowed by schema.
   - Verify parent/child references still make sense.
7. If MCP is available, optionally use `kdoc_validate` for the changed roadmap files. The skill must still work without MCP.

## Related Skills

- `kdoc:roadmap-add-phase`
- `kdoc:governance-check`
