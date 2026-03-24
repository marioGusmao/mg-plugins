---
name: parallel-review
description: This skill should be used when the user asks for a thorough review, comprehensive review, multi-perspective review, or parallel review of an implementation. It launches 2-3 reviewer agents in parallel — each focused on a different perspective (correctness, architecture, security) — then aggregates and deduplicates findings. Appropriate for standard or higher complexity. Triggers on "thorough review", "review from all angles", "comprehensive code review", "parallel review", "multi-perspective review".
version: 1.0.0
---

## Prerequisites

- **No runtime dependencies** — this is a pure instruction/skill package (Markdown + YAML frontmatter)
- Works with any AI coding assistant that supports skill/instruction injection
- For maximum effectiveness, pair with a test runner available in the project (jest, vitest, pytest, go test, etc.)


# Parallel Review Perspectives

Launch multiple reviewers in parallel for comprehensive coverage.

## The Problem

A single reviewer tends to find one plausible explanation and stop looking. Splitting review into independent perspectives ensures security, performance, and correctness all get thorough attention simultaneously.

## When to Use

Use 2-3 perspectives based on complexity:

| Complexity | Perspectives | Adversarial Pass |
|---|---|---|
| standard (20-200 lines, 2-4 files) | 2 perspectives (combine Architecture with another) | Optional |
| complex (>200 lines, >4 files, cross-module) | 3 perspectives | Recommended |
| security-critical (auth, checkout, permissions) | 3 perspectives | Always |

Also use when the user explicitly requests thoroughness regardless of complexity.

## Perspectives

Launch reviewer instances in parallel, each with a focused perspective:

### Perspective 1: Correctness & Logic
- Bugs and logic errors
- Edge cases and boundary conditions
- Control flow omissions (missing null checks, early returns, exception handling)
- Off-by-one errors, race conditions
- AI-specific: hallucinated APIs, phantom dependencies

### Perspective 2: Architecture & Conventions
- Module boundary violations
- Import rule compliance
- File placement and naming conventions
- Code duplication and abstraction quality
- Documentation and knowledge sync

### Perspective 3: Security & Performance
- OWASP Top 10 patterns (XSS, injection, log injection)
- Authentication and authorization gaps
- N+1 queries and performance anti-patterns
- Caching strategy and data flow efficiency
- Dependency vulnerabilities

## Adversarial Cross-Check (Perspective 4)

After the three perspectives return, launch an adversarial pass for complex or security-critical changes:

**Perspective 4: Devil's Advocate**
- Challenge assumptions made by the other three perspectives
- Look for what was NOT checked — blind spots and gaps
- Question whether findings are real or false positives
- Identify scenarios the other perspectives assumed were safe

This adversarial pattern raised substantive review comments from 16% to 54% in Anthropic's internal deployment.

## Aggregation

After all perspectives return:

1. **Merge** all findings into a single list
2. **Deduplicate** — same file:line + same issue = one finding (keep highest severity)
3. **Sort** by severity (critical → high → medium → low)
4. **Apply Review Quality Gate** from `review-loop` skill (see `skills/review-loop/SKILL.md`): if combined findings exceed thresholds (critical > 0 OR high > 3), hand findings back to the implementer for remediation. After fixes are applied, trigger a second parallel-review pass on the updated change (max 3 total iterations). Never re-review the same unfixed state — remediation must happen between iterations.

## Output Format

```markdown
## Parallel Review Summary

### Perspective Coverage
- Correctness & Logic: X findings
- Architecture & Conventions: Y findings
- Security & Performance: Z findings
- Adversarial (if run): W findings

### Combined Findings (deduplicated)
[Findings sorted by severity]

### Verdict
[Based on Review Quality Gate thresholds from review-loop]
```

## Implementation Notes

**Claude Code / sub-agent platforms:**
- Each perspective runs as a separate agent instance with the same reviewer definition
- The prompt to each instance specifies which perspective to focus on
- Aggregation happens in the main session after all agents return

**Non-sub-agent platforms (Codex, Cursor, Gemini CLI):**
- Simulate parallel perspectives by running three sequential review passes: first pass focused on Correctness, second on Architecture, third on Security
- Merge and deduplicate findings after all three passes
- Note "sequential fallback" in the output

## Related Skills

- `self-review-before-done` — upstream: implementers self-validate before this external review begins
- `review-loop` — quality gate applied after aggregation; defines thresholds and re-review protocol
- `ai-code-scrutiny` — Perspective 1 covers items from this checklist
- `tdd-enforcement` — TDD compliance is checked as part of the review
- `plan-with-ac` — plan reviews may be the review target; findings pass through review-loop after aggregation
