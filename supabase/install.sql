-- RepairMe One: reviewed migration bundle. Apply once to a NEW development project.
-- No users, passwords, employee fixtures, or paid integrations are included.

-- ===== 202610130001_foundation.sql =====
begin;
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create type public.app_role as enum ('ceo','admin','hr','finance','manager','employee');
create table public.employees(id uuid primary key references auth.users(id), employee_number text unique not null, first_name text not null, last_name text not null, work_email text unique not null, department text not null default '', job_title text not null default '', manager_id uuid references public.employees(id), employment_type text not null default 'full_time', joining_date date not null default current_date, status text not null default 'invited' check(status in ('invited','onboarding','active','suspended','offboarded')), skills text[] not null default '{}', version integer not null default 1, created_at timestamptz not null default now());
create table public.user_roles(user_id uuid references public.employees(id),role public.app_role not null,primary key(user_id,role));
create table public.employee_private(employee_id uuid primary key references public.employees(id),contact jsonb not null default '{}',emergency_contact jsonb not null default '{}');
create table public.company_settings(id boolean primary key default true check(id),name text not null default 'RepairMe',timezone text not null default 'Asia/Colombo',currency text not null default 'LKR',work_start time not null default '09:00',work_end time not null default '17:00',working_weekdays integer[] not null default '{}',break_minutes integer check(break_minutes between 0 and 240),break_paid boolean,leave_policy jsonb not null default '{"monthly_accrual":1,"proration":"unconfigured","carry_forward":"unconfigured"}',version integer not null default 1);
insert into public.company_settings(id) values(true);
create table public.holidays(id uuid primary key default gen_random_uuid(),day date unique not null,name text not null);
create table public.audit_events(id uuid primary key default gen_random_uuid(),actor_id uuid references public.employees(id),event text not null,entity_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.employees(id),title text not null,href text not null,dedupe_key text unique not null,read_at timestamptz,created_at timestamptz not null default now());
create function public.active_user() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.employees where id=auth.uid() and status in ('active','onboarding')); $$;
create function public.has_role(wanted public.app_role[]) returns boolean language sql stable security definer set search_path='' as $$ select public.active_user() and exists(select 1 from public.user_roles where user_id=auth.uid() and role=any(wanted)) and (not exists(select 1 from public.user_roles where user_id=auth.uid() and role in ('ceo','admin','hr','finance','manager')) or coalesce(auth.jwt()->>'aal','')='aal2'); $$;
create function public.is_manager(employee uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.has_role(array['manager']::public.app_role[]) and exists(select 1 from public.employees where id=employee and manager_id=auth.uid()); $$;
create function public.audit(event_name text,entity uuid,info jsonb default '{}') returns void language sql security definer set search_path='' as $$ insert into public.audit_events(actor_id,event,entity_id,details) values(auth.uid(),event_name,entity,info); $$;
create function public.protect_last_ceo() returns trigger language plpgsql security definer set search_path='' as $$ begin
 perform pg_advisory_xact_lock(771001);
 if TG_TABLE_NAME='user_roles' then
 if old.role='ceo' and not exists(select 1 from public.user_roles r join public.employees e on e.id=r.user_id where r.role='ceo' and e.status='active' and r.user_id<>old.user_id) then raise exception 'Cannot remove last active owner'; end if;
 else
 if old.status='active' and new.status<>'active' and exists(select 1 from public.user_roles where user_id=old.id and role='ceo') and not exists(select 1 from public.user_roles r join public.employees e on e.id=r.user_id where r.role='ceo' and e.status='active' and e.id<>old.id) then raise exception 'Cannot disable last active owner'; end if;
 end if; return coalesce(new,old); end $$;
create trigger last_owner_role before delete or update on public.user_roles for each row execute function public.protect_last_ceo();
create trigger last_owner_status before update on public.employees for each row execute function public.protect_last_ceo();
alter table public.employees enable row level security;
alter table public.user_roles enable row level security;
alter table public.employee_private enable row level security;
alter table public.company_settings enable row level security;
alter table public.holidays enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
create policy directory_read on public.employees for select to authenticated using(public.active_user());
create policy own_roles on public.user_roles for select to authenticated using(public.active_user() and (user_id=auth.uid() or public.has_role(array['admin','ceo']::public.app_role[])));
create policy private_hr_read on public.employee_private for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['hr','ceo']::public.app_role[])));
create policy settings_read on public.company_settings for select to authenticated using(public.active_user());
create policy holidays_read on public.holidays for select to authenticated using(public.active_user());
create policy audit_read on public.audit_events for select to authenticated using(public.has_role(array['ceo','admin']::public.app_role[]));
create policy notifications_read on public.notifications for select to authenticated using(public.active_user() and user_id=auth.uid());
revoke all on all tables in schema public from anon,authenticated;
grant select on public.employees,public.user_roles,public.employee_private,public.company_settings,public.holidays,public.audit_events,public.notifications to authenticated;
revoke execute on function public.audit(text,uuid,jsonb), public.protect_last_ceo() from public,anon,authenticated;
revoke execute on function public.active_user(),public.has_role(public.app_role[]),public.is_manager(uuid) from public,anon;
grant execute on function public.active_user(),public.has_role(public.app_role[]),public.is_manager(uuid) to authenticated;
commit;


