---
name: kdoc:adr-create
description: Create a new Architecture Decision Record by reading the ADR template, determining the next ADR number from existing files, and writing a schema-compliant ADR. Use when the user asks to create ADRs, document architecture decisions, or record a technical decision.
metadata:
  filePattern: "Knowledge/ADR/**"
  bashPattern: "kdoc create adr|create ADR|document architecture decision"
---

# kdoc:adr-create

Use this skill to create a new ADR using only `Read`, `Write`, `Glob`, `Edit`, and `Grep`.

## Workflow

1. Read `core/templates/adr.md`.
2. Read `core/schema/frontmatter-schemas.json` and use the `adr` definition as the contract for required fields, allowed statuses, and ID format.
3. Glob `Knowledge/ADR/ADR-*.md` to determine the next four-digit ADR number.
4. Read one or two nearby ADRs only if needed to match local style and cross-reference conventions.
5. Write the new file to `Knowledge/ADR/ADR-{NNNN}-{slug}.md`.
6. Post-write validation:
   - Read the file you created.
   - Verify all required `adr` frontmatter fields from `core/schema/frontmatter-schemas.json`.
   - Verify the frontmatter `id` matches the filename number.
   - Verify the status is allowed by the schema.
7. If MCP is available, optionally run `kdoc_validate` on the new file as an extra check. The skill must still work without MCP.

## Output Rules

- Use the next available zero-padded ADR number.
- Keep the filename slug kebab-case.
- Preserve existing ADR supersession conventions when the user is replacing an older ADR.

## Related Skills

- `kdoc:adr-validate`
- `kdoc:governance-check`

## Post-Create

After creating the ADR:

1. Check whether `~/.ai-sessions/spool/` exists.
2. If it exists, use Bash to append a `kdoc.artifact_created` event to `~/.ai-sessions/spool/events.jsonl`.
3. Use the created ADR path in `event_data.path` and `adr` in `event_data.type`.

Example:

```bash
echo '{"event_type":"kdoc.artifact_created","event_data":{"type":"adr","path":"Knowledge/ADR/ADR-0001-example.md"},"source":"skill:kdoc","created_at":"2026-03-24T12:00:00.000Z"}' >> ~/.ai-sessions/spool/events.jsonl
```
