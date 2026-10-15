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
