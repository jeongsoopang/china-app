alter table public.posts
  add column if not exists original_language text;

update public.posts
set original_language = 'ko'
where original_language is null;

alter table public.posts
  alter column original_language set default 'ko';

alter table public.posts
  alter column original_language set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_original_language_check'
      and conrelid = 'public.posts'::regclass
  ) then
    alter table public.posts
      add constraint posts_original_language_check
      check (original_language in ('ko', 'en'));
  end if;
end
$$;

create table if not exists public.post_translations (
  id bigserial primary key,
  post_id integer not null references public.posts(id) on delete cascade,
  source_language text not null check (source_language in ('ko', 'en')),
  target_language text not null check (target_language in ('ko', 'en')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  translated_title text,
  translated_abstract text,
  translated_body text,
  source_hash text not null,
  source_updated_at timestamptz not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_message text,
  last_attempt_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_translations_source_target_diff_check check (source_language <> target_language)
);

create index if not exists idx_post_translations_post_id
  on public.post_translations(post_id);

create index if not exists idx_post_translations_pending_created_at
  on public.post_translations(created_at)
  where status = 'pending';

create unique index if not exists idx_post_translations_unique_active_source
  on public.post_translations(post_id, target_language, source_hash)
  where status in ('pending', 'completed');

drop trigger if exists set_post_translations_updated_at on public.post_translations;
create trigger set_post_translations_updated_at
before update on public.post_translations
for each row
execute function public.set_updated_at();

alter table public.post_translations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'post_translations'
      and policyname = 'post_translations_select_own_posts'
  ) then
    create policy post_translations_select_own_posts
      on public.post_translations
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.posts p
          where p.id = post_translations.post_id
            and p.author_id = auth.uid()
        )
      );
  end if;
end
$$;

create or replace function public.enqueue_post_translation(
  p_post_id integer,
  p_source_language text,
  p_target_language text default null
)
returns table (
  translation_id bigint,
  status text,
  source_hash text,
  source_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post_title text;
  v_post_abstract text;
  v_post_body text;
  v_source_updated_at timestamptz;
  v_existing_original_language text;
  v_target_language text;
  v_source_hash text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_source_language not in ('ko', 'en') then
    raise exception 'Unsupported source language: %', p_source_language;
  end if;

  v_target_language := coalesce(
    p_target_language,
    case p_source_language
      when 'ko' then 'en'
      else 'ko'
    end
  );

  if v_target_language not in ('ko', 'en') then
    raise exception 'Unsupported target language: %', v_target_language;
  end if;

  if v_target_language = p_source_language then
    raise exception 'Source and target language must be different.';
  end if;

  select p.title, p.abstract, p.body, p.updated_at, p.original_language
  into v_post_title, v_post_abstract, v_post_body, v_source_updated_at, v_existing_original_language
  from public.posts p
  where p.id = p_post_id
    and p.author_id = auth.uid();

  if not found then
    raise exception 'Post not found or not owned by current user.';
  end if;

  if v_existing_original_language is distinct from p_source_language then
    update public.posts
    set original_language = p_source_language
    where id = p_post_id;

    select p.title, p.abstract, p.body, p.updated_at
    into v_post_title, v_post_abstract, v_post_body, v_source_updated_at
    from public.posts p
    where p.id = p_post_id;
  end if;

  v_source_hash :=
    md5(coalesce(v_post_title, '') || E'\n' || coalesce(v_post_abstract, '') || E'\n' || coalesce(v_post_body, ''));

  return query
  select pt.id, pt.status, pt.source_hash, pt.source_updated_at
  from public.post_translations pt
  where pt.post_id = p_post_id
    and pt.target_language = v_target_language
    and pt.source_hash = v_source_hash
    and pt.status in ('pending', 'completed')
  order by pt.id desc
  limit 1;

  if found then
    return;
  end if;

  begin
    insert into public.post_translations (
      post_id,
      source_language,
      target_language,
      status,
      source_hash,
      source_updated_at
    )
    values (
      p_post_id,
      p_source_language,
      v_target_language,
      'pending',
      v_source_hash,
      v_source_updated_at
    )
    returning id, post_translations.status, post_translations.source_hash, post_translations.source_updated_at
    into translation_id, status, source_hash, source_updated_at;
  exception
    when unique_violation then
      select pt.id, pt.status, pt.source_hash, pt.source_updated_at
      into translation_id, status, source_hash, source_updated_at
      from public.post_translations pt
      where pt.post_id = p_post_id
        and pt.target_language = v_target_language
        and pt.source_hash = v_source_hash
        and pt.status in ('pending', 'completed')
      order by pt.id desc
      limit 1;
  end;

  return next;
end;
$$;

grant execute on function public.enqueue_post_translation(integer, text, text) to authenticated;
