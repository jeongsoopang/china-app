do $$
begin
  if to_regclass('public.announcements') is not null then
    alter table public.announcements
      add column if not exists image_urls text[] not null default '{}'::text[];
  end if;
end
$$;
