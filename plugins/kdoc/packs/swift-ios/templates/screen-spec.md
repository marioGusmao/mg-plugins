---
type: screen-spec
pack: swift-ios
screen: {{SCREEN_NAME}}
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# Screen Spec: {{SCREEN_NAME}}

## Identity

| Field | Value |
|---|---|
| Screen name | `{{SCREEN_NAME}}` |
| Framework | SwiftUI / UIKit |
| Target | iPhone / iPad / Universal |
| Module | `{{TARGET_NAME}}` |

## View Hierarchy

<!-- Top-level container → key sub-views. Keep to 3 levels max. -->

- `{{ROOT_VIEW}}` (NavigationStack / TabView / plain View)
  - `<HeaderView>`
  - `<ContentView>`
    - `<ItemRow>` (repeated)
  - `<FooterView>`

## State

| Property | Type | Source | Notes |
|---|---|---|---|
| `items` | `[Item]` | ViewModel / `@StateObject` | Loaded on appear |
| `isLoading` | `Bool` | ViewModel | Shows progress indicator |
| `error` | `Error?` | ViewModel | Triggers error banner |

## Navigation Triggers

| Trigger | Destination | Method |
|---|---|---|
| Row tap | `<DetailScreen>` | `NavigationLink` / `push` |
| Back | Previous | System back button |

## Tokens Used

<!-- Reference tokens from `Knowledge/Design/swift-ios/tokens/` -->

- Color: `color.background.primary`, `color.text.primary`
- Typography: `typography.body`, `typography.title`
- Spacing: `spacing.md` (16 pt)

## Accessibility

- [ ] VoiceOver label set on all interactive elements
- [ ] Dynamic Type supported — no fixed font sizes
- [ ] Minimum tap target 44 x 44 pt
- [ ] Color contrast >= 4.5:1 (WCAG AA)
- [ ] `accessibilityHint` on non-obvious actions

## Open Questions

-
