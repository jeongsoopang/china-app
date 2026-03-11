# Supabase

This directory stores Supabase SQL migrations and Edge Functions.

## Current Foundation

- `migrations/0002_phase1_foundation.sql` defines the Phase 1 schema.
- Includes auth bootstrap trigger: new `auth.users` rows auto-create `public.user_profiles`.
- Includes placeholder-ready fields for later rules:
  - `user_profiles.tier` (bronze/silver/gold/platinum)
  - `posts.university_id` (own-university restriction)
  - `point_ledger.available_at` (delayed issuance window)
