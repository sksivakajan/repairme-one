begin;
-- Desktop agent: a small program on the employee's PC reports whether the computer is really in use.
-- Pairing: the employee creates a one-time code in the portal; the agent exchanges it for a private token.
-- Only a SHA-256 hash of the token is stored, and the agent functions take the plain token, so a stored
-- hash can never be used to impersonate a device.
create function public.agent_hash(value text) returns text language sql immutable set search_path='' as $$ select encode(sha256(convert_to(value,'UTF8')),'hex'); $$;
revoke all on function public.agent_hash(text) from public,anon,authenticated;

create table public.agent_pairings(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete cascade,
 code_hash text not null unique,
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now());
create table public.agent_devices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64),
 device_name text not null check(length(device_name) between 1 and 80),
 os text not null default '' check(length(os)<=80),
 agent_version text not null default '' check(length(agent_version)<=20),
 paired_at timestamptz not null default now(),
 last_seen_at timestamptz,
 revoked_at timestamptz);
create index agent_devices_user on public.agent_devices(user_id);
create table public.agent_status(
 device_id uuid primary key references public.agent_devices(id) on delete cascade,
 user_id uuid not null references public.employees(id) on delete cascade,
 state text not null check(state in ('active','idle','locked')),
 cpu_percent numeric(5,1) not null default 0,
 ram_percent numeric(5,1) not null default 0,
 ram_used_mb integer not null default 0,
 ram_total_mb integer not null default 0,
 cpu_count integer not null default 0,
 process_count integer not null default 0,
 foreground_app text not null default '',
 input_idle_seconds integer not null default 0,
 top_apps jsonb not null default '[]',
 updated_at timestamptz not null default now());
create index agent_status_user on public.agent_status(user_id);
alter table public.agent_pairings enable row level security;
alter table public.agent_devices enable row level security;
alter table public.agent_status enable row level security;
-- Same visibility as attendance: the employee, their reporting manager, HR and the CEO.
create policy agent_devices_read on public.agent_devices for select to authenticated using(public.active_user() and (user_id=auth.uid() or public.is_manager(user_id) or public.has_role(array['hr','ceo']::public.app_role[])));
create policy agent_status_read on public.agent_status for select to authenticated using(public.active_user() and (user_id=auth.uid() or public.is_manager(user_id) or public.has_role(array['hr','ceo']::public.app_role[])));
revoke all on public.agent_pairings,public.agent_devices,public.agent_status from anon,authenticated;
grant select on public.agent_devices,public.agent_status to authenticated;