-- ===== 202610130002_operations.sql =====
begin;
create table public.projects(id uuid primary key default gen_random_uuid(),name text not null,description text not null default '',client text not null default '',manager_id uuid not null references public.employees(id),start_date date,due_date date,status text not null default 'draft' check(status in ('draft','active','on_hold','completed','cancelled','archived')),reason text,version integer not null default 1,created_at timestamptz not null default now());
create table public.project_members(project_id uuid references public.projects(id),employee_id uuid references public.employees(id),primary key(project_id,employee_id));
create function public.project_access(project uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.active_user() and (public.has_role(array['ceo']::public.app_role[]) or exists(select 1 from public.projects where id=project and manager_id=auth.uid()) or exists(select 1 from public.project_members where project_id=project and employee_id=auth.uid())); $$;
create function public.project_manager(project uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.has_role(array['ceo']::public.app_role[]) or (public.has_role(array['manager']::public.app_role[]) and exists(select 1 from public.projects where id=project and manager_id=auth.uid())); $$;
create table public.tasks(id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),title text not null,description text not null default '',assignee_id uuid references public.employees(id),reporter_id uuid not null references public.employees(id),acceptance_criteria text not null,priority text not null default 'medium' check(priority in ('low','medium','high','urgent')),due_date date,original_due_date date,planned_minutes integer check(planned_minutes>0),weight integer not null check(weight in (1,3,5)),labels text[] default '{}',status text not null default 'backlog' check(status in ('backlog','todo','in_progress','in_review','completed','cancelled')),evidence text,reviewer_id uuid references public.employees(id),quality_rating numeric(3,2) check(quality_rating between 0 and 5),accepted_at timestamptz,version integer not null default 1,created_at timestamptz not null default now());
create table public.task_history(id uuid primary key default gen_random_uuid(),task_id uuid not null references public.tasks(id),actor_id uuid not null references public.employees(id),version integer not null,snapshot jsonb not null,reason text not null,created_at timestamptz not null default now(),unique(task_id,version));
create table public.task_dependencies(task_id uuid references public.tasks(id),depends_on uuid references public.tasks(id),primary key(task_id,depends_on),check(task_id<>depends_on));
create table public.task_comments(id uuid primary key default gen_random_uuid(),task_id uuid references public.tasks(id),author_id uuid references public.employees(id),body text not null,created_at timestamptz not null default now());
create table public.work_logs(id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.employees(id),task_id uuid not null references public.tasks(id),start_at timestamptz not null,end_at timestamptz not null,description text not null,status text not null default 'submitted' check(status in ('draft','submitted','approved','rejected')),reviewer_id uuid references public.employees(id),review_reason text,version integer not null default 1,check(end_at>start_at),exclude using gist(employee_id with =,tstzrange(start_at,end_at,'[)') with &&) where(status in ('submitted','approved')));
create table public.attendance(id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.employees(id),day date not null,check_in timestamptz not null default now(),check_out timestamptz,status text not null default 'recorded',unique(employee_id,day),check(check_out>check_in));
create table public.attendance_corrections(id uuid primary key default gen_random_uuid(),attendance_id uuid references public.attendance(id),employee_id uuid references public.employees(id),original_values jsonb not null,proposed_values jsonb not null,reason text not null,status text not null default 'submitted',reviewer_id uuid references public.employees(id));
create table public.leave_types(id uuid primary key default gen_random_uuid(),name text unique not null,policy jsonb not null default '{}');
insert into public.leave_types(name,policy) values('Company allowance','{"monthly_accrual":1}'),('Medical leave','{"requires_policy_setup":true}'),('Statutory annual leave','{"requires_policy_setup":true}');
create table public.leave_requests(id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.employees(id),type_id uuid not null references public.leave_types(id),start_date date not null,end_date date not null,days numeric(6,2) not null check(days>0 and mod(days,0.5)=0),half_day boolean not null default false,reason text not null,status text not null default 'submitted' check(status in ('draft','submitted','approved','rejected','recorded','cancellation_requested','cancelled')),reviewer_id uuid references public.employees(id),version integer not null default 1,check(end_date>=start_date),exclude using gist(employee_id with =,daterange(start_date,end_date,'[]') with &&) where(status in ('submitted','approved','recorded','cancellation_requested')));
create table public.leave_ledger(id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.employees(id),type_id uuid not null references public.leave_types(id),request_id uuid references public.leave_requests(id),kind text not null check(kind in ('accrual','use','reversal','adjustment')),days numeric(7,2) not null,reason text not null,period text,created_at timestamptz not null default now(),unique(request_id,kind),unique(employee_id,type_id,period,kind));
create table public.checklist_items(id uuid primary key default gen_random_uuid(),employee_id uuid references public.employees(id),title text not null,kind text not null default 'onboarding' check(kind in ('onboarding','offboarding')),completed_at timestamptz,due_date date);
create index tasks_assignee_status on public.tasks(assignee_id,status);
create index project_member_employee on public.project_members(employee_id);
create index work_logs_employee_status on public.work_logs(employee_id,status);
create index leave_employee_status on public.leave_requests(employee_id,status);
do $$ declare t text;begin foreach t in array array['projects','project_members','tasks','task_history','task_dependencies','task_comments','work_logs','attendance','attendance_corrections','leave_types','leave_requests','leave_ledger','checklist_items'] loop execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy projects_read on public.projects for select to authenticated using(public.project_access(id));
create policy members_read on public.project_members for select to authenticated using(public.project_access(project_id));
create policy tasks_read on public.tasks for select to authenticated using(public.project_access(project_id));
create policy task_history_read on public.task_history for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_id));
create policy dependencies_read on public.task_dependencies for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_id));
create policy comments_read on public.task_comments for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_id));
create policy logs_read on public.work_logs for select to authenticated using(public.active_user() and (employee_id=auth.uid() or exists(select 1 from public.tasks t where t.id=task_id and public.project_manager(t.project_id))));
create policy attendance_read on public.attendance for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.is_manager(employee_id) or public.has_role(array['hr','ceo']::public.app_role[])));
create policy correction_read on public.attendance_corrections for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['hr','ceo']::public.app_role[])));
create policy leave_types_read on public.leave_types for select to authenticated using(public.active_user());
create policy leave_read on public.leave_requests for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.is_manager(employee_id) or public.has_role(array['hr','ceo']::public.app_role[])));
create policy ledger_read on public.leave_ledger for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['hr','ceo']::public.app_role[])));
create policy checklist_read on public.checklist_items for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['hr','ceo']::public.app_role[])));
revoke execute on function public.project_access(uuid),public.project_manager(uuid) from public,anon;
grant execute on function public.project_access(uuid),public.project_manager(uuid) to authenticated;
commit;


