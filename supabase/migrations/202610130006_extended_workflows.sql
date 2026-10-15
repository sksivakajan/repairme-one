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

