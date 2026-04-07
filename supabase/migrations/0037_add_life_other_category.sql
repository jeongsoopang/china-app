do $$
declare
  v_life_section_id integer;
begin
  select s.id
    into v_life_section_id
  from public.sections s
  where s.code = 'life'
  order by s.id
  limit 1;

  if v_life_section_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.categories c
    where c.section_id = v_life_section_id
      and c.slug = 'life-other'
  ) then
    insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
    values (v_life_section_id, '기타', 'life-other', 42, true);
  end if;
end
$$;
