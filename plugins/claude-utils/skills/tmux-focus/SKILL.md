---
name: tmux-focus
description: Recover or navigate to the correct tmux session, window, or pane when notifications or parallel agents lose focus. Use when work is running in tmux and you need to jump to the right target safely.
---

# Tmux Focus

Use this skill to recover the correct tmux target without guessing.

## Workflow

1. Confirm tmux is available and the user is inside or targeting a tmux session.
2. Inspect available sessions, windows, and panes before switching targets.
3. Select the narrowest target possible: pane first, then window, then session.
4. If the target is ambiguous, report the candidates instead of switching blindly.
5. Confirm the final target after navigation.

## Guardrails

- Do not create or destroy tmux sessions unless the user asked for it.
- Do not rename windows or panes unless navigation requires it and the user approved it.
- Prefer read-only tmux inspection commands before any `select-*` action.
