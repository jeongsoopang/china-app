# ForYou Monorepo

Production-oriented monorepo scaffold for **ForYou**, an iOS-first student community platform for Shanghai universities.

## Stack

- Monorepo: `pnpm` workspaces + `Turborepo`
- Mobile: Expo + React Native + TypeScript + Expo Router
- Admin: Next.js + TypeScript + App Router
- Backend target: Supabase (`supabase/migrations`, `supabase/functions`)

## Repository Structure

```txt
apps/
  admin/      # Next.js admin panel
  mobile/     # Expo mobile app
packages/
  config/     # Shared config package
  supabase/   # Shared Supabase client helpers
  types/      # Shared TypeScript types
  ui/         # Shared UI primitives/components
  utils/      # Shared utilities
supabase/
  migrations/ # SQL migrations
  functions/  # Edge functions
docs/         # Product and engineering docs
```

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
pnpm install
cp .env.example .env
```

Run all apps in development:

```bash
pnpm dev
```

Run only mobile app:

```bash
pnpm --filter @foryou/mobile dev
```

Run only admin app:

```bash
pnpm --filter @foryou/admin dev
```

## Environment

- Root: `.env.example`
- Mobile: `apps/mobile/.env.example`
- Admin: `apps/admin/.env.example`

Supabase client setup is shared in `packages/supabase/src` and consumed by:
- Mobile: `apps/mobile/src/lib/supabase/client.ts`
- Admin (public): `apps/admin/lib/supabase/client.ts`
- Admin (server + service): `apps/admin/lib/supabase/server.ts`

## Supabase Foundation

- Core schema migration: `supabase/migrations/0002_phase1_foundation.sql`
- Generated-style database typing: `packages/types/src/db/database.ts`
- Row model aliases: `packages/types/src/db/models.ts`
- Auth bootstrap helper (password sign-in + current profile fetch): `packages/supabase/src/auth-bootstrap.ts`
- Current user abstraction: `packages/supabase/src/current-user.ts`

Auth assumption for Phase 1:
- A `public.user_profiles` row is auto-created by DB trigger whenever a new `auth.users` row is inserted.
- If profile bootstrap fails, current-user fetch throws `MissingUserProfileError`.

Planned rule hooks (not implemented yet):
- Bronze: 1 question per 24 hours
- Silver: automatic upgrade after school verification
- Posting restriction: own university only
- Delayed point issuance

## Quality Commands

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Notes

- This scaffold intentionally excludes business logic and feature implementation.
- Shared packages are initialized as placeholders for incremental build-out.
