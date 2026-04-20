---
name: kdoc:create-threat-model
description: Create a STRIDE threat model by reading the threat-model template and schema, then writing the result under Knowledge/ThreatModels. Use when the user asks for a threat model or says threat model for a module or feature.
metadata:
  filePattern: "Knowledge/ThreatModels/**"
  bashPattern: "kdoc create threat-model|threat model for"
---

# kdoc:create-threat-model

Use this skill to create threat models with file tools only.

## Workflow

1. Read `core/templates/threat-model.md`.
2. Read `core/schema/frontmatter-schemas.json` and use the `threat-model` definition as the validation contract.
3. Determine the module or feature name from context.
4. Write the file to `Knowledge/ThreatModels/{module-name}.md`.
5. Fill the template with the STRIDE sections instead of inventing a new structure.
6. Post-write validation:
   - Read the created file.
   - Verify all required `threat-model` frontmatter fields.
   - Verify the file lives under `Knowledge/ThreatModels/`.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:governance-check`
- `kdoc:create-guide`

## Post-Create

After creating the threat model:

1. Check whether `~/.ai-sessions/spool/` exists and the current environment permits shell commands and writes to that path.
2. If available, append a `kdoc.artifact_created` event to `~/.ai-sessions/spool/events.jsonl` with a shell command.
3. If shell execution or spool writes are unavailable, skip event emission and report that it was skipped.
4. Use the created threat model path in `event_data.path` and `threat-model` in `event_data.type`.

Example:

```bash
echo '{"event_type":"kdoc.artifact_created","event_data":{"type":"threat-model","path":"Knowledge/ThreatModels/auth.md"},"source":"skill:kdoc","created_at":"2026-03-24T12:00:00.000Z"}' >> ~/.ai-sessions/spool/events.jsonl
```
