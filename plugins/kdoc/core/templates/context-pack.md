---
title: "ContextPack — {{PROJECT_NAME}}"
type: context-pack
status: generated
date: {{DATE}}
scope: {{SCOPE}}
tags: [ai-context, generated]
aliases: ["ContextPack"]
intent: "Provide a compact, high-signal entry point for AI agents working in this Knowledge base."
summary: "AI context pack for {{PROJECT_NAME}}."
---

# ContextPack — {{PROJECT_NAME}}

> Goal: provide enough context to work on {{PROJECT_NAME}} without opening many files first.
>
> **Knowledge root:** `{{KNOWLEDGE_ROOT}}/` — all wikilinks resolve relative to this directory.

## Why

> Use this file to start fast. It should answer where the important knowledge lives, what is active now, and which documents to read next.

<!-- kdoc:generated:start -->
## Knowledge Map

| Area | Files | Key Documents |
| ---- | ----- | ------------- |
| TLDR | `TLDR/**` | <!-- [[TLDR/README]] --> |
| ADR | `ADR/**` | <!-- [[ADR/README]] --> |
| Roadmap | `Roadmap/**` | <!-- [[Roadmap/README]] --> |
| Guides | `Guides/**` | <!-- [[Guides/README]] --> |
| Runbooks | `runbooks/**` | <!-- [[runbooks/README]] --> |
| Agent Memory | `AgentMemory/**` | <!-- [[AgentMemory/MEMORY]] --> |

## Recent Decisions

| ADR | Status | Why It Matters |
| --- | ------ | -------------- |
| <!-- [[ADR/ADR-NNNN-name]] --> | proposed | |

## Active Features

| TLDR | Status | Scope |
| ---- | ------ | ----- |
| <!-- [[TLDR/feature-name]] --> | in_progress | root |

## Roadmap Status

| Current Phase | Next Unblocked | Blocking Decision |
| ------------- | -------------- | ----------------- |
| <!-- [[Roadmap/phases/phase-N]] --> | <!-- [[Roadmap/phases/phase-N/N.X]] --> | <!-- [[ADR/ADR-NNNN]] --> |
<!-- kdoc:generated:end -->

## Recommended Agent Startup Flow

1. Read this file.
2. Read `AgentMemory/MEMORY.md` (if agent-memory area is installed).
3. Read `TLDR/README.md`.
4. Open the relevant TLDR modules and follow dependency links.
5. If implementing a phase module, read the relevant phase file and sub-phase card.
6. If the change is structural, review ADRs before writing.
7. If encountering errors, consult `Guides/TROUBLESHOOTING.md` (if guides area is installed).

## Authoring Standards

- One TLDR file = one feature.
- Keep docs implementation-agnostic.
- Use wikilinks for internal cross-references.
- Keep frontmatter up to date.
- Every feature file must include all standard sections.

## Fast Update Checklist

- [ ] Requirements updated
- [ ] Dependencies and Used by sections reviewed
- [ ] Acceptance criteria updated
- [ ] Open questions resolved or escalated
