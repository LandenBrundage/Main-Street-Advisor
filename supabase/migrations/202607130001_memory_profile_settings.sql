-- Additive Main Street Advisor memory, profile-v2, and account settings migration.
-- Legacy profile columns and all task status values are intentionally preserved.

alter table public.profiles
  add column if not exists avatar_path text;

alter table public.businesses
  add column if not exists profile_details jsonb not null default '{}'::jsonb,
  add column if not exists business_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists profile_version integer not null default 2,
  add column if not exists primary_goal_id uuid references public.goals(id) on delete set null;

alter table public.conversations
  add column if not exists summary jsonb not null default jsonb_build_object(
    'confirmedFacts', '[]'::jsonb,
    'decisions', '[]'::jsonb,
    'goalsAndConstraints', '[]'::jsonb,
    'recommendedStrategies', '[]'::jsonb,
    'confirmedActionsTried', '[]'::jsonb,
    'confirmedResults', '[]'::jsonb,
    'unresolvedQuestions', '[]'::jsonb
  ),
  add column if not exists summarized_message_count integer not null default 0 check (summarized_message_count >= 0),
  add column if not exists summarized_through_message_id uuid references public.messages(id) on delete set null,
  add column if not exists summary_updated_at timestamptz;

create table if not exists public.conversation_summary_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  from_message_count integer not null check (from_message_count >= 0),
  through_message_count integer not null check (through_message_count > from_message_count),
  through_message_id uuid not null references public.messages(id) on delete restrict,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, through_message_count)
);

create table if not exists public.task_completion_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  idempotency_key text not null,
  status public.proposal_status not null default 'proposed',
  confirmation_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create index if not exists businesses_primary_goal_idx
  on public.businesses(primary_goal_id) where primary_goal_id is not null;
create index if not exists conversations_summary_recent_idx
  on public.conversations(business_id, summary_updated_at desc)
  where summary_updated_at is not null;
create index if not exists conversation_summary_history_lookup_idx
  on public.conversation_summary_history(business_id, conversation_id, through_message_count desc);
create index if not exists task_completion_requests_lookup_idx
  on public.task_completion_requests(business_id, conversation_id, status, created_at desc);

alter table public.conversation_summary_history enable row level security;
alter table public.task_completion_requests enable row level security;

-- SQL Editor users may safely rerun this additive migration after an
-- interrupted attempt. Policies are replaced without touching table data.
drop policy if exists "workspace select" on public.conversation_summary_history;
drop policy if exists "workspace insert" on public.conversation_summary_history;
create policy "workspace select" on public.conversation_summary_history
  for select using (public.is_business_member(business_id));
create policy "workspace insert" on public.conversation_summary_history
  for insert with check (public.is_business_member(business_id));
drop policy if exists "workspace select" on public.task_completion_requests;
drop policy if exists "workspace insert" on public.task_completion_requests;
drop policy if exists "workspace update" on public.task_completion_requests;
drop policy if exists "workspace delete" on public.task_completion_requests;
create policy "workspace select" on public.task_completion_requests
  for select using (public.is_business_member(business_id));
create policy "workspace insert" on public.task_completion_requests
  for insert with check (public.is_business_member(business_id));
create policy "workspace update" on public.task_completion_requests
  for update using (public.is_business_member(business_id))
  with check (public.is_business_member(business_id));
create policy "workspace delete" on public.task_completion_requests
  for delete using (public.is_business_member(business_id));

drop trigger if exists touch_updated_at on public.task_completion_requests;
create trigger touch_updated_at
  before update on public.task_completion_requests
  for each row execute function public.touch_updated_at();

-- Backfill the sectioned profile from legacy fields without changing or clearing legacy data.
update public.businesses
set profile_details = jsonb_strip_nulls(jsonb_build_object(
  'basics', jsonb_strip_nulls(jsonb_build_object(
    'industry', nullif(industry, ''),
    'description', nullif(description, ''),
    'location', nullif(location, ''),
    'legalStructure', nullif(legal_structure, ''),
    'employees', employee_count,
    'website', nullif(website, ''),
    'yearsInBusiness', case when year_founded is not null then greatest(0, extract(year from current_date)::int - year_founded) end
  )),
  'offerings', jsonb_strip_nulls(jsonb_build_object(
    'main', case when nullif(products_services, '') is null then '[]'::jsonb else jsonb_build_array(products_services) end,
    'typicalPriceRange', nullif(pricing_info, ''),
    'revenueModels', '[]'::jsonb,
    'salesChannels', '[]'::jsonb
  )),
  'customers', jsonb_strip_nulls(jsonb_build_object(
    'idealCustomer', nullif(target_customers, ''),
    'discoveryChannels', '[]'::jsonb,
    'whyChoose', nullif(competitive_advantages, ''),
    'competitors', '[]'::jsonb,
    'differentiation', nullif(competitive_advantages, '')
  )),
  'performance', jsonb_build_object('metricsTracked', '[]'::jsonb),
  'operations', jsonb_strip_nulls(jsonb_build_object(
    'tools', '[]'::jsonb,
    'responsibilities', nullif(organization, ''),
    'growthLimitations', '[]'::jsonb
  )),
  'goals', jsonb_strip_nulls(jsonb_build_object(
    'primaryGoal', nullif(current_goals, ''),
    'biggestObstacle', nullif(current_challenges, ''),
    'triedStrategies', '[]'::jsonb,
    'excludedSolutions', '[]'::jsonb
  )),
  'advice', jsonb_build_object('helpAreas', '[]'::jsonb),
  'legacyAdditionalInformation', concat_ws(E'\n',
    case when nullif(annual_revenue, '') is not null then 'Approximate annual revenue: ' || annual_revenue end,
    case when nullif(fixed_costs, '') is not null then 'Major fixed costs: ' || fixed_costs end,
    case when nullif(variable_costs, '') is not null then 'Major variable costs: ' || variable_costs end,
    case when nullif(budget_constraints, '') is not null then 'Budget constraints: ' || budget_constraints end,
    case when nullif(financial_notes, '') is not null then 'Additional financial notes: ' || financial_notes end
  )
))
where profile_details = '{}'::jsonb;

