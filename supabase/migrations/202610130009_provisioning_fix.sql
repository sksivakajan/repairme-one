-- Follow-up for projects that applied the first migration bundle while development was in progress.
begin;
create or replace function public.provision_employee(user_id uuid,email text,first_name text,last_name text,employee_number text,department text,job_title text) returns uuid language plpgsql security definer set search_path='' as $$ begin
 if not public.has_role(array['ceo','admin']::public.app_role[]) then raise exception 'Account administrator required';end if;
 if not exists(select 1 from auth.users u where u.id=provision_employee.user_id and lower(u.email)=lower(provision_employee.email)) then raise exception 'Invitation identity mismatch';end if;
 insert into public.employees(id,employee_number,first_name,last_name,work_email,department,job_title,status) values(user_id,employee_number,first_name,last_name,email,department,job_title,'onboarding');
 insert into public.user_roles values(user_id,'employee');
 insert into public.checklist_items(employee_id,title) values(user_id,'Complete HR documents'),(user_id,'Set up account and equipment'),(user_id,'Meet your team');
 perform public.audit('account_invited',user_id);return user_id;
end $$;

create or replace function public.request_notification() returns trigger language plpgsql security definer set search_path='' as $$ declare recipient uuid;entity uuid;kind text;href text;owner uuid;begin
 entity:=new.id;
 if TG_TABLE_NAME='expenses' then
  for recipient in select r.user_id from public.user_roles r join public.employees e on e.id=r.user_id where r.role='ceo' and e.status='active' and r.user_id<>new.submitted_by loop
   insert into public.notifications(user_id,title,href,dedupe_key) values(recipient,'Expense request needs review','/finance',entity||':submitted:'||recipient) on conflict(dedupe_key) do nothing;
  end loop;
 elsif TG_TABLE_NAME='leave_requests' then
  select manager_id into recipient from public.employees where id=new.employee_id;
  if recipient is not null and recipient<>new.employee_id then insert into public.notifications(user_id,title,href,dedupe_key) values(recipient,'Leave request needs review','/my-work',entity||':submitted:'||recipient) on conflict do nothing;
  else
   insert into public.notifications(user_id,title,href,dedupe_key) select user_id,'Leave request needs review','/hr',entity||':submitted:'||user_id from public.user_roles where role='ceo' and user_id<>new.employee_id on conflict do nothing;
  end if;
 elsif TG_TABLE_NAME='tasks' and new.assignee_id is not null then
  insert into public.notifications(user_id,title,href,dedupe_key) values(new.assignee_id,'A task has been assigned to you','/my-work',entity||':assigned') on conflict do nothing;
 end if;return new;end $$;
commit;
