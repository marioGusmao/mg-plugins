---
type: design-standard
id: accessibility
status: active
tags: [design, accessibility, wcag, a11y]
summary: WCAG 2.2 AA accessibility checklist and standards for all pages and components.
---

# Accessibility Standards

All pages and components must meet WCAG 2.2 Level AA.

## Perceivable

### Color Contrast

- Normal text (< 18pt / < 14pt bold): minimum 4.5:1 contrast ratio.
- Large text (≥ 18pt / ≥ 14pt bold): minimum 3:1 ratio.
- UI components and graphical objects: minimum 3:1 ratio against adjacent colors.
- Never convey information by color alone — pair with text label, icon, or pattern.

### Images

- Informative images: descriptive `alt` text.
- Decorative images: `alt=""` and `aria-hidden="true"`.
- Complex images (charts, diagrams): long description in adjacent text or `aria-describedby`.

### Motion

- Respect `prefers-reduced-motion: reduce` — disable or reduce all animations.
- No content that flashes more than 3 times per second.

## Operable

### Keyboard Navigation

- All interactive elements reachable via `Tab` key.
- Logical tab order matching visual reading order.
- Focus indicator visible on all focusable elements (minimum 3:1 contrast ratio).
- No keyboard traps — users can always navigate away.

### Skip Links

- First focusable element on every page: "Skip to main content" link targeting `<main>`.

### Touch Targets

- Minimum 44×44px for all interactive elements.

### Timing

- No time limits on user interaction unless absolutely required (and extendable/disableable).

## Understandable

### Page Structure

- Exactly one `<h1>` per page — the primary page title.
- Heading hierarchy is logical (no skipping from `<h1>` to `<h4>`).
- Landmark elements: `<header>`, `<main>`, `<nav>`, `<footer>`, `<aside>`.

### Forms

- All inputs have associated `<label>` elements (not placeholder-only).
- Error messages are specific, associated via `aria-describedby`, and suggest how to fix.
- Required fields marked with `*` and explained above the form.

### Language

- `lang` attribute set on `<html>` element.

## Robust

### Semantic HTML

- Use semantic elements: `<button>` for actions, `<a>` for navigation, `<table>` for data.
- Do not use `<div>` or `<span>` as interactive elements without ARIA roles.

### ARIA

- Use ARIA only when native HTML semantics are insufficient.
- `aria-label` or `aria-labelledby` on all icon-only buttons.
- `aria-expanded` on toggles (menus, accordions, dropdowns).
- `aria-live` regions for dynamic content (toasts, status updates).
- `role="dialog"` + `aria-modal="true"` + focus trap for modals.

## Component Checklist

| Component | Key requirements |
|-----------|-----------------|
| Button | Descriptive label, `aria-disabled` not `disabled` for visually disabled |
| Icon button | `aria-label` describing the action |
| Modal | Focus trap, `Escape` closes, focus returns to trigger on close |
| Dropdown menu | `aria-haspopup`, `aria-expanded`, arrow key navigation |
| Form input | Associated `<label>`, `aria-required`, `aria-describedby` for errors |
| Data table | `<th>` with `scope`, `aria-sort` on sortable headers |
| Toast | `role="status"` or `role="alert"`, `aria-live` region |