-- ===== 202610130003_finance_and_reviews.sql =====
begin;
create table public.performance_periods(id uuid primary key default gen_random_uuid(),name text not null,start_date date not null,end_date date not null,state text not null default 'open',check(end_date>=start_date));
create table public.performance_reviews(id uuid primary key default gen_random_uuid(),employee_id uuid not null references public.employees(id),period_id uuid not null references public.performance_periods(id),reviewer_id uuid references public.employees(id),state text not null default 'evidence_collection',formula_version text not null default '1.0',inputs jsonb not null default '{}',score numeric(8,5),reason text,employee_response text,finalized_at timestamptz,replaces_id uuid references public.performance_reviews(id),version integer not null default 1);
create table public.performance_evidence(id uuid primary key default gen_random_uuid(),review_id uuid references public.performance_reviews(id),task_id uuid references public.tasks(id),rating numeric(3,2) check(rating between 0 and 5),reason text not null,unique(review_id,task_id));
create table public.performance_appeals(id uuid primary key default gen_random_uuid(),review_id uuid references public.performance_reviews(id),employee_id uuid references public.employees(id),reason text not null,state text not null default 'submitted',reviewer_id uuid references public.employees(id),decision text);
create table public.points_ledger(id uuid primary key default gen_random_uuid(),employee_id uuid references public.employees(id),source_id uuid not null,points numeric(10,2) not null,approved_by uuid not null references public.employees(id),reason text not null,created_at timestamptz not null default now(),unique(source_id),check(employee_id<>approved_by));
create table public.compensation_proposals(id uuid primary key default gen_random_uuid(),employee_id uuid references public.employees(id),submitted_by uuid not null references public.employees(id),current_values jsonb not null,proposed_values jsonb not null,justification text not null,state text not null default 'proposed',hr_reviewer_id uuid references public.employees(id),ceo_id uuid references public.employees(id),effective_date date,version integer not null default 1);
create table public.expenses(id uuid primary key default gen_random_uuid(),submitted_by uuid not null references public.employees(id),payee text not null,purpose text not null,category text not null,project_id uuid references public.projects(id),amount numeric(16,2) not null check(amount>0),currency text not null default 'LKR',approved_amount numeric(16,2) check(approved_amount>0),approval_status text not null default 'submitted' check(approval_status in ('draft','submitted','approved','rejected')),execution_status text not null default 'unpaid' check(execution_status in ('unpaid','partial','paid','reconciled')),evidence text not null,approved_by uuid references public.employees(id),approved_version integer,due_date date,version integer not null default 1,created_at timestamptz not null default now(),check(approved_by<>submitted_by));
create table public.finance_approvals(id uuid primary key default gen_random_uuid(),expense_id uuid not null references public.expenses(id),version integer not null,reviewer_id uuid not null references public.employees(id),decision text not null check(decision in ('approved','rejected')),reason text not null,created_at timestamptz not null default now(),unique(expense_id,version));
create table public.payments(id uuid primary key default gen_random_uuid(),expense_id uuid not null references public.expenses(id),amount numeric(16,2) not null check(amount>0),reference text unique not null,evidence text not null,recorded_by uuid not null references public.employees(id),paid_at timestamptz not null default now());
create table public.invoices(id uuid primary key default gen_random_uuid(),customer text not null,amount numeric(16,2) not null check(amount>0),currency text not null default 'LKR',state text not null default 'draft',version integer not null default 1,approved_version integer,submitted_by uuid references public.employees(id),approved_by uuid references public.employees(id));
create table public.income(id uuid primary key default gen_random_uuid(),source text not null,invoice_id uuid references public.invoices(id),category text not null,amount numeric(16,2) not null check(amount>0),currency text not null default 'LKR',received_at timestamptz not null,reference text unique not null,evidence text not null,recorded_by uuid not null references public.employees(id),verified_by uuid references public.employees(id),state text not null default 'pending_verification',version integer not null default 1,verified_version integer,check(recorded_by<>verified_by));
create table public.budgets(id uuid primary key default gen_random_uuid(),name text not null,project_id uuid references public.projects(id),category text not null,amount numeric(16,2) not null check(amount>0),state text not null default 'draft',submitted_by uuid references public.employees(id),approved_by uuid references public.employees(id),version integer not null default 1,approved_version integer);
create table public.accounts(id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,kind text not null check(kind in ('asset','liability','equity','income','expense')),active boolean not null default true);
create table public.fiscal_periods(id uuid primary key default gen_random_uuid(),name text not null,start_date date not null,end_date date not null,locked boolean not null default false,check(end_date>=start_date),exclude using gist(daterange(start_date,end_date,'[]') with &&));
create table public.journals(id uuid primary key default gen_random_uuid(),period_id uuid not null references public.fiscal_periods(id),entry_date date not null,description text not null,source_reference text unique not null,submitted_by uuid not null references public.employees(id),approved_by uuid references public.employees(id),version integer not null default 1,approved_version integer,state text not null default 'draft' check(state in ('draft','submitted','approved','posted')),posted_at timestamptz,reverses_id uuid unique references public.journals(id),check(submitted_by<>approved_by));
create table public.journal_lines(id uuid primary key default gen_random_uuid(),journal_id uuid not null references public.journals(id),account_id uuid not null references public.accounts(id),debit numeric(16,2) not null default 0,credit numeric(16,2) not null default 0,check((debit>0 and credit=0) or(credit>0 and debit=0)));
create table public.payroll_drafts(id uuid primary key default gen_random_uuid(),employee_id uuid references public.employees(id),period text not null,components jsonb not null,state text not null default 'draft' check(state='draft'),statutory_verified boolean not null default false check(not statutory_verified));
create function public.immutable_record() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Immutable record: create a reviewed reversal or replacement'; end $$;
create trigger immutable_points before update or delete on public.points_ledger for each row execute function public.immutable_record();
create trigger immutable_leave_ledger before update or delete on public.leave_ledger for each row execute function public.immutable_record();
create trigger immutable_audit before update or delete on public.audit_events for each row execute function public.immutable_record();
create trigger immutable_payments before update or delete on public.payments for each row execute function public.immutable_record();
create trigger immutable_approvals before update or delete on public.finance_approvals for each row execute function public.immutable_record();
create function public.protect_finalized() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if TG_TABLE_NAME='performance_reviews' then if old.state='finalized' then raise exception 'Finalized review is immutable';end if;end if;
 if TG_TABLE_NAME='journals' then if old.state='posted' then raise exception 'Posted journal is immutable';end if;end if;
 if TG_TABLE_NAME='journal_lines' then if exists(select 1 from public.journals where id=old.journal_id and state='posted') then raise exception 'Posted lines are immutable';end if;end if;
 return coalesce(new,old);end $$;
create trigger finalized_review before update or delete on public.performance_reviews for each row execute function public.protect_finalized();
create trigger posted_journal before update or delete on public.journals for each row execute function public.protect_finalized();
create trigger posted_lines before update or delete on public.journal_lines for each row execute function public.protect_finalized();
create function public.invalidate_expense_approval() returns trigger language plpgsql set search_path='' as $$ begin
 if (new.amount,new.payee,new.purpose,new.currency,new.evidence) is distinct from (old.amount,old.payee,old.purpose,old.currency,old.evidence) then
 if old.execution_status<>'unpaid' then raise exception 'Paid expenses require a correcting record';end if;
 new.version:=old.version+1;new.approval_status:='draft';new.approved_by:=null;new.approved_amount:=null;new.approved_version:=null;
 end if;return new;end $$;
create trigger invalidate_expense before update on public.expenses for each row execute function public.invalidate_expense_approval();
create index expense_approval_status on public.expenses(approval_status,submitted_by);
create index payments_expense on public.payments(expense_id);
create index journal_lines_journal on public.journal_lines(journal_id);
do $$ declare t text;begin foreach t in array array['performance_periods','performance_reviews','performance_evidence','performance_appeals','points_ledger','compensation_proposals','expenses','finance_approvals','payments','invoices','income','budgets','accounts','fiscal_periods','journals','journal_lines','payroll_drafts'] loop execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);end loop;
foreach t in array array['finance_approvals','payments','invoices','income','budgets','accounts','fiscal_periods','journals','journal_lines'] loop execute format('create policy finance_read on public.%I for select to authenticated using(public.has_role(array[''ceo'',''finance'']::public.app_role[]))',t);end loop;
end $$;
create policy expense_read on public.expenses for select to authenticated using(public.active_user() and (submitted_by=auth.uid() or public.has_role(array['ceo','finance']::public.app_role[])));
create policy periods_read on public.performance_periods for select to authenticated using(public.active_user());
create policy reviews_read on public.performance_reviews for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.is_manager(employee_id) or public.has_role(array['ceo','hr']::public.app_role[])));
create policy evidence_read on public.performance_evidence for select to authenticated using(exists(select 1 from public.performance_reviews where id=review_id));
create policy appeals_read on public.performance_appeals for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['ceo','hr']::public.app_role[])));
create policy points_read on public.points_ledger for select to authenticated using(public.active_user() and (employee_id=auth.uid() or public.has_role(array['ceo','hr']::public.app_role[])));
create policy compensation_read on public.compensation_proposals for select to authenticated using(public.has_role(array['ceo','hr']::public.app_role[]));
create policy payroll_read on public.payroll_drafts for select to authenticated using(public.has_role(array['ceo','hr']::public.app_role[]));
revoke execute on function public.immutable_record(),public.protect_finalized(),public.invalidate_expense_approval() from public,anon,authenticated;
commit;


