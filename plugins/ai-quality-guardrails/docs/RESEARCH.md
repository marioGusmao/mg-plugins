# Research Sources

Evidence base for the quality guardrails implemented in this plugin.

## Spec-Driven Development (SDD)

- **Thoughtworks (2025)**: "Spec-driven development: Unpacking one of 2025's key new AI-assisted engineering practices" — SDD identified as one of the most important new practices. Specs as first-class executable artifacts.
  - https://www.thoughtworks.com/en-us/insights/blog/agile-engineering-practices/spec-driven-development-unpacking-2025-new-engineering-practices

- **Martin Fowler (2025)**: "SDD Tools: Kiro, spec-kit, Tessl" — Comparison of tooling for spec-driven workflows.
  - https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html

- **Addy Osmani / O'Reilly**: "How to write a good spec for AI agents" — 6 key areas of a good spec: commands, testing, project structure, code style, git workflow, boundaries.
  - https://www.oreilly.com/radar/how-to-write-a-good-spec-for-ai-agents/

## Testing & TDD

- **DORA 2025 (Google Cloud)**: Elite teams do TDD. AI amplifies existing practices — TDD teams get better; non-TDD teams get worse.
  - https://cloud.google.com/discover/how-test-driven-development-amplifies-ai-success

- **Meta ACH (FSE 2025)**: Mutation-guided LLM test generation. First industrial-scale combination of mutation testing + LLM. 73% of tests accepted by engineers.
  - https://engineering.fb.com/2025/09/30/security/llms-are-the-key-to-mutation-testing-and-better-compliance/

- **HumanEval-Java study**: LLM-generated tests achieved 100% line/branch coverage but only 4% mutation testing score — missed almost all corner cases. (Secondary source — cited in multiple 2025 testing publications; no single canonical URL available.)

- **CodeRabbit (December 2025)**: Analysis of 470 PRs: AI-authored PRs average 10.83 issues vs 6.45 human-only. Logic errors +75%, security findings +57%.
  - https://www.twocents.software/blog/how-to-test-ai-generated-code-the-right-way/

## Security

- **Veracode 2025**: 45% of AI-generated code introduces vulnerabilities. 86% failed against XSS, 88% vulnerable to log injection.
  - https://www.helpnetsecurity.com/2025/08/07/create-ai-code-security-risks/

- **OWASP Top 10 for Agentic Applications (2026)**: First framework for securing autonomous AI agents. ASI01 (Goal Hijacking), ASI05 (Unexpected Code Execution), ASI06 (Memory Poisoning).
  - https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/

- **Snyk ToxicSkills (February 2026)**: Audit of 3,984 skills: 36% contain prompt injection, 1,467 malicious payloads confirmed, 534 skills with critical issues.
  - https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/

- **Check Point (February 2026)**: CVE-2025-59536 (CVSS 8.7) — RCE via malicious hooks in Claude Code. CVE-2026-21852 — MCP consent bypass.
  - https://research.checkpoint.com/2026/rce-and-api-token-exfiltration-through-claude-code-project-files-cve-2025-59536/

## Review Patterns

- **Anthropic Claude Code Review (March 2026)**: Multi-agent parallel review system. Each agent analyzes from different perspective. Adversarial component. Internal results: substantive comments rose from 16% to 54%.
  - https://techcrunch.com/2026/03/09/anthropic-launches-code-review-tool-to-check-flood-of-ai-generated-code/

- **HAMY Blog (February 2026)**: 9 parallel AI agents reviewing code. "Run this and iterate before marking done."
  - https://hamy.xyz/blog/2026-02_code-reviews-claude-subagents

- **CodeScene**: Agentic loop pattern: assess → safeguard → refactor → validate → repeat. loveholidays scaled to 50% agent-assisted code without quality degradation.
  - https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality

## Context Engineering

- **Anthropic**: "Effective context engineering for AI agents" — shift from prompt engineering to context engineering.
  - https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

- **Addy Osmani**: "My LLM coding workflow going into 2026" — spec → plan → prompt plan file → focused execution.
  - https://addyosmani.com/blog/ai-coding-workflow/

## Productivity Data (secondary/aggregated — no single canonical source)

- **DORA 2025**: 90% developer AI adoption, 80%+ report benefits
  - https://cloud.google.com/discover/how-test-driven-development-amplifies-ai-success
- **DX Research**: 3.6 hours/week saved with structured AI workflows (cited in multiple 2025 industry reports)
- **Cursor market share**: ~40% of AI-assisted PR market (October 2025, cited in dev.to and industry analyses)
- **Enterprise pilots**: 30% faster PR turnaround (aggregated from multiple pilot program reports)
