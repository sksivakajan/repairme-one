begin;
-- Work-log self assessment, and attendance worked-time tracking across devices.
alter table public.work_logs add column self_quality_rating numeric(2,1) check(self_quality_rating between 0 and 5);
alter table public.attendance
 add column active_seconds integer not null default 0 check(active_seconds>=0),
 add column last_seen_at timestamptz,
 add column last_device text;
create table public.attendance_devices(
 attendance_id uuid not null references public.attendance(id) on delete cascade,
 device_id text not null check(length(device_id) between 8 and 64),
 device_label text not null default 'Unknown device' check(length(device_label)<=80),
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 active_seconds integer not null default 0 check(active_seconds>=0),
 primary key(attendance_id,device_id));
alter table public.attendance_devices enable row level security;
-- Visibility follows the attendance row policy (owner, reporting manager, HR, CEO).
create policy attendance_devices_read on public.attendance_devices for select to authenticated using(public.active_user() and exists(select 1 from public.attendance a where a.id=attendance_id));
revoke all on public.attendance_devices from anon,authenticated;
grant select on public.attendance_devices to authenticated;

alter function public.command(text,uuid,integer,jsonb) rename to command_pre_tracking;
revoke all on function public.command_pre_tracking(text,uuid,integer,jsonb) from public,anon,authenticated;

create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); a public.attendance; result jsonb; assignee uuid; project uuid; rating numeric; gap numeric; credit integer; dev text; dev_label text;
begin
 if action not in ('create_task','submit_work_log','check_in','check_out','attendance_heartbeat') then return public.command_pre_tracking(action,record_id,expected_version,payload);end if;
 if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required';end if;

 if action='create_task' then
  -- A project manager can assign any active employee; assigning also adds them to the project.
  project:=nullif(payload->>'project_id','')::uuid; assignee:=nullif(payload->>'assignee_id','')::uuid;
  if project is not null and assignee is not null and public.project_manager(project) then
   if not exists(select 1 from public.employees where id=assignee and status='active') then raise exception 'Active assignee required';end if;
   insert into public.project_members(project_id,employee_id) values(project,assignee) on conflict do nothing;
  end if;
  return public.command_pre_tracking(action,record_id,expected_version,payload);

 elsif action='submit_work_log' then
  rating:=nullif(trim(coalesce(payload->>'self_quality_rating','')),'')::numeric;
  if rating is not null and (rating<0 or rating>5) then raise exception 'Quality rating must be between 0 and 5';end if;
  result:=public.command_pre_tracking(action,record_id,expected_version,payload);
  update public.work_logs set self_quality_rating=rating where id=(result->>'id')::uuid and employee_id=actor;
  return result;

 elsif action='check_in' then
  -- A forgotten check-out must not block the next day: close it at the last time the employee was seen.
  update public.attendance set check_out=greatest(coalesce(last_seen_at,check_in),check_in+interval '1 second'),status='auto_closed'
   where employee_id=actor and check_out is null and coalesce(last_seen_at,check_in)<now()-interval '16 hours';
  return public.command_pre_tracking(action,record_id,expected_version,payload);

 elsif action='check_out' then
  update public.attendance set
   active_seconds=active_seconds+case when extract(epoch from now()-coalesce(last_seen_at,check_in)) between 1 and 180 then floor(extract(epoch from now()-coalesce(last_seen_at,check_in)))::integer else 0 end,
   last_seen_at=now()
   where employee_id=actor and check_out is null;
  return public.command_pre_tracking(action,record_id,expected_version,payload);

 else
  -- attendance_heartbeat: only time between consecutive heartbeats (max 3 minutes) is counted,
  -- so time while the computer sleeps or the app is closed is never counted as worked.
  select * into a from public.attendance where employee_id=actor and check_out is null for update;
  if not found then return jsonb_build_object('open',false);end if;
  dev:=left(trim(coalesce(payload->>'device_id','')),64);
  dev_label:=left(coalesce(nullif(trim(payload->>'device_label'),''),'Unknown device'),80);
  if length(dev)<8 then raise exception 'Device id required';end if;
  gap:=extract(epoch from now()-coalesce(a.last_seen_at,a.check_in));
  credit:=case when gap between 1 and 180 then floor(gap)::integer else 0 end;
  update public.attendance set active_seconds=active_seconds+credit,last_seen_at=now(),last_device=dev_label where id=a.id;
  insert into public.attendance_devices(attendance_id,device_id,device_label,active_seconds) values(a.id,dev,dev_label,credit)
   on conflict(attendance_id,device_id) do update set last_seen_at=now(),device_label=excluded.device_label,active_seconds=public.attendance_devices.active_seconds+credit;
  return jsonb_build_object('open',true,'active_seconds',a.active_seconds+credit);
 end if;
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
