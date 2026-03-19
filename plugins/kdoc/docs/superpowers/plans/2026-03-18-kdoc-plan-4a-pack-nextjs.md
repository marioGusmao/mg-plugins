# kdoc Plan 4A: Next.js Pack

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Next.js technology pack with pack manifest, templates, guides, design standards, and validation scripts.

**Architecture:** Pack content is namespaced under `packs/nextjs/`. When installed, content goes to `Knowledge/Templates/nextjs/`, `Knowledge/Guides/nextjs/`, `Knowledge/Design/nextjs/<scope>/`, and `scripts/kdoc/nextjs/`.

**Tech Stack:** Markdown templates, JSON manifest, TypeScript validation script

**Spec:** `docs/superpowers/specs/2026-03-17-kdoc-design.md` (Section 6.2)
**Depends on:** Plan 3 (Core Content — for template format conventions)

---

## File Structure

```
kdoc/
└── packs/
    └── nextjs/
        ├── pack.json
        ├── templates/
        │   ├── page-spec.md
        │   ├── flow-spec.md
        │   ├── route-contract.md
        │   └── recipe.md
        ├── guides/
        │   ├── onboarding.md
        │   ├── troubleshooting.md
        │   └── module-placement.md
        ├── design/
        │   ├── tokens-template.json
        │   └── standards/
        │       ├── ui-patterns.md
        │       ├── responsive-strategy.md
        │       └── accessibility.md
        └── scripts/
            └── check_route_contracts.ts
```

---

### Task 1: Pack Manifest (pack.json)

**Files:**
- Create: `packs/nextjs/pack.json`

- [ ] **Step 1: Create pack.json**

```json
{
  "name": "nextjs",
  "displayName": "Next.js",
  "description": "Next.js / React pack — page specs, route contracts, modular architecture templates, and design standards.",
  "detect": {
    "files": ["next.config.ts", "next.config.js", "next.config.mjs"],
    "dependencies": ["next"],
    "packageManager": ["pnpm", "npm", "yarn"]
  },
  "defaults": {
    "scopes": ["Admin", "Shop", "Shared"],
    "enforced-paths": [
      "apps/*/src/modules/",
      "apps/*/src/core/",
      "apps/*/src/app/api/",
      "packages/*/src/"
    ],
    "scripts-prefix": "kdoc",
    "scripts-runner": "pnpm"
  },
  "areas": {
    "design": {
      "subfolders": ["tokens", "standards"]
    }
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('packs/nextjs/pack.json', 'utf8')); console.log('pack.json valid')"
```

**Commit:** `feat(pack/nextjs): add pack manifest`

---

### Task 2: Templates

**Files:**
- Create: `packs/nextjs/templates/page-spec.md`
- Create: `packs/nextjs/templates/flow-spec.md`
- Create: `packs/nextjs/templates/route-contract.md`
- Create: `packs/nextjs/templates/recipe.md`

- [ ] **Step 1: Create page-spec.md**

Generalised from `Knowledge/Design/shop/page-specs/*.md` in AVShop2. Placeholders: `{{APP}}`, `{{PAGE_ID}}`, `{{PAGE_NAME}}`, `{{ROUTE}}`, `{{DATE}}`.

