begin;
create table public.support_tickets(
 id uuid primary key default gen_random_uuid(), ticket_number bigint generated always as identity unique,
 requester_id uuid not null references public.employees(id), assignee_id uuid references public.employees(id),
 title text not null check(length(trim(title)) between 3 and 160),
 description text not null check(length(trim(description)) between 5 and 5000),
 category text not null check(category in ('it_support','hardware','software_accounts','internet','office_equipment','facilities','supplies','hr','other')),
 location text not null default '' check(length(location)<=200),
 priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),
 status text not null default 'open' check(status in ('open','in_progress','waiting','resolved','closed')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.ticket_comments(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets(id),author_id uuid not null references public.employees(id),body text not null check(length(trim(body)) between 1 and 5000),created_at timestamptz not null default now());
create table public.ticket_events(id uuid primary key default gen_random_uuid(),ticket_id uuid not null references public.support_tickets(id),actor_id uuid not null references public.employees(id),event text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create index ticket_requester on public.support_tickets(requester_id,created_at desc);
create index ticket_assignee on public.support_tickets(assignee_id,status);
create index ticket_comment_parent on public.ticket_comments(ticket_id,created_at);
create index ticket_event_parent on public.ticket_events(ticket_id,created_at);
create function public.ticket_access(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.active_user() and exists(select 1 from public.support_tickets where id=target and (requester_id=auth.uid() or assignee_id=auth.uid() or public.has_role(array['ceo','admin']::public.app_role[]))); $$;
revoke all on function public.ticket_access(uuid) from public,anon;
grant execute on function public.ticket_access(uuid) to authenticated;
alter table public.support_tickets enable row level security;
alter table public.ticket_comments enable row level security;
alter table public.ticket_events enable row level security;
create policy ticket_read on public.support_tickets for select to authenticated using(public.ticket_access(id));
create policy ticket_comment_read on public.ticket_comments for select to authenticated using(public.ticket_access(ticket_id));
create policy ticket_event_read on public.ticket_events for select to authenticated using(public.ticket_access(ticket_id));
revoke all on public.support_tickets,public.ticket_comments,public.ticket_events from anon,authenticated;
grant select on public.support_tickets,public.ticket_comments,public.ticket_events to authenticated;
create function public.ticket_history_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Ticket history is immutable';end$$;
create trigger immutable_ticket_comments before update or delete on public.ticket_comments for each row execute function public.ticket_history_immutable();
create trigger immutable_ticket_events before update or delete on public.ticket_events for each row execute function public.ticket_history_immutable();
alter function public.command(text,uuid,integer,jsonb) rename to command_business;
revoke all on function public.command_business(text,uuid,integer,jsonb) from public,anon,authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); t public.support_tickets; target uuid; next_state text; event_name text; note text; staff boolean;
begin
 if action not in ('create_ticket','assign_ticket','transition_ticket','comment_ticket') then return public.command_business(action,record_id,expected_version,payload);end if;
 if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required';end if;
 staff:=public.has_role(array['ceo','admin']::public.app_role[]);
 if action='create_ticket' then
  insert into public.support_tickets(requester_id,title,description,category,location,priority)
  values(actor,trim(payload->>'title'),trim(payload->>'description'),payload->>'category',trim(coalesce(payload->>'location','')),coalesce(payload->>'priority','medium')) returning * into t;
  event_name:='created';
 else
  select * into strict t from public.support_tickets where id=record_id for update;
  if not public.ticket_access(t.id) then raise exception 'Ticket access denied';end if;
  if t.version is distinct from expected_version then raise exception 'Ticket changed; refresh and try again';end if;
  if action='assign_ticket' then
   if not staff then raise exception 'Ticket administrator required';end if;
   target:=nullif(payload->>'assignee_id','')::uuid;
   if target is not null and not exists(select 1 from public.employees where id=target and status='active') then raise exception 'Active assignee required';end if;
   update public.support_tickets set assignee_id=target,version=version+1,updated_at=now() where id=t.id;
   event_name:='assigned';
  elsif action='transition_ticket' then
   next_state:=payload->>'status';note:=trim(coalesce(payload->>'reason',''));
   if length(note)<3 or length(note)>5000 then raise exception 'Update reason required';end if;
   if not ((t.status='open' and next_state in ('in_progress','waiting','resolved')) or (t.status='in_progress' and next_state in ('waiting','resolved')) or (t.status='waiting' and next_state in ('in_progress','resolved')) or (t.status='resolved' and next_state in ('open','closed')) or (t.status='closed' and next_state='open')) then raise exception 'Invalid ticket transition';end if;
   if not staff and t.assignee_id is distinct from actor and not(t.requester_id=actor and ((t.status='resolved' and next_state in ('open','closed')) or (t.status='closed' and next_state='open'))) then raise exception 'Assigned support staff required';end if;
   update public.support_tickets set status=next_state,version=version+1,updated_at=now() where id=t.id;
   event_name:='status_changed';
  else
   if t.status='closed' then raise exception 'Reopen ticket before commenting';end if;
   insert into public.ticket_comments(ticket_id,author_id,body) values(t.id,actor,trim(payload->>'body'));
   update public.support_tickets set version=version+1,updated_at=now() where id=t.id;
   event_name:='commented';
  end if;
 end if;
 insert into public.ticket_events(ticket_id,actor_id,event,details) values(t.id,actor,event_name,case when action='transition_ticket' then jsonb_build_object('from',t.status,'to',next_state,'reason',note) when action='assign_ticket' then jsonb_build_object('from',t.assignee_id,'to',target) else '{}'::jsonb end);
 perform public.audit('ticket_'||event_name,t.id,jsonb_build_object('ticket_number',t.ticket_number));
 insert into public.notifications(user_id,title,href,dedupe_key)
 select distinct recipient,'Ticket #'||t.ticket_number||' '||replace(event_name,'_',' '),'/ticketing','ticket:'||t.id||':'||gen_random_uuid()||':'||recipient
 from (select t.requester_id as recipient union select assignee_id from public.support_tickets where id=t.id union select user_id from public.user_roles where role in ('ceo','admin') and action='create_ticket') n
 where recipient is not null and recipient<>actor;
 return jsonb_build_object('id',t.id);
end$$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;
