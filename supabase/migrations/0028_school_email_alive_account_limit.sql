create or replace function public.normalize_school_email(input_email text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(input_email, ''))), '');
$$;

create or replace function public.normalize_user_school_verification_email()
returns trigger
language plpgsql
as $$
begin
  new.school_email := public.normalize_school_email(new.school_email);

  if new.school_email is null then
    raise exception 'school_email is required';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_user_school_verification_email on public.user_school_verifications;
create trigger trg_normalize_user_school_verification_email
before insert or update of school_email
on public.user_school_verifications
for each row
execute function public.normalize_user_school_verification_email();

create or replace function public.enforce_verified_school_email_limit()
returns trigger
language plpgsql
as $$
declare
  normalized_email text;
  alive_verified_count integer;
begin
  new.verified_school_email := public.normalize_school_email(new.verified_school_email);
  normalized_email := new.verified_school_email;

  if normalized_email is null or new.verified_university_id is null then
    return new;
  end if;

  select count(*)
    into alive_verified_count
  from public.user_profiles up
  where up.id <> new.id
    and up.verified_university_id is not null
    and public.normalize_school_email(up.verified_school_email) = normalized_email;

  if alive_verified_count >= 2 then
    raise exception 'School email verification limit exceeded: this school email is already verified by 2 active accounts.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_verified_school_email_limit on public.user_profiles;
create trigger trg_enforce_verified_school_email_limit
before insert or update of verified_school_email, verified_university_id
on public.user_profiles
for each row
execute function public.enforce_verified_school_email_limit();
