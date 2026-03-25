---
name: kdoc:design-create-spec
description: Create a page, screen, or flow specification by detecting the active pack, reading the relevant template, and writing a schema-aware design doc. Use when the user asks to create a page spec, create a screen spec, create a design spec, or create a flow spec.
metadata:
  filePattern: "Knowledge/Design/**"
  bashPattern: "create page spec|create screen spec|create design spec|create flow spec"
---

# kdoc:design-create-spec

Use this skill to create design specifications without relying on CLI commands.

## Workflow

1. Read `.kdoc.yaml` to detect installed packs and available scopes.
2. Read `core/schema/frontmatter-schemas.json` for the closest matching frontmatter contract used by the target design document.
3. Read the relevant template:
   - `packs/nextjs/templates/page-spec.md` or `packs/nextjs/templates/flow-spec.md`
   - `packs/swift-ios/templates/screen-spec.md` or `packs/swift-ios/templates/flow-spec.md`
   - Fallback only for flows: `core/templates/flow-spec.md`
4. Choose the output path based on the active pack and scope.
5. Write the design document using the selected template.
6. Post-write validation:
   - Read the file back.
   - Verify required frontmatter fields.
   - Verify the path matches the chosen pack/scope layout.
7. If MCP is available, optionally run `kdoc_validate`. The skill must still work without MCP.

## Related Skills

- `kdoc:tldr-create`
- `kdoc:governance-check`
