-- Add explicit, user-confirmed completion state without removing historical data.

do $$
begin
  create type public.goal_status as enum ('incomplete', 'completed');
exception
  when duplicate_object then null;
end
$$;

alter table public.goals
  add column if not exists status public.goal_status not null default 'incomplete',
  add column if not exists completed_at timestamptz;

alter table public.tasks
  add column if not exists completed_at timestamptz,
  add column if not exists previous_incomplete_status public.task_status;

-- Existing completed tasks remain completed and gain a stable historical date.
update public.tasks
set completed_at = updated_at
where status = 'completed' and completed_at is null;

create index if not exists goals_completion_idx
  on public.goals(business_id, status, completed_at desc);
create index if not exists tasks_completion_idx
  on public.tasks(business_id, status, completed_at desc);

create or replace function public.sync_task_completion_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
    return new;
  end if;

  if new.status = 'completed' then
    if old.status <> 'completed' then
      new.previous_incomplete_status = old.status;
    end if;
    new.completed_at = coalesce(new.completed_at, old.completed_at, now());
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_task_completion on public.tasks;
create trigger sync_task_completion
  before insert or update of status, completed_at on public.tasks
  for each row execute function public.sync_task_completion_fields();

create or replace function public.sync_goal_completion_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      new.completed_at = coalesce(new.completed_at, now());
    else
      new.completed_at = null;
    end if;
    return new;
  end if;

  if new.status = 'completed' then
    new.completed_at = coalesce(new.completed_at, old.completed_at, now());
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_goal_completion on public.goals;
create trigger sync_goal_completion
  before insert or update of status, completed_at on public.goals
  for each row execute function public.sync_goal_completion_fields();

-- Complete/reopen a goal and optionally complete its remaining tasks in one transaction.
create or replace function public.set_goal_completion(
  p_goal_id uuid,
  p_business_id uuid,
  p_completed boolean,
  p_complete_remaining_tasks boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_goal public.goals;
  changed_tasks jsonb := '[]'::jsonb;
begin
  if not public.is_business_member(p_business_id) then
    raise exception 'not authorized';
  end if;

  select * into target_goal
  from public.goals
  where id = p_goal_id and business_id = p_business_id
  for update;
  if not found then raise exception 'goal not found'; end if;

  if p_completed then
    if p_complete_remaining_tasks then
      with updated_tasks as (
        update public.tasks
        set status = 'completed'
        where business_id = p_business_id
          and goal_id = p_goal_id
          and status <> 'completed'
        returning *
      )
      select coalesce(jsonb_agg(to_jsonb(updated_tasks)), '[]'::jsonb)
      into changed_tasks
      from updated_tasks;
    end if;

    update public.goals
    set status = 'completed'
    where id = p_goal_id and business_id = p_business_id
    returning * into target_goal;
  else
    update public.goals
    set status = 'incomplete'
    where id = p_goal_id and business_id = p_business_id
    returning * into target_goal;
  end if;

  return jsonb_build_object(
    'goal', to_jsonb(target_goal),
    'tasks', changed_tasks
  );
end;
$$;
revoke all on function public.set_goal_completion(uuid, uuid, boolean, boolean) from public;
grant execute on function public.set_goal_completion(uuid, uuid, boolean, boolean) to authenticated;

-- Older profile payloads briefly stored a personal name alongside business data.
-- Copy it only when the account has no display name, and never remove the legacy value.
with legacy_names as (
  select distinct on (membership.user_id)
    membership.user_id,
    trim(business.profile_details->>'name') as legacy_name
  from public.business_memberships membership
  join public.businesses business on business.id = membership.business_id
  where business.profile_details ? 'name'
    and trim(coalesce(business.profile_details->>'name', '')) <> ''
  order by membership.user_id, membership.created_at
)
update public.profiles profile
set full_name = legacy_names.legacy_name
from legacy_names
where profile.id = legacy_names.user_id
  and trim(coalesce(profile.full_name, '')) = '';
