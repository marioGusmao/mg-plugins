---
name: kdoc:create-guide
description: Create an operational guide (onboarding, troubleshooting, how-to) in the Knowledge/Guides directory. Use when the user asks to create a guide, onboarding doc, or how-to.
metadata:
  filePattern: "Knowledge/Guides/**/*.md"
  bashPattern: "kdoc create guide"
---

## Prerequisites

- **Node.js** >= 20
- **kdoc CLI**: `npx kdoc --version` must succeed. Install via `pnpm install` in the `cli/` directory if needed.
- **Knowledge directory**: A `Knowledge/` directory should exist at the project root. Run `npx kdoc init` if missing.

# kdoc:create-guide — Create Operational Guide

Use this skill when the user asks to create an operational guide, onboarding document, or how-to reference.

## When to Use

- "create onboarding guide" / "write a troubleshooting guide" / "create how-to for <X>"
- "document how to set up the dev environment"
- "write a guide for <process>"

## Output Path

Guides may be pack-specific or project-wide:
- Pack-specific: `Knowledge/Guides/{pack}/{guide-name}.md` (e.g., `Knowledge/Guides/nextjs/onboarding.md`)
- General: `Knowledge/Guides/{guide-name}.md`

Ask the user or infer from context whether the guide is pack-specific.

## Evidence-First: Repo Scan

Before generating any template, scan the repository for evidence that informs the content:

1. **Recent changes**: `git log --oneline -20` and `git diff --stat HEAD~5 HEAD` to understand what was recently modified
2. **Existing patterns**: Read 1-2 existing documents of the same type (ADR/TLDR/guide) to match style, depth, and structure
3. **Module context**: Check package.json, README.md, and directory structure for module descriptions and boundaries
4. **Cross-references**: Search for related ADRs, TLDRs, or guides that should be linked

Use this evidence to pre-populate template fields rather than starting from blank placeholders.

## Workflow

1. Determine guide type: onboarding, troubleshooting, how-to, recipe, reference.
2. Determine if pack-specific (check context / ask).
3. Fill the guide template:

```text
---
title: "{Guide Title}"
category: onboarding | troubleshooting | how-to | recipe | reference
---

# {Guide Title}

## Overview

{One paragraph describing what this guide covers and who it is for}

## Prerequisites

{What the reader needs before starting}

## Steps

### 1. {First Step}

{Instructions}

### 2. {Second Step}

{Instructions}

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| | | |

## Related

- [[link to related guide or ADR]]
```

4. Write the file to the determined path.

## Related Skills

- `kdoc:create-threat-model` — for security-focused documentation
- `kdoc:tldr-create` — for functional requirements (not operational guides)

## Autonomy Mode

When invoked by an automated agent (workshop orchestrator, CI pipeline, or batch process) rather than interactive user input:

1. **Deterministic inference**: Infer all required parameters from available context (git history, file structure, existing Knowledge/ content) instead of prompting the user. If a parameter cannot be inferred with reasonable confidence, use sensible defaults and note the assumption.

2. **Repo-scan first**: Before generating any content, scan the repository for relevant context:
   - `git log --oneline -20` for recent changes
   - Existing Knowledge/ structure and naming patterns
   - Package.json / project configuration for module names
   - Existing ADRs/TLDRs for numbering and style consistency

3. **Structured output**: Always produce valid frontmatter with all required fields populated. Emit the file path as the first line of output so callers can locate the artifact.
