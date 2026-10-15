begin;
-- Coffee breaks: after 60 minutes of continuous work the employee is offered a 10 minute break. They can start
-- it or push it back 10 minutes. Time on a break is never counted as work. The same state serves the web portal
-- and the desktop app, so both show the same prompt.
-- Offline sync: the desktop app stores work minutes locally while the portal is unreachable and uploads them later.
-- agent_minutes is the ledger that makes sure one minute is credited once, and at most 60 seconds.
create table public.agent_minutes(
 user_id uuid not null references public.employees(id) on delete cascade,
 minute timestamptz not null,
 seconds integer not null check(seconds between 0 and 60),
 device_id uuid references public.agent_devices(id) on delete set null,
 source text not null default 'live' check(source in ('live','backlog')),
 primary key(user_id,minute));
create table public.work_streaks(
 user_id uuid primary key references public.employees(id) on delete cascade,
 streak_seconds integer not null default 0 check(streak_seconds>=0),
 last_active_at timestamptz,
 snoozed_until timestamptz);
create table public.work_breaks(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete cascade,
 started_at timestamptz not null default now(),
 ends_at timestamptz not null,
 ended_at timestamptz,
 end_reason text check(end_reason in ('finished','ended_early')));
create unique index one_open_break on public.work_breaks(user_id) where ended_at is null;
create index work_breaks_user on public.work_breaks(user_id,started_at desc);
alter table public.agent_minutes enable row level security;
alter table public.work_streaks enable row level security;
alter table public.work_breaks enable row level security;
create policy work_streaks_read on public.work_streaks for select to authenticated using(public.active_user() and (user_id=auth.uid() or public.is_manager(user_id) or public.has_role(array['hr','ceo']::public.app_role[])));
create policy work_breaks_read on public.work_breaks for select to authenticated using(public.active_user() and (user_id=auth.uid() or public.is_manager(user_id) or public.has_role(array['hr','ceo']::public.app_role[])));
revoke all on public.agent_minutes,public.work_streaks,public.work_breaks from anon,authenticated;
grant select on public.work_streaks,public.work_breaks to authenticated;
alter table public.agent_status drop constraint agent_status_state_check;
alter table public.agent_status add constraint agent_status_state_check check(state in ('active','idle','locked','break'));

