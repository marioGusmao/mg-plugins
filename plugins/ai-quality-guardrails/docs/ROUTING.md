# Skill Routing Table

Which skill activates under which condition. Use this table to understand the plugin's activation landscape and avoid trigger collisions.

## Skill Activation Matrix

| Skill | Triggers When | Activates For | Does NOT Activate For |
|---|---|---|---|
| `plan-with-ac` | "create a plan", "plan this feature", "define AC", "break this into steps", "scope this work" | Planning any feature, change, or multi-step task | Trivial tasks, questions, exploration |
| `tdd-enforcement` | "write tests first", "use TDD", "red-green-refactor", "test-driven", "test before code" | Implementing or reviewing standard+ complexity work | Trivial changes, documentation, config edits |
| `review-loop` | "apply review gate", "re-review after fixes", "check thresholds", after any review produces findings | Post-review gating on any review type | During implementation, during planning |
| `parallel-review` | "thorough review", "review from all angles", "comprehensive review", "parallel review" | Standard+ complexity implementation reviews | Lightweight or trivial reviews |
| `ai-code-scrutiny` | "scrutinize AI code", "check for hallucinated APIs", "OWASP review", "audit generated code" | Reviewing any AI-generated code | Non-code reviews, documentation reviews |
| `self-review-before-done` | "validate before finishing", "check your work", "run tests before completing" | Before an implementer returns results | During exploration, during planning |

## Agent → Skill Mapping

| Agent | Uses These Skills | When |
|---|---|---|
| `explorer` | None | Always operates independently |
| `implementer` | `tdd-enforcement`, `self-review-before-done` | During implementation of standard+ complexity |
| `reviewer` | `ai-code-scrutiny`, `review-loop`, `parallel-review` | During any code or implementation review |
| `validator` | None | Runs deterministic commands only |

## Delivery Chain Flow

```
plan-with-ac (planning)
  ↓ produces plan with ACs + test scenarios
tdd-enforcement (implementation)
  ↓ implementer follows RED-GREEN-REFACTOR
self-review-before-done (pre-handoff)
  ↓ implementer validates before returning
parallel-review (review)
  ↓ multiple perspectives analyze in parallel
ai-code-scrutiny (review)
  ↓ AI-specific failure pattern checklist
review-loop (post-review)
  ↓ quality gate: re-review if thresholds exceeded
```

## Cross-Skill Section Dependencies

Skills consume specific numbered sections from the plan produced by `plan-with-ac`:

| Consuming Skill | Plan Section | What It Consumes |
|---|---|---|
| `tdd-enforcement` | Section 7a (Test Scenarios) | RED phase targets for implementer |
| `self-review-before-done` | Section 11 (Acceptance Criteria) | Self-validation checklist |

## Potential Overlaps

| Skills | Overlap Area | Resolution |
|---|---|---|
| `ai-code-scrutiny` + `parallel-review` Perspective 1 | Both check correctness/logic | `parallel-review` uses `ai-code-scrutiny` items within Perspective 1 — not duplication but delegation |
| `self-review-before-done` + `review-loop` | Both have iteration limits (max 3) | Different phases: self-review is pre-handoff internal; review-loop is post-handoff external. Both limits apply independently |
| `tdd-enforcement` + `review-loop` | TDD compliance is a blocking check | `review-loop` includes TDD as a pre-gate check. Missing TDD evidence = high severity finding |
