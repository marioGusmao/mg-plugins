---
name: kdoc:create-guide
description: Create an operational guide by reading the guide template and schema, then writing a guide under Knowledge/Guides. Use when the user asks to create a guide, create an operational guide, or write a how-to.
metadata:
  filePattern: "Knowledge/Guides/**"
  bashPattern: "create guide|create operational guide|write how-to"
---

# kdoc:create-guide

Use this skill to create project or pack-specific guides with file tools only.

## Workflow

1. Read `core/templates/guide.md`.
2. Read `core/schema/frontmatter-schemas.json` and use the `runbook` or nearest matching guide/reference contract to verify required frontmatter shape used by this repository.
3. Inspect `.kdoc.yaml` only if you need scope or pack context.
4. Choose the output path:
   - General guide: `Knowledge/Guides/{slug}.md`
   - Pack-specific guide when clearly required by context: `Knowledge/Guides/{pack}/{slug}.md`
5. Write the guide using the template structure rather than an inline ad hoc format.
6. Post-write validation:
   - Read the file back.
   - Verify required frontmatter fields are present.
   - Verify the path matches the intended guide location.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:governance-check`
- `kdoc:create-threat-model`

## Post-Create

After creating the guide:

1. Check whether `~/.ai-sessions/spool/` exists.
2. If it exists, use Bash to append a `kdoc.artifact_created` event to `~/.ai-sessions/spool/events.jsonl`.
3. Use the created guide path in `event_data.path` and `guide` in `event_data.type`.

Example:

```bash
echo '{"event_type":"kdoc.artifact_created","event_data":{"type":"guide","path":"Knowledge/Guides/onboarding.md"},"source":"skill:kdoc","created_at":"2026-03-24T12:00:00.000Z"}' >> ~/.ai-sessions/spool/events.jsonl
```