```markdown
---
type: page-spec
app: {{APP}}
id: {{PAGE_ID}}
status: draft
date: {{DATE}}
tags:
  - {{APP}}
summary: {{PAGE_NAME}} — page specification.
---

# {{PAGE_NAME}}

## Objective

<!-- What is this page for? Who does it serve? What is the primary user goal? -->

## Persona / Role

- **Primary persona**: <!-- e.g., Authenticated customer, Admin operator -->

## Related TLDR

<!-- Links to feature TLDRs that this page implements. Use wikilinks: [[TLDR/Scope/feature|Feature]] -->

## Route

`{{ROUTE}}`

## Layout Regions

### Header

<!-- Describe navigation, logo placement, auth state differences. -->

### Main Content

<!-- Primary content area — sections, cards, data displays. -->

### Footer

<!-- Footer links and copyright. -->

## Components Used

<!-- List of components rendered on this page and their source module. -->

## Interaction Rules

<!-- Describe all user interactions: clicks, form submissions, navigations. -->

## States

### Default

<!-- Happy path — all data loaded and visible. -->

### Loading

<!-- Skeleton placeholders — which regions show skeletons and how? -->

### Empty

<!-- No data to show — what is displayed instead? -->

### Error

<!-- Data fetch or action failure — how is the error surfaced? -->

## Validations

<!-- Form fields and their validation rules. "None" if no forms on this page. -->

## Accessibility Requirements

- Page has exactly one `<h1>`.
- Landmark elements: `<header>`, `<main>`, `<footer>`.
- Skip link present as first focusable element.
- All interactive elements have accessible labels.
- <!-- Add any page-specific a11y requirements. -->

## Responsive Behavior

| Viewport  | Layout            | Notes |
|-----------|-------------------|-------|
| Mobile    | Single column     |       |
| Tablet    | Two-column grid   |       |
| Desktop   | Multi-column grid |       |

## Acceptance Criteria

- [ ] Page renders at `{{ROUTE}}` with all layout regions visible.
- [ ] Loading state shows appropriate skeletons.
- [ ] Empty state is handled gracefully.
- [ ] Error state surfaces a meaningful message.
- [ ] Page is accessible: one `<h1>`, landmarks, skip link.
- [ ] Responsive layout correct across mobile / tablet / desktop.
```

- [ ] **Step 2: Create flow-spec.md**

Generalised from AVShop2 multi-step flow patterns (checkout, onboarding). Placeholders: `{{FLOW_NAME}}`, `{{APP}}`, `{{DATE}}`.

```markdown
---
type: flow-spec
app: {{APP}}
id: {{FLOW_NAME}}-flow
status: draft
date: {{DATE}}
tags:
  - {{APP}}
  - flow
summary: {{FLOW_NAME}} — multi-step user flow specification.
---

# {{FLOW_NAME}} Flow

## Objective

<!-- What does this flow accomplish? What is the user goal at completion? -->

## Entry Points

<!-- How does the user enter this flow? Which routes or triggers? -->

## Steps

### Step 1: <!-- Step Name -->

**Route:** `<!-- /path/to/step-1 -->`

**Purpose:** <!-- What does the user do here? -->

**Inputs:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| <!-- field --> | <!-- text/select/... --> | Yes/No | <!-- rule --> |

**Actions:**
- **Continue**: Validates inputs → proceeds to Step 2.
- **Back**: Returns to entry point (or previous step).
- **Cancel**: Abandons flow → redirect to `<!-- /path -->`.

**Error States:**
- Validation failure: inline field error below each invalid input.
- Server error: toast notification with retry option.

---

### Step 2: <!-- Step Name -->

<!-- Repeat the Step 1 structure for each step. -->

---

### Completion

**Route:** `<!-- /path/to/confirmation -->`

**Success state:** <!-- What does the user see on successful completion? -->

**Post-completion action:** <!-- Redirect, email sent, etc. -->

## State Persistence

<!-- How is flow state preserved if the user navigates away or refreshes? (URL params, session, server) -->

## Accessibility Requirements

- Focus moves to the first invalid field on validation failure.
- Step progress is communicated to screen readers (e.g., `aria-current="step"`).
- Each step page has a descriptive `<h1>` reflecting the current step.

## Acceptance Criteria

- [ ] User can complete all steps from entry to confirmation.
- [ ] Validation prevents progression with invalid inputs.
- [ ] Back navigation preserves previously entered data.
- [ ] Cancel exits the flow and redirects correctly.
- [ ] Completion state is shown after the final step.
```

- [ ] **Step 3: Create route-contract.md**

API Route Handler contract template, generalised from AVShop2 route patterns. Placeholders: `{{ROUTE_PATH}}`, `{{METHOD}}`, `{{MODULE}}`, `{{DATE}}`.

