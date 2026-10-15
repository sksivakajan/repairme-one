begin;
-- 1. Authenticator codes (MFA) are no longer required. Every role check and command asks mfa_satisfied(), and the
--    session wrapper lifts the session to the MFA level when it returns true, so this one function turns the rule off.
--    The single-active-session rule is unchanged: a new sign-in still signs the old one out.
create or replace function public.mfa_satisfied() returns boolean language sql stable security definer set search_path='' as $$ select true; $$;

-- 2. Desktop agent time must stop when the person stops. Older installed agents also counted a PC as "working" when
--    only a window or memory use changed. The server now enforces the rule for every agent version:
--    no keyboard or mouse for 5 minutes counts only while the PC is under sustained heavy load (a build or render),
--    and nothing counts after 30 minutes without input.
alter function public.agent_heartbeat(text,jsonb) rename to agent_heartbeat_raw;
revoke all on function public.agent_heartbeat_raw(text,jsonb) from public,anon,authenticated;
create function public.agent_heartbeat(token text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p jsonb:=payload; idle numeric; cpu numeric;
begin
 if jsonb_typeof(p)='object' then
  idle:=coalesce(nullif(p->>'input_idle_seconds','')::numeric,0);
  cpu:=coalesce(nullif(p->>'cpu_percent','')::numeric,0);
  if idle>1800 or (idle>300 and cpu<20) then
   p:=jsonb_set(jsonb_set(p,'{active_seconds}','0'),'{state}',case when p->>'state'='locked' then '"locked"' else '"idle"' end::jsonb);
  end if;
 end if;
 return public.agent_heartbeat_raw(token,p);
end$$;
revoke all on function public.agent_heartbeat(text,jsonb) from public;
grant execute on function public.agent_heartbeat(text,jsonb) to anon,authenticated;
commit;
