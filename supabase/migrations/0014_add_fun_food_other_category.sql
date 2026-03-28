do $$
declare
  v_fun_section_id public.sections.id%type;
begin
  select s.id
    into v_fun_section_id
    from public.sections s
   where s.code::text = 'fun'
   order by s.id
   limit 1;

  if v_fun_section_id is null then
    return;
  end if;

  insert into public.categories (section_id, name_ko, slug, sort_order, is_active)
  select v_fun_section_id, '기타', 'fun-food-other', 15, true
  where not exists (select 1 from public.categories where slug = 'fun-food-other');
end
$$;