```markdown
---
type: route-contract
module: {{MODULE}}
status: draft
date: {{DATE}}
tags:
  - api
  - {{MODULE}}
summary: API contract for {{METHOD}} {{ROUTE_PATH}}.
---

# Route Contract: {{METHOD}} {{ROUTE_PATH}}

## Endpoint

| Property | Value |
|----------|-------|
| Method | `{{METHOD}}` |
| Path | `{{ROUTE_PATH}}` |
| Auth required | Yes / No |
| Auth type | <!-- Session cookie / API key / None --> |

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| <!-- param --> | string | Yes | <!-- description --> |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| <!-- param --> | string | No | — | <!-- description --> |

### Request Body (if POST/PUT/PATCH)

```json
{
  "field": "string (required)",
  "optionalField": "string (optional)"
}
```

**Zod schema:** `<!-- z.object({ field: z.string(), ... }) -->`

## Response

### 200 OK

```json
{
  "data": {}
}
```

### 400 Bad Request

```json
{ "error": "Validation failed", "details": [] }
```

### 401 Unauthorized

```json
{ "error": "Unauthorized" }
```

### 404 Not Found

```json
{ "error": "Not found" }
```

### 500 Internal Server Error

```json
{ "error": "Internal server error" }
```

## Implementation Notes

<!-- Route handler file: `apps/<app>/src/app/api/... /route.ts` -->
<!-- Uses `responseSchema` for contract enforcement. -->
<!-- Related Server Actions (if any): `modules/{{MODULE}}/actions/` -->

## Acceptance Criteria

- [ ] Returns correct status codes for all documented cases.
- [ ] Response shape matches the documented schemas.
- [ ] Auth check rejects unauthenticated requests when required.
- [ ] Input validation returns 400 with field-level errors.
```

- [ ] **Step 4: Create recipe.md**

Generalised recipe / runbook template for reusable patterns. Placeholders: `{{RECIPE_NAME}}`, `{{CATEGORY}}`, `{{DATE}}`.

```markdown
---
type: recipe
category: {{CATEGORY}}
status: draft
date: {{DATE}}
tags:
  - recipe
  - {{CATEGORY}}
summary: {{RECIPE_NAME}} — implementation recipe.
---

# Recipe: {{RECIPE_NAME}}

## Problem

<!-- What problem does this recipe solve? When should you use it? -->

## Solution

<!-- One-paragraph summary of the approach. -->

## Prerequisites

- <!-- e.g., `next-safe-action` installed -->
- <!-- e.g., Module exists with barrel file -->

## Steps

### 1. <!-- Step title -->

```typescript
// Code example
```

<!-- Explanation of what this step does and why. -->

### 2. <!-- Step title -->

```typescript
// Code example
```

<!-- Explanation. -->

## Verification

```bash
# Command to verify the recipe is working correctly
pnpm lint && pnpm typecheck
```

## Related

- <!-- Link to relevant ADR, TLDR, or other recipe -->

## Caveats

<!-- Limitations, edge cases, or known issues with this approach. -->
```

**Commit:** `feat(pack/nextjs): add templates (page-spec, flow-spec, route-contract, recipe)`

---

### Task 3: Guides

**Files:**
- Create: `packs/nextjs/guides/onboarding.md`
- Create: `packs/nextjs/guides/troubleshooting.md`
- Create: `packs/nextjs/guides/module-placement.md`

- [ ] **Step 1: Create onboarding.md**

Generalised from `Knowledge/Guides/ONBOARDING.md` in AVShop2. Placeholders: `{{PROJECT_NAME}}`, `{{SHOP_PORT}}`, `{{ADMIN_PORT}}`, `{{NODE_MIN_VERSION}}`, `{{PACKAGE_MANAGER}}`.

```markdown
---
type: guide
category: onboarding
status: ready
tags: [onboarding, setup, getting-started]
summary: Task-oriented onboarding guide — from zero to first commit in a Next.js project.
---

# Onboarding Guide

Get from zero to your first commit in {{PROJECT_NAME}}.

## 1. Quick Start

```bash
# Clone and install
git clone <repo-url> && cd {{PROJECT_NAME}}
{{PACKAGE_MANAGER}} install

