begin;
-- One active session per user, and "remember this device" for the authenticator (MFA) prompt.
create table public.active_sessions(
 user_id uuid primary key references public.employees(id) on delete cascade,
 session_id uuid not null,
 mfa_trusted boolean not null default false,
 started_at timestamptz not null default now());
create table public.trusted_devices(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.employees(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64),
 label text not null default 'Trusted device' check(length(label)<=80),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null);
create index trusted_devices_user on public.trusted_devices(user_id,expires_at);
alter table public.active_sessions enable row level security;
alter table public.trusted_devices enable row level security;
revoke all on public.active_sessions,public.trusted_devices from anon,authenticated;

create function public.jwt_session() returns uuid language sql stable set search_path='' as $$ select nullif(auth.jwt()->>'session_id','')::uuid; $$;

-- True unless a newer sign-in has replaced this session.
create function public.session_is_current() returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.active_sessions s where s.user_id=auth.uid())
  or exists(select 1 from public.active_sessions s where s.user_id=auth.uid() and s.session_id=public.jwt_session()); $$;

-- True when the authenticator was verified in this session, or this session started on a trusted device.
create function public.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2'
  or exists(select 1 from public.active_sessions s where s.user_id=auth.uid() and s.session_id=public.jwt_session() and s.mfa_trusted); $$;

create or replace function public.active_user() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.employees where id=auth.uid() and status in ('active','onboarding')) and public.session_is_current(); $$;
create or replace function public.has_role(wanted public.app_role[]) returns boolean language sql stable security definer set search_path='' as $$
 select public.active_user() and exists(select 1 from public.user_roles where user_id=auth.uid() and role=any(wanted)) and (not exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('ceo','admin','hr','finance','manager')) or public.mfa_satisfied()); $$;

-- Called right after a sign-in. This session replaces any other session of the same user.
create function public.claim_session(trusted_hash text default null) returns void language plpgsql security definer set search_path='' as $$
declare sid uuid:=public.jwt_session(); trusted boolean;
begin
 if auth.uid() is null or sid is null then raise exception 'Session required';end if;
 trusted:=trusted_hash is not null and exists(select 1 from public.trusted_devices where user_id=auth.uid() and token_hash=trusted_hash and expires_at>now());
 insert into public.active_sessions(user_id,session_id,mfa_trusted) values(auth.uid(),sid,trusted)
  on conflict(user_id) do update set session_id=excluded.session_id,mfa_trusted=excluded.mfa_trusted,started_at=now();
 delete from public.trusted_devices where user_id=auth.uid() and expires_at<=now();
 perform public.audit('session_started',auth.uid(),jsonb_build_object('trusted_device',trusted));
end$$;

-- Only after the authenticator code was really verified (aal2) may a device be remembered.
create function public.trust_this_device(token_hash text,device_label text default 'Trusted device') returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2' or not public.session_is_current() then raise exception 'Verify your authenticator first';end if;
 if length(token_hash)<>64 then raise exception 'Invalid device token';end if;
 insert into public.trusted_devices(user_id,token_hash,label,expires_at) values(auth.uid(),token_hash,left(coalesce(nullif(trim(device_label),''),'Trusted device'),80),now()+interval '30 days');
 update public.active_sessions set mfa_trusted=true where user_id=auth.uid() and session_id=public.jwt_session();
 perform public.audit('device_trusted',auth.uid(),'{}');
end$$;

-- Forget every remembered device, for example after a password change.
create function public.revoke_trusted_devices() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Session required';end if;
 delete from public.trusted_devices where user_id=auth.uid();
 update public.active_sessions set mfa_trusted=false where user_id=auth.uid() and coalesce(auth.jwt()->>'aal','')<>'aal2';
 perform public.audit('trusted_devices_revoked',auth.uid(),'{}');
end$$;

revoke all on function public.session_is_current(),public.mfa_satisfied(),public.claim_session(text),public.trust_this_device(text,text),public.revoke_trusted_devices(),public.jwt_session() from public,anon;
grant execute on function public.session_is_current(),public.mfa_satisfied(),public.claim_session(text),public.trust_this_device(text,text),public.revoke_trusted_devices(),public.jwt_session() to authenticated;

-- Commands: reject a replaced session, and let a trusted-device session pass the MFA checks inside the older wrappers.
alter function public.command(text,uuid,integer,jsonb) rename to command_pre_session;
revoke all on function public.command_pre_session(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.session_is_current() then raise exception 'You were signed out because this account signed in on another device';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2' and public.mfa_satisfied() then
  perform set_config('request.jwt.claims',jsonb_set(auth.jwt(),'{aal}','"aal2"')::text,true);
 end if;
 return public.command_pre_session(action,record_id,expected_version,payload);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
