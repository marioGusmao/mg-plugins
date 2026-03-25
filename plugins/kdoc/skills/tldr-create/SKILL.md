---
name: kdoc:tldr-create
description: Create a TLDR document by reading the TLDR template, reading the schema, determining scope from repository config, and writing a schema-compliant file. Use when the user asks to create TLDR, document module, or write requirements for a feature.
metadata:
  filePattern: "Knowledge/TLDR/**"
  bashPattern: "kdoc create tldr|document module|write requirements for"
---

# kdoc:tldr-create

Use this skill to create TLDR documents with file tools only.

## Workflow

1. Read `.kdoc.yaml` to determine available scopes if the repository uses them.
2. Read `core/templates/tldr.md`.
3. Read `core/schema/frontmatter-schemas.json` and use the `feature` definition as the validation contract.
4. Determine the output path under `Knowledge/TLDR/{scope}/` when scoped, or the repository’s existing TLDR layout when not scoped.
5. Write the TLDR using the shared template rather than an inline custom format.
6. Post-write validation:
   - Read the created file.
   - Verify all required `feature` frontmatter fields.
   - Verify any status or tag values are allowed by schema.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:tldr-update-status`
- `kdoc:governance-check`
- `kdoc:adr-create`

## Post-Create

After creating the TLDR:

1. Check whether `~/.ai-sessions/spool/` exists.
2. If it exists, use Bash to append a `kdoc.artifact_created` event to `~/.ai-sessions/spool/events.jsonl`.
3. Use the created TLDR path in `event_data.path` and `tldr` in `event_data.type`.

Example:

```bash
echo '{"event_type":"kdoc.artifact_created","event_data":{"type":"tldr","path":"Knowledge/TLDR/Admin/example-feature.md"},"source":"skill:kdoc","created_at":"2026-03-24T12:00:00.000Z"}' >> ~/.ai-sessions/spool/events.jsonl
```
