---
type: design-standard
pack: swift-ios
title: HIG Patterns
status: current
date: YYYY-MM-DD
owner: ''
---

# HIG Alignment Patterns

Reference for aligning {{PROJECT_NAME}} iOS UI with Apple Human Interface Guidelines.
Source: [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines)

---

## Navigation

| Pattern | When to Use | Anti-pattern |
|---|---|---|
| `NavigationStack` (push/pop) | Drill-down content hierarchies | Pushing modals onto a navigation stack |
| Tab bar (`TabView`) | 3–5 top-level peer sections | More than 5 tabs (use "More" or reconsider IA) |
| Modal sheet | Focused task that requires full attention | Embedding primary navigation in a sheet |
| `fullScreenCover` | Immersive tasks (camera, onboarding) | General content browsing |

**Rule:** A user should always know where they are and how to get back. Never remove the system back button without providing an equivalent affordance.

---

## Controls

| Control | Correct Use | Notes |
|---|---|---|
| `Button` (filled) | Primary action per screen | One primary action maximum |
| `Button` (tinted/borderless) | Secondary actions | Do not use filled style for destructive actions |
| `Button` role `.destructive` | Permanent destructive actions | Confirm via `confirmationDialog` before executing |
| `Toggle` | Binary settings | Label must always be visible |
| `Stepper` | Small numeric adjustments | For large ranges, use `Slider` |
| `Picker` | Selection from a known set | Prefer segmented control for <= 4 short options |

---

## Typography Hierarchy

Stick to the system Dynamic Type scale — do not define custom font sizes. Use weight modifiers (`fontWeight`) only when semantic styles do not express the required emphasis.

```
Page title      → .largeTitle or .title
Section header  → .headline
Body text       → .body
Supporting text → .subheadline or .footnote
Captions        → .caption or .caption2
```

---

## List and Collection Layout

- Use `List` for variable-height, scrollable, tappable rows.
- Use `LazyVStack` / `LazyVGrid` when you need full control over layout outside a form context.
- Never place a `List` inside a `ScrollView` — this disables lazy loading and causes layout conflicts.
- Use `swipeActions` for row actions (delete, archive) instead of custom gesture recognizers.

---

## Alerts and Confirmations

| Scenario | Component |
|---|---|
| Error requiring acknowledgment | `Alert` (single button: OK) |
| Confirm destructive action | `confirmationDialog` (`.destructive` button) |
| Require user input | Sheet with form |
| Progress (non-blocking) | Overlay with `ProgressView` |

---

## App Icon and Launch Screen

- App icon must be provided at all required sizes in the Asset Catalog.
- Launch screen (Storyboard or `UILaunchScreen` plist key) must match the app's background color — avoid layout elements that may shift when loaded.

---

## Related

- [[Knowledge/Design/swift-ios/standards/accessibility|Accessibility Checklist]]
- [[Knowledge/Design/swift-ios/tokens/|Design Tokens]]
