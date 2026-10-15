begin;
-- 1. Daily work-log window. Employees submit and edit their work summary between the company's work start and
--    work end (default 09:00-18:00, company time zone). After the end time the day's logs are locked.
-- 2. The project leader (or CEO) can comment on any log of their project; the employee can reply.
-- 3. Any active employee can be a project leader, not only people with the manager role.

alter table public.company_settings alter column work_end set default '18:00';
update public.company_settings set work_end='18:00' where work_end='17:00';

alter table public.work_logs
 add column work_date date,
 add column edited_at timestamptz,
 add column edit_count integer not null default 0 check(edit_count>=0);
update public.work_logs w set work_date=(w.start_at at time zone (select timezone from public.company_settings))::date;
alter table public.work_logs alter column work_date set not null;
-- New logs get their company-time date from the start time, so the date cannot be chosen separately.
create function public.work_log_set_date() returns trigger language plpgsql security definer set search_path='' as $$
begin new.work_date:=(new.start_at at time zone (select timezone from public.company_settings))::date;return new;end$$;
revoke all on function public.work_log_set_date() from public,anon,authenticated;
create trigger work_logs_set_date before insert on public.work_logs for each row execute function public.work_log_set_date();
create index work_logs_day on public.work_logs(work_date,employee_id);

create table public.work_log_comments(
 id uuid primary key default gen_random_uuid(),
 work_log_id uuid not null references public.work_logs(id),
 author_id uuid not null references public.employees(id),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now());
create index work_log_comments_log on public.work_log_comments(work_log_id,created_at);
alter table public.work_log_comments enable row level security;
revoke all on public.work_log_comments from anon,authenticated;
grant select on public.work_log_comments to authenticated;
-- Visible to whoever can see the log (the employee, the project leader, the CEO).
create policy work_log_comments_read on public.work_log_comments for select to authenticated
 using(public.active_user() and exists(select 1 from public.work_logs w where w.id=work_log_id));

