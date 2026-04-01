-- Security hardening for Supabase Security Advisor findings:
-- 1) Enable RLS on public content tables and add read policies aligned with app usage.
-- 2) Fix mutable search_path on public functions by forcing search_path=public.

alter table if exists public.home_guide_content enable row level security;
alter table if exists public.church_page_content enable row level security;
alter table if exists public.university_alumni_content enable row level security;
alter table if exists public.event_page_banners enable row level security;
alter table if exists public.event_page_sponsors enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'home_guide_content'
      and policyname = 'home_guide_content_public_read_visible'
  ) then
    create policy home_guide_content_public_read_visible
      on public.home_guide_content
      for select
      to anon, authenticated
      using (id = 1 and coalesce(is_visible, true) = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_page_content'
      and policyname = 'church_page_content_public_read'
  ) then
    create policy church_page_content_public_read
      on public.church_page_content
      for select
      to anon, authenticated
      using (id = 1);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_page_content'
      and policyname = 'church_page_content_church_master_insert'
  ) then
    create policy church_page_content_church_master_insert
      on public.church_page_content
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.user_profiles up
          where up.id = auth.uid()
            and up.role in ('church_master', 'grandmaster', 'master')
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'church_page_content'
      and policyname = 'church_page_content_church_master_update'
  ) then
    create policy church_page_content_church_master_update
      on public.church_page_content
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.user_profiles up
          where up.id = auth.uid()
            and up.role in ('church_master', 'grandmaster', 'master')
        )
      )
      with check (
        exists (
          select 1
          from public.user_profiles up
          where up.id = auth.uid()
            and up.role in ('church_master', 'grandmaster', 'master')
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_page_banners'
      and policyname = 'event_page_banners_public_read_active'
  ) then
    create policy event_page_banners_public_read_active
      on public.event_page_banners
      for select
      to anon, authenticated
      using (coalesce(is_active, true) = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'event_page_sponsors'
      and policyname = 'event_page_sponsors_public_read_active'
  ) then
    create policy event_page_sponsors_public_read_active
      on public.event_page_sponsors
      for select
      to anon, authenticated
      using (coalesce(is_active, true) = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'university_alumni_content'
      and policyname = 'university_alumni_content_same_university_read'
  ) then
    create policy university_alumni_content_same_university_read
      on public.university_alumni_content
      for select
      to authenticated
      using (
        coalesce(is_visible, true) = true
        and exists (
          select 1
          from public.user_profiles up
          where up.id = auth.uid()
            and up.verified_university_id is not null
            and up.verified_university_id = university_alumni_content.university_id
        )
      );
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as regproc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'set_updated_at',
        'normalize_school_email',
        'normalize_user_school_verification_email',
        'enforce_verified_school_email_limit',
        'current_user_role',
        'current_user_university_id',
        'is_master',
        'is_signed_in'
      )
  loop
    execute format('alter function %s set search_path = public', r.regproc);
  end loop;
end
$$;
