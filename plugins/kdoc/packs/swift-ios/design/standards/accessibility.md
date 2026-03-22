---
type: design-standard
pack: swift-ios
title: iOS Accessibility Checklist
status: current
date: YYYY-MM-DD
owner: ''
---

# iOS Accessibility Checklist

Verify all items before marking a screen implementation complete.
Reference: [developer.apple.com/accessibility](https://developer.apple.com/accessibility/)

---

## VoiceOver

- [ ] Every interactive element has a meaningful `accessibilityLabel`
- [ ] Decorative images have `accessibilityHidden = true`
- [ ] Custom controls implement `accessibilityActivate()` and correct `accessibilityTraits`
- [ ] Reading order matches visual order (adjust with `accessibilitySortPriority` if needed)
- [ ] Grouped elements use `accessibilityElement(children: .combine)` where appropriate
- [ ] `accessibilityHint` provided for non-obvious actions (e.g. "Double-tap to expand")
- [ ] Dynamic content changes post `UIAccessibility.post(notification: .announcement, argument:)` or `.layoutChanged`

---

## Dynamic Type

- [ ] No fixed point-size fonts — all text uses `UIFont.preferredFont(forTextStyle:)` or SwiftUI `.font(.<textStyle>)`
- [ ] Layout tested at all Dynamic Type sizes including Accessibility sizes (AX1–AX5)
- [ ] Text containers use flexible height — no hardcoded height constraints on text-containing views
- [ ] Line limits removed or set to a sensible minimum (>= 3) for body text
- [ ] Icons and images adjacent to text scale proportionally (`UIFontMetrics.default.scaledValue(for:)`)

---

## Color and Contrast

- [ ] Text contrast ratio >= 4.5:1 against background (WCAG AA)
- [ ] Large text (>= 18 pt normal or >= 14 pt bold) contrast ratio >= 3:1
- [ ] Information is never conveyed by color alone — always pair with icon, label, or pattern
- [ ] Checked with both light and dark mode
- [ ] Verified with Color Blind filter (Xcode Accessibility Inspector → Color Filters)

---

## Motion and Animation

- [ ] `withAnimation` blocks respect `UIAccessibility.isReduceMotionEnabled`
- [ ] Auto-playing video or looping animations pause when Reduce Motion is active
- [ ] SwiftUI: use `.animation(reduceMotion ? .none : .default, ...)` pattern

---

## Keyboard and Switch Control

- [ ] All actions reachable without gesture (keyboard shortcut or accessible tap target)
- [ ] Tab order is logical in forms
- [ ] Custom gestures have single-tap alternatives declared via `UIAccessibilityCustomAction`
- [ ] Switch Control activation tested for primary actions on each screen

---

## Testing Tools

| Tool | How to Access | What it checks |
|---|---|---|
| Xcode Accessibility Inspector | Xcode → Open Developer Tool → Accessibility Inspector | Labels, traits, contrast, hierarchy |
| VoiceOver (device) | Settings → Accessibility → VoiceOver | Real screen-reader UX |
| Simulator VoiceOver | Hardware → Toggle VoiceOver (set shortcut first) | Basic label/trait validation |
| Dynamic Type preview | Xcode canvas environment overrides | Layout at all text sizes |

---

## Related

- [[Knowledge/Design/swift-ios/standards/hig-patterns|HIG Patterns]]
- [[Knowledge/Design/swift-ios/tokens/|Design Tokens]]
