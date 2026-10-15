-- Apply in Supabase SQL Editor. Grants CEO access to the existing Repair Me account.
-- Safe if the original owner bootstrap has already been applied.
begin;
do $$begin
 if not exists(select 1 from auth.users where id='3862dd9f-de31-4c57-a6fb-045a746b456e' and email is not null) then
  raise exception 'Create this account in Supabase Authentication first';
 end if;
 if exists(select 1 from public.employees where id='3862dd9f-de31-4c57-a6fb-045a746b456e' and status in ('suspended','offboarded')) then
  raise exception 'Review suspended/offboarded account before granting owner access';
 end if;
end$$;
insert into public.employees(id,employee_number,first_name,last_name,work_email,department,job_title,status)
select id,'RM-OWNER','Repair','Me',email,'','','active' from auth.users
where id='3862dd9f-de31-4c57-a6fb-045a746b456e'
on conflict(id) do update set first_name='Repair',last_name='Me',department='',job_title='',status='active',version=public.employees.version+1;
insert into public.user_roles(user_id,role) values
 ('3862dd9f-de31-4c57-a6fb-045a746b456e','ceo'),
 ('3862dd9f-de31-4c57-a6fb-045a746b456e','employee')
on conflict do nothing;
insert into public.audit_events(actor_id,event,entity_id,details)
values(null,'owner_access_configured','3862dd9f-de31-4c57-a6fb-045a746b456e','{"source":"reviewed SQL setup"}');
select e.id,e.first_name,e.last_name,e.status,r.role from public.employees e
join public.user_roles r on r.user_id=e.id where e.id='3862dd9f-de31-4c57-a6fb-045a746b456e';
commit;