-- Leaders: any active employee may lead a project; powers still come only from projects.manager_id (or the CEO role).
create or replace function public.project_manager(project uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.project_live(project) and (public.has_role(array['ceo']::public.app_role[]) or (public.active_user() and exists(select 1 from public.projects where id=project and manager_id=auth.uid()))); $$;
create or replace function public.leader_candidates() returns table(id uuid) language sql stable security definer set search_path='' as $$
 select e.id from public.employees e
 where e.status='active' and public.active_user()
  and (public.has_role(array['ceo','manager']::public.app_role[])
   or exists(select 1 from public.projects p where p.manager_id=auth.uid() and p.deleted_at is null)); $$;

-- The submission window in company time. Open only between work_start and work_end, and only on working weekdays when those are configured.
create function public.work_log_window() returns table(is_open boolean,work_day date,opens time,closes time) language plpgsql stable security definer set search_path='' as $$
declare s public.company_settings; local_now timestamp;
begin
 select * into strict s from public.company_settings;
 local_now:=now() at time zone s.timezone;
 return query select local_now::time>=s.work_start and local_now::time<s.work_end
   and (cardinality(s.working_weekdays)=0 or extract(dow from local_now)::integer=any(s.working_weekdays)),
   local_now::date,s.work_start,s.work_end;
end$$;
revoke all on function public.work_log_window() from public,anon;
grant execute on function public.work_log_window() to authenticated;

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_work_log_window;
revoke all on function public.command_pre_work_log_window(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); win record; tz text; s_at timestamptz; e_at timestamptz; summary text; rating numeric; w public.work_logs; t public.tasks; made jsonb; wid uuid; cid uuid; note text; recipient uuid; ws time; we time;
begin
 if action not in ('submit_work_log','edit_work_log','comment_work_log','update_settings') then return public.command_pre_work_log_window(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;
 select timezone into strict tz from public.company_settings;

 if action='update_settings' then
  -- Work hours are optional in the payload; everything else is the existing settings command.
  made:=public.command_pre_work_log_window(action,record_id,expected_version,payload-'work_start'-'work_end');
  if nullif(payload->>'work_start','') is not null or nullif(payload->>'work_end','') is not null then
   ws:=coalesce(nullif(payload->>'work_start','')::time,(select work_start from public.company_settings));
   we:=coalesce(nullif(payload->>'work_end','')::time,(select work_end from public.company_settings));
   if we<=ws then raise exception 'Work end must be after work start';end if;
   if we-ws<interval '1 hour' then raise exception 'The work day must be at least one hour long';end if;
   update public.company_settings set work_start=ws,work_end=we;
   perform public.audit('work_hours_changed',null,jsonb_build_object('work_start',ws,'work_end',we));
  end if;
  return made;
 end if;

 if action in ('submit_work_log','edit_work_log') then
  select * into win from public.work_log_window();
  if not win.is_open then raise exception 'Work logs can only be submitted or edited between % and % (company time). Today''s window is closed.',to_char(date '2000-01-01'+win.opens,'HH12:MI AM'),to_char(date '2000-01-01'+win.closes,'HH12:MI AM');end if;
  s_at:=(payload->>'start_at')::timestamptz; e_at:=(payload->>'end_at')::timestamptz;
  if (s_at at time zone tz)::date<>win.work_day or (e_at at time zone tz)::date<>win.work_day then raise exception 'A work log must be for today. Start and end must both be today.';end if;
  if e_at>now()+interval '5 minutes' then raise exception 'End time cannot be in the future';end if;
  summary:=trim(coalesce(payload->>'description',''));
  if length(summary)<3 then raise exception 'Describe what you worked on';end if;

  if action='submit_work_log' then
   return public.command_pre_work_log_window(action,record_id,expected_version,payload);
  end if;

  select * into w from public.work_logs where id=record_id for update;
  if not found or w.employee_id<>actor then raise exception 'You can only edit your own work log';end if;
  if w.work_date<>win.work_day then raise exception 'Only today''s work log can be edited';end if;
  if w.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;
  rating:=nullif(trim(coalesce(payload->>'self_quality_rating','')),'')::numeric;
  if rating is not null and (rating<0 or rating>5) then raise exception 'Quality rating must be between 0 and 5';end if;
  -- The change is kept in the audit trail. An edited log goes back to the leader as submitted.
  perform public.audit('work_log_edited',w.id,jsonb_build_object('before',jsonb_build_object('start_at',w.start_at,'end_at',w.end_at,'description',w.description,'status',w.status)));
  update public.work_logs set start_at=s_at,end_at=e_at,description=summary,self_quality_rating=rating,status='submitted',reviewer_id=null,review_reason=null,
   edited_at=now(),edit_count=edit_count+1,version=version+1 where id=w.id;
  return jsonb_build_object('id',w.id,'success',true);
 end if;

 -- comment_work_log: the project leader (or CEO) comments; the employee can reply. Allowed at any time.
 select * into w from public.work_logs where id=record_id;
 if not found then raise exception 'Work log not found';end if;
 select * into t from public.tasks where id=w.task_id;
 if actor<>w.employee_id and not public.project_manager(t.project_id) then raise exception 'Only the employee or the project leader can comment on this work log';end if;
 note:=trim(coalesce(payload->>'body',''));
 if length(note) not between 1 and 2000 then raise exception 'Write a comment of up to 2000 characters';end if;
 insert into public.work_log_comments(work_log_id,author_id,body) values(w.id,actor,note) returning id into cid;
 perform public.audit('work_log_commented',w.id,jsonb_build_object('comment',cid));
 recipient:=case when actor=w.employee_id then (select manager_id from public.projects where id=t.project_id) else w.employee_id end;
 if recipient is not null and recipient<>actor then
  insert into public.notifications(user_id,title,href,dedupe_key) values(recipient,'New comment on a work log','/work-logs','work-log-comment:'||cid) on conflict do nothing;
 end if;
 return jsonb_build_object('id',cid,'success',true);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
