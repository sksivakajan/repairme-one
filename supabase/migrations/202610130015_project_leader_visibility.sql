begin;
-- Task visibility: the project leader (and the CEO) see every task in the project; every other member
-- sees only the tasks assigned to them. History, comments and developer details follow task visibility.
drop policy tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using(
 deleted_at is null and public.active_user() and (assignee_id=auth.uid() or public.project_manager(project_id)));

-- People who can be chosen as a project leader: active employees with the manager or CEO role.
-- Only someone who can create projects may ask.
create function public.leader_candidates() returns table(id uuid) language sql stable security definer set search_path='' as $$
 select e.id from public.employees e
 where e.status='active' and public.has_role(array['ceo','manager']::public.app_role[])
  and exists(select 1 from public.user_roles r where r.user_id=e.id and r.role in ('manager','ceo')); $$;
revoke all on function public.leader_candidates() from public,anon;
grant execute on function public.leader_candidates() to authenticated;

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_leader;
revoke all on function public.command_pre_leader(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); leader uuid; made jsonb; pid uuid; pname text;
begin
 if action<>'create_project' then return public.command_pre_leader(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;
 leader:=nullif(payload->>'leader_id','')::uuid;
 if leader is null then raise exception 'Choose the project leader';end if;
 if not exists(select 1 from public.leader_candidates() c where c.id=leader) then raise exception 'The project leader must be an active manager';end if;
 made:=public.command_pre_leader(action,record_id,expected_version,payload-'leader_id');
 pid:=(made->>'id')::uuid;
 -- The chosen leader owns the project from now on and is the one who creates and reviews its tasks.
 update public.projects set manager_id=leader where id=pid returning name into pname;
 perform public.audit('project_leader_assigned',pid,jsonb_build_object('leader',leader));
 if leader<>actor then
  insert into public.notifications(user_id,title,href,dedupe_key) values(leader,'You are the leader of project '||pname,'/projects','project-leader:'||pid) on conflict do nothing;
 end if;
 return made;
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
