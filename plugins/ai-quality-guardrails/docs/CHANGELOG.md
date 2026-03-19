# Changelog

## [0.1.0] - 2026-03-17

### Added

- **6 universal skills** (SKILL.md format, cross-platform compatible):
  - `plan-with-ac` — Plans with acceptance criteria, test scenarios, and milestones
  - `tdd-enforcement` — TDD chain across plan → implement → review
  - `review-loop` — Quality threshold gating with iterative re-review
  - `parallel-review` — Multiple reviewer perspectives in parallel
  - `ai-code-scrutiny` — Checklist for AI-generated code failure patterns
  - `self-review-before-done` — Self-validation before claiming completion

- **4 agent templates** (Claude Code format):
  - `explorer` — Read-only codebase exploration with forbidden behaviors
  - `implementer` — TDD workflow, self-review, output contract with AC check
  - `reviewer` — 7-item checklist, AI scrutiny, TDD compliance verification
  - `validator` — Validation ladder with evidence-backed reporting

- **Documentation**:
  - `docs/ARCHITECTURE.md` — Architecture overview and cross-platform compatibility
  - `docs/DESIGN.md` — Design intent and rationale (10 decisions, D1-D10)
  - `docs/ROUTING.md` — Skill activation matrix and agent-skill mapping
  - `docs/RESEARCH.md` — Evidence base with 20 sources
  - `docs/CHANGELOG.md` — Version history

- **Infrastructure**:
  - `LICENSE` — MIT license
  - `.gitignore` — Standard exclusions
