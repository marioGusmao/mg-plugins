# Design Intent

Original design intent and decisions for ai-quality-guardrails. Use this document to understand WHY things are built the way they are, enabling informed updates without losing design rationale.

## Origin

This plugin was extracted from the AVShop2 project (March 2026) after an extensive research session covering industry best practices for AI-assisted development. The research covered:

- Spec-Driven Development (Thoughtworks, GitHub, Amazon)
- Context Engineering (Anthropic)
- TDD amplification with AI (DORA 2025, Meta ACH)
- AI code quality gaps (Veracode, CodeRabbit, OWASP)
- Iterative review patterns (Anthropic Code Review, CodeScene, HAMY)
- Agent security (OWASP Agentic AI 2026, Snyk ToxicSkills)

The full evidence base is in `docs/RESEARCH.md`.

## Core Design Decisions

### D1: Six skills, not one monolithic skill

**Decision**: Split guardrails into 6 independent skills instead of one large "quality-guardrails" skill.

**Rationale**: Each skill addresses a distinct phase of the delivery chain (planning, implementing, reviewing, validating). A monolithic skill would exceed the ~150 line guideline for optimal AI context processing, and users may want to adopt guardrails incrementally.

**Tradeoff**: More files to maintain, but each skill is independently usable and cross-platform portable.

### D2: Skills are generic, agents are opinionated

**Decision**: Skills contain no project-specific references. Agents contain role-specific behavioral contracts (forbidden behaviors, escalation triggers, output contracts).

**Rationale**: Skills must work across 14+ platforms (Claude Code, Codex, Gemini, Cursor, etc.). Agents are Claude Code-specific and can afford richer behavioral contracts. This separation means the same skill content works everywhere while agents add enforcement depth on Claude Code.

### D3: TDD enforced across the full chain, not just in the implementer

**Decision**: TDD enforcement spans plan (defines test scenarios) → implementer (writes tests first) → reviewer (verifies TDD compliance).

**Rationale**: DORA 2025 shows TDD amplifies AI quality. But TDD only works if the chain is complete — if the plan doesn't define test scenarios, the implementer has nothing to test against. If the reviewer doesn't check TDD compliance, the implementer can skip it.

### D4: Review loop with quality threshold, not single-pass

**Decision**: Reviews that produce critical findings OR more than 3 high findings trigger mandatory re-review. High 1-3 recommends re-review with user decision.

**Rationale**: CodeRabbit 2025 data shows AI PRs average 10.83 issues each. Single-pass reviews catch the obvious ones but miss systemic issues. The threshold is calibrated to avoid infinite loops (max 3 iterations) while catching the most impactful issues.

### D5: Parallel review with adversarial component

**Decision**: Standard+ complexity reviews launch 2-3 reviewer instances in parallel with different perspectives, plus optional adversarial cross-check.

**Rationale**: Anthropic's internal Claude Code Review (March 2026) showed that adversarial review (agents explicitly challenge each other) raised substantive comments from 16% to 54%. The HAMY blog (9 parallel agents) independently confirmed the pattern.

### D6: AI code scrutiny as a separate checklist, not embedded in review

**Decision**: `ai-code-scrutiny` is a standalone skill with a structured checklist, not merged into the reviewer's general checklist.

**Rationale**: The failure patterns of AI-generated code are specific and evidence-backed (hallucinated APIs, phantom dependencies, OWASP vulnerabilities, control-flow omissions, agentic risks). A standalone checklist can be updated independently as new research emerges, and can be used by any agent — not just the reviewer.

### D7: Self-review before done, with "switch perspective" technique

**Decision**: Implementers must self-validate against acceptance criteria and validation commands before returning. Includes a "switch perspective" technique — re-read output as if you are the reviewer.

**Rationale**: HAMY blog pattern "run this and iterate before marking done." The switch perspective technique addresses the cognitive bias where the author evaluates their own work from the same mental model that produced it. Asking the agent to "think like the reviewer" partially breaks this bias.

### D8: Human-in-the-loop at plan presentation, not just at review

**Decision**: Plans must be presented to the user before triggering review or implementation.

**Rationale**: Learned from AVShop2 session — auto-chaining plan creation → review without showing the user bypasses the decision-maker. The user may want to adjust scope, change approach, or add requirements before the plan is finalized.

### D9: No hooks — enforcement via skills

**Decision**: Review quality gate logic lives in skills, not Claude Code hooks.

**Rationale**: Hooks are Claude Code-specific (JSON config + shell scripts). Skills work cross-platform. Since the quality gate is a behavioral instruction ("if findings exceed threshold, re-review") rather than a deterministic file operation, a skill is the natural home.

### D10: Agent prompt size under 150 lines

**Decision**: All agent files target under 150 lines.

**Rationale**: Context Engineering research (Anthropic) shows model performance degrades when context is overloaded. Agent system prompts compete with conversation context for the model's "attention budget." Keeping them concise preserves quality.

## Component Map

```
Planning phase:
  plan-with-ac ──→ defines ACs + test scenarios + milestones

Implementation phase:
  tdd-enforcement ──→ RED-GREEN-REFACTOR per scenario
  self-review-before-done ──→ validate before returning
  implementer agent ──→ orchestrates both skills

Review phase:
  parallel-review ──→ multiple perspectives + adversarial
  ai-code-scrutiny ──→ AI-specific failure checklist
  review-loop ──→ quality threshold + re-review
  reviewer agent ──→ orchestrates all three skills

Validation phase:
  validator agent ──→ deterministic command runner

Exploration phase:
  explorer agent ──→ read-only discovery
```

## Updating This Plugin

When updating any component:

1. Check this file for the relevant design decision
2. Understand WHY before changing WHAT
3. If the change contradicts a decision, update the decision here with new rationale
4. Update `CHANGELOG.md` with what changed
5. Update `RESEARCH.md` if new evidence informed the change
6. Run the reviewer agent against your changes