update public.businesses
set business_snapshot = jsonb_strip_nulls(jsonb_build_object(
  'identity', jsonb_strip_nulls(jsonb_build_object(
    'name', name,
    'industry', nullif(industry, ''),
    'description', nullif(description, ''),
    'location', nullif(location, ''),
    'employees', employee_count
  )),
  'offer', jsonb_strip_nulls(jsonb_build_object(
    'productsAndServices', nullif(products_services, ''),
    'pricing', nullif(pricing_info, ''),
    'revenueModel', nullif(business_model, '')
  )),
  'market', jsonb_strip_nulls(jsonb_build_object(
    'idealCustomer', nullif(target_customers, ''),
    'competitivePosition', nullif(competitive_advantages, '')
  )),
  'currentFocus', jsonb_strip_nulls(jsonb_build_object(
    'primaryGoal', nullif(current_goals, ''),
    'biggestObstacle', nullif(current_challenges, '')
  ))
))
where business_snapshot = '{}'::jsonb;

create or replace function public.store_conversation_summary(
  p_conversation_id uuid,
  p_business_id uuid,
  p_expected_message_count integer,
  p_through_message_count integer,
  p_through_message_id uuid,
  p_summary jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized'; end if;
  select summarized_message_count into current_count
  from public.conversations
  where id = p_conversation_id and business_id = p_business_id
  for update;
  if not found then raise exception 'conversation not found'; end if;
  if current_count <> p_expected_message_count then return false; end if;
  if p_through_message_count <= current_count then return false; end if;
  if not exists(
    select 1 from public.messages
    where id = p_through_message_id
      and conversation_id = p_conversation_id
      and business_id = p_business_id
  ) then raise exception 'summary boundary not found'; end if;

  insert into public.conversation_summary_history(
    business_id, conversation_id, from_message_count, through_message_count,
    through_message_id, summary
  ) values (
    p_business_id, p_conversation_id, current_count, p_through_message_count,
    p_through_message_id, p_summary
  );
  update public.conversations
  set summary = p_summary,
      summarized_message_count = p_through_message_count,
      summarized_through_message_id = p_through_message_id,
      summary_updated_at = now()
  where id = p_conversation_id and business_id = p_business_id;
  return true;
end;
$$;
grant execute on function public.store_conversation_summary(uuid, uuid, integer, integer, uuid, jsonb) to authenticated;

create or replace function public.approve_task_completion(
  p_request_id uuid,
  p_business_id uuid,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  completion_request public.task_completion_requests;
  completed_task public.tasks;
begin
  if auth.uid() <> p_user_id or not public.is_business_member(p_business_id) then
    raise exception 'not authorized';
  end if;
  select * into completion_request
  from public.task_completion_requests
  where id = p_request_id and business_id = p_business_id
  for update;
  if not found then raise exception 'completion request not found'; end if;
  if completion_request.status = 'approved' then
    select * into completed_task from public.tasks
    where id = completion_request.task_id and business_id = p_business_id;
    return jsonb_build_object('already_approved', true, 'task', to_jsonb(completed_task));
  end if;
  if completion_request.status <> 'proposed' then raise exception 'completion request is not pending'; end if;

  update public.tasks
  set status = 'completed'
  where id = completion_request.task_id and business_id = p_business_id
  returning * into completed_task;
  if not found then raise exception 'task not found'; end if;

  update public.task_completion_requests
  set status = 'approved'
  where id = completion_request.id;
  return jsonb_build_object('already_approved', false, 'task', to_jsonb(completed_task));
end;
$$;
grant execute on function public.approve_task_completion(uuid, uuid, uuid) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values('profile-avatars', 'profile-avatars', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

drop policy if exists "avatar owner read" on storage.objects;
drop policy if exists "avatar owner insert" on storage.objects;
drop policy if exists "avatar owner update" on storage.objects;
drop policy if exists "avatar owner delete" on storage.objects;
create policy "avatar owner read" on storage.objects for select
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar owner insert" on storage.objects for insert
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar owner update" on storage.objects for update
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar owner delete" on storage.objects for delete
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
