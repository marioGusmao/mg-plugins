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

In Xcode toolbar: choose `<SchemeName>` → pick a simulator (e.g. iPhone 16 Pro, iOS 18.x) → press the Run button.

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
