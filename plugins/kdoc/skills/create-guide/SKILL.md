---
name: kdoc:create-guide
description: Create an operational guide (onboarding, troubleshooting, how-to) in the Knowledge/Guides directory. Use when the user asks to create a guide, onboarding doc, or how-to.
metadata:
  filePattern: "Knowledge/Guides/**/*.md"
  bashPattern: "kdoc create guide"
---

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