# Start development servers
{{PACKAGE_MANAGER}} dev
# App: http://localhost:{{SHOP_PORT}}
```

**Prerequisites:**

- Node.js >= {{NODE_MIN_VERSION}}
- {{PACKAGE_MANAGER}} (see `packageManager` in `package.json`)

## 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in required values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | Auth secret (generate with `openssl rand -base64 32`) |

## 3. Your First Code Change

1. **Create a branch** (check project policy first):
   ```bash
   git checkout -b feature/your-description
   ```

2. **Write code** following these rules:
   - Cross-module imports go through barrel files (`index.ts`)
   - Server Actions in `modules/*/actions/` with `'use server'` directive
   - Route Handlers in `app/api/` only
   - `"use client"` pushed as low as possible in component tree

3. **Validate before committing:**
   ```bash
   {{PACKAGE_MANAGER}} lint && {{PACKAGE_MANAGER}} typecheck && {{PACKAGE_MANAGER}} test
   ```

## 4. Key Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Next.js configuration |
| `tailwind.config.ts` | Tailwind CSS configuration |
| `drizzle.config.ts` | Database ORM configuration |
| `Knowledge/ContextPack.md` | Project quick-start context |

## 5. Common Commands

| Command | Description |
|---------|-------------|
| `{{PACKAGE_MANAGER}} dev` | Start development server |
| `{{PACKAGE_MANAGER}} build` | Production build |
| `{{PACKAGE_MANAGER}} lint` | ESLint with boundary rules |
| `{{PACKAGE_MANAGER}} typecheck` | TypeScript check |
| `{{PACKAGE_MANAGER}} test` | Run unit tests |
| `{{PACKAGE_MANAGER}} db:migrate` | Run database migrations |
```

- [ ] **Step 2: Create troubleshooting.md**

Generalised from `Knowledge/Guides/TROUBLESHOOTING.md` in AVShop2.

```markdown
---
type: guide
category: troubleshooting
status: ready
tags: [troubleshooting, errors, debugging]
summary: Symptom-cause-fix lookup for common Next.js project errors.
---

# Troubleshooting Guide

Find your symptom, understand the cause, apply the fix.

## Build & TypeScript

### `Module not found: Can't resolve '@/modules/<name>'`

- **Cause:** Import bypasses barrel file or module does not exist.
- **Fix:** Import from `@/modules/<name>` (barrel), not deep paths. Run `pnpm lint` for boundary violations.

### `Type error: Property '...' does not exist on type 'never'`

- **Cause:** Zod schema inferred type is `never` — usually a schema composition error.
- **Fix:** Check `z.union()` / `z.discriminatedUnion()` discriminant fields. Ensure all branches share the discriminant.

### `pnpm build` fails with `Dynamic server usage` error

- **Cause:** A component using `headers()`, `cookies()`, or `searchParams` is rendered in a statically cached segment.
- **Fix:** Add `export const dynamic = 'force-dynamic'` to the route segment, or wrap the component in `<Suspense>`.

## Database

### Migrations hang or fail silently

- **Cause:** ORM config uses a pooled connection (transaction mode) instead of a direct connection for DDL.
- **Fix:** Ensure `drizzle.config.ts` (or equivalent) uses the direct database URL (session mode / port 5432). Pooled connections cannot run DDL.

### Changes in schema not reflected after migration

- **Cause:** Migration not applied, or dev server cache is stale.
- **Fix:** Run `pnpm db:migrate` then restart the dev server with a hard cache reset (`pnpm dev` after clearing `.next/`).

## Auth

### Session is `null` after sign-in

- **Cause:** Auth callback URL mismatch or cookie `secure` flag set in HTTP dev environment.
- **Fix:** Verify `NEXTAUTH_URL` (or equivalent) matches the actual dev URL. Check that `sameSite` and `secure` cookie settings are compatible with `http://localhost`.

### Middleware redirects in a loop

- **Cause:** The middleware's `matcher` does not exclude the auth routes themselves.
- **Fix:** Add auth routes to the matcher exclusion list. Ensure the `isPublic` check covers all auth-related paths.

## Architecture Boundaries

### ESLint boundary error: `import of X is not allowed`

- **Cause:** Direct import into a cross-module path, bypassing the barrel file.
- **Fix:** Import from `@/modules/<name>` barrel only. Never import from `@/modules/<name>/components/X` directly.

### Circular dependency detected by dependency-cruiser

- **Cause:** Module A imports from module B which imports from module A.
- **Fix:** Extract shared logic to a third module or to `core/`. Map the dependency graph before refactoring.
```

- [ ] **Step 3: Create module-placement.md**

Decision tree for file placement in a modular Next.js project.

```markdown
---
type: guide
category: architecture
status: ready
tags: [architecture, module-placement, file-placement]
summary: Decision tree for placing new files in a modular Next.js project.
---

# Module Placement Guide

Use this decision tree to determine where a new file belongs.

## Decision Tree

```
Is this a UI route (page, layout)?
├─ YES → app/<route>/page.tsx  (thin: compose from modules)
│        app/<route>/layout.tsx
│
└─ NO → Is this business logic for a specific domain?
        ├─ YES → Which layer?
        │        ├─ React component      → modules/<name>/components/
        │        ├─ React hook           → modules/<name>/hooks/
        │        ├─ Server Action        → modules/<name>/actions/  ('use server')
        │        ├─ Pure business logic  → modules/<name>/services/
        │        ├─ TypeScript types     → modules/<name>/types/
        │        └─ Internal helpers     → modules/<name>/utils/
        │        (Export from modules/<name>/index.ts)
        │
        └─ NO → Is this shared app infrastructure (not domain-specific)?
                ├─ YES → core/components/   (layout, primitives)
                │        core/hooks/        (global hooks)
                │        core/config/       (constants, env)
                │        core/api/          (HTTP client helpers)
                │
                └─ NO → Is this shared across multiple apps?
                        ├─ YES → packages/<shared-package>/src/
                        └─ NO → Re-evaluate: most code belongs in a module.
```

## Placement Rules

| File type | Location | Notes |
|-----------|----------|-------|
| `page.tsx` | `app/<route>/page.tsx` | Thin — compose components from modules |
| `layout.tsx` | `app/<route>/layout.tsx` | App shell, auth guards |
| `route.ts` (API) | `app/api/<segment>/route.ts` | Business logic only — no HTML |
| Server Action | `modules/<name>/actions/*.ts` | Must have `'use server'` |
| React component | `modules/<name>/components/` | Server or client |
| React hook | `modules/<name>/hooks/` | Client only |
| Service function | `modules/<name>/services/` | Pure functions, no React |
| Types | `modules/<name>/types/` | Module-local types |
| Shared component | `packages/shared-ui/src/` | Used by 2+ apps |
| Shared type/constant | `packages/shared-types/src/` | DTOs, enums, constants only |

## Import Rules

- Cross-module imports: through `index.ts` barrel only.
- `page.tsx` → module: `import { X } from '@/modules/<name>'`
- Module → module: `import { Y } from '@/modules/<other>'` (barrel)
- Module → shared package: `import { Z } from '@shared-ui'`
- FORBIDDEN: module A → module B bypassing barrel
- FORBIDDEN: shared package → app module

## New Module Checklist

- [ ] Created with generator: `pnpm module:new --app <app> --name <name>`
- [ ] Has `index.ts` barrel file
- [ ] Exports only public surface through barrel
- [ ] Has corresponding TLDR in `Knowledge/TLDR/<scope>/<name>.md`
```

**Commit:** `feat(pack/nextjs): add guides (onboarding, troubleshooting, module-placement)`

---

### Task 4: Design Standards + Tokens

**Files:**
- Create: `packs/nextjs/design/tokens-template.json`
- Create: `packs/nextjs/design/standards/ui-patterns.md`
- Create: `packs/nextjs/design/standards/responsive-strategy.md`
- Create: `packs/nextjs/design/standards/accessibility.md`

- [ ] **Step 1: Create tokens-template.json**

DTCG-format design tokens starter, generalised from `Knowledge/Design/tokens/base.json` in AVShop2.

```json
{
  "$schema": "https://tr.designtokens.org/format/",
  "$description": "Design tokens for {{PROJECT_NAME}}. Edit values to match your brand. Token names follow DTCG format ($value, $type, $description).",
  "color": {
    "brand": {
      "primary": {
        "$value": "#7C3AED",
        "$type": "color",
        "$description": "Primary brand color — CTAs, links, active states"
      },
      "secondary": {
        "$value": "#A78BFA",
        "$type": "color",
        "$description": "Secondary brand color — accents, highlights"
      },
      "accent": {
        "$value": "#FF6D5A",
        "$type": "color",
        "$description": "Accent — badges, promotions, attention elements"
      }
    },
    "semantic": {
      "success": { "$value": "#16A34A", "$type": "color", "$description": "Success states" },
      "warning": { "$value": "#EAB308", "$type": "color", "$description": "Warning states" },
      "error":   { "$value": "#DC2626", "$type": "color", "$description": "Error states" },
      "info":    { "$value": "#0EA5E9", "$type": "color", "$description": "Informational states" }
    },
    "neutral": {
      "gray-50":  { "$value": "#F9FAFB", "$type": "color" },
      "gray-100": { "$value": "#F3F4F6", "$type": "color" },
      "gray-200": { "$value": "#E5E7EB", "$type": "color" },
      "gray-400": { "$value": "#9CA3AF", "$type": "color" },
      "gray-700": { "$value": "#374151", "$type": "color" },
      "gray-900": { "$value": "#111827", "$type": "color" }
    }
  },
  "spacing": {
    "1":  { "$value": "4px",   "$type": "dimension" },
    "2":  { "$value": "8px",   "$type": "dimension" },
    "4":  { "$value": "16px",  "$type": "dimension" },
    "6":  { "$value": "24px",  "$type": "dimension" },
    "8":  { "$value": "32px",  "$type": "dimension" },
    "12": { "$value": "48px",  "$type": "dimension" },
    "16": { "$value": "64px",  "$type": "dimension" },
    "20": { "$value": "80px",  "$type": "dimension" }
  },
  "typography": {
    "fontFamily": {
      "sans": { "$value": "Inter, ui-sans-serif, system-ui, sans-serif", "$type": "fontFamily" },
      "mono": { "$value": "ui-monospace, SFMono-Regular, monospace", "$type": "fontFamily" }
    },
    "fontSize": {
      "xs":  { "$value": "12px", "$type": "dimension" },
      "sm":  { "$value": "14px", "$type": "dimension" },
      "base":{ "$value": "16px", "$type": "dimension" },
      "lg":  { "$value": "18px", "$type": "dimension" },
      "xl":  { "$value": "20px", "$type": "dimension" },
      "2xl": { "$value": "24px", "$type": "dimension" },
      "4xl": { "$value": "36px", "$type": "dimension" },
      "6xl": { "$value": "60px", "$type": "dimension" }
    },
    "fontWeight": {
      "regular":  { "$value": "400", "$type": "fontWeight" },
      "medium":   { "$value": "500", "$type": "fontWeight" },
      "semibold": { "$value": "600", "$type": "fontWeight" },
      "bold":     { "$value": "700", "$type": "fontWeight" }
    }
  },
  "borderRadius": {
    "sm":   { "$value": "4px",   "$type": "dimension" },
    "md":   { "$value": "8px",   "$type": "dimension" },
    "lg":   { "$value": "12px",  "$type": "dimension" },
    "full": { "$value": "9999px","$type": "dimension" }
  },
  "shadow": {
    "sm": { "$value": "0 1px 2px 0 rgba(0,0,0,0.05)", "$type": "shadow" },
    "md": { "$value": "0 4px 6px -1px rgba(0,0,0,0.1)", "$type": "shadow" },
    "lg": { "$value": "0 10px 15px -3px rgba(0,0,0,0.1)", "$type": "shadow" }
  },
  "breakpoint": {
    "sm":  { "$value": "640px",  "$type": "dimension", "$description": "Small — large phones in landscape" },
    "md":  { "$value": "768px",  "$type": "dimension", "$description": "Medium — tablets portrait, 2-column layouts" },
    "lg":  { "$value": "1024px", "$type": "dimension", "$description": "Large — laptops, full multi-column" },
    "xl":  { "$value": "1280px", "$type": "dimension", "$description": "Extra large — standard desktops" },
    "2xl": { "$value": "1536px", "$type": "dimension", "$description": "2x large — wide monitors" }
  }
}
```

- [ ] **Step 2: Create ui-patterns.md**

Generalised from `Knowledge/Design/standards/ui-patterns.md` in AVShop2.

```markdown
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
```

- [ ] **Step 3: Create responsive-strategy.md**

Generalised from `Knowledge/Design/standards/responsive-strategy.md` in AVShop2.

```markdown
---
type: design-standard
id: responsive-strategy
status: active
tags: [design, responsive, mobile-first, layout]
summary: Breakpoint definitions, mobile-first approach, and responsive layout rules.
---

# Responsive Strategy

## Mobile-First Approach

Base styles target the smallest viewport (320px minimum). Larger layouts are progressive enhancements applied via `min-width` breakpoints. Content is never hidden from mobile users — layout adapts presentation, not availability.

In Tailwind CSS, write classes without prefixes for mobile, add prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) for larger viewports.

## Breakpoints

| Token | Name | Width | Primary Use |
|-------|------|-------|-------------|
| — | Base (mobile) | < 640px | Single-column, stacked content, full-width |
| `breakpoint.sm` | Small | 640px | Large phones landscape, minor adjustments |
| `breakpoint.md` | Medium | 768px | Tablets portrait, 2-column layouts begin |
| `breakpoint.lg` | Large | 1024px | Laptops, multi-column layouts |
| `breakpoint.xl` | Extra Large | 1280px | Standard desktops, max container width |
| `breakpoint.2xl` | 2x Large | 1536px | Wide monitors, full-width data tables |

## Layout Rules

### Containers

- Max content width: `1280px` (align with `breakpoint.xl`).
- Horizontal padding: `spacing.4` (mobile), `spacing.8` (tablet+).
- Centered with `margin: 0 auto`.

### Grid

- Mobile: 1 column (default)
- Tablet (`md`): 2 columns (cards, forms)
- Desktop (`lg`): up to 12-column grid (complex layouts)

### Navigation

| Viewport | Pattern |
|----------|---------|
| Mobile | Bottom navigation bar or hamburger menu |
| Tablet | Collapsible sidebar or top navigation |
| Desktop | Full sidebar or header navigation |

## Touch Targets

- Minimum 44×44px for all interactive elements (WCAG 2.5.5).
- Minimum 48×48px recommended for primary CTAs.
- Adequate spacing between adjacent targets to prevent mis-taps.

## Images

- Use `next/image` with `priority` for above-the-fold images (LCP).
- Provide explicit `width` and `height` to prevent layout shift (CLS).
- Use `sizes` attribute to serve appropriately-sized images per viewport.

## Testing

1. Test mobile first — verify the experience is complete before larger viewports.
2. Test at each defined breakpoint (not just endpoints).
3. Test landscape orientation on mobile (constrain tall elements to `max-height: 50vh`).
4. Verify with keyboard-only navigation at all breakpoints.
```

- [ ] **Step 4: Create accessibility.md**

Generalised from `Knowledge/Design/ACCESSIBILITY.md` in AVShop2.

```markdown
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
```

**Commit:** `feat(pack/nextjs): add design standards and tokens template`

---

### Task 5: Validation Script

**Files:**
- Create: `packs/nextjs/scripts/check_route_contracts.ts`

- [ ] **Step 1: Create check_route_contracts.ts**

Validates that Next.js route handlers in `app/api/` have a declared `responseSchema`. Reads `.kdoc.yaml` for `enforced-paths` to scope which paths are checked. Exits with a non-zero code if violations are found (suitable for CI).

```typescript
#!/usr/bin/env tsx
/**
 * check_route_contracts.ts
 *
 * Validates that Next.js Route Handlers in enforced API paths declare a
 * `responseSchema` (Zod schema) for contract enforcement.
 *
 * Usage:
 *   npx tsx scripts/kdoc/nextjs/check_route_contracts.ts
 *   npx tsx scripts/kdoc/nextjs/check_route_contracts.ts --dry-run
 *
 * Reads .kdoc.yaml to determine enforced paths.
 * Exits 0 if all route handlers have contracts, 1 if violations found.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse as parseYaml } from "yaml";
import fg from "fast-glob";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface KdocConfig {
  root?: string;
  governance?: {
    "enforced-paths"?: string[];
  };
}

interface Violation {
  file: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadConfig(cwd: string): KdocConfig {
  const configPath = join(cwd, ".kdoc.yaml");
  if (!existsSync(configPath)) {
    console.warn("[check_route_contracts] .kdoc.yaml not found — using defaults.");
    return {};
  }
  return parseYaml(readFileSync(configPath, "utf8")) as KdocConfig;
}

function resolveApiGlobs(config: KdocConfig, cwd: string): string[] {
  const enforcedPaths = config.governance?.["enforced-paths"] ?? [
    "apps/*/src/app/api/",
  ];

  // Convert enforced-paths entries that look like app/api paths into route globs.
  // Only paths containing "app/api" are relevant for route contract checking.
  const apiPaths = enforcedPaths.filter((p) => p.includes("app/api"));

  if (apiPaths.length === 0) {
    // Fall back to common default if none of the enforced-paths are API paths.
    return ["apps/*/src/app/api/**/route.ts"];
  }

  return apiPaths.map((p) => {
    // Normalise: strip trailing slash, append the route file glob.
    const base = p.replace(/\/$/, "");
    return `${base}/**/route.ts`;
  });
}

