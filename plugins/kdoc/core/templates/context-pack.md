# ContextPack — Quick Start for Agents

> Goal: provide enough context to work on {{PROJECT_NAME}} without opening many files first.
>
> **Knowledge root:** `{{KNOWLEDGE_ROOT}}/` — all wikilinks resolve relative to this directory.

## Where information lives

<!-- Customize these entries for your project's actual Knowledge structure. -->
<!-- Remove areas that are not installed. Add project-specific entries. -->

- Feature requirements: `TLDR/**`
- Decisions: `ADR/**`
- Roadmap: `Roadmap/`
- Guides: `Guides/`
- Runbooks: `runbooks/`
- Agent memory: `AgentMemory/`

## Recommended agent startup flow

1. Read this file.
2. Read `AgentMemory/MEMORY.md` (if agent-memory area is installed).
3. Read `TLDR/README.md`.
4. Open the relevant TLDR modules and follow dependency links.
5. If implementing a phase module, read the relevant phase file and sub-phase card.
6. If the change is structural, review ADRs before writing.
7. If encountering errors, consult `Guides/TROUBLESHOOTING.md` (if guides area is installed).

## Authoring standards

- One TLDR file = one feature.
- Keep docs implementation-agnostic.
- Use wikilinks for internal cross-references.
- Keep frontmatter up to date.
- Every feature file must include all standard sections.

## Fast update checklist

- [ ] Requirements updated
- [ ] Dependencies and Used by sections reviewed
- [ ] Acceptance criteria updated
- [ ] Open questions resolved or escalated
