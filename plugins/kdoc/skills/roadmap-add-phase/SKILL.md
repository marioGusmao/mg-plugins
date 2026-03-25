---
name: kdoc:roadmap-add-phase
description: Add a roadmap phase or sub-phase by reading roadmap templates, scanning existing roadmap files, and updating the parent phase structure. Use when the user asks to add phase to roadmap, create roadmap phase, or add sub-phase.
metadata:
  filePattern: "Knowledge/Roadmap/phases/**"
  bashPattern: "add phase to roadmap|create roadmap phase|add sub-phase"
---

# kdoc:roadmap-add-phase

Use this skill to add roadmap items without CLI helpers.

## Workflow

1. Read `core/templates/phase.md` and `core/templates/sub-phase.md`.
2. Read `core/schema/frontmatter-schemas.json` and use the `phase` and `sub-phase` contracts.
3. Glob `Knowledge/Roadmap/phases/phase-*.md` to determine the next phase number or identify the target parent phase.
4. For sub-phases, read the parent phase file and existing sub-phase files under `Knowledge/Roadmap/phases/phase-{N}/`.
5. Write the new phase or sub-phase file using the appropriate template.
6. Update the parent phase summary if you created a sub-phase.
7. Post-write validation:
   - Read the created file.
   - Verify required frontmatter fields and allowed statuses.
   - Verify naming matches the roadmap conventions used in the repo.
8. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:roadmap-update`
- `kdoc:governance-check`

## Post-Create

After creating the roadmap artifact:

1. Check whether `~/.ai-sessions/spool/` exists.
2. If it exists, use Bash to append a `kdoc.artifact_created` event to `~/.ai-sessions/spool/events.jsonl`.
3. Use the created roadmap file path in `event_data.path` and `roadmap-phase` in `event_data.type`.

Example:

```bash
echo '{"event_type":"kdoc.artifact_created","event_data":{"type":"roadmap-phase","path":"Knowledge/Roadmap/phases/phase-1.md"},"source":"skill:kdoc","created_at":"2026-03-24T12:00:00.000Z"}' >> ~/.ai-sessions/spool/events.jsonl
```
