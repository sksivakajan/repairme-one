-- Run this ENTIRE file in one Supabase SQL Editor query. No temporary tables.
-- Existing names, employee numbers and roles are preserved on reruns.
do $$
declare member record; auth_user auth.users;
begin
 for member in select * from (values
 ('8ed07614-2258-4075-8c35-f8f94fc4bbca'::uuid,'RM-002','HR / Engineering','HR / Developer',array['hr']::public.app_role[]),
 ('c3b80b19-a389-466d-9c0f-3aca5ec62f9b'::uuid,'RM-003','Engineering','Developer','{}'),
 ('e0c9dde1-9b12-4013-8894-523ec9a91fb4'::uuid,'RM-004','Engineering','Developer','{}'),
 ('084e3b31-f687-4926-a8d5-fb6a354d3492'::uuid,'RM-005','Leadership','CMO / CFO / COO',array['finance','manager']::public.app_role[]),
 ('39117bd5-c8ed-4af0-b31f-64e384b6333d'::uuid,'RM-006','Engineering / Marketing','Developer / Marketing','{}'),
 ('b9d94de3-2131-44fb-8609-6fd6ae4fead2'::uuid,'RM-007','Engineering','Developer','{}'),
 ('4e273fb2-0553-40ce-9c26-cb4f65e35b9a'::uuid,'RM-008','Engineering','Developer','{}')
 ) as members(id,employee_number,department,job_title,extra_roles)
 loop
  select * into auth_user from auth.users where id=member.id;
  if auth_user.id is null or nullif(auth_user.email,'') is null then
   raise exception 'Auth user % is missing or has no email',member.id;
  end if;
  if exists(select 1 from public.user_roles where user_id=member.id and role in ('ceo','admin')) then
   raise exception 'Account % already has owner/admin privileges; review before changing it',member.id;
  end if;
  if exists(select 1 from public.employees where id=member.id and status in ('suspended','offboarded')) then
   raise exception 'Account % is suspended/offboarded; review separately',member.id;
  end if;
  insert into public.employees(id,employee_number,first_name,last_name,work_email,department,job_title,status)
  values(auth_user.id,member.employee_number,
   coalesce(nullif(trim(auth_user.raw_user_meta_data->>'first_name'),''),nullif(trim(auth_user.raw_user_meta_data->>'full_name'),''),nullif(trim(auth_user.raw_user_meta_data->>'name'),''),split_part(auth_user.email,'@',1)),
   coalesce(auth_user.raw_user_meta_data->>'last_name',''),auth_user.email,member.department,member.job_title,'active')
  on conflict(id) do update set department=excluded.department,job_title=excluded.job_title,version=public.employees.version+1;
  insert into public.user_roles(user_id,role)
  select member.id,'employee'::public.app_role
  union select member.id,unnest(member.extra_roles)
  on conflict do nothing;
  insert into public.audit_events(actor_id,event,entity_id,details)
  values(null,'team_account_provisioned',member.id,jsonb_build_object('source','reviewed SQL bootstrap','job_title',member.job_title,'additional_roles',member.extra_roles));
 end loop;
end$$;
select e.id,e.work_email,e.first_name,e.last_name,e.job_title,e.status,array_agg(r.role order by r.role) as roles
from public.employees e join public.user_roles r on r.user_id=e.id
where e.id in (
'8ed07614-2258-4075-8c35-f8f94fc4bbca','c3b80b19-a389-466d-9c0f-3aca5ec62f9b','e0c9dde1-9b12-4013-8894-523ec9a91fb4','084e3b31-f687-4926-a8d5-fb6a354d3492','39117bd5-c8ed-4af0-b31f-64e384b6333d','b9d94de3-2131-44fb-8609-6fd6ae4fead2','4e273fb2-0553-40ce-9c26-cb4f65e35b9a')
group by e.id order by e.employee_number;
