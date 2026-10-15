begin;
-- A project leader (or the CEO) can reopen a day's work log for an employee who missed the 6 PM cutoff.
-- The employee can then submit or edit that day's log for a limited time. Every reopen is audited and notified.
create table public.work_log_reopens(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.employees(id),
 work_date date not null,
 opened_by uuid not null references public.employees(id),
 reason text not null check(length(trim(reason))>=3),
 expires_at timestamptz not null,
 created_at timestamptz not null default now(),
 unique(employee_id,work_date));
alter table public.work_log_reopens enable row level security;
revoke all on public.work_log_reopens from anon,authenticated;
grant select on public.work_log_reopens to authenticated;
create policy work_log_reopens_read on public.work_log_reopens for select to authenticated
 using(public.active_user() and (employee_id=auth.uid() or opened_by=auth.uid() or public.has_role(array['ceo']::public.app_role[])));

-- The window now also opens for a reopened day. A reopen for a past day wins over the normal window;
-- a reopen for today only matters once today's window has closed.
create or replace function public.work_log_window() returns table(is_open boolean,work_day date,opens time,closes time) language plpgsql stable security definer set search_path='' as $$
declare s public.company_settings; local_now timestamp; normal boolean; r public.work_log_reopens;
begin
 select * into strict s from public.company_settings;
 local_now:=now() at time zone s.timezone;
 normal:=local_now::time>=s.work_start and local_now::time<s.work_end
  and (cardinality(s.working_weekdays)=0 or extract(dow from local_now)::integer=any(s.working_weekdays));
 select * into r from public.work_log_reopens x where x.employee_id=auth.uid() and x.expires_at>now() and (not normal or x.work_date<local_now::date)
  order by x.work_date desc limit 1;
 if found then
  return query select true,r.work_date,s.work_start,s.work_end;
 else
  return query select normal,local_now::date,s.work_start,s.work_end;
 end if;
end$$;

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_reopen;
revoke all on function public.command_pre_reopen(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; day date; note text; today date; rid uuid;
begin
 if action<>'reopen_work_log' then return public.command_pre_reopen(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 target:=nullif(payload->>'employee_id','')::uuid; day:=nullif(payload->>'work_date','')::date; note:=trim(coalesce(payload->>'reason',''));
 today:=(now() at time zone (select timezone from public.company_settings))::date;
 if target is null or day is null then raise exception 'Choose the employee and the date';end if;
 if target=actor then raise exception 'You cannot reopen your own work log';end if;
 if day>today or day<today-7 then raise exception 'Only the last 7 days can be reopened';end if;
 if length(note)<3 then raise exception 'Reason required';end if;
 -- Only the leader of a project the employee works in (or the CEO) may reopen.
 if not (public.has_role(array['ceo']::public.app_role[]) or exists(select 1 from public.tasks t where t.assignee_id=target and public.project_manager(t.project_id))) then
  raise exception 'Only the project leader of this employee can reopen a work log';end if;
 insert into public.work_log_reopens(employee_id,work_date,opened_by,reason,expires_at) values(target,day,actor,note,now()+interval '4 hours')
  on conflict(employee_id,work_date) do update set opened_by=excluded.opened_by,reason=excluded.reason,expires_at=excluded.expires_at,created_at=now()
  returning id into rid;
 perform public.audit('work_log_reopened',target,jsonb_build_object('work_date',day,'reason',note));
 insert into public.notifications(user_id,title,href,dedupe_key) values(target,'Your work log for '||day||' was reopened for 4 hours','/work-logs','work-log-reopen:'||rid||':'||gen_random_uuid()) on conflict do nothing;
 return jsonb_build_object('id',rid,'success',true);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
