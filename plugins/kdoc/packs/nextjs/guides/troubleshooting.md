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
