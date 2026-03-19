# kdoc Plan 4B: Swift/iOS Pack

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Swift/iOS technology pack with pack manifest, templates, guides, design standards, and validation scripts.

**Architecture:** Pack content is namespaced under `packs/swift-ios/`. When installed, content goes to `Knowledge/Templates/swift-ios/`, `Knowledge/Guides/swift-ios/`, `Knowledge/Design/swift-ios/<scope>/`, and `scripts/kdoc/swift-ios/`.

**Tech Stack:** Markdown templates, JSON manifest, Shell validation script

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md` (Section 6.3)
**Depends on:** Plan 3 (Core Content — for template format conventions)

---

## File Structure

```
kdoc/
└── packs/
    └── swift-ios/
        ├── pack.json
        ├── templates/
        │   ├── screen-spec.md
        │   ├── flow-spec.md
        │   ├── api-contract.md
        │   └── recipe.md
        ├── guides/
        │   ├── onboarding.md
        │   ├── troubleshooting.md
        │   └── module-placement.md
        ├── design/
        │   ├── tokens-template.json
        │   └── standards/
        │       ├── hig-patterns.md
        │       └── accessibility.md
        └── scripts/
            └── check_module_deps.sh
```

---

### Task 1: Pack Manifest

**Files:**
- Create: `packs/swift-ios/pack.json`

- [ ] **Step 1: Create `packs/swift-ios/pack.json`**

The manifest follows the schema defined in spec section 6.1. Detection patterns cover the three canonical iOS project root files. Default scopes match spec section 6.3. `scripts-runner` is `make` since iOS projects commonly use Makefiles for automation; SPM-only projects may use `swift` directly, but `make` is the safer universal default.

```jsonc
{
  "name": "swift-ios",
  "displayName": "Swift / iOS",
  "description": "Knowledge pack for Swift/iOS projects using UIKit, SwiftUI, or hybrid apps. Adds screen specs, navigation flow templates, API client contracts, SPM module guidance, Apple HIG design standards, and VoiceOver/Dynamic Type accessibility checklists.",
  "detect": {
    "files": ["Package.swift", "*.xcodeproj", "*.xcworkspace"],
    "dependencies": [],
    "packageManager": ["spm", "cocoapods"]
  },
  "defaults": {
    "scopes": ["App", "Shared"],
    "enforced-paths": [
      "Sources/*/Modules/",
      "Sources/*/Core/",
      "Packages/*/Sources/"
    ],
    "scripts-prefix": "kdoc",
    "scripts-runner": "make"
  },
  "areas": {
    "design": {
      "token-format": "ios-semantic",
      "scope-axis": "inner"
    }
  }
}
```

- [ ] **Step 2: Verify manifest is valid JSON**

```bash
python3 -c "import json, sys; json.load(open('packs/swift-ios/pack.json')); print('valid')"
```

Expected output: `valid`

---

### Task 2: Templates

**Files:**
- Create: `packs/swift-ios/templates/screen-spec.md`
- Create: `packs/swift-ios/templates/flow-spec.md`
- Create: `packs/swift-ios/templates/api-contract.md`
- Create: `packs/swift-ios/templates/recipe.md`

**Placeholder conventions shared across pack templates:**

| Placeholder | Source in `.kdoc.yaml` | Example value |
|---|---|---|
| `{{PROJECT_NAME}}` | top-level `name` | `MyApp` |
| `{{SCREEN_NAME}}` | user prompt at scaffold time | `ProductDetail` |
| `{{FLOW_NAME}}` | user prompt at scaffold time | `Checkout` |
| `{{MODULE_NAME}}` | user prompt at scaffold time | `Networking` |

- [ ] **Step 1: Create `packs/swift-ios/templates/screen-spec.md`**

iOS equivalent of the Next.js `page-spec.md`. Covers SwiftUI/UIKit view identity, view hierarchy, state, navigation triggers, accessibility, and Dynamic Type. Target 50 lines.

```markdown
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
```

- [ ] **Step 2: Create `packs/swift-ios/templates/flow-spec.md`**

Navigation flow template covering state transitions, entry/exit points, and error paths. Matches spec section 6.3. Target 45 lines.

```markdown
---
type: flow-spec
pack: swift-ios
flow: {{FLOW_NAME}}
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# Flow Spec: {{FLOW_NAME}}

## Entry Points

<!-- Where can a user enter this flow from? -->

