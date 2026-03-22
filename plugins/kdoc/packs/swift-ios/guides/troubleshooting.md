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
