do $$
declare
  v_life_section_id public.sections.id%type;
begin
  select s.id
    into v_life_section_id
    from public.sections s
   where s.code::text = 'life'
   order by s.id
   limit 1;

  if v_life_section_id is null then
    return;
  end if;

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_life_section_id, '기회의 장', 'life-opportunity', 40, true
  where not exists (
    select 1
      from public.categories
     where section_id = v_life_section_id
       and slug = 'life-opportunity'
  );

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_life_section_id, '정보 공유', 'life-info-sharing', 41, true
  where not exists (
    select 1
      from public.categories
     where section_id = v_life_section_id
       and slug = 'life-info-sharing'
  );
end
$$;
