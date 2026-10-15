begin;
alter table public.documents add column state text not null default 'ready' check(state in ('staged','ready'));
create or replace function public.document_access(document uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.active_user() and exists(select 1 from public.documents d where d.id=document and d.state='ready' and ((d.classification='own' and d.owner_id=auth.uid()) or(d.classification='project' and public.project_access(d.project_id)) or(d.classification='hr' and public.has_role(array['ceo','hr']::public.app_role[])) or(d.classification='finance' and public.has_role(array['ceo','finance']::public.app_role[])))); $$;
create function public.provision_employee(user_id uuid,email text,first_name text,last_name text,employee_number text,department text,job_title text) returns uuid language plpgsql security definer set search_path='' as $$ begin
 if not public.has_role(array['ceo','admin']::public.app_role[]) then raise exception 'Account administrator required';end if;
 if not exists(select 1 from auth.users u where u.id=user_id and lower(u.email)=lower(email)) then raise exception 'Invitation identity mismatch';end if;
 insert into public.employees(id,employee_number,first_name,last_name,work_email,department,job_title,status) values(user_id,employee_number,first_name,last_name,email,department,job_title,'onboarding');
 insert into public.user_roles values(user_id,'employee');
 insert into public.checklist_items(employee_id,title) values(user_id,'Complete HR documents'),(user_id,'Set up account and equipment'),(user_id,'Meet your team');
 perform public.audit('account_invited',user_id);return user_id;
end $$;
create function public.prepare_document(file_name text,file_type text,file_size bigint,classification text,project_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$ declare document_id uuid:=gen_random_uuid();file_path text;begin
 if not public.active_user() or not public.has_role(array['employee','ceo','hr','finance','manager','admin']::public.app_role[]) then raise exception 'Authenticated workspace required';end if;
 if file_type not in ('application/pdf','image/jpeg','image/png','text/plain') or file_size not between 1 and 5242880 or length(file_name) not between 1 and 200 then raise exception 'Unsupported file or size';end if;
 if not(classification='own' or(classification='project' and public.project_access(project_id)) or(classification='hr' and public.has_role(array['hr','ceo']::public.app_role[])) or(classification='finance' and public.has_role(array['finance','ceo']::public.app_role[]))) then raise exception 'Document classification access denied';end if;
 file_path:=auth.uid()::text||'/'||document_id::text;
 insert into public.documents(id,owner_id,project_id,name,path,classification,mime_type,size_bytes,state) values(document_id,auth.uid(),project_id,file_name,file_path,classification,file_type,file_size,'staged');
 return jsonb_build_object('id',document_id,'path',file_path);
end $$;
create function public.document_upload_access(file_path text) returns boolean language sql stable security definer set search_path='' as $$ select public.active_user() and exists(select 1 from public.documents where path=file_path and owner_id=auth.uid() and state='staged'); $$;
create policy private_file_upload on storage.objects for insert to authenticated with check(bucket_id='private-documents' and public.document_upload_access(name));
create function public.finish_document(document_id uuid) returns void language plpgsql security definer set search_path='' as $$ declare file_path text;begin
 select path into strict file_path from public.documents where id=document_id and owner_id=auth.uid() and state='staged' for update;
 if not public.active_user() or not exists(select 1 from storage.objects where bucket_id='private-documents' and name=file_path) then raise exception 'Uploaded file required';end if;
 update public.documents set state='ready' where id=document_id;
 perform public.audit('document_uploaded',document_id);
end $$;
create function public.request_notification() returns trigger language plpgsql security definer set search_path='' as $$ declare recipient uuid;entity uuid;kind text;href text;owner uuid;begin
 entity:=new.id;
 if TG_TABLE_NAME='expenses' then
  for recipient in select r.user_id from public.user_roles r join public.employees e on e.id=r.user_id where r.role='ceo' and e.status='active' and r.user_id<>new.submitted_by loop
   insert into public.notifications(user_id,title,href,dedupe_key) values(recipient,'Expense request needs review','/finance',entity||':submitted:'||recipient) on conflict(dedupe_key) do nothing;
  end loop;
 elsif TG_TABLE_NAME='leave_requests' then
  select manager_id into recipient from public.employees where id=new.employee_id;
  if recipient is not null and recipient<>new.employee_id then insert into public.notifications(user_id,title,href,dedupe_key) values(recipient,'Leave request needs review','/hr',entity||':submitted:'||recipient) on conflict do nothing;
  else
   insert into public.notifications(user_id,title,href,dedupe_key) select user_id,'Leave request needs review','/hr',entity||':submitted:'||user_id from public.user_roles where role='ceo' and user_id<>new.employee_id on conflict do nothing;
  end if;
 elsif TG_TABLE_NAME='tasks' and new.assignee_id is not null then
  insert into public.notifications(user_id,title,href,dedupe_key) values(new.assignee_id,'A task has been assigned to you','/my-work',entity||':assigned') on conflict do nothing;
 end if;return new;end $$;
create trigger expense_request_notification after insert on public.expenses for each row execute function public.request_notification();
create trigger leave_request_notification after insert on public.leave_requests for each row execute function public.request_notification();
create trigger task_assignment_notification after insert on public.tasks for each row execute function public.request_notification();
revoke execute on function public.provision_employee(uuid,text,text,text,text,text,text),public.prepare_document(text,text,bigint,text,uuid),public.document_upload_access(text),public.finish_document(uuid),public.request_notification() from public,anon,authenticated;
grant execute on function public.provision_employee(uuid,text,text,text,text,text,text),public.prepare_document(text,text,bigint,text,uuid),public.document_upload_access(text),public.finish_document(uuid) to authenticated;
commit;

