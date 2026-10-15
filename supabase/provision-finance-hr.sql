-- Run this ENTIRE file in Supabase SQL Editor after creating both Auth accounts.
-- Existing names, employee numbers and roles are preserved. Developer uses employee access.
do $$
declare member record; account auth.users;
begin
 for member in select * from (values
  ('39117bd5-c8ed-4af0-b31f-64e384b6333d'::uuid,'RM-006','Engineering / Finance','Developer / Finance','finance'::public.app_role),
  ('e70011d7-3982-4048-b246-698616ec9128'::uuid,'RM-009','Engineering / HR','Developer / HR','hr'::public.app_role)
 ) as members(id,employee_number,department,job_title,extra_role)
 loop
  select * into account from auth.users where id=member.id;
  if account.id is null or nullif(account.email,'') is null then
   raise exception 'Auth account % must exist and have an email first',member.id;
  end if;
  if exists(select 1 from public.employees where id=member.id and status in ('suspended','offboarded')) then
   raise exception 'Account % is suspended/offboarded; review its status separately',member.id;
  end if;
  insert into public.employees(id,employee_number,first_name,last_name,work_email,department,job_title,status)
  values(account.id,member.employee_number,
   coalesce(nullif(trim(account.raw_user_meta_data->>'first_name'),''),nullif(trim(account.raw_user_meta_data->>'full_name'),''),nullif(trim(account.raw_user_meta_data->>'name'),''),split_part(account.email,'@',1)),
   coalesce(account.raw_user_meta_data->>'last_name',''),account.email,member.department,member.job_title,'active')
  on conflict(id) do update set department=excluded.department,job_title=excluded.job_title,version=public.employees.version+1;
  insert into public.user_roles(user_id,role) values(member.id,'employee'),(member.id,member.extra_role)
  on conflict do nothing;
  insert into public.audit_events(actor_id,event,entity_id,details)
  values(null,'team_access_configured',member.id,jsonb_build_object('source','reviewed SQL setup','job_title',member.job_title,'additional_role',member.extra_role));
 end loop;
end$$;

select e.id,e.employee_number,concat_ws(' ',e.first_name,e.last_name) as name,
 e.work_email,e.job_title,e.status,array_agg(r.role order by r.role) as roles
from public.employees e join public.user_roles r on r.user_id=e.id
where e.id in ('39117bd5-c8ed-4af0-b31f-64e384b6333d','e70011d7-3982-4048-b246-698616ec9128')
group by e.id order by e.employee_number;
