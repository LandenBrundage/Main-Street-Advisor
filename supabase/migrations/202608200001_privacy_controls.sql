-- Privacy controls and durable per-user API abuse limits.

alter table public.businesses
  add column if not exists ai_workspace_context_enabled boolean not null default true,
  add column if not exists ai_cross_conversation_enabled boolean not null default true,
  add column if not exists ai_document_search_enabled boolean not null default true;

create table if not exists public.api_rate_limit_buckets (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 80),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, scope, window_start)
);

alter table public.api_rate_limit_buckets enable row level security;

-- There are deliberately no direct table policies. Authenticated callers can
-- consume only their own bucket through this narrowly scoped function.
create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  bucket_start timestamptz;
  updated_count integer;
begin
  if caller_id is null then raise exception 'not authorized'; end if;
  if char_length(p_scope) not between 1 and 80 then raise exception 'invalid scope'; end if;
  if p_limit not between 1 and 10000 then raise exception 'invalid limit'; end if;
  if p_window_seconds not between 1 and 86400 then raise exception 'invalid window'; end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  delete from public.api_rate_limit_buckets
  where user_id = caller_id
    and scope = p_scope
    and window_start < bucket_start - make_interval(secs => p_window_seconds);

  insert into public.api_rate_limit_buckets(user_id, scope, window_start, request_count)
  values(caller_id, p_scope, bucket_start, 1)
  on conflict(user_id, scope, window_start) do update
    set request_count = public.api_rate_limit_buckets.request_count + 1
    where public.api_rate_limit_buckets.request_count < p_limit
  returning request_count into updated_count;

  return updated_count is not null and updated_count <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;
