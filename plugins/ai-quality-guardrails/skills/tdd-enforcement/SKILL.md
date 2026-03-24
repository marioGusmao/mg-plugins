---
name: tdd-enforcement
description: This skill should be used when the user asks to follow TDD, write tests first, use test-driven development, apply red-green-refactor, or enforce test-first workflow. It spans the full delivery chain — planners define test scenarios, implementers write failing tests before code, and reviewers verify TDD compliance. Triggers on "write tests first", "use TDD", "red-green-refactor", "test-driven", "test before code".
version: 1.0.0
---

## Prerequisites

- **No runtime dependencies** — this is a pure instruction/skill package (Markdown + YAML frontmatter)
- Works with any AI coding assistant that supports skill/instruction injection
- For maximum effectiveness, pair with a test runner available in the project (jest, vitest, pytest, go test, etc.)


# TDD Enforcement

Enforce test-driven development across the full plan → implement → review chain.

## When to Use

- Implementing features, bug fixes, or refactoring of standard+ complexity
- Planning work that requires test scenarios
- Reviewing implementation for TDD compliance
- NOT for trivial changes (single-line, config, rename, formatting)

## Complexity Tiers

TDD applies differently based on task complexity:

| Tier | Criteria | TDD Requirement |
|---|---|---|
| trivial | Single-line change, typo, rename, formatting | Not required |
| lightweight | <20 lines, 1 file, low risk | Recommended but not mandatory |
| standard | 20-200 lines, 2-4 files, or architectural impact | **Mandatory** — full Red-Green-Refactor |
| complex | >200 lines, >4 files, cross-module, or unclear scope | **Mandatory** — full Red-Green-Refactor with extra edge case analysis |

Default: standard. Downgrade only when ALL lightweight criteria are met.

## The Problem

AI-generated code has significantly higher rates of logic errors compared to human code. Tests written after implementation tend to verify the implementation rather than the intended behavior. TDD inverts this — tests define intent first, then code fulfills it.

See the plugin's `docs/RESEARCH.md` for sourced statistics.

## TDD Workflow (for implementers)

For standard+ complexity:

1. **Read plan test scenarios** (section 7a) before writing any code
2. **RED**: Write a failing test for the first scenario
3. **GREEN**: Write the minimum code to make the test pass
4. **REFACTOR**: Clean up while keeping tests green
5. **Repeat**: Complete one scenario's cycle before starting the next

Do not batch — finish one Red-Green-Refactor cycle before starting the next.

Before moving from RED to GREEN, verify the failing test covers:

- Edge cases and boundary conditions
- Error paths and exception handling
- Null/undefined/empty inputs
- Concurrent or race conditions (if applicable)

Coverage metrics alone do not guarantee test quality.

## TDD Evidence in Output

When returning implementation results, include:

1. **Test files created/modified** — list with paths
2. **Plan test scenarios addressed** — cross-reference to plan section 7a
3. **Scenarios NOT addressed** — with rationale (deferred, out-of-scope, blocked)

## For Reviewers: TDD Compliance Check

When reviewing implementation of standard+ complexity:

1. Verify test files exist for each plan test scenario
2. Check evidence that tests were written before implementation (git history, implementer output)
3. Flag any implementation code without corresponding tests
4. Verify tests validate behavior and intent, not just implementation details
5. Missing TDD evidence for standard+ complexity is a blocking finding — classify as `high` severity

The `reviewer` agent enforces these checks; this section is the cross-platform reference.

## For Planners

Plans must include concrete test scenarios in section 7a. See `plan-with-ac` skill for the required format and structure.

## Brownfield Exception

When adding tests to existing untested code (not new development):

- TDD compliance check is replaced by **coverage delta verification**
- The reviewer confirms added tests meaningfully increase coverage or reduce risk
- Tests do not need to have been written "before" the code (since the code already exists)
- Before modifying any specific line of existing code, write a test that covers that line's current behavior first. You are not required to write tests for all untested existing code — only for the code you are about to change
- A task is brownfield when modifying existing code that has zero test coverage for the affected area

## Related Skills

- `plan-with-ac` — upstream: defines test scenarios in section 7a that become RED phase targets
- `self-review-before-done` — downstream: uses TDD evidence in output contract
- `review-loop` — downstream: quality gate applied after TDD compliance check
- `ai-code-scrutiny` — complementary: checklist for AI-specific code patterns
