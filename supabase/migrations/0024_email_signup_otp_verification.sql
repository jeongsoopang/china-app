do $$
begin
  if not exists (
    select 1
    from pg_type
    where typnamespace = 'public'::regnamespace
      and typname = 'email_verification_request_status'
  ) then
    create type public.email_verification_request_status as enum (
      'code_sent',
      'verified',
      'failed',
      'expired',
      'completed'
    );
  end if;
end
$$;

create table if not exists public.email_verification_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  status public.email_verification_request_status not null default 'code_sent',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts smallint not null default 5 check (max_attempts > 0),
  resend_count integer not null default 0 check (resend_count >= 0),
  max_resends smallint not null default 5 check (max_resends >= 0),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null,
  verified_at timestamptz,
  verification_token text,
  consumed_at timestamptz,
  completed_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_email_verification_requests_email_created_at
  on public.email_verification_requests (lower(email), created_at desc);

create index if not exists idx_email_verification_requests_status
  on public.email_verification_requests (status);

create index if not exists idx_email_verification_requests_expires_at
  on public.email_verification_requests (expires_at);

create index if not exists idx_email_verification_requests_token
  on public.email_verification_requests (verification_token);

drop trigger if exists set_email_verification_requests_updated_at on public.email_verification_requests;
create trigger set_email_verification_requests_updated_at
before update on public.email_verification_requests
for each row
execute function public.set_updated_at();

alter table public.email_verification_requests enable row level security;

revoke all on table public.email_verification_requests from anon;
revoke all on table public.email_verification_requests from authenticated;
