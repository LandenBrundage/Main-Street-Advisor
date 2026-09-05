-- Keep a separate, immutable acknowledgment for each user and policy version.
-- This works before the user's business workspace/profile has been created.
create table if not exists public.legal_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, terms_version, privacy_version)
);

alter table public.legal_acceptances enable row level security;
revoke all on public.legal_acceptances from public, anon, authenticated;
grant select on public.legal_acceptances to authenticated;
-- The database, rather than the client, sets the acceptance timestamp.
grant insert (user_id, terms_version, privacy_version)
  on public.legal_acceptances to authenticated;

create policy legal_acceptances_read_own on public.legal_acceptances
  for select to authenticated using (user_id = (select auth.uid()));
create policy legal_acceptances_insert_own on public.legal_acceptances
  for insert to authenticated with check (user_id = (select auth.uid()));
