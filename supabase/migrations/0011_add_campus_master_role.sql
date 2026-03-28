do $$
begin
  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_role') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_role'
        and e.enumlabel = 'campus_master'
    ) then
      alter type public.user_role add value 'campus_master';
    end if;
  end if;

  if exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'user_tier') then
    if not exists (
      select 1
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      where t.typnamespace = 'public'::regnamespace
        and t.typname = 'user_tier'
        and e.enumlabel = 'campus_master'
    ) then
      alter type public.user_tier add value 'campus_master';
    end if;
  end if;
end
$$;