-- Adds counted seconds to the continuous-work streak. A pause of 10 minutes or more is a natural break and resets it.
create function public.work_credit(uid uuid,seconds integer,at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if seconds<=0 or exists(select 1 from public.work_breaks where user_id=uid and ended_at is null and ends_at>now()) then return;end if;
 insert into public.work_streaks as w(user_id,streak_seconds,last_active_at) values(uid,seconds,at)
 on conflict(user_id) do update set
  streak_seconds=case when w.last_active_at is null or w.last_active_at<at-interval '10 minutes' then excluded.streak_seconds else w.streak_seconds+excluded.streak_seconds end,
  snoozed_until=case when w.last_active_at is null or w.last_active_at<at-interval '10 minutes' then null else w.snoozed_until end,
  last_active_at=excluded.last_active_at;
end$$;

-- What the portal and the desktop app show. Closes a break whose time is up (and resets the streak).
create function public.work_status_for(uid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.work_breaks; s public.work_streaks; streak integer:=0; due boolean; last_ended timestamptz;
begin
 update public.work_breaks set ended_at=ends_at,end_reason='finished' where user_id=uid and ended_at is null and ends_at<=now();
 if found then update public.work_streaks set streak_seconds=0,last_active_at=null,snoozed_until=null where user_id=uid;end if;
 select * into b from public.work_breaks where user_id=uid and ended_at is null;
 select * into s from public.work_streaks where user_id=uid;
 select max(ended_at) into last_ended from public.work_breaks where user_id=uid and ended_at is not null;
 streak:=case when s.last_active_at is null or s.last_active_at<now()-interval '10 minutes' then 0 else s.streak_seconds end;
 due:=b.id is null and streak>=3600 and (s.snoozed_until is null or s.snoozed_until<=now());
 return jsonb_build_object('on_break',b.id is not null,'break_ends_at',b.ends_at,
  'break_seconds_left',case when b.id is null then 0 else greatest(floor(extract(epoch from b.ends_at-now())),0)::integer end,
  'streak_seconds',streak,'break_due',due,'snoozed_until',s.snoozed_until,'last_break_ended_at',last_ended,
  'work_block_seconds',3600,'break_seconds',600,'server_time',now());
end$$;
create function public.work_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.active_user() then raise exception 'Account access denied';end if;
 return public.work_status_for(auth.uid());
end$$;
revoke all on function public.work_credit(uuid,integer,timestamptz),public.work_status_for(uuid) from public,anon,authenticated;
revoke all on function public.work_status() from public,anon;
grant execute on function public.work_status() to authenticated;

-- Pairing now also returns the account id, so the desktop app can tell whose computer it is.
create or replace function public.agent_pair(code text,device_name text,os text default '',agent_version text default '') returns jsonb language plpgsql security definer set search_path='' as $$
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
 return jsonb_build_object('ok',true,'token',token,'employee',who,'user_id',p.user_id);
end$$;

-- The 30-second report. Same rules as before, plus: no credit during a coffee break, the continuous-work streak,
-- the per-minute ledger, and upload of work minutes the app stored while it was offline.
create or replace function public.agent_heartbeat(token text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.agent_devices; uid uuid; elapsed numeric; reported numeric; credit integer; st text; tz text; day_start timestamptz; today integer; att uuid; apps jsonb; paused boolean; item jsonb; m timestamptz; sec integer; added integer; backlog_total integer:=0;
begin
 if token is null or token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'reason','invalid');end if;
 select * into d from public.agent_devices where token_hash=public.agent_hash(token) for update;
 if not found or d.revoked_at is not null then return jsonb_build_object('ok',false,'reason','revoked');end if;
 uid:=d.user_id;
 if not exists(select 1 from public.employees where id=uid and status in ('active','onboarding')) then return jsonb_build_object('ok',false,'reason','inactive');end if;
 paused:=exists(select 1 from public.work_breaks where user_id=uid and ended_at is null and ends_at>now());
 elapsed:=case when d.last_seen_at is null then 0 else greatest(extract(epoch from now()-d.last_seen_at),0) end;
 reported:=least(greatest(coalesce(nullif(payload->>'active_seconds','')::numeric,0),0),120);
 credit:=case when paused then 0 else floor(least(reported,elapsed))::integer end;
 st:=case when paused then 'break' when payload->>'state' in ('active','idle','locked') then payload->>'state' else 'idle' end;
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
 update public.attendance set active_seconds=active_seconds+credit,last_seen_at=now(),last_device=d.device_name where employee_id=uid and check_out is null returning id into att;
 if att is not null then
  insert into public.attendance_devices(attendance_id,device_id,device_label,active_seconds) values(att,d.id::text,left(d.device_name||' (agent)',80),credit)
  on conflict(attendance_id,device_id) do update set last_seen_at=now(),active_seconds=public.attendance_devices.active_seconds+credit;
 end if;
 if credit>0 then
  insert into public.agent_minutes(user_id,minute,seconds,device_id,source) values(uid,date_trunc('minute',now()),least(credit,60),d.id,'live')
  on conflict(user_id,minute) do update set seconds=least(60,public.agent_minutes.seconds+excluded.seconds);
  perform public.work_credit(uid,credit,now());
 end if;
 -- Minutes the app stored while offline: each minute is credited once, at most 60 seconds, never inside a break.
 if jsonb_typeof(payload->'backlog')='array' then
  for item in select value from jsonb_array_elements(payload->'backlog') limit 120 loop
   begin
    m:=date_trunc('minute',(item->>'minute')::timestamptz);
    sec:=least(greatest(coalesce(nullif(item->>'seconds','')::numeric,0),0),60)::integer;
   exception when others then continue;
   end;
   continue when sec=0 or m<now()-interval '3 days' or m>now()-interval '1 minute';
   continue when exists(select 1 from public.work_breaks b where b.user_id=uid and m>=b.started_at and m<coalesce(b.ended_at,b.ends_at));
   insert into public.agent_minutes(user_id,minute,seconds,device_id,source) values(uid,m,sec,d.id,'backlog') on conflict do nothing;
   get diagnostics added=row_count;
   if added>0 then
    update public.attendance set active_seconds=active_seconds+sec where id=(select a.id from public.attendance a where a.employee_id=uid and a.check_in<=m and (a.check_out is null or a.check_out>=m) order by a.check_in desc limit 1);
    backlog_total:=backlog_total+sec;
   end if;
  end loop;
 end if;
 select timezone into tz from public.company_settings limit 1;
 day_start:=((now() at time zone coalesce(tz,'UTC'))::date::timestamp) at time zone coalesce(tz,'UTC');
 select coalesce(sum(active_seconds),0)::integer into today from public.attendance where employee_id=uid and check_in>=day_start;
 return jsonb_build_object('ok',true,'credited',credit,'backlog_credited',backlog_total,'checked_in',att is not null,'today_active_seconds',today,'server_time',now(),'work',public.work_status_for(uid));
end$$;

-- Commands: start, push back or end a coffee break; browser attendance heartbeats respect breaks and feed the streak.
alter function public.command(text,uuid,integer,jsonb) rename to command_pre_break;
revoke all on function public.command_pre_break(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid; before_s integer; after_s integer; result jsonb;
begin
 if action not in ('start_break','snooze_break','end_break','attendance_heartbeat') then return public.command_pre_break(action,record_id,expected_version,payload);end if;
 if actor is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and not public.mfa_satisfied() then raise exception 'MFA required';end if;

 if action='attendance_heartbeat' then
  if exists(select 1 from public.work_breaks where user_id=actor and ended_at is null and ends_at>now()) then return jsonb_build_object('open',true,'on_break',true);end if;
  select active_seconds into before_s from public.attendance where employee_id=actor and check_out is null;
  result:=public.command_pre_break(action,record_id,expected_version,payload);
  select active_seconds into after_s from public.attendance where employee_id=actor and check_out is null;
  if before_s is not null and after_s>before_s then perform public.work_credit(actor,after_s-before_s,now());end if;
  return result;

 elsif action='start_break' then
  perform public.work_status_for(actor);
  if exists(select 1 from public.work_breaks where user_id=actor and ended_at is null) then raise exception 'You are already on a break';end if;
  insert into public.work_breaks(user_id,ends_at) values(actor,now()+interval '10 minutes');
  update public.work_streaks set snoozed_until=null where user_id=actor;
  return jsonb_build_object('success',true,'status',public.work_status_for(actor));

 elsif action='snooze_break' then
  insert into public.work_streaks as w(user_id,streak_seconds,last_active_at,snoozed_until) values(actor,0,null,now()+interval '10 minutes')
  on conflict(user_id) do update set snoozed_until=now()+interval '10 minutes';
  return jsonb_build_object('success',true,'status',public.work_status_for(actor));

 else
  update public.work_breaks set ended_at=now(),end_reason='ended_early' where user_id=actor and ended_at is null returning id into rid;
  if rid is null then raise exception 'No break is in progress';end if;
  update public.work_streaks set streak_seconds=0,last_active_at=null,snoozed_until=null where user_id=actor;
  return jsonb_build_object('success',true,'status',public.work_status_for(actor));
 end if;
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
