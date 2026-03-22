---
type: design-standard
id: ui-patterns
status: active
tags: [design, ui-patterns, components]
summary: Shared UI pattern vocabulary for page specs and component design.
---

# UI Patterns

Core UI patterns for {{PROJECT_NAME}}. Page specs reference patterns defined here rather than re-describing them inline.

## Data Tables

Present structured data in rows and columns with sorting, pagination, and row actions.

### Column Types

| Type | Rendering | Alignment |
|------|-----------|-----------|
| Text | Truncated with ellipsis, tooltip on hover | Left |
| Numeric | Monospace, right-aligned | Right |
| Status badge | Pill-shaped with semantic color | Left |
| Action | Three-dot overflow menu for 3+ actions | Right (last column) |
| Date | Formatted string (e.g., "12 Jan 25") | Left |

### Sorting

Single-column sort. Active column shows a chevron indicator. Sortable headers are `<button>` elements with `aria-sort`.

### Pagination

- Page sizes: 10, 25, 50 items. Default: 10.
- "Showing X–Y of Z" label + page buttons + prev/next arrows.
- Disabled buttons use `opacity.disabled` and `cursor: not-allowed`.

### Empty State

Replace table body with a centered empty state message. Keep header row visible.

### Loading State

Skeleton rows (default: 5) with shimmer animation matching column layout.

---

## Forms

Standard form patterns for user input.

### Input Fields

- Label above the field, always visible (never placeholder-only).
- Error message below the field in `color.semantic.error`.
- Required fields marked with `*` and explained at form top.
- Minimum touch target: 44×44px (inputs, buttons).

### Buttons

| Variant | Use case |
|---------|---------|
| Primary | Single main action per view |
| Secondary | Alternative or cancel actions |
| Destructive | Irreversible actions — confirm in a modal |
| Ghost | Tertiary actions, navigation |

### Validation

- Validate on submit (not on every keystroke).
- On failure: scroll to first error, move focus to first invalid field.
- Field-level error messages are associated via `aria-describedby`.

---

## Empty States

Displayed when a list or content area has no items.

- Centered icon (decorative, `aria-hidden`), heading, description, optional action button.
- Do not show empty states for loading — use skeletons instead.

---

## Notifications & Toasts

- **Toast**: Non-blocking, auto-dismisses after 5s. Top-right (desktop), top-center (mobile).
- **Banner**: Persistent, requires user dismissal. Used for warnings or degraded mode.
- **Inline error**: Associated with the specific element that caused the error.

---

## Modals

- Triggered by user action only — never on page load.
- Focus trapped within modal while open.
- Close on `Escape` key, backdrop click (except confirmation modals), and explicit close button.
- Confirmation modals have two explicit buttons: confirm (may be destructive) and cancel.
