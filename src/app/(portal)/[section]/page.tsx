import { notFound, redirect } from 'next/navigation';
import { Portal } from '@/components/portal';
import { sections, canAccess } from '@/lib/permissions';
import { isConfigured, serverClient } from '@/lib/supabase/server';
import { identity } from '@/lib/supabase/identity';
import { fixtures } from '@/features/fixtures';
export const dynamic = 'force-dynamic';
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_FIXTURE_PREVIEW === 'false')
      redirect('/login');
    return (
      <Portal
        section={section}
        preview
        data={fixtures}
        user={{
          id: 'preview',
          first_name: 'Kajan',
          last_name: 'Raj',
          job_title: 'CEO / Owner',
          roles: ['ceo'],
        }}
      />
    );
  }
  const user = await identity();
  if (!user) redirect('/login');
  if (user.needsMfa) redirect('/mfa');
  if (section === 'dashboard' && !user.roles.includes('ceo')) {
    redirect(
      user.roles.includes('hr')
        ? '/hr'
        : user.roles.includes('finance')
          ? '/finance'
          : user.roles.includes('manager')
            ? '/tasks'
            : user.roles.includes('admin')
              ? '/employees'
              : '/my-work',
    );
  }
  if (!canAccess(user.roles, section)) notFound();
  const db = await serverClient();
  const ticketResults =
    section === 'ticketing'
      ? await Promise.all([
          db
            .from('support_tickets')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(100),
          db.from('ticket_comments').select('*').order('created_at').limit(1000),
          db.from('ticket_events').select('*').order('created_at').limit(1000),
        ])
      : null;
  const ticketData = ticketResults
    ? {
        tickets: ticketResults[0].data ?? [],
        comments: ticketResults[1].data ?? [],
        events: ticketResults[2].data ?? [],
        error: ticketResults.some((r) => r.error)
          ? 'Apply migration 202610130010_ticketing.sql in Supabase SQL Editor, then reload.'
          : undefined,
      }
    : undefined;
  const [
    employees,
    projects,
    tasks,
    expenses,
    leave,
    logs,
    attendance,
    notifications,
    settings,
    income,
    reviews,
    checklists,
    candidates,
    documents,
    payments,
    budgets,
    journals,
    accounts,
    periods,
    performancePeriods,
    leaveTypes,
    leaveLedger,
    compensation,
    sprints,
    releases,
  ] = await Promise.all(
    (
      [
        'employees',
        'projects',
        'tasks',
        'expenses',
        'leave_requests',
        'work_logs',
        'attendance',
        'notifications',
        'company_settings',
        'income',
        'performance_reviews',
        'checklist_items',
        'candidates',
        'documents',
        'payments',
        'budgets',
        'journals',
        'accounts',
        'fiscal_periods',
        'performance_periods',
        'leave_types',
        'leave_ledger',
        'compensation_proposals',
        'sprints',
        'releases',
      ] as const
    ).map(async (t) => {
      const result = await db.from(t).select('*').limit(100);
      return { ...result, data: result.data?.map((r) => ({ ...r, id: String(r.id) })) };
    }),
  );
  const results = [
    employees,
    projects,
    tasks,
    expenses,
    leave,
    logs,
    attendance,
    notifications,
    settings,
    income,
    reviews,
    checklists,
    candidates,
    documents,
    payments,
    budgets,
    journals,
    accounts,
    periods,
    performancePeriods,
    leaveTypes,
    leaveLedger,
    compensation,
    sprints,
    releases,
  ];
  if (results.some((r) => r.error))
    return (
      <div className="setup-page">
        <h1>Workspace could not be loaded</h1>
        <p>Check the database migration and your access permissions, then reload.</p>
        <a href={`/${section}`}>Try again</a>
      </div>
    );
  return (
    <Portal
      section={section}
      preview={false}
      ticketData={ticketData}
      user={user}
      data={{
        employees: employees.data ?? [],
        projects: projects.data ?? [],
        tasks: tasks.data ?? [],
        expenses: expenses.data ?? [],
        leave: leave.data ?? [],
        logs: logs.data ?? [],
        attendance: attendance.data ?? [],
        notifications: notifications.data ?? [],
        settings: settings.data ?? [],
        income: income.data ?? [],
        reviews: reviews.data ?? [],
        checklists: checklists.data ?? [],
        candidates: candidates.data ?? [],
        documents: documents.data ?? [],
        payments: payments.data ?? [],
        budgets: budgets.data ?? [],
        journals: journals.data ?? [],
        accounts: accounts.data ?? [],
        periods: periods.data ?? [],
        performancePeriods: performancePeriods.data ?? [],
        leaveTypes: leaveTypes.data ?? [],
        leaveLedger: leaveLedger.data ?? [],
        compensation: compensation.data ?? [],
        sprints: sprints.data ?? [],
        releases: releases.data ?? [],
      }}
    />
  );
}
