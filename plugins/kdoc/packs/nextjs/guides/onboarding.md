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
