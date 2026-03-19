---
name: kdoc:design-create-spec
description: Create a design specification (page spec, screen spec, or flow spec) for a UI component or user flow. Detects the active pack and uses the correct template.
metadata:
  filePattern: "Knowledge/Design/**/*.md"
  bashPattern: "kdoc create"
---

# kdoc:design-create-spec — Create Design Specification

Use this skill when the user asks to create a page spec, screen spec, or flow spec.

## When to Use

- "create page spec" / "create screen spec" / "design spec for <X>"
- "spec the checkout flow" / "document the onboarding flow"
- "create route contract for <API endpoint>"

## Pack Detection

Check `.kdoc.yaml` for the active pack(s):
- `nextjs` — use `page-spec.md` or `flow-spec.md` from `Knowledge/Templates/nextjs/`
- `swift-ios` — use `screen-spec.md` or `flow-spec.md` from `Knowledge/Templates/swift-ios/`
- Multi-pack — ask the user which platform this spec is for.

If no pack template is found, report clearly: "Pack template not installed. Run `npx kdoc add-pack <pack>` first." Do not silently produce an empty document.

## Output Path Convention

Design specs are always namespaced by pack:
- nextjs page: `Knowledge/Design/nextjs/{scope}/{page-name}.md`
- nextjs flow: `Knowledge/Design/nextjs/{scope}/{flow-name}-flow.md`
- swift-ios screen: `Knowledge/Design/swift-ios/{scope}/{screen-name}.md`
- swift-ios flow: `Knowledge/Design/swift-ios/{scope}/{flow-name}-flow.md`

The scope is the app area (e.g., `admin`, `shop`, `app`, `shared`).

## Workflow

1. Detect pack from `.kdoc.yaml`.
2. Ask (or infer from context): spec type (page/screen/flow), scope, name.
3. Read the appropriate template from `Knowledge/Templates/{pack}/`.
4. Fill in available fields from context; leave unfilled sections as placeholders.
5. Write to the correct path under `Knowledge/Design/{pack}/{scope}/`.

## nextjs Page Spec Template Fields

| Field | Description |
|-------|-------------|
| Route | URL path (e.g., `/admin/coupons`) |
| Layout | Which layout wraps this page |
| Components | List of main components |
| Data sources | Server Actions or API calls |
| Tokens | Design tokens used |
| Responsive | Breakpoint behavior |
| Accessibility | WCAG requirements |

## swift-ios Screen Spec Template Fields

| Field | Description |
|-------|-------------|
| Navigation | How the user arrives at this screen |
| Components | UIKit/SwiftUI components |
| State | Screen state variants |
| Accessibility | VoiceOver / Dynamic Type |

## Related Skills

- `kdoc:tldr-create` — create requirements doc alongside spec
- `kdoc:governance-check` — validates Design area structure
