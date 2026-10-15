begin;
-- One task can be given to several people. Each person gets their own task row (own status, evidence,
-- review and quality rating), linked by group_id, with an optional description of their individual part.
alter table public.tasks
 add column group_id uuid,
 add column individual_work text not null default '' check(length(individual_work)<=2000),
 add column deleted_at timestamptz,
 add column deleted_by uuid references public.employees(id),
 add column delete_reason text;
create index tasks_group on public.tasks(group_id) where group_id is not null;
-- Deleted tasks disappear from every list but stay in the database, history and audit trail.
drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using(deleted_at is null and public.project_access(project_id));

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_group;
revoke all on function public.command_pre_group(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); t public.tasks; person jsonb; made jsonb; ids uuid[]:='{}'; gid uuid:=gen_random_uuid(); n integer; note text;
begin
 if action='create_task' and jsonb_typeof(payload->'assignees')='array' then
  n:=jsonb_array_length(payload->'assignees');
  if n<1 or n>20 then raise exception 'Choose between 1 and 20 people';end if;
  if (select count(distinct x->>'id') from jsonb_array_elements(payload->'assignees') x)<>n then raise exception 'Each person can be added once';end if;
  for person in select * from jsonb_array_elements(payload->'assignees') loop
   if coalesce(person->>'id','')='' then raise exception 'Choose a person for each assignment';end if;
   made:=public.command_pre_group('create_task',null,null,(payload-'assignees')||jsonb_build_object('assignee_id',person->>'id'));
   update public.tasks set group_id=case when n>1 then gid end,individual_work=left(coalesce(trim(person->>'work'),''),2000) where id=(made->>'id')::uuid;
   ids:=ids||(made->>'id')::uuid;
  end loop;
  return jsonb_build_object('id',ids[1],'ids',to_jsonb(ids),'success',true);

 elsif action='delete_task' then
  if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
  if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required';end if;
  select * into strict t from public.tasks where id=record_id for update;
  if not public.project_manager(t.project_id) then raise exception 'Project manager required';end if;
  if t.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;
  if t.status='completed' then raise exception 'Completed tasks are part of the record and cannot be deleted';end if;
  if exists(select 1 from public.work_logs where task_id=t.id and status in ('submitted','approved')) then raise exception 'This task has submitted work logs; close it instead of deleting it';end if;
  note:=trim(coalesce(payload->>'reason',''));
  if length(note)<3 then raise exception 'Reason required';end if;
  insert into public.task_history(task_id,actor_id,version,snapshot,reason) values(t.id,actor,t.version,to_jsonb(t),'Deleted: '||note);
  update public.tasks set status='cancelled',deleted_at=now(),deleted_by=actor,delete_reason=note,version=version+1 where id=t.id;
  perform public.audit('task_deleted',t.id,jsonb_build_object('reason',note));
  return jsonb_build_object('id',t.id,'success',true);
 end if;
 return public.command_pre_group(action,record_id,expected_version,payload);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
