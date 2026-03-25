---
name: kdoc:memory-save
description: Save durable operational knowledge into AgentMemory files and validate the saved content against the repository conventions. Use when the user says save to memory, remember this, or agent memory.
metadata:
  filePattern: "Knowledge/AgentMemory/**"
  bashPattern: "save to memory|remember this|agent memory"
---

# kdoc:memory-save

Use this skill to persist operational knowledge with file tools only.

## Workflow

1. Read `core/templates/memory.md` to understand the canonical shared-memory structure.
2. Read `core/schema/frontmatter-schemas.json` if the target memory file uses frontmatter.
3. Choose the destination:
   - `Knowledge/AgentMemory/MEMORY.md` for shared top-level memory
   - topic files under `Knowledge/AgentMemory/` for more specific notes
4. Read the existing target file before editing.
5. Add the new durable note without storing secrets or one-off chat state.
6. Post-write validation:
   - Read the updated file.
   - Verify formatting remains coherent.
   - If frontmatter exists, verify required fields.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:governance-check`
- `kdoc:create-guide`