| Entry | Trigger | Context passed |
|---|---|---|
| `<SourceScreen>` | Button tap | `<ContextType>` |

## Screens in Flow

| Step | Screen | Description |
|---|---|---|
| 1 | `<Step1Screen>` | <!-- Brief purpose --> |
| 2 | `<Step2Screen>` | |
| N | Completion | Flow exits or presents confirmation |

## State Machine

```
[Idle] --start--> [Step1] --next--> [Step2] --submit--> [Processing]
                                               ^               |
                                               |-- retry <-- [Error]
                                                             |
                                                           [Done]
```

## Navigation Method

- [ ] `NavigationStack` (push/pop)
- [ ] Modal sheet (`sheet` / `fullScreenCover`)
- [ ] Tab switch
- [ ] Deep link: `<url-scheme>://<path>`

## Exit Points

| Exit | Condition | Destination |
|---|---|---|
| Success | Flow completed | `<DestinationScreen>` |
| Cancel | User taps dismiss | Returns to entry point |
| Error (unrecoverable) | Fatal failure | Root / Home |

## Open Questions

-
```

- [ ] **Step 3: Create `packs/swift-ios/templates/api-contract.md`**

API client contract template using Codable models. Documents endpoint URL, HTTP method, request/response shapes, error handling, and retry policy. Target 55 lines.

```markdown
---
type: api-contract
pack: swift-ios
endpoint: {{ENDPOINT_NAME}}
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# API Contract: {{ENDPOINT_NAME}}

## Endpoint

| Field | Value |
|---|---|
| Method | `GET` / `POST` / `PUT` / `DELETE` |
| Path | `/api/v1/<resource>` |
| Auth | Bearer token / None |
| Base URL | `{{API_BASE_URL}}` |

## Request

### Path Parameters

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `String` | Yes | Resource identifier |

### Query Parameters

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | `Int` | No | `1` | Page number |

### Body (POST / PUT)

```swift
struct <RequestName>: Encodable {
    let field: String
    let count: Int
}
```

## Response

### Success (2xx)

```swift
struct <ResponseName>: Decodable {
    let id: String
    let name: String
    let createdAt: Date        // ISO 8601 — use `.iso8601` JSONDecoder strategy
}
```

### Error Shape

```swift
struct APIError: Decodable {
    let code: String
    let message: String
}
```

| HTTP Status | `code` | Meaning |
|---|---|---|
| 400 | `invalid_input` | Request validation failed |
| 401 | `unauthorized` | Token missing or expired |
| 404 | `not_found` | Resource does not exist |
| 500 | `server_error` | Retry with backoff |

## Retry Policy

- Max attempts: 3
- Backoff: exponential (1 s, 2 s, 4 s)
- Retryable: 429, 500, 503

## Open Questions

-
```

- [ ] **Step 4: Create `packs/swift-ios/templates/recipe.md`**

Reusable implementation recipe for common iOS patterns (networking setup, persistence, auth tokens, etc.). Target 40 lines.

```markdown
---
type: recipe
pack: swift-ios
title: <RecipeTitle>
status: draft
date: YYYY-MM-DD
owner: ''
tags: []
summary: ''
---

# Recipe: <RecipeTitle>

## Purpose

<!-- One sentence: what problem does this recipe solve? -->

## When to Use

<!-- Conditions under which this recipe applies. -->

## Dependencies

| Dependency | Type | Notes |
|---|---|---|
| `<FrameworkOrPackage>` | SPM / System | <!-- Version or reason --> |

## Implementation

### Step 1 — <StepTitle>

<!-- Code block + explanation. Keep steps atomic. -->

```swift
// Example Swift snippet
```

### Step 2 — <StepTitle>

```swift
// Example Swift snippet
```

## Integration Checklist

- [ ] Added to `Package.swift` dependencies (if SPM)
- [ ] Environment variable / secret stored in `.xcconfig` (never in source)
- [ ] Unit test written for core logic
- [ ] Existing tests still pass

## Related

- [[<path-to-related-tldr>|<Feature Name>]]
- [[<path-to-related-screen-spec>|<Screen Name>]]
```

---

### Task 3: Guides

**Files:**
- Create: `packs/swift-ios/guides/onboarding.md`
- Create: `packs/swift-ios/guides/troubleshooting.md`
- Create: `packs/swift-ios/guides/module-placement.md`

- [ ] **Step 1: Create `packs/swift-ios/guides/onboarding.md`**

Covers first-run setup: Xcode, simulators, SPM resolution, scheme configuration, environment variables via `.xcconfig`. Target 55 lines.

```markdown
---
type: guide
pack: swift-ios
title: iOS Project Onboarding
status: current
date: YYYY-MM-DD
owner: ''
---

