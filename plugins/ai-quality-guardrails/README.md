# ai-quality-guardrails

Quality guardrails for AI-assisted development. Provides structured guidance for TDD, iterative review loops, AI code scrutiny, spec-driven planning, and self-review patterns across your projects. Enforcement depends on the host project's routing layer — this plugin provides the skills and agent templates; the project decides when and how to invoke them.

## Why

AI-generated code has measurable quality gaps: 45% introduces security vulnerabilities (Veracode 2025), 75% more logic errors (CodeRabbit 2025), and 86% fails against XSS. These guardrails catch what single-pass reviews miss.

## What's Included

### Skills (universal — cross-platform)

| Skill | Purpose |
|---|---|
| `plan-with-ac` | Plans with acceptance criteria, test scenarios, and milestones |
| `tdd-enforcement` | TDD chain: plan defines tests → implement tests first → review verifies |
| `review-loop` | Quality threshold gating with iterative re-review (max 3 iterations) |
| `parallel-review` | Multiple reviewer perspectives in parallel (correctness, architecture, security) |
| `ai-code-scrutiny` | Checklist for AI-generated code failure patterns (OWASP, logic, hallucinations) |
| `self-review-before-done` | Self-validation before claiming completion |

### Agents (Claude Code)

| Agent | Role | Mutability |
|---|---|---|
| `explorer` | Codebase exploration and analysis | Read-only |
| `implementer` | TDD workflow, self-review, AC-driven output | Read-write |
| `reviewer` | Severity-first review with AI scrutiny and TDD compliance | Read-only |
| `validator` | Validation ladder with evidence-backed reporting | Read-only |

## Installation

### Claude Code

```bash
claude plugin install /path/to/ai-quality-guardrails
```

Or for development:

```bash
claude --plugin-dir /path/to/ai-quality-guardrails
```

### Other Platforms

Skills use the universal SKILL.md format. Copy the `skills/` directory to your platform's skills location:

- **Codex CLI**: `~/.agents/skills/`
- **Gemini CLI**: Gemini skills directory
- **Cursor**: Generate `.cursorrules` from skill content

When working from the `plugins-develop` monorepo, prefer the root sync command instead of copying manually:

```bash
./scripts/sync-to-codex.sh ai-quality-guardrails
```

This installs the reusable skills into Codex. The `agents/` directory remains Claude Code-specific.

## Documentation

- `docs/DESIGN.md` — Design intent and rationale for each component (D1-D10)
- `docs/ARCHITECTURE.md` — Architecture overview and cross-platform compatibility
- `docs/ROUTING.md` — Skill activation matrix and agent-skill mapping
- `docs/RESEARCH.md` — Evidence base with 20 sources
- `docs/CHANGELOG.md` — Version history

## License

MIT