-- Called by the agent (no user session): exchange a one-time code for a device token.
create function public.agent_pair(code text,device_name text,os text default '',agent_version text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.agent_pairings; plain text:=lower(regexp_replace(coalesce(code,''),'[^0-9a-fA-F]','','g')); token text; who text;
begin
 if length(plain)<>12 then return jsonb_build_object('ok',false,'error','Code is not valid or has expired');end if;
 select * into p from public.agent_pairings where code_hash=public.agent_hash(plain) and used_at is null and expires_at>now() for update;
 if not found then return jsonb_build_object('ok',false,'error','Code is not valid or has expired');end if;
 if not exists(select 1 from public.employees where id=p.user_id and status in ('active','onboarding')) then return jsonb_build_object('ok',false,'error','Account is not active');end if;
 if (select count(*) from public.agent_devices where user_id=p.user_id and revoked_at is null)>=5 then return jsonb_build_object('ok',false,'error','This account already has 5 connected computers. Disconnect one first.');end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 insert into public.agent_devices(user_id,token_hash,device_name,os,agent_version) values(p.user_id,public.agent_hash(token),left(coalesce(nullif(trim(device_name),''),'Computer'),80),left(coalesce(os,''),80),left(coalesce(agent_version,''),20));
 update public.agent_pairings set used_at=now() where id=p.id;
 select first_name into who from public.employees where id=p.user_id;
 return jsonb_build_object('ok',true,'token',token,'employee',who);
end$$;

-- Called by the agent about every 30 seconds. Time is credited only for activity the agent measured while the
-- computer was awake, capped by the real time since the previous report, so sleeping or stopping adds nothing.
create function public.agent_heartbeat(token text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.agent_devices; uid uuid; elapsed numeric; reported numeric; credit integer; st text; tz text; day_start timestamptz; today integer; att uuid; apps jsonb;
begin
 if token is null or token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'reason','invalid');end if;
 select * into d from public.agent_devices where token_hash=public.agent_hash(token) for update;
 if not found or d.revoked_at is not null then return jsonb_build_object('ok',false,'reason','revoked');end if;
 uid:=d.user_id;
 if not exists(select 1 from public.employees where id=uid and status in ('active','onboarding')) then return jsonb_build_object('ok',false,'reason','inactive');end if;
 elapsed:=case when d.last_seen_at is null then 0 else greatest(extract(epoch from now()-d.last_seen_at),0) end;
 reported:=least(greatest(coalesce(nullif(payload->>'active_seconds','')::numeric,0),0),120);
 credit:=floor(least(reported,elapsed))::integer;
 st:=case when payload->>'state' in ('active','idle','locked') then payload->>'state' else 'idle' end;
 apps:=case when jsonb_typeof(payload->'top_apps')='array' and jsonb_array_length(payload->'top_apps')<=10 then payload->'top_apps' else '[]'::jsonb end;
 update public.agent_devices set last_seen_at=now(),agent_version=left(coalesce(nullif(payload->>'agent_version',''),agent_version),20) where id=d.id;
 insert into public.agent_status(device_id,user_id,state,cpu_percent,ram_percent,ram_used_mb,ram_total_mb,cpu_count,process_count,foreground_app,input_idle_seconds,top_apps)
 values(d.id,uid,st,
  least(greatest(coalesce(nullif(payload->>'cpu_percent','')::numeric,0),0),100),least(greatest(coalesce(nullif(payload->>'ram_percent','')::numeric,0),0),100),
  least(greatest(coalesce(nullif(payload->>'ram_used_mb','')::numeric,0),0),10000000)::integer,least(greatest(coalesce(nullif(payload->>'ram_total_mb','')::numeric,0),0),10000000)::integer,
  least(greatest(coalesce(nullif(payload->>'cpu_count','')::numeric,0),0),4096)::integer,least(greatest(coalesce(nullif(payload->>'process_count','')::numeric,0),0),1000000)::integer,
  left(coalesce(payload->>'foreground_app',''),80),least(greatest(coalesce(nullif(payload->>'input_idle_seconds','')::numeric,0),0),31536000)::integer,apps)
 on conflict(device_id) do update set state=excluded.state,cpu_percent=excluded.cpu_percent,ram_percent=excluded.ram_percent,ram_used_mb=excluded.ram_used_mb,ram_total_mb=excluded.ram_total_mb,
  cpu_count=excluded.cpu_count,process_count=excluded.process_count,foreground_app=excluded.foreground_app,input_idle_seconds=excluded.input_idle_seconds,top_apps=excluded.top_apps,updated_at=now();
 -- Credit worked time to today's open attendance record, and show the device there.
 update public.attendance set active_seconds=active_seconds+credit,last_seen_at=now(),last_device=d.device_name where employee_id=uid and check_out is null returning id into att;
 if att is not null then
  insert into public.attendance_devices(attendance_id,device_id,device_label,active_seconds) values(att,d.id::text,left(d.device_name||' (agent)',80),credit)
  on conflict(attendance_id,device_id) do update set last_seen_at=now(),active_seconds=public.attendance_devices.active_seconds+credit;
 end if;
 select timezone into tz from public.company_settings limit 1;
 day_start:=((now() at time zone coalesce(tz,'UTC'))::date::timestamp) at time zone coalesce(tz,'UTC');
 select coalesce(sum(active_seconds),0)::integer into today from public.attendance where employee_id=uid and check_in>=day_start;
 return jsonb_build_object('ok',true,'credited',credit,'checked_in',att is not null,'today_active_seconds',today,'server_time',now());
end$$;
revoke all on function public.agent_pair(text,text,text,text),public.agent_heartbeat(text,jsonb) from public;
grant execute on function public.agent_pair(text,text,text,text),public.agent_heartbeat(text,jsonb) to anon,authenticated;

-- Commands: portal-side agent actions, re-check-in on the same day, and agent-aware attendance heartbeats.
alter function public.command(text,uuid,integer,jsonb) rename to command_pre_agent;
revoke all on function public.command_pre_agent(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); code text; rid uuid; s public.company_settings; agent_live boolean; project uuid;
begin
 if action not in ('create_agent_pairing','revoke_agent_device','check_in','check_out','attendance_heartbeat','create_task') then return public.command_pre_agent(action,record_id,expected_version,payload);end if;
 if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;
 agent_live:=exists(select 1 from public.agent_devices where user_id=actor and revoked_at is null and last_seen_at>now()-interval '3 minutes');

 if action='create_task' then
  -- Only the leader who created the project can add tasks to it.
  project:=nullif(payload->>'project_id','')::uuid;
  if not exists(select 1 from public.projects where id=project and manager_id=actor) then raise exception 'Only the leader who created this project can create tasks in it';end if;
  return public.command_pre_agent(action,record_id,expected_version,payload);

 elsif action='create_agent_pairing' then
  delete from public.agent_pairings where user_id=actor and (used_at is not null or expires_at<now());
  if (select count(*) from public.agent_pairings where user_id=actor)>=5 then raise exception 'Too many unused codes. Wait a few minutes and try again.';end if;
  code:=substr(replace(gen_random_uuid()::text,'-',''),1,12);
  insert into public.agent_pairings(user_id,code_hash,expires_at) values(actor,public.agent_hash(code),now()+interval '10 minutes');
  return jsonb_build_object('success',true,'code',code,'expires_at',now()+interval '10 minutes');

 elsif action='revoke_agent_device' then
  update public.agent_devices set revoked_at=now() where id=record_id and revoked_at is null and (user_id=actor or public.has_role(array['hr','ceo']::public.app_role[])) returning id into rid;
  if rid is null then raise exception 'Computer not found';end if;
  delete from public.agent_status where device_id=rid;
  return jsonb_build_object('success',true,'id',rid);

 elsif action='check_in' then
  -- Checking in again later the same day resumes today's record instead of failing on the one-per-day rule.
  select * into s from public.company_settings limit 1;
  update public.attendance set check_out=null,last_seen_at=now(),status='recorded'
   where employee_id=actor and day=(now() at time zone s.timezone)::date and check_out is not null returning id into rid;
  if rid is not null then return jsonb_build_object('success',true,'id',rid,'resumed',true);end if;
  return public.command_pre_agent(action,record_id,expected_version,payload);

 elsif action='check_out' then
  -- While the agent reports, it is the only source of worked time; do not add browser time on top.
  if agent_live then update public.attendance set last_seen_at=now() where employee_id=actor and check_out is null;end if;
  return public.command_pre_agent(action,record_id,expected_version,payload);

 else
  if agent_live then return jsonb_build_object('open',true,'agent',true);end if;
  return public.command_pre_agent(action,record_id,expected_version,payload);
 end if;
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
