-- Phase 1 foundation schema for ForYou
-- This migration establishes the typed core entities used by mobile/admin scaffolds.

create extension if not exists "pgcrypto";

create type if not exists public.user_role as enum ('student', 'moderator', 'admin');
create type if not exists public.user_tier as enum ('bronze', 'silver', 'gold');
create type if not exists public.school_verification_status as enum (
  'code_requested',
  'pending_review',
  'verified',
  'rejected',
  'expired'
);
create type if not exists public.post_visibility as enum ('public', 'university_only');
create type if not exists public.post_status as enum ('active', 'hidden', 'removed');
create type if not exists public.comment_status as enum ('active', 'hidden', 'removed');
create type if not exists public.notification_type as enum (
  'post_liked',
  'comment_replied',
  'moderation_notice',
  'announcement',
  'system'
);
create type if not exists public.point_ledger_reason as enum (
  'post_created',
  'comment_created',
  'verification_approved',
  'moderation_penalty',
  'manual_adjustment'
);

create table if not exists public.universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  slug text not null unique,
  city text not null default 'Shanghai',
  country_code text not null default 'CN',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.university_domains (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint university_domains_university_id_domain_key unique (university_id, domain)
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  bio text,
  university_id uuid references public.universities(id) on delete set null,
  role public.user_role not null default 'student',
  tier public.user_tier not null default 'bronze',
  is_school_verified boolean not null default false,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid references public.universities(id) on delete set null,
  school_email text not null,
  status public.school_verification_status not null default 'code_requested',
  verification_code_hash text,
  code_requested_at timestamptz,
  code_expires_at timestamptz,
  verified_at timestamptz,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sections_university_id_slug_key unique (university_id, slug)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_section_id_slug_key unique (section_id, slug)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  university_id uuid not null references public.universities(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  visibility public.post_visibility not null default 'university_only',
  status public.post_status not null default 'active',
  is_anonymous boolean not null default false,
  comment_count integer not null default 0 check (comment_count >= 0),
  like_count integer not null default 0 check (like_count >= 0),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_comment_id uuid references public.comments(id) on delete set null,
  body text not null,
  is_anonymous boolean not null default false,
  status public.comment_status not null default 'active',
  like_count integer not null default 0 check (like_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  actor_id uuid references auth.users(id) on delete set null,
  post_id uuid references public.posts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  reason public.point_ledger_reason not null,
  reference_id uuid,
  note text,
  issued_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  balance_after integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_university_id on public.user_profiles(university_id);
create index if not exists idx_school_verifications_user_id on public.school_verifications(user_id);
create index if not exists idx_posts_author_id on public.posts(author_id);
create index if not exists idx_posts_university_id on public.posts(university_id);
create index if not exists idx_comments_post_id on public.comments(post_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_point_ledger_user_id on public.point_ledger(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_universities_updated_at on public.universities;
create trigger set_universities_updated_at
before update on public.universities
for each row
execute function public.set_updated_at();

drop trigger if exists set_university_domains_updated_at on public.university_domains;
create trigger set_university_domains_updated_at
before update on public.university_domains
for each row
execute function public.set_updated_at();

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_school_verifications_updated_at on public.school_verifications;
create trigger set_school_verifications_updated_at
before update on public.school_verifications
for each row
execute function public.set_updated_at();

drop trigger if exists set_sections_updated_at on public.sections;
create trigger set_sections_updated_at
before update on public.sections
for each row
execute function public.set_updated_at();

drop trigger if exists set_categories_updated_at on public.categories;
create trigger set_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

drop trigger if exists set_posts_updated_at on public.posts;
create trigger set_posts_updated_at
before update on public.posts
for each row
execute function public.set_updated_at();

drop trigger if exists set_comments_updated_at on public.comments;
create trigger set_comments_updated_at
before update on public.comments
for each row
execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

drop trigger if exists set_point_ledger_updated_at on public.point_ledger;
create trigger set_point_ledger_updated_at
before update on public.point_ledger
for each row
execute function public.set_updated_at();

-- Auth bootstrap assumption:
-- user_profiles row is inserted automatically when auth.users gets a new row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inferred_name text;
begin
  inferred_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1),
    'User'
  );

  insert into public.user_profiles (id, display_name)
  values (new.id, inferred_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- Minimal RLS bootstrap for authenticated users.
alter table public.user_profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'user_profiles_select_own'
  ) then
    create policy user_profiles_select_own
      on public.user_profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
      and policyname = 'user_profiles_update_own'
  ) then
    create policy user_profiles_update_own
      on public.user_profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end
$$;
