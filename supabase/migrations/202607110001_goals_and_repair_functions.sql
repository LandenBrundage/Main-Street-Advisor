-- Stop using folders without risking task loss. The legacy table and column remain for rollback.
update public.tasks set folder_id = null where folder_id is not null;
drop index if exists public.folders_business_idx;

create index if not exists tasks_goal_idx on public.tasks(business_id, goal_id);
create index if not exists goals_business_title_idx on public.goals(business_id, lower(title));

create or replace function public.delete_goal_keep_tasks(p_goal_id uuid, p_business_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'not authorized'; end if;
  if not exists(select 1 from public.goals where id = p_goal_id and business_id = p_business_id) then return false; end if;
  update public.tasks set goal_id = null where business_id = p_business_id and goal_id = p_goal_id;
  delete from public.goals where id = p_goal_id and business_id = p_business_id;
  return true;
end;
$$;
grant execute on function public.delete_goal_keep_tasks(uuid, uuid) to authenticated;

create or replace function public.approve_task_plan(p_proposal_id uuid, p_business_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.ai_action_requests;
  goal_id uuid;
  task_data jsonb;
  created_tasks jsonb := '[]'::jsonb;
  task_record public.tasks;
begin
  if auth.uid() <> p_user_id or not public.is_business_member(p_business_id) then raise exception 'not authorized'; end if;
  select * into proposal from public.ai_action_requests where id = p_proposal_id and business_id = p_business_id for update;
  if not found then raise exception 'proposal not found'; end if;
  if proposal.status = 'approved' then
    select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into created_tasks from public.tasks t where t.ai_action_request_id = proposal.id;
    select g.id into goal_id from public.goals g join public.tasks t on t.goal_id = g.id where t.ai_action_request_id = proposal.id limit 1;
    return jsonb_build_object('already_approved', true, 'goal_id', goal_id, 'tasks', created_tasks);
  end if;
  if proposal.status <> 'proposed' then raise exception 'proposal is not pending'; end if;

  select id into goal_id from public.goals where business_id = p_business_id and lower(title) = lower(proposal.payload->'goal'->>'title') limit 1;
  if goal_id is null then
    insert into public.goals(business_id, created_by, title, description, target_date)
    values(p_business_id, p_user_id, proposal.payload->'goal'->>'title', nullif(proposal.payload->'goal'->>'description',''), nullif(proposal.payload->'goal'->>'targetDate','')::date)
    returning id into goal_id;
  end if;

  for task_data in select * from jsonb_array_elements(proposal.payload->'tasks') loop
    insert into public.tasks(business_id, created_by, goal_id, folder_id, title, description, due_date, priority, status, origin, ai_action_request_id, sort_order)
    values(p_business_id, p_user_id, goal_id, null, task_data->>'title', nullif(task_data->>'description',''), nullif(task_data->>'dueDate','')::date, (task_data->>'priority')::public.task_priority, 'todo', 'ai', proposal.id, (task_data->>'order')::int)
    returning * into task_record;
    created_tasks := created_tasks || jsonb_build_array(to_jsonb(task_record));
  end loop;
  if jsonb_array_length(created_tasks) = 0 then raise exception 'no tasks created'; end if;
  update public.ai_action_requests set status = 'approved' where id = proposal.id;
  return jsonb_build_object('already_approved', false, 'goal_id', goal_id, 'tasks', created_tasks);
exception when others then
  -- The function call is atomic; the proposal remains unapproved when any insert fails.
  raise;
end;
$$;
grant execute on function public.approve_task_plan(uuid, uuid, uuid) to authenticated;