# iOS Project Onboarding

## Overview

Everything you need to get the {{PROJECT_NAME}} iOS project running locally.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Xcode | >= 15.0 | Install from App Store or [developer.apple.com](https://developer.apple.com) |
| macOS | >= 14.0 (Sonoma) | Required for Xcode 15+ |
| Swift | >= 5.9 | Bundled with Xcode |
| Ruby | >= 3.0 | Only if using CocoaPods |

## Setup

### 1. Clone and open

```bash
git clone <repo-url>
open <ProjectName>.xcworkspace   # use .xcworkspace if CocoaPods/Tuist; else .xcodeproj
```

### 2. Resolve Swift Package dependencies

```
Xcode menu → File → Packages → Resolve Package Versions
```

Or via CLI:
```bash
xcodebuild -resolvePackageDependencies -project <ProjectName>.xcodeproj
```

### 3. Configure environment variables

Environment-specific values (API keys, base URLs) live in `.xcconfig` files — never hardcoded in source.

```bash
cp Configurations/Debug.xcconfig.example Configurations/Debug.xcconfig
# Fill in values — this file is git-ignored
```

### 4. Select scheme and simulator

In Xcode toolbar: choose `<SchemeName>` → pick a simulator (e.g. iPhone 16 Pro, iOS 18.x) → press ▶.

## Running Tests

```bash
xcodebuild test \
  -scheme <SchemeName> \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

## Common First-Run Issues

See `Knowledge/Guides/swift-ios/troubleshooting.md`.

## Related

- [[Knowledge/Guides/swift-ios/module-placement|Module Placement Guide]]
```

- [ ] **Step 2: Create `packs/swift-ios/guides/troubleshooting.md`**

Covers the most common iOS development issues: SPM resolution failures, simulator boot problems, signing errors, and Dynamic Type layout breaks. Target 60 lines.

```markdown
---
type: guide
pack: swift-ios
title: iOS Troubleshooting
status: current
date: YYYY-MM-DD
owner: ''
---

# iOS Troubleshooting

## SPM Package Resolution Fails

**Symptom:** Xcode shows "Failed to resolve package graph" or hangs at resolution.

**Fix:**

```bash
# Clear derived data and package caches
rm -rf ~/Library/Developer/Xcode/DerivedData
rm -rf ~/Library/Caches/org.swift.swiftpm

# Then in Xcode: File → Packages → Reset Package Caches
```

If a specific package fails, check its version constraint in `Package.swift` — a `from:` constraint may conflict with a transitive dependency.

---

## Simulator Won't Boot

**Symptom:** Simulator stays on black screen or "CoreSimulatorService" error appears.

**Fix:**

```bash
xcrun simctl shutdown all
xcrun simctl erase all   # wipes simulator content — use only in dev
```

Or open Xcode → Window → Devices and Simulators → right-click simulator → Erase All Content and Settings.

---

## Code Signing Error

**Symptom:** `No signing certificate "iOS Development" found` or provisioning profile mismatch.

**Fix (local development):**
1. Xcode → project target → Signing & Capabilities → check "Automatically manage signing".
2. Select your personal team.
3. If running on a physical device, ensure the device UDID is registered in your provisioning profile.

---

## Dynamic Type Breaks Layout

**Symptom:** Text truncates or overflows at Accessibility sizes (AX1–AX5).

**Fix checklist:**
- Remove fixed-height constraints on containers holding text.
- Use `UIFontMetrics` / `.scaledFont(for:)` instead of literal point sizes.
- Test with Xcode Accessibility Inspector: Device → Settings → Display & Text Size → Larger Text.
- In SwiftUI use `.font(.body)` not `.font(.system(size: 17))`.

---

## Build Succeeds but App Crashes at Launch

**Symptom:** Clean build passes but the app crashes immediately on the simulator.

**Common causes:**
1. Missing `.xcconfig` key — check that all keys used in `Info.plist` exist in the active config.
2. Main actor isolation violation — look for `@MainActor` deadlock in async task chains.
3. Missing `NSAppTransportSecurity` exception for HTTP endpoints (iOS blocks HTTP by default).

---

## Related

- [[Knowledge/Guides/swift-ios/onboarding|Onboarding Guide]]
```

- [ ] **Step 3: Create `packs/swift-ios/guides/module-placement.md`**

Decision tree for placing new code into the correct SPM target or local package. Mirrors the intent of the Next.js `module-placement.md` but for Xcode/SPM project structures. Target 55 lines.

```markdown
---
type: guide
pack: swift-ios
title: Module Placement Guide
status: current
date: YYYY-MM-DD
owner: ''
---

# Module Placement Guide

Use this guide when you're unsure where to add a new file, type, or feature to the iOS project.

## Decision Tree

```
Is the code used by more than one target (e.g., App + Widget + Tests)?
├── YES → Place in a local SPM package under Packages/
│         └── Does it depend on UIKit / AppKit?
│             ├── YES → Packages/<FeatureName>/Sources/<FeatureName>/ (platform module)
│             └── NO  → Packages/<FeatureName>/Sources/<FeatureName>/ (pure Swift — testable without simulator)
└── NO  → Place inside the target that owns it
          └── Does it represent a self-contained vertical feature slice?
              ├── YES → Sources/{{TARGET_NAME}}/Modules/<FeatureName>/
              └── NO  → Sources/{{TARGET_NAME}}/Core/<LayerName>/
                        (Layers: Networking, Persistence, UI/Components, Extensions)
```

## Placement Table

| What you're creating | Where it goes | Notes |
|---|---|---|
| Shared model / DTO | `Packages/Models/Sources/Models/` | No UIKit dependency |
| Network client | `Packages/Networking/Sources/Networking/` | Uses `URLSession`; no UI |
| Feature screen (SwiftUI) | `Sources/<Target>/Modules/<FeatureName>/` | View + ViewModel in same folder |
| Shared UI component | `Packages/DesignSystem/Sources/DesignSystem/` | Previews-friendly |
| App-level navigation | `Sources/<Target>/Core/Navigation/` | App target only |
| Persistence layer | `Packages/Persistence/Sources/Persistence/` | SwiftData / CoreData / GRDB |
| Widget extension code | `Sources/<WidgetTarget>/` | Separate target; share models via package |
| Unit test helper | `Packages/<Name>/Tests/<Name>Tests/` | Co-located test target |

## Rules

1. **Never import a feature module from another feature module directly** — go through a coordinator or router in `Core/Navigation/`.
2. **Packages must not import application targets** — dependency must flow inward only (packages are leaves).
3. **Use `@testable import` only in test targets** — never in application code.
4. **Extensions on system types** live in `Packages/Extensions/` or `Sources/<Target>/Core/Extensions/`.

## When in Doubt

Create the file in the most restrictive location first (closest to where it is used). Move it to a shared package only when a second consumer actually needs it.

## Related

- [[Knowledge/Guides/swift-ios/onboarding|Onboarding Guide]]
- [[Knowledge/Design/swift-ios/standards/hig-patterns|HIG Patterns]]
```

---

### Task 4: Design Standards and Tokens

**Files:**
- Create: `packs/swift-ios/design/tokens-template.json`
- Create: `packs/swift-ios/design/standards/hig-patterns.md`
- Create: `packs/swift-ios/design/standards/accessibility.md`

- [ ] **Step 1: Create `packs/swift-ios/design/tokens-template.json`**

Design tokens for iOS using semantic naming. Covers Dynamic Type scales (system font styles), SF Symbols usage, semantic colors (adaptable to light/dark mode), and spacing scale in points. Format is iOS-semantic (not DTCG) since iOS does not consume W3C Design Token Community Group JSON natively — values map directly to SwiftUI/UIKit APIs.

```json
{
  "$schema": "kdoc/ios-semantic/1.0",
  "$description": "Semantic design tokens for {{PROJECT_NAME}} iOS. Values reference Apple system APIs where applicable.",
  "typography": {
    "largeTitle":  { "uiFont": "UIFont.preferredFont(forTextStyle: .largeTitle)",  "swiftUI": ".largeTitle",  "size": 34 },
    "title":       { "uiFont": "UIFont.preferredFont(forTextStyle: .title1)",       "swiftUI": ".title",       "size": 28 },
    "title2":      { "uiFont": "UIFont.preferredFont(forTextStyle: .title2)",       "swiftUI": ".title2",      "size": 22 },
    "title3":      { "uiFont": "UIFont.preferredFont(forTextStyle: .title3)",       "swiftUI": ".title3",      "size": 20 },
    "headline":    { "uiFont": "UIFont.preferredFont(forTextStyle: .headline)",     "swiftUI": ".headline",    "size": 17, "weight": "semibold" },
    "body":        { "uiFont": "UIFont.preferredFont(forTextStyle: .body)",         "swiftUI": ".body",        "size": 17 },
    "callout":     { "uiFont": "UIFont.preferredFont(forTextStyle: .callout)",      "swiftUI": ".callout",     "size": 16 },
    "subheadline": { "uiFont": "UIFont.preferredFont(forTextStyle: .subheadline)",  "swiftUI": ".subheadline", "size": 15 },
    "footnote":    { "uiFont": "UIFont.preferredFont(forTextStyle: .footnote)",     "swiftUI": ".footnote",    "size": 13 },
    "caption":     { "uiFont": "UIFont.preferredFont(forTextStyle: .caption1)",     "swiftUI": ".caption",     "size": 12 },
    "caption2":    { "uiFont": "UIFont.preferredFont(forTextStyle: .caption2)",     "swiftUI": ".caption2",    "size": 11 }
  },
  "color": {
    "$note": "All semantic colors adapt to light/dark mode automatically via UIColor/Color system APIs.",
    "background": {
      "primary":   { "uiColor": "UIColor.systemBackground",        "swiftUI": "Color(.systemBackground)" },
      "secondary": { "uiColor": "UIColor.secondarySystemBackground","swiftUI": "Color(.secondarySystemBackground)" },
      "grouped":   { "uiColor": "UIColor.systemGroupedBackground",  "swiftUI": "Color(.systemGroupedBackground)" }
    },
    "text": {
      "primary":   { "uiColor": "UIColor.label",            "swiftUI": "Color(.label)" },
      "secondary": { "uiColor": "UIColor.secondaryLabel",   "swiftUI": "Color(.secondaryLabel)" },
      "tertiary":  { "uiColor": "UIColor.tertiaryLabel",    "swiftUI": "Color(.tertiaryLabel)" },
      "link":      { "uiColor": "UIColor.link",             "swiftUI": "Color(.link)" }
    },
    "interactive": {
      "accent":    { "$note": "Set in Xcode Asset Catalog as AccentColor — referenced via Color.accentColor in SwiftUI" },
      "destructive":{ "uiColor": "UIColor.systemRed",       "swiftUI": "Color(.systemRed)" }
    },
    "separator":   { "uiColor": "UIColor.separator",         "swiftUI": "Color(.separator)" }
  },
  "spacing": {
    "$unit": "points",
    "xs":  { "value": 4 },
    "sm":  { "value": 8 },
    "md":  { "value": 16 },
    "lg":  { "value": 24 },
    "xl":  { "value": 32 },
    "xxl": { "value": 48 }
  },
  "iconography": {
    "$note": "Use SF Symbols — reference by name. Always set accessibilityLabel.",
    "examples": {
      "add":      "plus",
      "remove":   "minus",
      "close":    "xmark",
      "back":     "chevron.left",
      "forward":  "chevron.right",
      "settings": "gearshape",
      "search":   "magnifyingglass",
      "share":    "square.and.arrow.up",
      "favorite": "heart",
      "error":    "exclamationmark.triangle"
    }
  },
  "cornerRadius": {
    "sm":  { "value": 6,  "unit": "points" },
    "md":  { "value": 12, "unit": "points" },
    "lg":  { "value": 16, "unit": "points" },
    "pill":{ "value": 9999, "unit": "points", "$note": "Use for capsule/pill shapes" }
  },
  "minTapTarget": {
    "value": 44,
    "unit": "points",
    "$note": "Apple HIG minimum: 44 x 44 pt for all interactive controls"
  }
}
```

- [ ] **Step 2: Verify tokens JSON is valid**

```bash
python3 -c "import json, sys; json.load(open('packs/swift-ios/design/tokens-template.json')); print('valid')"
```

Expected output: `valid`

- [ ] **Step 3: Create `packs/swift-ios/design/standards/hig-patterns.md`**

HIG alignment reference covering navigation patterns, control usage, modal presentation, typography hierarchy, and platform conventions. Target 60 lines.

```markdown
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
```

- [ ] **Step 4: Create `packs/swift-ios/design/standards/accessibility.md`**

iOS accessibility checklist covering VoiceOver, Dynamic Type, color contrast, motion sensitivity, and keyboard/switch control. Target 55 lines.

```markdown
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
```

---

### Task 5: Validation Script

**Files:**
- Create: `packs/swift-ios/scripts/check_module_deps.sh`

- [ ] **Step 1: Create `packs/swift-ios/scripts/check_module_deps.sh`**

Shell script that validates SPM module dependencies. Checks that no local package imports an application target (dependency must flow inward), that no two feature modules import each other directly (they must communicate via a coordinator/router in Core), and that all `Package.swift` local package targets are accounted for in the project. Works with any project that uses SPM local packages.

```bash
#!/usr/bin/env bash
# check_module_deps.sh — Validate Swift Package Manager module dependencies
#
# Usage: ./scripts/kdoc/swift-ios/check_module_deps.sh [--project-root <path>]
#
# Rules enforced:
#   1. Local packages must not import application targets.
#   2. Feature modules must not directly import other feature modules
#      (they communicate through Core/Navigation or a coordinator).
#   3. All targets declared in Package.swift files must be discoverable
#      (no ghost declarations).
#
# Exit codes: 0 = pass, 1 = violations found, 2 = usage error

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_ROOT="${1:-$(pwd)}"
PACKAGES_DIR="${PROJECT_ROOT}/Packages"
SOURCES_DIR="${PROJECT_ROOT}/Sources"
VIOLATIONS=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

pass()  { echo -e "${GREEN}[PASS]${NC} $*"; }
fail()  { echo -e "${RED}[FAIL]${NC} $*"; VIOLATIONS=$((VIOLATIONS + 1)); }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
info()  { echo "       $*"; }

# ---------------------------------------------------------------------------
# Rule 1: Local packages must not import application targets
# ---------------------------------------------------------------------------

echo ""
echo "Rule 1: Local packages must not import application targets"
echo "----------------------------------------------------------"

if [ ! -d "${PACKAGES_DIR}" ]; then
    warn "No Packages/ directory found — skipping Rule 1."
else
    # Collect application target names from Sources/ subdirectories
    APP_TARGETS=()
    if [ -d "${SOURCES_DIR}" ]; then
        while IFS= read -r dir; do
            APP_TARGETS+=("$(basename "$dir")")
        done < <(find "${SOURCES_DIR}" -mindepth 1 -maxdepth 1 -type d)
    fi

    if [ ${#APP_TARGETS[@]} -eq 0 ]; then
        warn "No application targets found in Sources/ — skipping Rule 1."
    else
        # Search for imports of application targets inside Packages/
        for target in "${APP_TARGETS[@]}"; do
            matches=$(grep -r --include="*.swift" "import ${target}" "${PACKAGES_DIR}" 2>/dev/null || true)
            if [ -n "$matches" ]; then
                fail "Package imports application target '${target}':"
                echo "$matches" | while IFS= read -r line; do info "$line"; done
            fi
        done
        [ $VIOLATIONS -eq 0 ] && pass "No local packages import application targets."
    fi
fi

# ---------------------------------------------------------------------------
# Rule 2: Feature modules must not directly import sibling feature modules
# ---------------------------------------------------------------------------

echo ""
echo "Rule 2: Feature modules must not directly import sibling feature modules"
echo "-------------------------------------------------------------------------"

MODULES_VIOLATIONS_BEFORE=$VIOLATIONS

if [ ! -d "${SOURCES_DIR}" ]; then
    warn "No Sources/ directory found — skipping Rule 2."
else
    # Find all Modules directories
    while IFS= read -r modules_dir; do
        target_name=$(basename "$(dirname "$modules_dir")")
        # Get list of feature module names
        module_names=()
        while IFS= read -r mod; do
            module_names+=("$(basename "$mod")")
        done < <(find "$modules_dir" -mindepth 1 -maxdepth 1 -type d)

        # For each module, check if it imports another sibling module
        for module in "${module_names[@]}"; do
            module_path="${modules_dir}/${module}"
            for sibling in "${module_names[@]}"; do
                [ "$module" = "$sibling" ] && continue
                matches=$(grep -r --include="*.swift" "import ${sibling}" "${module_path}" 2>/dev/null || true)
                if [ -n "$matches" ]; then
                    fail "Feature module '${module}' (in ${target_name}) imports sibling module '${sibling}':"
                    echo "$matches" | while IFS= read -r line; do info "$line"; done
                fi
            done
        done
    done < <(find "${SOURCES_DIR}" -type d -name "Modules")

    [ $VIOLATIONS -eq $MODULES_VIOLATIONS_BEFORE ] && pass "No direct sibling feature module imports detected."
fi

# ---------------------------------------------------------------------------
# Rule 3: All targets in Package.swift files must have a corresponding source directory
# ---------------------------------------------------------------------------

echo ""
echo "Rule 3: Package.swift target declarations match source directories"
echo "-------------------------------------------------------------------"

TARGETS_VIOLATIONS_BEFORE=$VIOLATIONS

while IFS= read -r pkg_file; do
    pkg_dir=$(dirname "$pkg_file")
    # Extract .target and .testTarget names (simple grep — not a full Swift parser)
    declared=$(grep -E '\.target\(|\.testTarget\(' "$pkg_file" \
        | grep -oE 'name:\s*"[^"]+"' \
        | grep -oE '"[^"]+"' \
        | tr -d '"' || true)

    for target_name in $declared; do
        # Source directories can be Sources/<name>/ or Tests/<name>/
        found=false
        for candidate in "${pkg_dir}/Sources/${target_name}" "${pkg_dir}/Tests/${target_name}"; do
            [ -d "$candidate" ] && found=true && break
        done
        if [ "$found" = false ]; then
            fail "Target '${target_name}' declared in ${pkg_file} has no source directory."
        fi
    done
done < <(find "${PROJECT_ROOT}" -name "Package.swift" -not -path "*/checkouts/*" -not -path "*/.build/*")

[ $VIOLATIONS -eq $TARGETS_VIOLATIONS_BEFORE ] && pass "All Package.swift targets have matching source directories."

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "================================================================"
if [ $VIOLATIONS -eq 0 ]; then
    echo -e "${GREEN}All checks passed.${NC}"
    exit 0
else
    echo -e "${RED}${VIOLATIONS} violation(s) found. Fix before merging.${NC}"
    exit 1
fi
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x packs/swift-ios/scripts/check_module_deps.sh
```

- [ ] **Step 3: Smoke-test the script**

Run the script against the kdoc repo itself (which has no Swift sources) to confirm it exits 0 and prints warnings rather than errors:

```bash
bash packs/swift-ios/scripts/check_module_deps.sh
```

Expected: three "WARN: No ... directory found" messages and exit code 0.

---

## Acceptance Criteria

- [ ] `packs/swift-ios/pack.json` is valid JSON and matches spec section 6.1 schema
- [ ] `pack.json` detection patterns cover `Package.swift`, `*.xcodeproj`, `*.xcworkspace`
- [ ] `pack.json` default scopes are `["App", "Shared"]`
- [ ] All 4 templates created; each between 30 and 65 lines
- [ ] `screen-spec.md` has VoiceOver, Dynamic Type, and tap-target accessibility checklist items
- [ ] `api-contract.md` uses `Codable` struct examples (not raw JSON)
- [ ] All 3 guides created; `module-placement.md` includes a visual decision tree
- [ ] `tokens-template.json` covers Dynamic Type scale (all 11 styles), semantic colors, spacing, SF Symbols, corner radius, and minimum tap target
- [ ] `tokens-template.json` is valid JSON
- [ ] `hig-patterns.md` covers navigation, controls, typography, lists, alerts
- [ ] `accessibility.md` covers VoiceOver, Dynamic Type, color/contrast, motion, keyboard/switch control
- [ ] `check_module_deps.sh` enforces 3 rules: no package→app import, no feature→feature import, Package.swift target directories exist
- [ ] Script exits 0 on clean project and 1 on violation
- [ ] Script is executable (`chmod +x`)

## Non-Goals

- Runtime Swift compilation or Xcode integration
- macOS-specific patterns (this pack is iOS-focused)
- CocoaPods-specific tooling (SPM is the default)
- UIKit-specific UIViewController lifecycle documentation (covered in HIG reference link)

## Dependencies

- Plan 3 (Core Content) — template format conventions and `{{PLACEHOLDER}}` syntax must be established first
- `cli/src/templates/renderer.ts` (Plan 1) — consumes `{{PLACEHOLDER}}` syntax in templates at install time