-- ===== 202610130004_support.sql =====
begin;
create table public.candidates(id uuid primary key default gen_random_uuid(),name text not null,email text not null,position text not null,stage text not null default 'applied',job_related_evidence text not null default '',created_at timestamptz not null default now());
create table public.sprints(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id),name text not null,start_date date,end_date date,state text not null default 'planned');
create table public.task_developer_details(task_id uuid primary key references public.tasks(id),sprint_id uuid references public.sprints(id),severity text,reproduction_steps text,repository_url text,pull_request_url text);
create table public.releases(id uuid primary key default gen_random_uuid(),project_id uuid references public.projects(id),name text not null,state text not null default 'draft',checklist jsonb not null default '[]',deployment_history jsonb not null default '[]');
create table public.documents(id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.employees(id),project_id uuid references public.projects(id),name text not null,path text unique not null,classification text not null check(classification in ('own','project','hr','finance')),mime_type text not null,size_bytes bigint not null check(size_bytes between 1 and 5242880),created_at timestamptz not null default now());
do $$ declare t text;begin foreach t in array array['candidates','sprints','task_developer_details','releases','documents'] loop execute format('alter table public.%I enable row level security',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy recruitment_read on public.candidates for select to authenticated using(public.has_role(array['ceo','hr']::public.app_role[]));
create policy sprint_read on public.sprints for select to authenticated using(public.project_access(project_id));
create policy developer_details_read on public.task_developer_details for select to authenticated using(exists(select 1 from public.tasks where id=task_id));
create policy release_read on public.releases for select to authenticated using(public.project_access(project_id));
create function public.document_access(document uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.active_user() and exists(select 1 from public.documents d where d.id=document and ((d.classification='own' and d.owner_id=auth.uid()) or(d.classification='project' and public.project_access(d.project_id)) or(d.classification='hr' and public.has_role(array['ceo','hr']::public.app_role[])) or(d.classification='finance' and public.has_role(array['ceo','finance']::public.app_role[])))); $$;
create policy document_read on public.documents for select to authenticated using(public.document_access(id));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-documents','private-documents',false,5242880,array['application/pdf','image/jpeg','image/png','text/plain']) on conflict(id) do nothing;
create policy private_file_read on storage.objects for select to authenticated using(bucket_id='private-documents' and exists(select 1 from public.documents d where d.path=name and public.document_access(d.id)));
revoke execute on function public.document_access(uuid) from public,anon;
grant execute on function public.document_access(uuid) to authenticated;
commit;


-- ===== 202610130005_commands.sql =====
begin;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); e public.expenses; t public.tasks; l public.leave_requests; w public.work_logs; j public.journals; s public.company_settings;  payment_amount numeric(16,2); total numeric(16,2); result_id uuid; days numeric(6,2); target uuid; start_day date;end_day date;new_state text;owner uuid;settings_version integer;
begin
 if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required';end if;
 if action='create_project' then
  if not public.has_role(array['ceo','manager']::public.app_role[]) then raise exception 'Not authorized';end if;
  insert into public.projects(name,description,client,manager_id,due_date,status) values(nullif(trim(payload->>'name'),''),coalesce(payload->>'description',''),coalesce(payload->>'client',''),actor,(payload->>'due_date')::date,'active') returning id into result_id;
 elsif action='create_task' then
  target:=(payload->>'project_id')::uuid;if not public.project_manager(target) then raise exception 'Project reviewer required';end if;
  owner:=nullif(payload->>'assignee_id','')::uuid;
  if owner is not null and not exists(select 1 from public.project_members where project_id=target and employee_id=owner) then raise exception 'Assignee must be a project member';end if;
  insert into public.tasks(project_id,title,assignee_id,reporter_id,acceptance_criteria,priority,due_date,original_due_date,weight,status) values(target,nullif(trim(payload->>'title'),''),owner,actor,nullif(trim(payload->>'acceptance_criteria'),''),coalesce(payload->>'priority','medium'),(payload->>'due_date')::date,(payload->>'due_date')::date,(payload->>'weight')::integer,'todo') returning id into result_id;
 elsif action='task_transition' then
  select * into strict t from public.tasks where id=record_id for update;
  if t.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;
  new_state:=payload->>'state';
  if not public.project_access(t.project_id) then raise exception 'Project access denied';end if;
  if not ((t.status='backlog' and new_state='todo') or(t.status='todo' and new_state='in_progress') or(t.status='in_progress' and new_state='in_review') or(t.status='in_review' and new_state in ('in_progress','completed')) or(t.status not in ('completed','cancelled') and new_state='cancelled')) then raise exception 'Invalid task transition';end if;
  if new_state in ('completed','cancelled') or(t.status='in_review' and new_state='in_progress') then
   if not public.project_manager(t.project_id) or actor=t.assignee_id then raise exception 'Independent authorized reviewer required';end if;
  elsif actor is distinct from t.assignee_id then raise exception 'Only assignee may submit work';end if;
  if new_state in ('completed','in_review','cancelled') and length(trim(coalesce(payload->>'evidence','')))<3 then raise exception 'Evidence or reason required';end if;
  if new_state='completed' and (payload->>'quality_rating') is null then raise exception 'Reviewed quality rating required';end if;
  insert into public.task_history(task_id,actor_id,version,snapshot,reason) values(t.id,actor,t.version,to_jsonb(t),coalesce(payload->>'evidence','State transition'));
  update public.tasks set status=new_state,evidence=coalesce(payload->>'evidence',evidence),reviewer_id=case when new_state='completed' then actor else reviewer_id end,quality_rating=case when new_state='completed' then (payload->>'quality_rating')::numeric else quality_rating end,accepted_at=case when new_state='completed' then now() else accepted_at end,version=version+1 where id=t.id;
  result_id:=t.id;
  insert into public.notifications(user_id,title,href,dedupe_key) select case when new_state='in_review' then manager_id else t.assignee_id end,'Task '||replace(new_state,'_',' '),'/tasks',t.id||':'||(t.version+1) from public.projects where id=t.project_id and (case when new_state='in_review' then manager_id else t.assignee_id end) is not null;
 elsif action in ('check_in','check_out') then
  select * into strict s from public.company_settings;
  if action='check_in' then insert into public.attendance(employee_id,day) values(actor,(now() at time zone s.timezone)::date) returning id into result_id;
  else update public.attendance set check_out=now() where employee_id=actor and check_out is null returning id into result_id;if result_id is null then raise exception 'No open attendance record';end if;end if;
 elsif action='submit_work_log' then
  select * into strict t from public.tasks where id=(payload->>'task_id')::uuid;
  if actor is distinct from t.assignee_id or not public.project_access(t.project_id) then raise exception 'Assigned task required';end if;
  insert into public.work_logs(employee_id,task_id,start_at,end_at,description) values(actor,t.id,(payload->>'start_at')::timestamptz,(payload->>'end_at')::timestamptz,nullif(trim(payload->>'description'),'')) returning id into result_id;
 elsif action='review_work_log' then
  select * into strict w from public.work_logs where id=record_id for update;select * into strict t from public.tasks where id=w.task_id;
  if actor=w.employee_id or not public.project_manager(t.project_id) or w.status<>'submitted' or w.version is distinct from expected_version then raise exception 'Independent reviewer and current submitted version required';end if;
  if payload->>'decision' not in ('approved','rejected') or length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Decision and reason required';end if;
  update public.work_logs set status=payload->>'decision',reviewer_id=actor,review_reason=payload->>'reason',version=version+1 where id=w.id;result_id:=w.id;
 elsif action='submit_leave' then
  select * into strict s from public.company_settings;
  if cardinality(s.working_weekdays)=0 then raise exception 'Working weekdays must be configured';end if;
  start_day:=(payload->>'start_date')::date;end_day:=(payload->>'end_date')::date;
  if end_day<start_day or end_day-start_day>366 then raise exception 'Invalid leave dates';end if;
  if coalesce((payload->>'half_day')::boolean,false) and end_day<>start_day then raise exception 'Half day requires one date';end if;
  select count(*) into days from generate_series(start_day::timestamp,end_day::timestamp,interval '1 day') d where extract(dow from d)::integer=any(s.working_weekdays) and not exists(select 1 from public.holidays h where h.day=d::date);
  if coalesce((payload->>'half_day')::boolean,false) then days:=days/2;end if;
  insert into public.leave_requests(employee_id,type_id,start_date,end_date,days,half_day,reason) values(actor,(payload->>'type_id')::uuid,start_day,end_day,days,coalesce((payload->>'half_day')::boolean,false),nullif(trim(payload->>'reason'),'')) returning id into result_id;
 elsif action in ('decide_leave','cancel_leave') then
  select * into strict l from public.leave_requests where id=record_id for update;
  if actor=l.employee_id or l.version is distinct from expected_version then raise exception 'Independent reviewer and current version required';end if;
  select manager_id into owner from public.employees where id=l.employee_id;
  if not ((owner=actor and public.is_manager(l.employee_id)) or(owner is null and public.has_role(array['ceo']::public.app_role[]))) then raise exception 'Assigned reviewer required';end if;
  if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Review reason required';end if;
  if action='decide_leave' then
   if l.status<>'submitted' or payload->>'decision' not in ('approved','rejected') then raise exception 'Invalid leave decision';end if;
   if payload->>'decision'='approved' then
    perform pg_advisory_xact_lock(hashtextextended(l.employee_id::text||l.type_id::text,0));
    select coalesce(sum(ledger.days),0) into total from public.leave_ledger ledger where ledger.employee_id=l.employee_id and ledger.type_id=l.type_id;
    if total<l.days then raise exception 'Insufficient leave balance';end if;
    insert into public.leave_ledger(employee_id,type_id,request_id,kind,days,reason) values(l.employee_id,l.type_id,l.id,'use',-l.days,payload->>'reason');
   end if;
   update public.leave_requests set status=case when payload->>'decision'='approved' then 'recorded' else 'rejected' end,reviewer_id=actor,version=version+1 where id=l.id;
  else
   if l.status<>'cancellation_requested' then raise exception 'Reviewed cancellation request required';end if;
   insert into public.leave_ledger(employee_id,type_id,request_id,kind,days,reason) values(l.employee_id,l.type_id,l.id,'reversal',l.days,payload->>'reason');
   update public.leave_requests set status='cancelled',version=version+1 where id=l.id;
  end if;result_id:=l.id;
 elsif action='submit_expense' then
  insert into public.expenses(submitted_by,payee,purpose,category,amount,evidence) values(actor,nullif(trim(payload->>'payee'),''),nullif(trim(payload->>'purpose'),''),nullif(trim(payload->>'category'),''),(payload->>'amount')::numeric,nullif(trim(payload->>'evidence'),'')) returning id into result_id;
 elsif action in ('approve_expense','reject_expense','record_payment','reconcile_expense') then
  select * into strict e from public.expenses where id=record_id for update;
  if e.version is distinct from expected_version then raise exception 'Record changed. Reload and retry';end if;
  if action in ('approve_expense','reject_expense') then
   if not public.has_role(array['ceo']::public.app_role[]) or actor=e.submitted_by then raise exception 'Independent CEO approval required';end if;
   if e.approval_status<>'submitted' then raise exception 'Submitted request required';end if;
   if length(trim(coalesce(payload->>'reason','')))<3 then raise exception 'Reviewer reason required';end if;
   new_state:=case when action='approve_expense' then 'approved' else 'rejected' end;
   insert into public.finance_approvals(expense_id,version,reviewer_id,decision,reason) values(e.id,e.version,actor,new_state,payload->>'reason');
   update public.expenses set approval_status=new_state,approved_by=case when new_state='approved' then actor end,approved_version=case when new_state='approved' then version+1 end,approved_amount=case when new_state='approved' then e.amount end,version=version+1 where id=e.id;
  elsif action='record_payment' then
   if not public.has_role(array['finance']::public.app_role[]) then raise exception 'Finance role required to record payment';end if;
   if e.approval_status<>'approved' or e.approved_version<>e.version or e.execution_status='reconciled' then raise exception 'Current CEO approval required';end if;
   payment_amount:=(payload->>'amount')::numeric;select coalesce(sum(p.amount),0) into total from public.payments p where p.expense_id=e.id;
   if payment_amount<=0 or payment_amount+total>e.approved_amount then raise exception 'Payment exceeds remaining approval';end if;
   insert into public.payments(expense_id,amount,reference,evidence,recorded_by) values(e.id,payment_amount,nullif(trim(payload->>'reference'),''),nullif(trim(payload->>'evidence'),''),actor);
   update public.expenses set execution_status=case when total+payment_amount=e.approved_amount then 'paid' else 'partial' end where id=e.id;
  else
   if not public.has_role(array['finance']::public.app_role[]) or e.execution_status<>'paid' or length(trim(coalesce(payload->>'evidence','')))<3 then raise exception 'Paid expense and reconciliation evidence required';end if;
   update public.expenses set execution_status='reconciled' where id=e.id;
  end if;result_id:=e.id;
  insert into public.notifications(user_id,title,href,dedupe_key) values(e.submitted_by,replace(action,'_',' '),'/finance',e.id||':'||action||':'||coalesce(payload->>'reference',e.version::text));
 elsif action='record_income' then
  if not public.has_role(array['finance']::public.app_role[]) then raise exception 'Finance role required';end if;
  insert into public.income(source,category,amount,received_at,reference,evidence,recorded_by) values(nullif(trim(payload->>'source'),''),nullif(trim(payload->>'category'),''),(payload->>'amount')::numeric,(payload->>'received_at')::timestamptz,nullif(trim(payload->>'reference'),''),nullif(trim(payload->>'evidence'),''),actor) returning id into result_id;
 elsif action='verify_income' then
  if not public.has_role(array['ceo']::public.app_role[]) then raise exception 'CEO required';end if;
  update public.income set verified_by=actor,state='verified',verified_version=version where id=record_id and recorded_by<>actor and state='pending_verification' and version=expected_version returning id into result_id;
  if result_id is null then raise exception 'Independent verification of current version required';end if;
 elsif action='post_journal' then
  select * into strict j from public.journals where id=record_id for update;
  if not public.has_role(array['finance']::public.app_role[]) or j.state<>'approved' or j.approved_version<>j.version or j.version is distinct from expected_version then raise exception 'Current journal approval and Finance role required';end if;
  perform 1 from public.fiscal_periods where id=j.period_id and not locked and j.entry_date between start_date and end_date for update;if not found then raise exception 'Period locked or invalid';end if;
  select sum(debit-credit),count(*) into total,days from public.journal_lines where journal_id=j.id;
  if total is null or total<>0 or days<2 or exists(select 1 from public.journal_lines jl join public.accounts account on account.id=jl.account_id where jl.journal_id=j.id and not account.active) then raise exception 'Balanced journal with valid accounts required';end if;
  update public.journals set state='posted',posted_at=now() where id=j.id;result_id:=j.id;
 elsif action='update_settings' then
  if not public.has_role(array['ceo','admin']::public.app_role[]) then raise exception 'Configuration access required';end if;
  select version into settings_version from public.company_settings for update;
  if settings_version is distinct from expected_version then raise exception 'Settings changed';end if;
  if public.has_role(array['admin']::public.app_role[]) and not public.has_role(array['ceo']::public.app_role[]) then raise exception 'Working policy changes require CEO approval';end if;
  update public.company_settings set working_weekdays=array(select jsonb_array_elements_text(payload->'working_weekdays')::integer),break_minutes=(payload->>'break_minutes')::integer,break_paid=(payload->>'break_paid')::boolean,version=version+1;
 else raise exception 'Workflow is not enabled yet';
 end if;
 perform public.audit(action,result_id,jsonb_build_object('previous_version',expected_version));
 return jsonb_build_object('id',result_id,'success',true);
end $$;
revoke all on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
-- Mutations have no direct INSERT/UPDATE/DELETE grants or policies. All business writes use bounded transactional commands.
commit;








-- ===== 202610130006_extended_workflows.sql =====
begin;
alter function public.command(text,uuid,integer,jsonb) rename to command_core;
revoke execute on function public.command_core(text,uuid,integer,jsonb) from authenticated;
create function public.command(action text,record_id uuid default null,expected_version integer default null,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); target uuid; new_state text; result_id uuid; l public.leave_requests; a public.attendance; c public.attendance_corrections; p public.compensation_proposals; r public.performance_reviews; t public.tasks; j public.journals; b public.budgets;inv public.invoices;v integer;sum_debit numeric;sum_credit numeric;accepted numeric;agreed numeric;ontime numeric;quality numeric;teamwork numeric;calculated_score numeric;period_start date;period_end date;row_data jsonb;
begin
 if actor is null or not public.active_user() then raise exception 'Account access denied';end if;
 if exists(select 1 from public.user_roles where user_id=actor and role in ('ceo','admin','hr','finance','manager')) and coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'MFA required';end if;
 if action='request_leave_cancellation' then
  select * into strict l from public.leave_requests where id=record_id for update;
  if l.employee_id<>actor or l.status<>'recorded' or l.version is distinct from expected_version then raise exception 'Current own recorded leave required';end if;
  update public.leave_requests set status='cancellation_requested',version=version+1 where id=l.id;result_id:=l.id;
 elsif action='adjust_leave' then
  if not public.has_role(array['hr','ceo']::public.app_role[]) or (payload->>'employee_id')::uuid=actor then raise exception 'Independent HR administrator required';end if;
  if length(trim(coalesce(payload->>'reason','')))<5 then raise exception 'Adjustment reason required';end if;
  insert into public.leave_ledger(employee_id,type_id,kind,days,reason,period) values((payload->>'employee_id')::uuid,(payload->>'type_id')::uuid,'adjustment',(payload->>'days')::numeric,payload->>'reason',nullif(payload->>'reference','')) returning id into result_id;
 elsif action='request_attendance_correction' then
  select * into strict a from public.attendance where id=record_id for update;
  if a.employee_id<>actor then raise exception 'Own attendance required';end if;
  insert into public.attendance_corrections(attendance_id,employee_id,original_values,proposed_values,reason) values(a.id,actor,to_jsonb(a),payload->'proposed',nullif(trim(payload->>'reason'),'')) returning id into result_id;
 elsif action='decide_attendance_correction' then
  select * into strict c from public.attendance_corrections where id=record_id for update;
  if c.employee_id=actor or not public.has_role(array['hr','ceo']::public.app_role[]) or c.status<>'submitted' then raise exception 'Independent HR review required';end if;
  new_state:=payload->>'decision';if new_state not in ('approved','rejected') then raise exception 'Invalid decision';end if;
  select * into strict a from public.attendance where id=c.attendance_id for update;
  if to_jsonb(a)<>c.original_values then raise exception 'Attendance changed; request fresh correction';end if;
  if new_state='approved' then update public.attendance set check_in=(c.proposed_values->>'check_in')::timestamptz,check_out=(c.proposed_values->>'check_out')::timestamptz where id=a.id;end if;
  update public.attendance_corrections set status=new_state,reviewer_id=actor where id=c.id;result_id:=c.id;
 elsif action='complete_onboarding' then
  if exists(select 1 from public.checklist_items where employee_id=actor and completed_at is null and kind='onboarding') then raise exception 'Complete required onboarding checklist';end if;
  update public.employees set status='active',version=version+1 where id=actor and status='onboarding' returning id into result_id;
  if result_id is null then raise exception 'Account not onboarding';end if;
 elsif action='set_account_status' then
  if not public.has_role(array['ceo','admin']::public.app_role[]) then raise exception 'Account administrator required';end if;
  if payload->>'status' not in ('onboarding','active','suspended','offboarded') then raise exception 'Invalid account status';end if;
  update public.employees set status=payload->>'status',version=version+1 where id=record_id and version=expected_version returning id into result_id;
  if result_id is null then raise exception 'Account changed';end if;
 elsif action='set_role' then
  if not public.has_role(array['ceo','admin']::public.app_role[]) then raise exception 'Privileged account administrator required';end if;
  if not public.has_role(array['ceo']::public.app_role[]) and payload->>'role' in ('ceo','finance','hr') then raise exception 'Owner must assign business privileges';end if;
  if coalesce((payload->>'remove')::boolean,false) then delete from public.user_roles where user_id=record_id and role=(payload->>'role')::public.app_role;
  else insert into public.user_roles(user_id,role) values(record_id,(payload->>'role')::public.app_role) on conflict do nothing;end if;result_id:=record_id;
 elsif action='complete_checklist_item' then
  if not public.has_role(array['ceo','hr']::public.app_role[]) then raise exception 'HR administrator required';end if;
  update public.checklist_items set completed_at=now() where id=record_id and completed_at is null returning id into result_id;
 elsif action='add_project_member' then
  if not public.project_manager(record_id) then raise exception 'Assigned project manager required';end if;
  insert into public.project_members(project_id,employee_id) values(record_id,(payload->>'employee_id')::uuid) on conflict do nothing;result_id:=record_id;
 elsif action='revise_task_scope' then
  select * into strict t from public.tasks where id=record_id for update;
  if not public.project_manager(t.project_id) or t.status in ('completed','cancelled') or t.version is distinct from expected_version then raise exception 'Manager and unfinished current task required';end if;
  if exists(select 1 from public.performance_evidence e join public.performance_reviews r on r.id=e.review_id where e.task_id=t.id and r.state='finalized') then raise exception 'Finalized evidence requires versioned review replacement';end if;
  if length(trim(coalesce(payload->>'reason','')))<5 then raise exception 'Reviewed scope reason required';end if;
  insert into public.task_history(task_id,actor_id,version,snapshot,reason) values(t.id,actor,t.version,to_jsonb(t),payload->>'reason');
  update public.tasks set acceptance_criteria=coalesce(payload->>'acceptance_criteria',acceptance_criteria),weight=coalesce((payload->>'weight')::integer,weight),due_date=coalesce((payload->>'due_date')::date,due_date),version=version+1 where id=t.id;result_id:=t.id;
 elsif action='create_review' then
  target:=(payload->>'employee_id')::uuid;
  if target=actor or not(public.is_manager(target) or public.has_role(array['ceo','hr']::public.app_role[])) then raise exception 'Independent reviewer required';end if;
  insert into public.performance_reviews(employee_id,period_id,reviewer_id) values(target,(payload->>'period_id')::uuid,actor) returning id into result_id;
 elsif action in ('review_evidence','review_response','finalize_review') then
  select * into strict r from public.performance_reviews where id=record_id for update;
  if r.version is distinct from expected_version then raise exception 'Review changed';end if;
  if action='review_response' then
   if actor<>r.employee_id or r.state<>'employee_response' then raise exception 'Employee response phase required';end if;
   update public.performance_reviews set employee_response=nullif(trim(payload->>'response'),''),version=version+1 where id=r.id;
  else
   if actor=r.employee_id or actor is distinct from r.reviewer_id or not(public.is_manager(r.employee_id) or public.has_role(array['ceo','hr']::public.app_role[])) then raise exception 'Assigned independent reviewer required';end if;
   if action='review_evidence' then
    if r.state not in ('evidence_collection','manager_review') then raise exception 'Evidence phase required';end if;
    select start_date,end_date into period_start,period_end from public.performance_periods where id=r.period_id;
    select coalesce(sum(weight),0),coalesce(sum(weight) filter(where status='completed'),0),coalesce(sum(weight) filter(where status='completed' and (accepted_at at time zone 'Asia/Colombo')::date<=due_date),0),sum(weight*quality_rating) filter(where status='completed')/nullif(sum(weight) filter(where status='completed' and quality_rating is not null),0) into agreed,accepted,ontime,quality from public.tasks where assignee_id=r.employee_id and due_date between period_start and period_end and status<>'cancelled';
    if exists(select 1 from public.leave_requests where employee_id=r.employee_id and status='recorded' and start_date<=period_end and end_date>=period_start) and length(trim(coalesce(payload->>'workload_adjustment_reason','')))<5 then raise exception 'Document approved-leave workload adjustment before review';end if;
    -- Approved workload is explicitly reviewed, never inferred from overtime or attendance.
    if payload ? 'agreed_weight' then agreed:=(payload->>'agreed_weight')::numeric;end if;
    teamwork:=(payload->>'teamwork_rating')::numeric;
    if teamwork<0 or teamwork>5 or agreed<0 then raise exception 'Invalid evidence inputs';end if;
    if agreed=0 or accepted=0 or quality is null or teamwork is null then calculated_score:=null;else calculated_score:=least(accepted/agreed,1)*40+quality/5*30+ontime/accepted*20+teamwork/5*10;end if;
    if length(trim(coalesce(payload->>'reason','')))<5 then raise exception 'Evidence-backed reviewer reason required';end if;
    insert into public.performance_evidence(review_id,task_id,rating,reason) select r.id,id,quality_rating,payload->>'reason' from public.tasks where assignee_id=r.employee_id and status='completed' and due_date between period_start and period_end on conflict(review_id,task_id) do nothing;
    update public.performance_reviews set inputs=jsonb_build_object('agreed_weight',agreed,'accepted_weight',accepted,'on_time_weight',ontime,'quality_rating',quality,'teamwork_rating',teamwork,'workload_adjustment_reason',payload->>'workload_adjustment_reason'),score=calculated_score,reason=payload->>'reason',state='employee_response',version=version+1 where id=r.id;
   else
    if r.state<>'employee_response' or r.employee_response is null or r.score is null then raise exception 'Employee response and complete evidence required';end if;
    update public.performance_reviews set state='finalized',finalized_at=now(),version=version+1 where id=r.id;
   end if;
  end if;result_id:=r.id;
 elsif action='submit_appeal' then
  select * into strict r from public.performance_reviews where id=record_id;
  if r.employee_id<>actor or r.state<>'finalized' then raise exception 'Own finalized review required';end if;
  insert into public.performance_appeals(review_id,employee_id,reason) values(r.id,actor,nullif(trim(payload->>'reason'),'')) returning id into result_id;
 elsif action='propose_compensation' then
  if not(public.has_role(array['hr']::public.app_role[]) or public.is_manager((payload->>'employee_id')::uuid)) then raise exception 'HR or reporting manager required';end if;
  insert into public.compensation_proposals(employee_id,submitted_by,current_values,proposed_values,justification) values((payload->>'employee_id')::uuid,actor,payload->'current_values',payload->'proposed_values',nullif(trim(payload->>'justification'),'')) returning id into result_id;
 elsif action in ('hr_review_compensation','decide_compensation','record_compensation') then
  select * into strict p from public.compensation_proposals where id=record_id for update;
  if p.version is distinct from expected_version then raise exception 'Proposal changed';end if;
  if action='hr_review_compensation' then
   if not public.has_role(array['hr']::public.app_role[]) or actor=p.submitted_by or actor=p.employee_id or p.state<>'proposed' then raise exception 'Independent HR review required';end if;
   update public.compensation_proposals set state='hr_reviewed',hr_reviewer_id=actor,version=version+1 where id=p.id;
  elsif action='decide_compensation' then
   if not public.has_role(array['ceo']::public.app_role[]) or actor=p.submitted_by or actor=p.employee_id or p.state<>'hr_reviewed' then raise exception 'Independent CEO decision required';end if;
   if payload->>'decision' not in ('approved','rejected') then raise exception 'Invalid decision';end if;
   update public.compensation_proposals set state=payload->>'decision',ceo_id=actor,effective_date=(payload->>'effective_date')::date,version=version+1 where id=p.id;
  else
   if not public.has_role(array['hr']::public.app_role[]) or p.state<>'approved' or p.effective_date is null or p.effective_date>current_date then raise exception 'Approved effective proposal required';end if;
   update public.compensation_proposals set state='effective',version=version+1 where id=p.id;
   if p.proposed_values ? 'job_title' then update public.employees set job_title=p.proposed_values->>'job_title',version=version+1 where id=p.employee_id;end if;
  end if;result_id:=p.id;
 elsif action='create_journal' then
  if not public.has_role(array['finance']::public.app_role[]) then raise exception 'Finance required';end if;
  insert into public.journals(period_id,entry_date,description,source_reference,submitted_by,state) values((payload->>'period_id')::uuid,(payload->>'entry_date')::date,nullif(payload->>'description',''),nullif(payload->>'source_reference',''),actor,'submitted') returning id into result_id;
  for row_data in select * from jsonb_array_elements(payload->'lines') loop insert into public.journal_lines(journal_id,account_id,debit,credit) values(result_id,(row_data->>'account_id')::uuid,coalesce((row_data->>'debit')::numeric,0),coalesce((row_data->>'credit')::numeric,0));end loop;
  select sum(debit),sum(credit) into sum_debit,sum_credit from public.journal_lines where journal_id=result_id;
  if sum_debit is null or sum_debit<>sum_credit or sum_debit<=0 then raise exception 'Balanced journal required';end if;
 elsif action='approve_journal' then
  select * into strict j from public.journals where id=record_id for update;
  if not public.has_role(array['ceo']::public.app_role[]) or actor=j.submitted_by or j.state<>'submitted' or j.version is distinct from expected_version then raise exception 'Independent current CEO approval required';end if;
  update public.journals set state='approved',approved_by=actor,approved_version=version where id=j.id;result_id:=j.id;
 elsif action='prepare_budget' then
  if not public.has_role(array['finance']::public.app_role[]) then raise exception 'Finance required';end if;
  insert into public.budgets(name,category,amount,submitted_by,state) values(payload->>'name',payload->>'category',(payload->>'amount')::numeric,actor,'prepared') returning id into result_id;
 elsif action in ('approve_budget','activate_budget') then
  select * into strict b from public.budgets where id=record_id for update;
  if b.version is distinct from expected_version then raise exception 'Budget changed';end if;
  if action='approve_budget' then
   if not public.has_role(array['ceo']::public.app_role[]) or actor=b.submitted_by or b.state<>'prepared' then raise exception 'Independent CEO approval required';end if;
   update public.budgets set state='approved',approved_by=actor,approved_version=version where id=b.id;
  else
   if not public.has_role(array['finance']::public.app_role[]) or b.state<>'approved' or b.approved_version<>b.version then raise exception 'Current approved budget required';end if;
   update public.budgets set state='active' where id=b.id;
  end if;result_id:=b.id;
 elsif action='create_candidate' then
  if not public.has_role(array['hr','ceo']::public.app_role[]) then raise exception 'HR required';end if;
  insert into public.candidates(name,email,position,job_related_evidence) values(payload->>'name',payload->>'email',payload->>'position',payload->>'job_related_evidence') returning id into result_id;
 elsif action='update_candidate' then
  if not public.has_role(array['hr','ceo']::public.app_role[]) or length(trim(coalesce(payload->>'job_related_evidence','')))<5 then raise exception 'HR and job-related criteria required';end if;
  if payload->>'stage' not in ('screening','interview','offer','hired','rejected') then raise exception 'Invalid recruitment stage';end if;
  update public.candidates set stage=payload->>'stage',job_related_evidence=payload->>'job_related_evidence' where id=record_id;result_id:=record_id;
 elsif action='create_sprint' then
  if not public.project_manager((payload->>'project_id')::uuid) then raise exception 'Project manager required';end if;
  insert into public.sprints(project_id,name,start_date,end_date) values((payload->>'project_id')::uuid,payload->>'name',(payload->>'start_date')::date,(payload->>'end_date')::date) returning id into result_id;
 elsif action='create_release' then
  if not public.project_manager((payload->>'project_id')::uuid) then raise exception 'Project manager required';end if;
  insert into public.releases(project_id,name,checklist) values((payload->>'project_id')::uuid,payload->>'name',coalesce(payload->'checklist','[]')) returning id into result_id;
 else return public.command_core(action,record_id,expected_version,payload);
 end if;
 perform public.audit(action,result_id,jsonb_build_object('previous_version',expected_version));
 return jsonb_build_object('id',result_id,'success',true);
end $$;
revoke execute on function public.command(text,uuid,integer,jsonb) from public,anon;
grant execute on function public.command(text,uuid,integer,jsonb) to authenticated;
commit;



-- ===== 202610130007_hardening.sql =====
begin;
-- Supabase projects can have permissive default grants; deny direct mutation explicitly.
revoke insert,update,delete,truncate,references,trigger on all tables in schema public from anon,authenticated;
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
create function public.enforce_financial_version() returns trigger language plpgsql set search_path='' as $$ begin
 if TG_TABLE_NAME='journals' then
  if(new.description,new.entry_date,new.period_id,new.source_reference) is distinct from(old.description,old.entry_date,old.period_id,old.source_reference) then new.version:=old.version+1;new.state:='draft';new.approved_by:=null;new.approved_version:=null;end if;
 elsif TG_TABLE_NAME='budgets' then
  if(new.amount,new.category,new.project_id) is distinct from(old.amount,old.category,old.project_id) then new.version:=old.version+1;new.state:='draft';new.approved_by:=null;new.approved_version:=null;end if;
 elsif TG_TABLE_NAME='income' then
  if(new.amount,new.source,new.currency,new.evidence,new.reference) is distinct from(old.amount,old.source,old.currency,old.evidence,old.reference) then
   if old.state in ('posted','reconciled') then raise exception 'Posted receipt requires reversal';end if;
   new.version:=old.version+1;new.state:='pending_verification';new.verified_by:=null;new.verified_version:=null;
  end if;
 end if;return new;end $$;
create trigger journal_version before update on public.journals for each row execute function public.enforce_financial_version();
create trigger budget_version before update on public.budgets for each row execute function public.enforce_financial_version();
create trigger income_version before update on public.income for each row execute function public.enforce_financial_version();
create function public.line_version() returns trigger language plpgsql security definer set search_path='' as $$ declare parent uuid;begin
 parent:=coalesce(new.journal_id,old.journal_id);
 perform 1 from public.journals where id=parent for update;
 if exists(select 1 from public.journals where id=parent and state='posted') then raise exception 'Posted lines are immutable';end if;
 update public.journals set state='draft',approved_by=null,approved_version=null,version=version+1 where id=parent and state='approved';
 return coalesce(new,old);end $$;
create trigger line_approval_version before insert or update or delete on public.journal_lines for each row execute function public.line_version();
alter table public.company_settings add constraint valid_weekdays check(working_weekdays<@array[0,1,2,3,4,5,6]);
alter table public.performance_reviews add constraint review_state check(state in ('evidence_collection','manager_review','employee_response','finalized'));
alter table public.performance_reviews add constraint score_range check(score between 0 and 100);
create unique index one_original_review on public.performance_reviews(employee_id,period_id) where replaces_id is null;
alter table public.points_ledger add constraint nonzero_points check(points<>0);
create unique index one_open_attendance on public.attendance(employee_id) where check_out is null;
alter table public.leave_ledger add constraint exact_half_days check(mod(days,0.5)=0);
create index notifications_user_created on public.notifications(user_id,created_at desc);
create index audit_entity_created on public.audit_events(entity_id,created_at desc);
revoke execute on function public.enforce_financial_version(),public.line_version() from public,anon,authenticated;
commit;


-- ===== 202610130008_accounts_documents_notifications.sql =====
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



-- ===== 202610130009_provisioning_fix.sql =====
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


-- ===== 202610130010_ticketing.sql =====
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
