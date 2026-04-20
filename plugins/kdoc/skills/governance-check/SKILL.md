---
name: kdoc:governance-check
description: Check Knowledge health by scanning documentation files, validating frontmatter contracts, and reporting structural or reference issues. Use when the user asks to check knowledge, run governance check, or run kdoc doctor.
metadata:
  filePattern: "Knowledge/**/*.md"
  bashPattern: "kdoc doctor|check knowledge|run governance check"
---

# kdoc:governance-check

Use this skill to audit Knowledge content with the current agent's file read, glob, and search capabilities.

## Workflow

1. Read `.kdoc.yaml` if present to determine active Knowledge areas and scope layout.
2. Read `core/schema/frontmatter-schemas.json` and `core/schema/knowledge-structure.json`.
3. Glob enabled Knowledge files and directories.
4. Validate:
   - required directories and seed files
   - required frontmatter fields by document type
   - invalid status values
   - broken or suspicious wikilinks
   - obvious missing index or roadmap artifacts
5. Report PASS/WARN/FAIL findings with exact file paths.
6. If MCP is available, optionally call `kdoc_health` to confirm or enrich the manual audit. The skill must still work without MCP.

## Related Skills

- `kdoc:adr-validate`
- `kdoc:scaffold`
- `kdoc:tldr-update-status`
