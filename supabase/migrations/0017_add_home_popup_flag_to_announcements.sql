do $$
begin
  if to_regclass('public.announcements') is not null then
    alter table public.announcements
      add column if not exists is_home_popup boolean not null default false;
  end if;
end
$$;
