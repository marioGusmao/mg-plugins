---
name: kdoc:memory-save
description: Save a piece of operational knowledge to the project's AgentMemory. Use when the user says "remember this", "save to memory", or asks to persist a gotcha, pattern, or operational note.
metadata:
  filePattern: "Knowledge/AgentMemory/**"
  bashPattern: "memory:sync|memory:check"
---

# kdoc:memory-save — Save to Agent Memory

Use this skill when the user asks to persist knowledge to agent memory, save a gotcha, or update operational notes.

## When to Use

- "save to memory" / "remember this" / "add this to agent memory"
- "save this gotcha" / "note this pattern"
- After discovering a non-obvious operational fact that future AI sessions should know

## Workflow

1. Determine the memory category:
   - **Gotcha**: Non-obvious fact that could cause bugs if unknown → `gotchas-<topic>.md`
   - **Pattern**: Reusable approach or convention → `patterns-<topic>.md`
   - **Operational**: Environment, commands, ports, credentials format → `MEMORY.md` (Dev Environment section)
   - **Feedback**: Preference about how AI should behave → `feedback_<topic>.md`

2. Read the existing file for the category (or `MEMORY.md` if new).

3. Add the new entry:
   - For gotchas: numbered list item under the relevant section heading.
   - For patterns: numbered list item with description and example.
   - For MEMORY.md sections: add inline or create a new section.

4. Write the updated file.

5. If `package.json` has `memory:sync` and `memory:check`, run both:
   - `pnpm memory:sync`
   - `pnpm memory:check`
   These sync the canonical `Knowledge/AgentMemory/` to the AI tool's mirror directory.

## Memory File Conventions

- `Knowledge/AgentMemory/MEMORY.md` — top-level index and Dev Environment quick reference
- `Knowledge/AgentMemory/gotchas-<topic>.md` — numbered list of gotchas per topic area
- `Knowledge/AgentMemory/patterns-<topic>.md` — numbered list of reusable patterns
- `Knowledge/AgentMemory/feedback_<name>.md` — single-purpose preference notes

## Safety Rules

- NEVER store secrets, credentials, tokens, or personal data.
- Store stable patterns only — not one-off session notes.
- Keep MEMORY.md concise; delegate detail to topic files.
- Canonical source is `Knowledge/AgentMemory/*`. The external AI mirror is a synchronized copy, not a source of truth.

## Related Skills

- `kdoc:governance-check` — validates AgentMemory structure
- `kdoc:create-guide` — for detailed operational guides (not memory snippets)
