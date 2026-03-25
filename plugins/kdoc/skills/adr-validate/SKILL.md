---
name: kdoc:adr-validate
description: Validate ADR numbering, frontmatter, supersession chains, and wikilink references by scanning ADR files directly. Use when the user asks to validate ADRs, check ADR governance, or audit the ADR directory.
metadata:
  filePattern: "Knowledge/ADR/**"
  bashPattern: "kdoc doctor|check ADR governance|validate ADRs"
---

# kdoc:adr-validate

Use this skill to validate ADRs with direct file inspection only.

## Workflow

1. Read `core/schema/frontmatter-schemas.json` and use the `adr` contract for required fields, statuses, and ID rules.
2. Glob `Knowledge/ADR/ADR-*.md`.
3. For each ADR:
   - Read the frontmatter.
   - Verify required fields exist.
   - Verify the `id` matches the filename.
   - Verify `status` is allowed by the schema.
4. Validate directory-level integrity:
   - Detect duplicate ADR numbers.
   - Note numbering gaps as informational only.
   - Verify `supersedes` or `superseded_by` references point to existing ADRs when present.
   - Grep ADR wikilinks and flag broken ADR references.
5. Report findings as PASS/WARN/FAIL.
6. If MCP is available, optionally use `kdoc_health` or `kdoc_validate` to confirm the manual findings. The skill must still work without MCP.

## Related Skills

- `kdoc:adr-create`
- `kdoc:governance-check`
