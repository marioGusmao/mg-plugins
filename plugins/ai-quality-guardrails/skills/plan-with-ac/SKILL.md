---
name: plan-with-ac
description: This skill should be used when the user asks to create an implementation plan, plan a feature, break work into milestones, define acceptance criteria, or scope a multi-step task. Ensures plans include numbered acceptance criteria, concrete test scenarios, and verifiable milestones following spec-driven development principles. Triggers on "create a plan", "plan this feature", "define AC", "break this into steps", "scope this work", "implementation plan for".
version: 1.0.0
---

# Plan with Acceptance Criteria

Create implementation plans that are verifiable contracts, not vague outlines.

## When to Use

- Creating an implementation plan for any feature or change
- Planning work that will be delegated to an implementation agent
- Defining scope for a multi-step task

## Plan Packet Structure

Every plan must include these sections:

1. **Problem and goals** — what and why
2. **Scope** — in/out boundaries
3. **Current state evidence** — what exists today (code, docs, constraints)
4. **Option analysis** — minimum two approaches with tradeoffs
5. **Recommended approach** — chosen option with rationale
6. **Public interface/type impacts** — API or contract changes
7. **Test strategy**
   a. Test scenarios — concrete scenarios with expected behavior and test level (unit/component/integration/E2E). These become the RED phase targets for implementation.
   b. Validation commands for each major step.
   c. Edge cases and failure modes to cover.
8. **Rollout, migration, rollback** — deployment and recovery
9. **Risks and mitigations** — what could go wrong
10. **Assumptions and chosen defaults** — explicit unknowns
11. **Acceptance Criteria** — numbered, testable items that define "done". Each AC must be verifiable by a command, test, or observable behavior.
12. **Implementation milestones** — numbered steps that break the approach into trackable units. Each milestone independently verifiable and small enough for a single session.

## Common Mistakes to Avoid

- Vague AC like "system works correctly" — each AC must be independently testable
- Milestones too large for a single session — split further
- Missing verification commands — every milestone needs a way to prove it's done
- Placeholder content left as TBD — fill everything or flag as a blocking unknown

## Acceptance Criteria Format

```markdown
## Acceptance Criteria

- [ ] AC1: [Specific, testable condition] [verification: command/test/observable]
- [ ] AC2: [Specific, testable condition] [verification: command/test/observable]
- [ ] AC3: [Specific, testable condition] [verification: command/test/observable]
```

Each AC must be:
- **Specific** — no ambiguity about what "done" means
- **Testable** — can be verified by running a command, checking a test, or observing behavior
- **Independent** — failure of one AC does not block verification of others

## Milestone Format

```markdown
## Implementation Milestones

1. [Milestone name] — [what it delivers] — [how to verify]
2. [Milestone name] — [what it delivers] — [how to verify]
3. [Milestone name] — [what it delivers] — [how to verify]
```

Each milestone must be:
- Independently verifiable
- Small enough for a single implementation session
- Ordered by dependency (earlier milestones unblock later ones)

## Human-in-the-Loop

After creating the plan:

1. Present the plan summary to the user
2. Wait for user feedback or approval
3. Do not proceed to review or implementation without user confirmation

## Quality Gates

Before considering a plan complete:

- All sections are filled (no TBD or placeholder content)
- Test scenarios cover happy path + at least 2 edge cases per feature
- Acceptance criteria are numbered and testable
- Milestones have verification steps
- No unresolved high-impact ambiguity remains

## Related Skills

- `tdd-enforcement` — consumes section 7a test scenarios as RED phase targets
- `self-review-before-done` — consumes section 11 ACs for self-validation
- `review-loop` — applied by reviewer after implementation
- `parallel-review` — used for standard+ complexity reviews

## References

This skill's structure is based on:
- **Spec-Driven Development** (Thoughtworks 2025) — specs as first-class executable artifacts
- **Addy Osmani's 6 areas** (O'Reilly) — commands, testing, structure, style, git, boundaries
- **Amazon Kiro** — 3-phase spec workflow: requirements → design → tasks
- **GitHub spec-kit** — requirements + plan + tasks with configurable constitution

See the plugin's `docs/RESEARCH.md` for full source list.
