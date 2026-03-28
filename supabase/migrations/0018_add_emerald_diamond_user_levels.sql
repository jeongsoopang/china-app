do $$
begin
  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_role') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_role'
        and e.enumlabel = 'emerald'
    ) then
      alter type public.user_role add value 'emerald' after 'gold';
    end if;

    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_role'
        and e.enumlabel = 'diamond'
    ) then
      alter type public.user_role add value 'diamond' after 'emerald';
    end if;
  end if;

  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_tier') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_tier'
        and e.enumlabel = 'emerald'
    ) then
      alter type public.user_tier add value 'emerald' after 'gold';
    end if;

    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_tier'
        and e.enumlabel = 'diamond'
    ) then
      alter type public.user_tier add value 'diamond' after 'emerald';
    end if;
  end if;

  if to_regclass('public.user_profiles') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'role'
    ) then
      update public.user_profiles
      set role = 'diamond'
      where role::text = 'platinum';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user_profiles'
        and column_name = 'tier'
    ) then
      update public.user_profiles
      set tier = 'diamond'
      where tier::text = 'platinum';
    end if;
  end if;
end
$$;
