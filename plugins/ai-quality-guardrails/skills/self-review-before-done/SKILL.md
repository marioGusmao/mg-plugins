---
name: self-review-before-done
description: This skill should be used when an agent is about to return implementation results, claim a task is done, or hand off completed work. It enforces self-validation — comparing output against plan acceptance criteria, running validation commands, and iterating internally until quality standards pass. Triggers on "validate before finishing", "check your work before reporting back", "run tests before completing", or when an implementer agent reaches the end of a plan phase.
version: 1.0.0
---

# Self-Review Before Done

Validate output before claiming completion.

## The Problem

AI agents tend to declare work "done" after writing code without verifying it actually works or meets requirements. This shifts the burden to reviewers and users, who then find obvious issues that should have been caught earlier.

## The Rule

Before returning results to the main session or user:

1. **Run all validation commands** — lint, typecheck, tests
2. **Compare output against plan acceptance criteria** — check each AC
3. **If any AC is not met or validation fails** — fix and re-validate (max 3 attempts)
4. **Only return when all ACs are addressed and validations pass**

## Discovering Validation Commands

Before running validation, inspect the project to identify the correct commands:

- **Node/JS**: Check `package.json` scripts for lint, typecheck, test commands
- **Python**: Check `pyproject.toml`, `Makefile`, or `tox.ini` for lint, type-check, test
- **Other**: Check project README or Makefile for validation commands

## Self-Review Checklist

```
Before returning:
  ├─ Validation commands pass?
  │   ├─ YES → continue
  │   └─ NO → fix, re-run, repeat (max 3 attempts)
  │
  ├─ All plan ACs addressed?
  │   ├─ YES → continue
  │   └─ PARTIALLY → list unaddressed with rationale
  │
  ├─ Tests pass?
  │   ├─ YES → continue
  │   └─ NO → fix tests or implementation
  │
  └─ Output contract complete?
      ├─ YES → return to main session
      └─ NO → fill missing fields
```

## Output Contract

When returning implementation results, always include:

1. **Touched files** — list of files created/modified
2. **Validation results** — pass/fail for each command run
3. **Plan reference** — path to the plan this implements
4. **Acceptance Criteria check** — each AC with status (met/not met/deferred) and evidence
5. **TDD evidence** (if applicable) — test files, scenarios covered, scenarios deferred

## What NOT To Do

- Never claim "done" without running validation commands
- Never skip AC comparison ("I think I covered everything")
- Never return with failing tests and say "tests need updating"
- Never silently drop scope — explicitly list anything deferred with rationale
- Never report validation results you didn't actually run

## When No Validation Commands Exist

If the project has no configured lint, typecheck, or test commands:

1. Perform a manual static review pass using the `ai-code-scrutiny` checklist
2. Verify the code compiles/runs without errors
3. Check that acceptance criteria can be demonstrated manually
4. Document what was verified and how

## Switch Perspective Technique

Before returning, re-read the output as if acting as the **reviewer**, not the implementer:

- Would a reviewer find obvious issues?
- Are there untested edge cases visible from a fresh reading?
- Does the code actually do what the AC says, or does it just look like it does?

This "mental model switch" catches issues that same-perspective self-review misses.

## Iteration Limit

If after 3 internal fix attempts validation still fails:

1. Stop trying to fix
2. Report what passes and what fails
3. List the specific failures with error output
4. Let the main session or user decide next steps

## Related Skills

- `plan-with-ac` — upstream: defines the ACs this skill validates against (section 11)
- `ai-code-scrutiny` — fallback checklist when no validation commands exist
- `tdd-enforcement` — TDD evidence is part of the output contract (item 5)
- `parallel-review` — downstream: external multi-perspective review after self-review completes
- `review-loop` — downstream: external review applied after self-review. The self-review limit (3 attempts) is separate from review-loop's external limit (3 iterations) — tune both if adjusting retry behavior.
