begin;
-- Existing projects can get a new leader, and a project can be deleted. Deleting hides the project and its tasks from
-- every list but keeps them in the database and audit trail.
alter table public.projects
 add column deleted_at timestamptz,
 add column deleted_by uuid references public.employees(id),
 add column delete_reason text;

create function public.project_live(project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.projects where id=project and deleted_at is null); $$;
revoke all on function public.project_live(uuid) from public,anon;
grant execute on function public.project_live(uuid) to authenticated;

-- Same rules as before, but a deleted project grants no access to anyone.
create or replace function public.project_access(project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.active_user() and public.project_live(project) and (public.has_role(array['ceo']::public.app_role[]) or exists(select 1 from public.projects where id=project and manager_id=auth.uid()) or exists(select 1 from public.project_members where project_id=project and employee_id=auth.uid())); $$;
create or replace function public.project_manager(project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.project_live(project) and (public.has_role(array['ceo']::public.app_role[]) or (public.has_role(array['manager']::public.app_role[]) and exists(select 1 from public.projects where id=project and manager_id=auth.uid()))); $$;

drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using(
 deleted_at is null and public.active_user() and public.project_live(project_id) and (assignee_id=auth.uid() or public.project_manager(project_id)));

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_project_admin;
revoke all on function public.command_pre_project_admin(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.projects; leader uuid; note text; t public.tasks;
begin
 if action not in ('set_project_leader','delete_project') then return public.command_pre_project_admin(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;
 select * into p from public.projects where id=record_id and deleted_at is null for update;
 if not found then raise exception 'Project not found';end if;
 -- The CEO, or the current leader, may hand the project over or delete it.
 if not public.project_manager(p.id) then raise exception 'Only the CEO or the project leader can do this';end if;
 if p.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;

 if action='set_project_leader' then
  leader:=nullif(payload->>'leader_id','')::uuid;
  if leader is null then raise exception 'Choose the new project leader';end if;
  if not exists(select 1 from public.leader_candidates() c where c.id=leader) then raise exception 'The project leader must be an active manager';end if;
  if leader=p.manager_id then raise exception 'That person is already the project leader';end if;
  update public.projects set manager_id=leader,version=version+1 where id=p.id;
  perform public.audit('project_leader_changed',p.id,jsonb_build_object('from',p.manager_id,'to',leader));
  insert into public.notifications(user_id,title,href,dedupe_key) values(leader,'You are now the leader of project '||p.name,'/projects','project-leader:'||p.id||':'||gen_random_uuid()) on conflict do nothing;
  return jsonb_build_object('success',true,'id',p.id);

 else
  note:=trim(coalesce(payload->>'reason',''));
  if length(note)<3 then raise exception 'Reason required';end if;
  if exists(select 1 from public.tasks where project_id=p.id and status='completed') then raise exception 'This project has completed work, which is part of the record. It cannot be deleted';end if;
  if exists(select 1 from public.work_logs w join public.tasks k on k.id=w.task_id where k.project_id=p.id and w.status in ('submitted','approved')) then raise exception 'This project has submitted work logs. It cannot be deleted';end if;
  -- Open tasks are cancelled with a history entry so they never count toward anyone's monthly review.
  for t in select * from public.tasks where project_id=p.id and status not in ('completed','cancelled') and deleted_at is null for update loop
   insert into public.task_history(task_id,actor_id,version,snapshot,reason) values(t.id,actor,t.version,to_jsonb(t),'Project deleted: '||note);
   update public.tasks set status='cancelled',version=version+1 where id=t.id;
  end loop;
  update public.projects set deleted_at=now(),deleted_by=actor,delete_reason=note,status='cancelled',version=version+1 where id=p.id;
  perform public.audit('project_deleted',p.id,jsonb_build_object('reason',note));
  return jsonb_build_object('success',true,'id',p.id);
 end if;
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
