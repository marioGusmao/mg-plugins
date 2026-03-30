---
name: orphaned-process-cleanup
description: Find and clean up leaked browser, test-runner, and dev-server processes after interrupted sessions. Use when a task leaves Chromium, Playwright, Vitest, Jest, or long-lived dev servers behind.
---

# Orphaned Process Cleanup

Use this skill when local development processes survived after the session that created them.

## Workflow

1. Identify candidate processes owned by the current user.
2. Confirm they match the leaked-process patterns you are targeting.
3. Check elapsed runtime so you do not kill fresh processes that may still be in use.
4. Terminate only the stale processes that match the cleanup scope.
5. Re-check the process list and report what was removed.

## Guardrails

- Never kill processes owned by another user.
- Never kill the current shell, parent shell, or obviously active sessions.
- Prefer narrow process matching over broad `pkill` patterns.
- Report the exact patterns you used and anything you left untouched.
