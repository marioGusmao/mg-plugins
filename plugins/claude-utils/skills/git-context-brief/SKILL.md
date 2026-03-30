---
name: git-context-brief
description: Summarize the current repository state before work begins by collecting branch, recent commits, and uncommitted changes. Use when starting work, resuming after a break, or before making a risky edit.
---

# Git Context Brief

Use this skill when you need a fast operational snapshot of the current repository.

## Workflow

1. Confirm the current working directory is inside a git repository.
2. Capture the active branch or detached ref.
3. Capture the last five commits with one-line summaries.
4. Capture `git status --short` so uncommitted changes stay visible.
5. Present the result as a concise brief before deeper work begins.

## Guardrails

- Do not mutate the repository while gathering context.
- Treat uncommitted changes as user-owned unless proven otherwise.
- If the directory is not a git repository, say so explicitly instead of guessing.
