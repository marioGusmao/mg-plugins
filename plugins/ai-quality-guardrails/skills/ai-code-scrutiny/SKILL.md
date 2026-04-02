---
name: ai-code-scrutiny
description: This skill should be used when reviewing or auditing AI-generated code for common failure patterns. Applies a systematic checklist covering hallucinated APIs, phantom dependencies, OWASP security vulnerabilities, control-flow omissions, logic errors, and agentic AI risks. Triggers on "scrutinize AI code", "check for hallucinated APIs", "OWASP review", "audit generated code", "review code for AI-specific bugs", "security checklist on generated code".
version: 1.0.0
---

## Prerequisites

- **No runtime dependencies** — this is a pure instruction/skill package (Markdown + YAML frontmatter)
- Works with any AI coding assistant that supports skill/instruction injection
- For maximum effectiveness, pair with a test runner available in the project (jest, vitest, pytest, go test, etc.)


# AI-Generated Code Scrutiny

Systematic checklist for code produced by AI coding agents.

## The Problem

AI-generated code has significantly higher rates of security vulnerabilities (45% per Veracode 2025), logic errors (+75% per CodeRabbit 2025), and control-flow omissions compared to human-written code. These follow patterns that can be checked systematically.

See the plugin's `docs/RESEARCH.md` for full sourced evidence.

## Scrutiny Checklist

### 1. Hallucinated APIs and Phantom Dependencies

- [ ] All imported packages exist in package.json / requirements.txt
- [ ] All API methods called actually exist on the libraries used
- [ ] No invented function signatures that look plausible but don't exist
- [ ] Version compatibility verified for all dependencies

### 2. Security Patterns (OWASP Top 10)

- [ ] **Injection**: User inputs sanitized before use in queries, commands, templates
- [ ] **XSS**: Output encoding applied for all user-controlled content rendered in HTML
- [ ] **Log injection**: User inputs not directly interpolated into log messages
- [ ] **Auth bypass**: Authentication checks present on all protected routes
- [ ] **Mass assignment**: Object spread/merge doesn't expose sensitive fields
- [ ] **SSRF**: External URLs validated before server-side fetch
- [ ] **Secrets**: No hardcoded credentials, API keys, or tokens

### 3. Control-Flow Omissions

- [ ] Null/undefined checks present where data could be absent
- [ ] Early returns for invalid states (guard clauses)
- [ ] Exception handling for operations that can fail (I/O, network, parsing)
- [ ] Error propagation preserves context (not silently swallowed)
- [ ] Async error handling (try/catch around await, .catch() on promises)

### 4. Logic Correctness

- [ ] Comparison operators correct (=== not ==, >= not >, etc.)
- [ ] Loop boundaries correct (off-by-one, inclusive vs exclusive)
- [ ] Boolean logic correct (&&/|| precedence, De Morgan's)
- [ ] State mutations intentional (not accidental reference sharing)
- [ ] Return values used (not silently discarded)

### 5. AI-Specific Patterns

- [ ] No "looks right but does nothing" code (functions that return without effect)
- [ ] No over-abstraction (unnecessary wrappers, premature generalization)
- [ ] No copy-paste drift (similar blocks that should be identical diverge subtly)
- [ ] No phantom error handling (catch blocks that swallow errors silently)
- [ ] No invented test assertions (tests that pass but don't actually verify behavior)

### 6. Agentic Code Patterns (OWASP Agentic AI 2026)

Apply this section only when reviewing code that configures AI agents, skills, hooks, or MCP servers:

- [ ] **Prompt injection**: Configuration files, SKILL.md, or .mcp.json don't contain hidden instructions that override agent behavior
- [ ] **Goal hijacking (ASI01)**: No inputs that could redirect agent objectives (poisoned docs, emails, web content used as context)
- [ ] **Unexpected code execution (ASI05)**: Dynamically generated code is sandboxed or reviewed before execution
- [ ] **Memory poisoning (ASI06)**: Shared memory/context files don't contain injected instructions
- [ ] **Supply chain**: Third-party skills/plugins verified — no phantom packages, no unsigned skills from untrusted sources

## How to Apply

When reviewing code:

1. Run through each section of the checklist (skip section 6 unless reviewing agent config)
2. For each failed item, create a finding with severity and file:line:
   ```
   [CRITICAL|HIGH|MEDIUM|LOW] Section X.Y — description (file:line)
   ```
3. Pay special attention to sections 2 and 3 — highest real-world impact
4. Cross-reference with test coverage — untested code gets extra scrutiny

## Capability Warrant Compliance

When a **capability warrant block** is present in the session context:

- [ ] **Unwarranted capability usage**: Check if the code uses capabilities (tools, APIs, features) that are NOT listed in the warrant items. Flag as `[HIGH]` if a capability was relied upon without warrant coverage.
- [ ] **Stale warrant items**: If any warrant item has `verification_state: stale`, flag usage of that capability as `[MEDIUM]` — the capability may not be reliably available.
- [ ] **Policy violations**: If a warrant item has `policy: prohibit` or `policy: discourage`, flag any usage as `[CRITICAL]` or `[HIGH]` respectively.

When **no warrant block** is present: use existing heuristic checks unchanged.

## Related Skills

- `self-review-before-done` — uses this checklist as fallback when no validation commands exist
- `parallel-review` — Perspective 1 covers items from this checklist
- `review-loop` — quality gate applied after findings are produced
- `tdd-enforcement` — complementary: TDD catches logic errors at write time; this catches them at review time
