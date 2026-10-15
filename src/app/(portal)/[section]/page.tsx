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
  // Managers and the CEO can pick or change a project leader from any page that shows a project.
  const leaderRows = user.roles.some((r) => r === 'ceo' || r === 'manager')
    ? ((await db.rpc('leader_candidates')).data ?? [])
    : [];
  const [
    employees,
    projects,
    tasks,
    expenses,
    leave,
    logs,
    attendance,
    attendanceDevices,
    agentDevices,
    agentStatus,
    projectMembers,
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
        'attendance_devices',
        'agent_devices',
        'agent_status',
        'project_members',
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
      const query = db.from(t).select('*');
      const result = await (
        t === 'attendance'
          ? query.order('day', { ascending: false }).order('check_in', { ascending: false })
          : query
      ).limit(t === 'attendance' ? 300 : 100);
      return {
        ...result,
        table: t,
        data: result.data?.map((r) => ({
          ...r,
          id:
            'id' in r
              ? String(r.id)
              : 'attendance_id' in r
                ? `${r.attendance_id}:${r.device_id}`
                : 'device_id' in r
                  ? String(r.device_id)
                  : `${r.project_id}:${r.employee_id}`,
        })),
      };
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
    attendanceDevices,
    agentDevices,
    agentStatus,
    projectMembers,
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
  // Tables added by the newest migrations are optional, so the portal still opens before they are applied.
  const optional = ['attendance_devices', 'agent_devices', 'agent_status'];
  const failed = results.filter((r) => r.error && !optional.includes(r.table));
  if (failed.length)
    return (
      <div className="setup-page">
        <h1>Workspace could not be loaded</h1>
        <p>
          Check the database migration and your access permissions, then reload. Could not read:{' '}
          {failed.map((r) => r.table).join(', ')}.
        </p>
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
        attendanceDevices: attendanceDevices.data ?? [],
        agentDevices: agentDevices.data ?? [],
        agentStatus: agentStatus.data ?? [],
        projectMembers: projectMembers.data ?? [],
        leaders: leaderRows.map((r) => ({ id: String(r.id) })),
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
