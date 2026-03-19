---
name: review-loop
description: This skill should be used after any review (plan review, implementation review, code review) to apply quality threshold gating. It triggers when findings exceed pass thresholds, when the user says "apply review gate", "re-review after fixes", "check review thresholds", "iterate on review findings", or when a review produces critical or high-severity findings. Enforces mandatory re-review with iteration tracking and escalation.
version: 1.0.0
---

# Review Loop with Quality Threshold

Apply iterative review gating to catch issues that single-pass reviews miss.

## The Problem

Single-pass reviews consistently miss issues — multiple review passes with quality thresholds catch what single passes miss. The threshold of 3+ high findings indicates systemic issues rather than isolated oversights.

See the plugin's `docs/RESEARCH.md` for sourced statistics.

## Severity Definitions

All gating depends on consistent severity classification:

| Severity | Criteria | Examples |
|---|---|---|
| **critical** | Security breach, data loss, corruption, production outage risk | SQL injection, auth bypass, data deletion without confirmation |
| **high** | Functional breakage, clear regression, or blocking defect | Wrong return value, missing error handling on critical path, broken API contract |
| **medium** | Reliability, performance, or maintainability risk likely to cause future defects | N+1 query, missing index, unclear error message, brittle test |
| **low** | Minor quality or documentation inconsistency with limited impact | Naming convention violation, missing comment, unused import |

## Pre-Gate Check: TDD Compliance (implementation and code reviews only)

For **implementation reviews** and **code reviews** of standard+ complexity, check TDD compliance before applying thresholds. Missing TDD evidence is a mandatory block regardless of finding count — classify as `high` severity.

This check does **not** apply to **plan reviews** — at plan stage there is no code or tests yet, only test scenario definitions.

## Review Quality Gate

After any review (plan, implementation, or code review):

1. **Count findings by severity**
2. **Apply threshold**:

| Condition | Action |
|---|---|
| critical > 0 OR high > 3 | **MANDATORY** re-review after fixes (max 3 iterations) |
| high 1-3 | **RECOMMENDED** re-review — present to user and wait for explicit decision. Default: re-review unless user explicitly waives. |
| only medium/low | Single pass sufficient |

3. **Track iteration** in review artifact: `remediation_iteration: N`
4. **After 3 iterations** without resolution → escalate to user for scope decision

## Review Type Actions

What "fix and re-review" means depends on the review type:

| Review Type | Fix Action | Re-Review Scope |
|---|---|---|
| Plan review | Revise plan sections with findings | Re-review revised sections + check for new gaps |
| Implementation review | Fix code, add tests, update docs | Verify fixes for previous findings + scan for regressions introduced by fixes |
| Code review | Fix code issues | Verify fixes + scan for regressions |

Re-reviews are NOT full re-scans — they verify fixes and check for regressions introduced by those fixes.

## Verdict Definitions

| Verdict | When to Use |
|---|---|
| `approved` | Zero critical, zero high findings |
| `approved_with_conditions` | Zero critical, 1-3 high findings with documented mitigation or user waiver |
| `blocked` | Any critical finding, OR high > 3, OR mandatory conditions unmet |

## How It Works

```
Review produces findings
  ├─ critical > 0 OR high > 3
  │   └─ Fix findings → Re-review (iteration N+1) → Apply gate again
  ├─ high 1-3
  │   └─ Recommend re-review → Present to user → User decides (default: re-review)
  └─ medium/low only
      └─ Single pass sufficient → Proceed
```

## Review Artifact Format

Produce the following artifact for each review iteration:

```markdown
## Review Report (Iteration N)

### Findings
- [severity] Finding description — file:line — suggested fix

### Summary
- Total: X findings (critical: N, high: N, medium: N, low: N)
- Previous iteration: Y findings
- Delta: -Z findings resolved, +W new findings

### Verdict
- [approved | approved_with_conditions | blocked]
- remediation_iteration: N
```

## Escalation Protocol

When reaching 3 iterations without resolution:

1. Present remaining findings to user with severity
2. Offer options:
   a. Continue fixing (extend iteration limit)
   b. Accept remaining risk with documented rationale
   c. Reduce scope to eliminate problematic area
3. Document decision in review artifact

## Related Skills

- `parallel-review` — calls this skill's quality gate after aggregating parallel findings
- `tdd-enforcement` — TDD compliance is a pre-gate check
- `ai-code-scrutiny` — provides the checklist that generates findings
- `plan-with-ac` — upstream: plan reviews are one of the three supported review types; fix action is to revise plan sections
- `self-review-before-done` — shares the iteration-limit pattern (3 internal attempts). The self-review limit is separate from this external review-loop limit — tune both if adjusting retry behavior.
