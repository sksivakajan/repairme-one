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






