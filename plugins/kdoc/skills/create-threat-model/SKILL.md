---
name: kdoc:create-threat-model
description: Create a STRIDE threat model document for a module or feature. Use when the user asks for a threat model, security analysis, or "threat model for <X>".
metadata:
  filePattern: "Knowledge/runbooks/threat-models/**"
  bashPattern: "kdoc create threat-model"
---

# kdoc:create-threat-model — Create Threat Model

Use this skill when the user asks to threat model a feature, create a security analysis, or document attack vectors.

## When to Use

- "threat model for auth" / "security analysis for checkout" / "create threat model for <X>"
- "document attack vectors for <module>"
- Before implementing security-critical features

## Output Path

`Knowledge/runbooks/threat-models/{module-name}.md`

## Workflow

1. Identify the module or feature to threat model (from context or ask).
2. Ask for the security tier: critical (auth, payments, PII) | high (user data, admin access) | standard.
3. Fill the STRIDE threat model template:

```text
---
area: {scope}
module: {module-name}
tier: critical | high | standard
date: {YYYY-MM-DD}
---

# Threat Model: {Module Title}

## Scope

{What is being analyzed — components, data flows, trust boundaries}

## Assets

{What needs to be protected — data, sessions, secrets}

## Trust Boundaries

{Where trust transitions occur — auth boundaries, API perimeters}

## STRIDE Analysis

### Spoofing

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Tampering

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Repudiation

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Information Disclosure

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Denial of Service

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

### Elevation of Privilege

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|------------|
| | | | |

## Open Risks

{Accepted risks with rationale}

## Related

- [[ADR-XXXX]] (relevant security decisions)
```

4. Write the file.

## Tier-Based Depth

| Tier | STRIDE Rows | Reviewer Required |
|------|-------------|------------------|
| `critical` | 3+ per category | Human security review |
| `high` | 2+ per category | Peer review |
| `standard` | 1+ per category | Self-review |

## Related Skills

- `kdoc:governance-check` — validates threat-models area
- `kdoc:create-guide` — for operational security guides (not attack analysis)
