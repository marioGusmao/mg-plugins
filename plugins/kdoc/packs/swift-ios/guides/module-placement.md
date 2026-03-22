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
