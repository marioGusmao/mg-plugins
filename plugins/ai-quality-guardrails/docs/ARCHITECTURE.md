# Plugin Architecture

## Design Decisions

### Why these 6 skills?

Each skill addresses a specific, evidence-backed gap in AI-assisted development:

| Skill | Problem It Solves | Evidence |
|---|---|---|
| `plan-with-ac` | Plans are vague and unverifiable | SDD (Thoughtworks 2025), Addy Osmani (O'Reilly), Amazon Kiro, GitHub spec-kit |
| `tdd-enforcement` | AI code has 75% more logic errors; tests written after code verify implementation, not intent | DORA 2025, CodeRabbit 2025, Meta ACH (FSE 2025) |
| `review-loop` | Single-pass reviews miss issues; AI PRs average 10.83 issues each | CodeRabbit 2025, CodeScene agentic loop, Anthropic Code Review |
| `parallel-review` | Single reviewer finds one explanation and stops | Anthropic Code Review (March 2026), HAMY 9-agent setup |
| `ai-code-scrutiny` | 45% of AI code has security vulnerabilities, 86% fails XSS | Veracode 2025, OWASP 2025/2026, CodeRabbit 2025 |
| `self-review-before-done` | AI agents claim "done" without verifying | HAMY blog, CodeScene safeguards, Addy Osmani self-check pattern |

### Why these 4 agents?

The agent topology covers the four core roles in a delivery pipeline:

| Agent | Role | Mutability | Shell Access |
|---|---|---|---|
| `explorer` | Discovery and analysis | Read-only (no Write/Edit/Bash) | No |
| `implementer` | Code production | Read-write | Yes |
| `reviewer` | Quality assurance | Read-only (no Write/Edit/Bash) | No |
| `validator` | Automated verification | No Write/Edit — but has Bash | Yes — required to execute validation commands |

**Least agency note**: Explorer and reviewer have no shell access — their read-only guarantee is enforced by tool restrictions (`disallowedTools`). Validator requires Bash to run lint/typecheck/test commands; Write/Edit are blocked via `disallowedTools`, but Bash can still modify files via shell commands (`rm`, `mv`, redirects). The validator's no-mutation guarantee is **behavioral** (Forbidden Behaviors section), not a hard permission boundary. If your environment requires a hard guarantee, run the validator in a sandboxed shell or a read-only filesystem mount.

### Why no commands?

Skills are invoked by name (e.g., `/plan-with-ac`) or triggered by a routing layer if the project implements one. Commands would add an extra naming layer without additional value, since explicit skill invocation is sufficient.

### Why no hooks?

The review quality gate logic lives in the `review-loop` skill rather than hooks because:
1. Skills work cross-platform (Codex, Gemini CLI, Cursor)
2. Hooks are Claude Code-specific
3. Prompt-based enforcement in skills is more flexible than JSON hook configuration

## Cross-Platform Compatibility

### Universal (SKILL.md format — 14+ platforms)
- All 6 skills work on: Claude Code, Codex CLI, Gemini CLI, Cursor, Windsurf, Aider, Copilot, and more
- SKILL.md files follow the Agent Skills open standard (Anthropic, December 2025)

### Claude Code-specific
- 4 agent definitions (`.md` files with YAML frontmatter)
- Agent frontmatter uses Claude Code schema: `name`, `description`, `model`, `tools`, `disallowedTools`, `maxTurns`

### Adapting for other platforms
- **Codex CLI**: Copy skills to `~/.codex/skills/`. Agents need adaptation to Codex role template format.
- **Cursor**: Generate `.cursorrules` from skill content.
- **Gemini CLI**: Copy skills to Gemini skills directory.

## Design Principles

1. **Evidence over opinion** — every skill cites specific research
2. **Least agency** — agents have minimal permissions; read-only agents enforced via `disallowedTools`, not sandbox
3. **Cross-platform first** — skills in universal format
4. **Human-in-the-loop** — plans presented to user before review
5. **Iteration over perfection** — review loops catch what single passes miss
6. **Tests before code** — TDD enforced across the chain
7. **Defensive hardening** — Forbidden Behaviors prevent known failure modes

For detailed rationale on each decision, see `docs/DESIGN.md`. For skill activation mapping, see `docs/ROUTING.md`.