// ---------------------------------------------------------------------------
// Contract detection
// ---------------------------------------------------------------------------

const RESPONSE_SCHEMA_PATTERN = /responseSchema\s*[:=]/;
const HANDLER_PATTERN = /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/;

function checkFile(filePath: string): Violation | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return { file: filePath, reason: "Could not read file" };
  }

  // Only check files that actually export a route handler method.
  if (!HANDLER_PATTERN.test(content)) {
    return null; // Not a route handler — skip.
  }

  if (!RESPONSE_SCHEMA_PATTERN.test(content)) {
    return {
      file: filePath,
      reason: "No `responseSchema` declaration found. Route handlers must declare a Zod response schema for contract enforcement.",
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const cwd = process.cwd();

  const config = loadConfig(cwd);
  const globs = resolveApiGlobs(config, cwd);

  console.log("[check_route_contracts] Scanning route handlers...");
  if (dryRun) console.log("[check_route_contracts] Dry-run mode — no exit code enforcement.");

  const files = await fg(globs, { cwd, absolute: true });

  if (files.length === 0) {
    console.log("[check_route_contracts] No route files found. Nothing to check.");
    process.exit(0);
  }

  const violations: Violation[] = [];

  for (const file of files) {
    const violation = checkFile(file);
    if (violation) violations.push(violation);
  }

  const checkedCount = files.length;
  const violationCount = violations.length;

  if (violationCount === 0) {
    console.log(`[check_route_contracts] All ${checkedCount} route handler(s) have response contracts. ✓`);
    process.exit(0);
  }

  console.error(`\n[check_route_contracts] ${violationCount} violation(s) found:\n`);
  for (const v of violations) {
    const relativePath = v.file.replace(resolve(cwd) + "/", "");
    console.error(`  ✗ ${relativePath}`);
    console.error(`    ${v.reason}\n`);
  }
  console.error(`[check_route_contracts] ${violationCount}/${checkedCount} route handler(s) missing contracts.\n`);

  if (!dryRun) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("[check_route_contracts] Unexpected error:", err);
  process.exit(2);
});
```

- [ ] **Step 2: Verify the script compiles without errors**

```bash
cd /path/to/kdoc && npx tsc --noEmit --strict --esModuleInterop --moduleResolution bundler --target ES2022 packs/nextjs/scripts/check_route_contracts.ts 2>&1 || echo "Note: compile check requires fast-glob and yaml types to be installed in the CLI package"
```

**Commit:** `feat(pack/nextjs): add check_route_contracts validation script`

---

## Summary

| Task | Files | Status |
|------|-------|--------|
| 1. Manifest | `pack.json` | - [ ] |
| 2. Templates | `page-spec.md`, `flow-spec.md`, `route-contract.md`, `recipe.md` | - [ ] |
| 3. Guides | `onboarding.md`, `troubleshooting.md`, `module-placement.md` | - [ ] |
| 4. Design | `tokens-template.json`, `ui-patterns.md`, `responsive-strategy.md`, `accessibility.md` | - [ ] |
| 5. Script | `check_route_contracts.ts` | - [ ] |

**Total files created: 13**

## Acceptance Criteria

- [ ] `packs/nextjs/pack.json` is valid JSON with detection config for `next.config.{ts,js,mjs}` and `"next"` in deps.
- [ ] `pack.json` declares default scopes `[Admin, Shop, Shared]` and default enforced-paths.
- [ ] All 4 templates exist and contain placeholder syntax (`{{KEY}}`).
- [ ] Templates are 30–60 lines focused — starters, not comprehensive docs.
- [ ] All 3 guides exist and are structured (frontmatter + headings).
- [ ] `tokens-template.json` is valid JSON following DTCG token format.
- [ ] All 3 design standards exist and match the categories: ui-patterns, responsive, accessibility.
- [ ] `check_route_contracts.ts` exits 0 when all route handlers have `responseSchema`, exits 1 when violations found.
- [ ] Validation script reads `.kdoc.yaml` to determine which paths to scan.
- [ ] No content references AVShop2-specific values (all placeholders or generalized examples).
