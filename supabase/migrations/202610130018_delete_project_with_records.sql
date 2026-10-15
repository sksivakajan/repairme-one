begin;
-- A project that already has completed tasks or submitted work logs can now be deleted, but only by the CEO and only after
-- typing the project's name. Deleting still only hides the project: completed tasks stay completed and every work log,
-- review and audit entry is kept, so nobody's monthly review or hours change.
alter function public.command(text,uuid,integer,jsonb) rename to command_pre_delete_rules;
revoke all on function public.command_pre_delete_rules(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); p public.projects; note text; has_records boolean; t public.tasks;
begin
 if action<>'delete_project' then return public.command_pre_delete_rules(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;
 select * into p from public.projects where id=record_id and deleted_at is null for update;
 if not found then raise exception 'Project not found';end if;
 if not public.project_manager(p.id) then raise exception 'Only the CEO or the project leader can do this';end if;
 if p.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;
 note:=trim(coalesce(payload->>'reason',''));
 if length(note)<3 then raise exception 'Reason required';end if;
 has_records:=exists(select 1 from public.tasks where project_id=p.id and status='completed')
  or exists(select 1 from public.work_logs w join public.tasks k on k.id=w.task_id where k.project_id=p.id and w.status in ('submitted','approved'));
 if has_records then
  if not public.has_role(array['ceo']::public.app_role[]) then raise exception 'This project has completed work or submitted work logs. Only the CEO can delete it';end if;
  if lower(trim(coalesce(payload->>'confirm_name','')))<>lower(trim(p.name)) then raise exception 'Type the project name exactly to confirm deleting a project that has work records';end if;
 end if;
 -- Open tasks are cancelled with a history entry; completed tasks stay completed.
 for t in select * from public.tasks where project_id=p.id and status not in ('completed','cancelled') and deleted_at is null for update loop
  insert into public.task_history(task_id,actor_id,version,snapshot,reason) values(t.id,actor,t.version,to_jsonb(t),'Project deleted: '||note);
  update public.tasks set status='cancelled',version=version+1 where id=t.id;
 end loop;
 update public.projects set deleted_at=now(),deleted_by=actor,delete_reason=note,status='cancelled',version=version+1 where id=p.id;
 perform public.audit('project_deleted',p.id,jsonb_build_object('reason',note,'had_work_records',has_records));
 return jsonb_build_object('success',true,'id',p.id);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
