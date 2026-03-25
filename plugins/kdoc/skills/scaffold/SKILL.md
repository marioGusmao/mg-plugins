---
name: kdoc:scaffold
description: Scaffold or extend a Knowledge installation by reading the repository config, schema, templates, and existing files, then writing the required structure directly. Use when the user asks to scaffold knowledge, run kdoc init, kdoc add, kdoc add-pack, or kdoc add-tool.
metadata:
  filePattern: ".kdoc.yaml"
  bashPattern: "kdoc init|kdoc add|kdoc add-pack|kdoc add-tool|scaffold knowledge"
---

# kdoc:scaffold

Use this skill to scaffold Knowledge structures with direct file operations only.

## Workflow

1. Read `.kdoc.yaml` if it already exists.
2. Read `core/schema/knowledge-structure.json` and `core/schema/frontmatter-schemas.json`.
3. Read the relevant templates under `core/templates/` and pack templates under `packs/*/templates/` as needed.
4. Decide whether the request is:
   - initial scaffold
   - add area
   - add pack
   - add tool integration
5. Write or update the required files directly, preserving existing user content outside managed sections.
6. Post-write validation:
   - Read the changed files.
   - Verify required seed files and directories now exist.
   - Verify created documents include required frontmatter fields where applicable.
7. If MCP is available, optionally run `kdoc_health` or `kdoc_validate` as a final check. The skill must still work without MCP.

## Safety Rules

- Prefer diff-sized edits over large rewrites.
- Do not overwrite user-authored content without explicit instruction.
- Keep `.kdoc.lock` and `.kdoc.yaml` consistent when both are present.

## Related Skills

- `kdoc:governance-check`
- `kdoc:adr-create`
- `kdoc:tldr-create`
