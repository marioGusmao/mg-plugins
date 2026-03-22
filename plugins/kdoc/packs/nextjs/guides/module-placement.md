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
