'use client';
import { useState, useMemo, useEffect } from 'react';
import NextLink from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  LayoutDashboard,
  ClipboardCheck,
  FolderKanban,
  ListTodo,
  Clock,
  CalendarDays,
  Users,
  Contact,
  Wallet,
  Code2,
  ChartNoAxesCombined,
  FileText,
  ChartPie,
  Settings,
  Search,
  Bell,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Check,
  X,
  Menu,
  LogOut,
  Layers,
  TrendingUp,
  Receipt,
  Download,
  Filter,
  MoreHorizontal,
  Sun,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Info,
  ArrowDownLeft,
  ArrowUpRight as Outgoing,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { canAccess, type Role } from '@/lib/permissions';
import type { PortalData, Row } from '@/features/fixtures';
import { ticketFixtures } from '@/features/ticket-fixtures';
import { AWAY_AFTER_MS, deviceId, deviceLabel, formatDuration } from '@/lib/attendance';
import { DigitalWatch } from '@/components/digital-watch';
import { buildPdf, statusCell, type PdfCell } from '@/lib/pdf';
import { WorkBreak } from '@/components/work-break';
import { DesktopBridge } from '@/components/desktop-bridge';
import { Ticketing, type TicketData } from '@/components/ticketing';
import { workflowForms } from '@/features/workflow-forms';
const nav: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { slug: 'my-work', label: 'My Work', icon: ClipboardCheck },
  { slug: 'projects', label: 'Projects', icon: FolderKanban },
  { slug: 'ticketing', label: 'Ticketing', icon: ClipboardCheck },
  { slug: 'tasks', label: 'Tasks', icon: ListTodo },
  { slug: 'work-logs', label: 'Work Logs', icon: Clock },
  { slug: 'attendance', label: 'Attendance', icon: CalendarDays },
  { slug: 'employees', label: 'Employees', icon: Users },
  { slug: 'hr', label: 'HR', icon: Contact },
  { slug: 'finance', label: 'Finance', icon: Wallet },
  { slug: 'developer-workspace', label: 'Developer Workspace', icon: Code2 },
  { slug: 'performance', label: 'Performance', icon: ChartNoAxesCombined },
  { slug: 'documents', label: 'Documents', icon: FileText },
  { slug: 'reports', label: 'Reports', icon: ChartPie },
  { slug: 'settings', label: 'Settings', icon: Settings },
];
const text = (r: Row, key: string) => String(r[key] ?? '');
const num = (r: Row, key: string) => Number(r[key] ?? 0);
const label = (s: string) => s.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const transitionLabel = (from: string, to: string) =>
  to === 'in_progress'
    ? from === 'todo'
      ? 'Accept and start work'
      : 'Send back for changes'
    : to === 'in_review'
      ? 'Submit for review'
      : to === 'completed'
        ? 'Approve and close'
        : to === 'cancelled'
          ? 'Close task (cancel)'
          : label(to);
const money = (n: number) => 'LKR ' + n.toLocaleString('en-LK', { maximumFractionDigits: 2 });
const date = (s: string) =>
  s
    ? new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Colombo',
      }).format(new Date(s))
    : '—';
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? 'small' : ''}`}>
      {name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value}`}>
      {value === 'submitted' ? 'Pending' : value === 'active' ? 'In progress' : label(value)}
    </span>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <span className="progress-wrap">
      <span className="progress">
        <span style={{ width: `${value}%` }} />
      </span>
      <span>{value}%</span>
    </span>
  );
}
function Panel({
  title,
  children,
  action,
  extra,
  className = '',
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <h2>
          {title}
          {extra}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
function Stat({
  icon: Icon,
  title,
  value,
  detail,
  color = 'green',
}: {
  icon: LucideIcon;
  title: string;
  value: string | number;
  detail: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="stat">
      <span className={`stat-icon ${color}`}>
        <Icon size={25} />
      </span>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <div className="stat-detail">{detail}</div>
      </div>
    </div>
  );
}
function Empty({ message = 'No records yet' }: { message?: string }) {
  return (
    <div className="empty">
      <Layers size={28} />
      <strong>{message}</strong>
      <p>New records will appear here as your team gets to work.</p>
    </div>
  );
}
export function Portal({
  section,
  preview,
  previewPath = false,
  ticketData = { tickets: [], comments: [], events: [] },
  data,
  user,
  logRange,
}: {
  section: string;
  preview: boolean;
  previewPath?: boolean;
  ticketData?: TicketData;
  data: PortalData;
  logRange?: { from: string; to: string };
  user: { id: string; first_name: string; last_name: string; job_title: string; roles: Role[] };
}) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('input[aria-label="Search workspace"]')?.focus();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  const Link = ({ href, ...props }: React.ComponentProps<typeof NextLink>) => (
    <NextLink
      href={
        previewPath && typeof href === 'string' && nav.some((n) => href === `/${n.slug}`)
          ? `/preview${href}`
          : href
      }
      {...props}
    />
  );
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [mobile, setMobile] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<{ kind: string; row?: Row } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState<{ code: string; expires: string } | null>(null);
  const [formError, setFormError] = useState('');
  const [tab, setTab] = useState('Expenses');
  const [filter, setFilter] = useState('all');
  const [view, setView] = useState('board');
  const [page, setPage] = useState(1);
  const [, setTick] = useState(0);
  const [logFrom, setLogFrom] = useState(logRange?.from ?? '');
  const [logTo, setLogTo] = useState(logRange?.to ?? '');
  const name = user.first_name + ' ' + user.last_name;
  const openAttendance =
    !preview && data.attendance.some((a) => text(a, 'employee_id') === user.id && !a.check_out);
  useEffect(() => {
    // Worked time is the sum of gaps between heartbeats of up to 3 minutes, so time while the
    // computer sleeps or the app is closed is never counted.
    if (!openAttendance) return;
    const beat = () =>
      void fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attendance_heartbeat',
          payload: { device_id: deviceId(), device_label: deviceLabel() },
        }),
      })
        .then((res) => {
          if (res.status === 401) router.replace('/login?reason=another-device');
        })
        .catch(() => undefined);
    const wake = () => {
      if (document.visibilityState === 'visible') beat();
    };
    beat();
    const timer = setInterval(beat, 60000);
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [openAttendance, router]);
  useEffect(() => {
    if (section !== 'work-logs') return;
    const timer = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, [section]);
  useEffect(() => {
    if (section !== 'attendance' || preview) return;
    const timer = setInterval(() => router.refresh(), 120000);
    return () => clearInterval(timer);
  }, [section, preview, router]);
  const employeeName = (id: string) => {
    const e = data.employees.find((e) => e.id === id);
    return e ? text(e, 'first_name') + ' ' + text(e, 'last_name') : 'Team member';
  };
  const colomboDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' }).format(
    new Date(),
  );
  // Work-log window (company time). The database enforces it; this only explains it on screen.
  const companySettings = data.settings[0] ?? { id: '' };
  const companyTz = text(companySettings, 'timezone') || 'Asia/Colombo';
  const workStart = (text(companySettings, 'work_start') || '09:00').slice(0, 5);
  const workEnd = (text(companySettings, 'work_end') || '18:00').slice(0, 5);
  const time12 = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  };
  const workDay = new Intl.DateTimeFormat('en-CA', { timeZone: companyTz }).format(new Date());
  const nowHm = new Intl.DateTimeFormat('en-GB', {
    timeZone: companyTz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
  const workDays = (companySettings.working_weekdays as number[] | undefined) ?? [];
  const logWindowOpen =
    nowHm >= workStart &&
    nowHm < workEnd &&
    (!workDays.length || workDays.includes(new Date(`${workDay}T00:00:00Z`).getUTCDay()));
  // A leader can reopen a locked day for a few hours. These are the reopens that still apply to this person.
  const myReopens = data.workLogReopens.filter(
    (r) => text(r, 'employee_id') === user.id && Date.parse(text(r, 'expires_at')) > Date.now(),
  );
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const dayShift = (days: number) =>
    new Date(Date.parse(`${workDay}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  const logDay = (w: Row) => text(w, 'work_date') || text(w, 'start_at').slice(0, 10);
  // A single date shows that day only; two dates show everything between them.
  const applyRange = (from: string, to: string) => {
    const a = from || to;
    const b = to || from;
    const [lo, hi] = a && b && a > b ? [b, a] : [a, b];
    setLogFrom(lo);
    setLogTo(hi);
    if (!preview) router.push(lo ? `/work-logs?from=${lo}&to=${hi}` : '/work-logs');
  };
  const rangeText = logFrom
    ? logFrom === logTo
      ? logFrom
      : `${logFrom} to ${logTo}`
    : 'All loaded dates';
  const downloadPdf = (name: string, report: Parameters<typeof buildPdf>[0]) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(
      new Blob([buildPdf(report) as unknown as BlobPart], { type: 'application/pdf' }),
    );
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const stamp = () => new Date().toLocaleString('en-GB', { timeZone: companyTz });
  const ownAttendance = data.attendance.filter((a) => text(a, 'employee_id') === user.id);
  const todayRecord = ownAttendance.find((a) => text(a, 'day') === colomboDay || !a.check_out);
  const canSeeTeam = preview || user.roles.some((r) => ['ceo', 'hr', 'manager'].includes(r));
  const deviceNames = (attendanceId: string) =>
    data.attendanceDevices
      .filter((d) => text(d, 'attendance_id') === attendanceId)
      .map((d) => text(d, 'device_label'))
      .join(', ') || '—';
  const clock = (value: string) =>
    new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Colombo' });
  const awaySeconds = (a: Row) => {
    const end = a.check_out ?? a.last_seen_at ?? a.check_in;
    return Math.max(
      0,
      (Date.parse(String(end)) - Date.parse(text(a, 'check_in'))) / 1000 - num(a, 'active_seconds'),
    );
  };
  const presence = (a: Row) =>
    a.check_out
      ? 'Checked out'
      : Date.now() - Date.parse(text(a, 'last_seen_at') || text(a, 'check_in')) < AWAY_AFTER_MS
        ? 'Active now'
        : 'Away / offline';
  const ownDevices = data.agentDevices.filter(
    (d) => text(d, 'user_id') === user.id && !d.revoked_at,
  );
  const ownAgent = data.agentStatus
    .filter((s) => text(s, 'user_id') === user.id)
    .sort((a, b) => text(b, 'updated_at').localeCompare(text(a, 'updated_at')))[0];
  const deviceName = (id: string) =>
    text(data.agentDevices.find((d) => d.id === id) ?? { id: '' }, 'device_name') || 'Computer';
  const agentFresh = (s: Row) => Date.now() - Date.parse(text(s, 'updated_at')) < 150000;
  const agentLabel = (s: Row) =>
    !agentFresh(s)
      ? 'Offline / asleep'
      : text(s, 'state') === 'active'
        ? 'Working'
        : text(s, 'state') === 'locked'
          ? 'PC locked'
          : text(s, 'state') === 'break'
            ? 'Coffee break'
            : 'Idle';
  const agentClass: Record<string, string> = {
    Working: 'approved',
    Idle: 'submitted',
    'PC locked': 'submitted',
    'Coffee break': 'in_progress',
    'Offline / asleep': 'draft',
  };
  async function createPairing() {
    if (preview) {
      setFormError(
        'This is a read-only fixture preview. Connect Supabase to save changes securely.',
      );
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_agent_pairing', payload: {} }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setPairing({ code: String(result.code), expires: String(result.expires_at) });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to create a code. Try again.');
    } finally {
      setBusy(false);
    }
  }
  const presenceClass: Record<string, string> = {
    'Active now': 'approved',
    'Away / offline': 'submitted',
    'Checked out': 'draft',
  };
  const todayRows = data.attendance.filter((a) => text(a, 'day') === colomboDay);
  const workedByEmployee = [...new Set(data.attendance.map((a) => text(a, 'employee_id')))].map(
    (id) => {
      const rows = data.attendance.filter((a) => text(a, 'employee_id') === id);
      return {
        id,
        days: rows.length,
        worked: rows.reduce((n, a) => n + num(a, 'active_seconds'), 0),
      };
    },
  );
  const projectName = (id: string) =>
    text(data.projects.find((p) => p.id === id) ?? { id: '' }, 'name') || 'Unassigned project';
  const pending = data.expenses.filter((e) => text(e, 'approval_status') === 'submitted');
  const paid = data.payments.reduce((n, p) => n + num(p, 'amount'), 0);
  const incomeTotal = data.income.reduce((n, r) => n + num(r, 'amount'), 0);
  const unpaid = data.expenses
    .filter(
      (e) => text(e, 'approval_status') === 'approved' && text(e, 'execution_status') === 'unpaid',
    )
    .reduce((n, e) => n + num(e, 'approved_amount'), 0);
  // Your own tasks, plus every task of the projects you lead (the CEO sees all). Nobody else's task shows here.
  const leadsProject = (projectId: string) =>
    user.roles.includes('ceo') ||
    data.projects.some((p) => p.id === projectId && text(p, 'manager_id') === user.id);
  const mine = preview
    ? data.tasks
    : data.tasks.filter(
        (t) =>
          text(t, 'assignee_id') === user.id ||
          (section !== 'my-work' && leadsProject(text(t, 'project_id'))),
      );
  const isOverdue = (t: Row) =>
    !!t.due_date &&
    text(t, 'due_date') < colomboDay &&
    !['completed', 'cancelled'].includes(text(t, 'status'));
  const daysLate = (t: Row) =>
    Math.max(1, Math.round((Date.parse(colomboDay) - Date.parse(text(t, 'due_date'))) / 86400000));
  const overdueTasks = mine
    .filter(isOverdue)
    .sort((a, b) => text(a, 'due_date').localeCompare(text(b, 'due_date')));
  // Overdue tasks leave their normal column and wait in Overdue until they are closed.
  const inColumn = (t: Row, state: string) =>
    state === 'overdue' ? isOverdue(t) : text(t, 'status') === state && !isOverdue(t);
  const groupMates = (t: Row) =>
    t.group_id ? data.tasks.filter((o) => o.group_id === t.group_id && o.id !== t.id) : [];
  const canManageTasks =
    user.roles.some((r) => r === 'ceo' || r === 'manager') ||
    data.projects.some((p) => text(p, 'manager_id') === user.id);
  const filtered = (rows: Row[]) =>
    rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(query.toLowerCase())),
    );
  const shownLogs = filtered(data.logs).filter(
    (w) => (!logFrom || logDay(w) >= logFrom) && (!logTo || logDay(w) <= logTo),
  );
  function exportPdf() {
    if (section === 'work-logs') {
      const counts: Record<string, number> = {};
      shownLogs.forEach((w) => (counts[text(w, 'status')] = (counts[text(w, 'status')] ?? 0) + 1));
      downloadPdf(
        `repairme-work-logs-${logFrom || 'all'}${logTo && logTo !== logFrom ? `-to-${logTo}` : ''}.pdf`,
        {
          title: 'Work logs',
          subtitle: `${rangeText}  |  ${shownLogs.length} logs  |  ${Object.entries(counts)
            .map(([k, n]) => `${statusCell(k).text} ${n}`)
            .join(', ')}  |  Generated ${stamp()}`,
          columns: [
            { title: 'Date', width: 62 },
            { title: 'Employee', width: 92 },
            { title: 'Task', width: 110 },
            { title: 'Work summary', width: 240 },
            { title: 'Hours', width: 38 },
            { title: 'Status', width: 62 },
            { title: 'Latest comment', width: 190 },
          ],
          rows: shownLogs.map((w): (PdfCell | string)[] => {
            const comments = data.workLogComments.filter((c) => text(c, 'work_log_id') === w.id);
            const last = comments[comments.length - 1];
            return [
              logDay(w),
              employeeName(text(w, 'employee_id')),
              text(data.tasks.find((t) => t.id === text(w, 'task_id')) ?? { id: '' }, 'title'),
              text(w, 'description') + (num(w, 'edit_count') > 0 ? ' (edited)' : ''),
              ((Date.parse(text(w, 'end_at')) - Date.parse(text(w, 'start_at'))) / 3600000).toFixed(
                1,
              ),
              statusCell(text(w, 'status')),
              last ? `${employeeName(text(last, 'author_id'))}: ${text(last, 'body')}` : '',
            ];
          }),
        },
      );
      return;
    }
    const rows = filtered(mine);
    downloadPdf('repairme-tasks.pdf', {
      title: 'Tasks',
      subtitle: `${rows.length} tasks  |  Generated ${stamp()}`,
      columns: [
        { title: 'Task', width: 220 },
        { title: 'Project', width: 130 },
        { title: 'Assignee', width: 110 },
        { title: 'Due', width: 70 },
        { title: 'Priority', width: 60 },
        { title: 'Status', width: 80 },
      ],
      rows: rows.map((t): (PdfCell | string)[] => [
        text(t, 'title'),
        projectName(text(t, 'project_id')),
        text(t, 'assignee_id') ? employeeName(text(t, 'assignee_id')) : '',
        text(t, 'due_date'),
        label(text(t, 'priority')),
        statusCell(isOverdue(t) ? 'overdue' : text(t, 'status')),
      ]),
    });
  }
  const today = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  }).format(new Date());
  const open = (kind: string, row?: Row) => {
    setFormError('');
    setDialog({ kind, row });
  };
  const inform = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 6000);
  };
  async function command(action: string, payload: Record<string, unknown>, row?: Row) {
    if (preview) {
      setFormError(
        'This is a read-only fixture preview. Connect Supabase to save changes securely.',
      );
      return false;
    }
    setBusy(true);
    setFormError('');
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, id: row?.id, version: row?.version }),
      });
      const result = await res.json();
      if (res.status === 401) router.replace('/login?reason=another-device');
      if (!res.ok) throw new Error(result.error);
      inform('Saved successfully. Your workspace is up to date.');
      router.refresh();
      return true;
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to save. Try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const viewAll = (href: string) => (
    <Link className="text-link" href={href}>
      View all <ArrowRight size={13} />
    </Link>
  );
  function ProjectTable() {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Client</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Due date</th>
              <th>Team</th>
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p, i) => {
              const tasks = data.tasks.filter((t) => text(t, 'project_id') === p.id);
              const progress = preview
                ? num(p, 'progress')
                : tasks.length
                  ? Math.round(
                      (tasks.filter((t) => text(t, 'status') === 'completed').length /
                        tasks.length) *
                        100,
                    )
                  : 0;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href="/projects" className="project-table-name">
                      <span className={`project-mark ${text(p, 'color') || 'blue'}`}>
                        <FolderKanban size={14} />
                      </span>
                      <span>
                        <small>{text(p, 'code') || `PROJECT ${i + 1}`}</small>
                        {text(p, 'name')}
                      </span>
                    </Link>
                  </td>
                  <td>{text(p, 'client') || 'Internal'}</td>
                  <td>
                    <Progress value={progress} />
                  </td>
                  <td>
                    <Badge value={text(p, 'status')} />
                  </td>
                  <td>{date(text(p, 'due_date'))}</td>
                  <td>
                    <div className="avatar-stack">
                      {[...new Set(tasks.map((t) => text(t, 'assignee_id')))]
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((id) => (
                          <Avatar key={id} name={employeeName(id)} small />
                        ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!data.projects.length && <Empty />}
      </div>
    );
  }
  function ExpenseTable({ compact = false }: { compact?: boolean }) {
    const rows = filtered(compact ? pending : data.expenses).filter(
      (e) => filter === 'all' || text(e, 'approval_status') === filter,
    );
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              {!compact && <th>Category</th>}
              <th>Purpose</th>
              <th>Amount</th>
              <th>Submitted by</th>
              <th>Status</th>
              <th className="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 8, page * 8).map((e) => (
              <tr key={e.id}>
                <td>{date(text(e, 'created_at'))}</td>
                {!compact && <td>{text(e, 'category')}</td>}
                <td className="purpose">{text(e, 'purpose')}</td>
                <td className="nowrap amount">{money(num(e, 'amount'))}</td>
                <td>
                  <div className="person">
                    <Avatar name={employeeName(text(e, 'submitted_by'))} small />
                    <div>
                      {employeeName(text(e, 'submitted_by'))}
                      <small>
                        {text(
                          data.employees.find((x) => x.id === text(e, 'submitted_by')) ?? {
                            id: '',
                          },
                          'job_title',
                        )}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <Badge value={text(e, 'approval_status')} />
                </td>
                <td className="right">
                  <button
                    className={
                      text(e, 'approval_status') === 'submitted'
                        ? 'button yellow small-button'
                        : 'button quiet small-button'
                    }
                    onClick={() => open('expense-detail', e)}
                  >
                    {text(e, 'approval_status') === 'submitted' ? 'Review' : 'View'}
                    <ChevronRight size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <Empty message="No matching expenses" />}
        {rows.length > 8 && (
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button disabled={page * 8 >= rows.length} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        )}
      </div>
    );
  }
  function CashChart() {
    const series = useMemo(() => {
      const map = new Map<string, { income: number; expense: number }>();
      for (const r of data.income) {
        const day = text(r, 'received_at').slice(0, 10);
        const old = map.get(day) ?? { income: 0, expense: 0 };
        old.income += num(r, 'amount');
        map.set(day, old);
      }
      for (const r of data.payments) {
        const day = text(r, 'paid_at').slice(0, 10);
        const old = map.get(day) ?? { income: 0, expense: 0 };
        old.expense += num(r, 'amount');
        map.set(day, old);
      }
      return [...map].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
    }, []);
    const max = Math.max(1, ...series.map(([, v]) => Math.max(v.income, v.expense)));
    return (
      <>
        <div className="chart-legend">
          <span>
            <i className="dot green" />
            Income received
          </span>
          <span>
            <i className="dot yellow" />
            Paid expenses
          </span>
        </div>
        <div className="cash-chart">
          <div className="chart-axis">
            {[1, 0.75, 0.5, 0.25, 0].map((v) => (
              <span key={v}>{v ? `${Math.round((max * v) / 1000)}K` : '0'}</span>
            ))}
          </div>
          <div className="chart-plot">
            {series.map(([day, v]) => (
              <div className="chart-day" key={day}>
                <div className="bar-pair">
                  <span
                    title={`${day}: ${money(v.income)} received`}
                    className="bar income"
                    style={{ height: `${(v.income / max) * 100}%` }}
                  />
                  <span
                    title={`${day}: ${money(v.expense)} paid`}
                    className="bar expense"
                    style={{ height: `${(v.expense / max) * 100}%` }}
                  />
                </div>
                <small>{date(day).split(' ').slice(0, 2).join(' ')}</small>
              </div>
            ))}
          </div>
        </div>
        <p className="chart-caption">Actual receipt and payment events · LKR</p>
      </>
    );
  }
  function Workload() {
    const assigned = new Set(
      data.tasks
        .filter((t) => !['completed', 'cancelled'].includes(text(t, 'status')))
        .map((t) => text(t, 'assignee_id'))
        .filter(Boolean),
    );
    const count = data.employees.length;
    const working = assigned.size;
    return (
      <div className="workload">
        <div
          className="donut"
          style={{
            background: `conic-gradient(#2db86b 0 ${count ? (working / count) * 100 : 0}%, #e7ecf2 0 100%)`,
          }}
        >
          <div>
            <strong>{count}</strong>
            <span>Employees</span>
          </div>
        </div>
        <div className="workload-legend">
          <div>
            <i className="dot green" />
            <span>Assigned to work</span>
            <b>{working}</b>
            <small>{count ? Math.round((working / count) * 100) : 0}%</small>
          </div>
          <div>
            <i className="dot gray" />
            <span>Available / other</span>
            <b>{count - working}</b>
            <small>{count ? Math.round(((count - working) / count) * 100) : 0}%</small>
          </div>
          <p>Based on current task assignments</p>
        </div>
      </div>
    );
  }
  function Board() {
    return (
      <div className="kanban">
        {['todo', 'in_progress', 'in_review', 'completed', 'overdue'].map((state) => (
          <div className={`kanban-column ${state}`} key={state}>
            <div className="column-title">
              <span>
                <i />
                {state === 'todo'
                  ? 'Awaiting acceptance'
                  : state === 'completed'
                    ? 'Closed'
                    : label(state)}
              </span>
              <b>{mine.filter((t) => inColumn(t, state)).length}</b>
            </div>
            {filtered(mine)
              .filter((t) => inColumn(t, state))
              .map((t) => (
                <button className="task-card" key={t.id} onClick={() => open('task-detail', t)}>
                  <div className="task-id">
                    {text(t, 'code') || t.id.slice(0, 8)}
                    <MoreHorizontal size={17} />
                  </div>
                  <strong>{text(t, 'title')}</strong>
                  <Badge value={text(t, 'priority')} />
                  {isOverdue(t) && (
                    <span className="badge urgent">Overdue · {daysLate(t)}d late</span>
                  )}
                  {text(t, 'individual_work') && (
                    <small className="task-part">{text(t, 'individual_work')}</small>
                  )}
                  <div className="task-project">
                    <FolderKanban size={14} />
                    {projectName(text(t, 'project_id'))}
                  </div>
                  <div className="task-footer">
                    <span>
                      <CalendarDays size={13} />
                      {date(text(t, 'due_date')).split(' ').slice(0, 2).join(' ')}
                    </span>
                    <Avatar name={employeeName(text(t, 'assignee_id'))} small />
                  </div>
                </button>
              ))}
          </div>
        ))}
      </div>
    );
  }
  function Directory() {
    const rows = filtered(data.employees).filter(
      (e) => filter === 'all' || text(e, 'department') === filter,
    );
    return (
      <>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th>Job title</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * 6, page * 6).map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="person">
                      <Avatar name={employeeName(e.id)} />
                      <div className="employee-name">
                        {employeeName(e.id)}
                        <small>{text(e, 'work_email')}</small>
                      </div>
                    </div>
                  </td>
                  <td>{text(e, 'department')}</td>
                  <td>{text(e, 'job_title')}</td>
                  <td>
                    <span className="status-dot" />
                    {label(text(e, 'status'))}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`View ${employeeName(e.id)}`}
                      onClick={() => open('employee-detail', e)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty />}
        <div className="table-bottom">
          <span>
            Showing {Math.min((page - 1) * 6 + 1, rows.length)}–{Math.min(page * 6, rows.length)} of{' '}
            {rows.length} employees
          </span>
          <div className="pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>{page}</span>
            <button disabled={page * 6 >= rows.length} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </div>
        </div>
      </>
    );
  }
  function LeaveTable() {
    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave dates</th>
              <th>Duration</th>
              <th>Type</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.leave.map((l) => (
              <tr key={l.id}>
                <td>
                  <div className="person">
                    <Avatar name={employeeName(text(l, 'employee_id'))} small />
                    {employeeName(text(l, 'employee_id'))}
                  </div>
                </td>
                <td>{date(text(l, 'start_date'))}</td>
                <td>
                  {num(l, 'days')} day{num(l, 'days') !== 1 ? 's' : ''}
                </td>
                <td>{text(l, 'type') || 'Company leave'}</td>
                <td>
                  <Badge value={text(l, 'status')} />
                </td>
                <td>
                  <button
                    className="button yellow small-button"
                    onClick={() => open('leave-detail', l)}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.leave.length && <Empty />}
      </div>
    );
  }
  const title = nav.find((n) => n.slug === section)?.label ?? 'Dashboard';
  return (
    <div className="workspace">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link className="brand logo-brand" href="/dashboard" aria-label="RepairMe One home">
          <BrandLogo />
        </Link>
        <div className="workspace-label">COMPANY WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav
            .filter((n) => canAccess(user.roles, n.slug))
            .map(({ slug, label: navLabel, icon: Icon }, i) => (
              <Link
                onClick={() => {
                  setMobile(false);
                  setQuery('');
                  setFilter('all');
                  setPage(1);
                }}
                key={slug}
                href={`/${slug}`}
                className={`${section === slug ? 'selected' : ''} ${i === 8 ? 'nav-divider' : ''}`}
                aria-current={section === slug ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{navLabel}</span>
                {slug === 'finance' && pending.length > 0 && (
                  <b className="nav-count">{pending.length}</b>
                )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-health">
            <i />
            {preview ? 'Fixture preview' : 'Workspace available'}
          </div>
          <button onClick={() => inform('Need help? Contact your company system administrator.')}>
            <span className="help-icon">?</span>Help & support
            <ArrowUpRight size={15} />
          </button>
          <span className="sidebar-version">
            RepairMe One <span>v1.0</span>
          </span>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input
                aria-label="Search workspace"
                placeholder="Search anything..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className="topbar-line" />
            <div className="popover-anchor">
              <button
                className="notification-button icon-button"
                aria-label="Notifications"
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell size={20} />
                {data.notifications.length > 0 && <span />}
              </button>
              {notificationOpen && (
                <div className="popover notification-popover">
                  <h3>
                    Notifications <span>{data.notifications.length}</span>
                  </h3>
                  {data.notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={text(n, 'href')}
                      onClick={() => setNotificationOpen(false)}
                    >
                      <span className="notification-symbol">
                        <Bell size={16} />
                      </span>
                      <span>
                        {text(n, 'title')}
                        <small>{date(text(n, 'created_at'))}</small>
                      </span>
                    </Link>
                  ))}
                  {!data.notifications.length && <p>You’re all caught up.</p>}
                </div>
              )}
            </div>
            <div className="popover-anchor">
              <button className="profile-button" onClick={() => setProfileOpen(!profileOpen)}>
                <Avatar name={name} />
                <span>
                  <strong>{name}</strong>
                  <small>{user.job_title}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <div className="popover profile-popover">
                  <strong>{name}</strong>
                  <small>{preview ? 'Fixture preview' : user.job_title}</small>
                  <Link href="/my-work">
                    My workspace <ArrowRight size={14} />
                  </Link>
                  <Link href="/account">
                    Account & security <ShieldCheck size={14} />
                  </Link>
                  <form action="/auth/logout" method="post">
                    <button>
                      Sign out <LogOut size={14} />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {section === 'dashboard' ? (
                  <>
                    <span className="eyebrow-dot" /> YOUR COMPANY AT A GLANCE
                  </>
                ) : (
                  <>
                    WORKSPACE <span>/</span> {title.toUpperCase()}
                  </>
                )}
              </div>
              <h1>
                {section === 'dashboard'
                  ? `Good morning, ${user.first_name}`
                  : section === 'my-work'
                    ? 'Make today a good day.'
                    : section === 'hr'
                      ? 'People & HR'
                      : title}
                {section === 'dashboard' && <Sun className="greeting-sun" size={28} />}
              </h1>
              <p>
                {(
                  {
                    dashboard: 'A little clarity for everything your team is building.',
                    'my-work': 'Your work, priorities, and progress. All in one place.',
                    hr: 'Take care of your people. They take care of the rest.',
                    finance: 'Every rupee accounted for. Every decision in the right hands.',
                    projects: 'From the first idea to the final delivery.',
                    tasks: 'A clear view of what needs to happen next.',
                    employees: 'The people behind RepairMe.',
                    performance: 'Meaningful progress, backed by evidence.',
                    settings: 'Make this workspace work for your team.',
                  } as Record<string, string>
                )[section] ?? 'Keep your team connected and your work moving forward.'}
              </p>
            </div>
            <div className="heading-actions">
              {section === 'dashboard' ? (
                <span className="date-label">
                  <CalendarDays size={16} />
                  {today}
                </span>
              ) : ['projects', 'tasks', 'employees', 'finance', 'work-logs', 'documents'].includes(
                  section,
                ) ? (
                <>
                  <button
                    className="button outline"
                    onClick={() => {
                      const rows =
                        section === 'finance'
                          ? data.expenses
                          : section === 'employees'
                            ? data.employees
                            : section === 'projects'
                              ? data.projects
                              : data.tasks;
                      const csv = rows.length
                        ? [
                            Object.keys(rows[0]).join(','),
                            ...rows.map((r) =>
                              Object.values(r)
                                .map((v) => '"' + String(v ?? '').replaceAll('"', '""') + '"')
                                .join(','),
                            ),
                          ].join('\n')
                        : '';
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                      a.download = `repairme-${section}.csv`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      inform('Export downloaded.');
                    }}
                  >
                    <Download size={15} />
                    Export
                  </button>
                  {['tasks', 'work-logs'].includes(section) && (
                    <button className="button outline" onClick={exportPdf}>
                      <FileText size={15} />
                      PDF
                    </button>
                  )}
                  <button
                    className="button yellow"
                    onClick={() =>
                      open(
                        section === 'projects'
                          ? 'project'
                          : section === 'tasks'
                            ? 'task'
                            : section === 'finance'
                              ? 'expense'
                              : section === 'work-logs'
                                ? 'work-log'
                                : section === 'employees'
                                  ? 'invite'
                                  : 'document',
                      )
                    }
                  >
                    <Plus size={17} />
                    {section === 'finance'
                      ? 'New expense'
                      : section === 'projects'
                        ? 'New project'
                        : section === 'tasks'
                          ? 'New task'
                          : section === 'employees'
                            ? 'Invite employee'
                            : section === 'documents'
                              ? 'Upload document'
                              : 'Submit work log'}
                  </button>
                </>
              ) : (
                <span className="date-label">
                  <CalendarDays size={16} />
                  {new Intl.DateTimeFormat('en-GB', {
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'Asia/Colombo',
                  }).format(new Date())}
                </span>
              )}
            </div>
          </div>
          {preview && (
            <div className="preview-banner">
              <span>
                <i />
                <strong>Fixture preview</strong>
                <span>Explore the workspace with fictional development data.</span>
              </span>
              <Link href="/login">
                Connect your workspace <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          {section === 'ticketing' && (
            <Ticketing
              data={preview ? ticketFixtures : ticketData}
              employees={data.employees}
              userId={user.id}
              admin={user.roles.some((r) => r === 'ceo' || r === 'admin')}
              preview={preview}
            />
          )}
          {['dashboard', 'my-work', 'attendance'].includes(section) && (
            <DigitalWatch
              key={`${todayRecord ? num(todayRecord, 'active_seconds') : 0}:${ownAgent ? text(ownAgent, 'updated_at') : ''}`}
              baseSeconds={todayRecord ? num(todayRecord, 'active_seconds') : 0}
              agentState={ownAgent ? text(ownAgent, 'state') : null}
              agentUpdatedAt={ownAgent ? text(ownAgent, 'updated_at') : null}
              checkedIn={!!(todayRecord && !todayRecord.check_out)}
            />
          )}
          {section === 'dashboard' && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={Users}
                  title="Team members"
                  value={data.employees.length}
                  color="blue"
                  detail={
                    <>
                      <span className="positive">
                        <TrendingUp size={13} />{' '}
                        {data.employees.filter((e) => text(e, 'status') === 'active').length} active
                      </span>
                      <span>across your company</span>
                    </>
                  }
                />
                <Stat
                  icon={Layers}
                  title="Active projects"
                  value={data.projects.filter((p) => text(p, 'status') === 'active').length}
                  detail={
                    <>
                      <span className="positive">
                        <span className="tiny-dot" />
                        Assigned work
                      </span>
                      <span>let’s keep it going</span>
                    </>
                  }
                />
                <Stat
                  icon={ClipboardCheck}
                  title="Pending approvals"
                  value={pending.length}
                  color="yellow"
                  detail={
                    <>
                      <span className="amber">
                        <Clock size={13} />
                        Your review
                      </span>
                      <span>is needed</span>
                    </>
                  }
                />
                <Stat
                  icon={Wallet}
                  title="Income received"
                  value={money(incomeTotal)}
                  detail={
                    <>
                      <span className="positive">
                        <ArrowDownLeft size={13} />
                        Actual receipts
                      </span>
                      <span>not invoices</span>
                    </>
                  }
                />
              </div>
              <div className="dashboard-grid">
                <div className="main-column">
                  <Panel
                    title="Pending CEO approvals"
                    extra={<span className="count-pill">{pending.length}</span>}
                    action={viewAll('/finance')}
                  >
                    <ExpenseTable compact />
                    <div className="panel-footnote">
                      <ShieldCheck size={14} />
                      Your approval authorizes payment. Finance records it separately.
                    </div>
                  </Panel>
                  <Panel title="Recent project progress" action={viewAll('/projects')}>
                    <ProjectTable />
                  </Panel>
                  <div className="bottom-note">
                    <span className="yellow-square">✦</span>Great teams do great things. You’re
                    building one.
                    <span>
                      Let’s get to work <ArrowRight size={13} />
                    </span>
                  </div>
                </div>
                <div className="side-column">
                  <Panel title="Company workload" action={viewAll('/reports')}>
                    <Workload />
                  </Panel>
                  <Panel
                    title="Income vs. paid expenses"
                    action={<span className="subtle">Recent activity</span>}
                  >
                    <CashChart />
                  </Panel>
                  <Panel
                    title="Expenses overview"
                    action={<span className="subtle">Current records</span>}
                  >
                    <div className="expense-summary">
                      <div>
                        <span className="summary-icon green">
                          <CheckCircle2 size={16} />
                        </span>
                        <p>Paid expenses</p>
                        <strong>{money(paid)}</strong>
                        <small>Payment recorded</small>
                      </div>
                      <div>
                        <span className="summary-icon yellow">
                          <Clock size={16} />
                        </span>
                        <p>Approved unpaid</p>
                        <strong>{money(unpaid)}</strong>
                        <small>Awaiting payment</small>
                      </div>
                      <div>
                        <span className="summary-icon gray">
                          <Receipt size={16} />
                        </span>
                        <p>Pending approval</p>
                        <strong>{money(pending.reduce((n, e) => n + num(e, 'amount'), 0))}</strong>
                        <small>{pending.length} requests</small>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </>
          )}
          {['my-work', 'tasks'].includes(section) && overdueTasks.length > 0 && (
            <Panel
              className="operational-panel overdue-panel"
              title={`Overdue tasks (${overdueTasks.length})`}
            >
              <div className="review-queue">
                {overdueTasks.map((t) => (
                  <div key={t.id}>
                    <span>
                      <strong>{text(t, 'title')}</strong>
                      <small>
                        {employeeName(text(t, 'assignee_id'))} ·{' '}
                        {projectName(text(t, 'project_id'))} · due {date(text(t, 'due_date'))} ·{' '}
                        {daysLate(t)} day
                        {daysLate(t) === 1 ? '' : 's'} late
                      </small>
                    </span>
                    <button
                      className="button outline small-button"
                      onClick={() => open('task-detail', t)}
                    >
                      {canManageTasks ? 'Close or delete' : 'Open'}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {['my-work', 'tasks', 'developer-workspace'].includes(section) && (
            <>
              <div className="work-stats">
                <div className="attendance-card">
                  <span className="stat-icon green">
                    <Clock size={24} />
                  </span>
                  <div>
                    <p>Attendance today</p>
                    <strong>
                      {todayRecord
                        ? formatDuration(num(todayRecord, 'active_seconds')) + ' worked'
                        : 'Not checked in'}
                    </strong>
                    <small>
                      {todayRecord
                        ? `Checked in ${clock(text(todayRecord, 'check_in'))} · Asia/Colombo`
                        : 'Check in to start tracking your time'}
                    </small>
                  </div>
                  <div className="attendance-action">
                    <Badge
                      value={
                        data.attendance.some(
                          (a) => text(a, 'employee_id') === user.id && !a.check_out,
                        )
                          ? 'recorded'
                          : 'not_checked_in'
                      }
                    />
                    <button
                      className="button yellow small-button"
                      onClick={() => open('attendance')}
                    >
                      <LogOut size={14} />{' '}
                      {data.attendance.some(
                        (a) => text(a, 'employee_id') === user.id && !a.check_out,
                      )
                        ? 'Check out'
                        : 'Check in'}
                    </button>
                  </div>
                </div>
                <Stat
                  icon={ClipboardCheck}
                  title="Active tasks"
                  value={
                    mine.filter((t) => !['completed', 'cancelled'].includes(text(t, 'status')))
                      .length
                  }
                  color="blue"
                  detail="assigned to you"
                />
                <Stat
                  icon={CalendarDays}
                  title="Leave requests"
                  value={data.leave.filter((l) => text(l, 'status') === 'submitted').length}
                  color="purple"
                  detail="awaiting review"
                />
              </div>
              <div className="work-layout">
                <Panel
                  title={section === 'developer-workspace' ? 'Product backlog' : 'My tasks'}
                  action={
                    <div className="segmented">
                      <button
                        onClick={() => setView('board')}
                        className={view === 'board' ? 'active' : ''}
                      >
                        Board
                      </button>
                      <button
                        onClick={() => setView('list')}
                        className={view === 'list' ? 'active' : ''}
                      >
                        List
                      </button>
                    </div>
                  }
                >
                  {view === 'board' ? (
                    <Board />
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Task</th>
                            <th>Project</th>
                            <th>Assigned by</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Due date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered(mine).map((t) => (
                            <tr key={t.id}>
                              <td>
                                <button
                                  className="plain-link"
                                  onClick={() => open('task-detail', t)}
                                >
                                  {text(t, 'title')}
                                </button>
                              </td>
                              <td>{projectName(text(t, 'project_id'))}</td>
                              <td>{employeeName(text(t, 'reporter_id'))}</td>
                              <td>
                                <Badge value={text(t, 'priority')} />
                              </td>
                              <td>
                                <Badge value={text(t, 'status')} />
                              </td>
                              <td>{date(text(t, 'due_date'))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!mine.length && <Empty message="No assigned tasks" />}
                </Panel>
                <div className="side-column">
                  <Panel title="This month’s performance">
                    <p className="subtle">Current review period</p>
                    <div className="performance-empty">
                      <ChartNoAxesCombined size={35} />
                      <strong>Insufficient Evidence</strong>
                      <p>Your score becomes available after evidence has been reviewed.</p>
                    </div>
                    <Link className="button quiet full" href="/performance">
                      View breakdown <ArrowRight size={16} />
                    </Link>
                  </Panel>
                  <Panel title="Take time to recharge">
                    <p className="subtle">Request annual, medical, or other leave.</p>
                    <button className="button yellow full" onClick={() => open('leave')}>
                      Request leave <ArrowRight size={16} />
                    </button>
                  </Panel>
                  <Panel title="Log your progress">
                    <p className="subtle">A little detail makes your work visible.</p>
                    <button className="button outline full" onClick={() => open('work-log')}>
                      Submit work log <ArrowRight size={16} />
                    </button>
                  </Panel>
                  {section === 'developer-workspace' && (
                    <Panel title="Development tools">
                      <p className="subtle">
                        Sprints and releases link to these same project tasks.
                      </p>
                      <p className="info-block">
                        <Info size={17} />
                        GitHub integration is disabled. Repository activity is not a performance
                        score.
                      </p>
                    </Panel>
                  )}
                </div>
              </div>
            </>
          )}
          {section === 'projects' && (
            <>
              <div className="section-toolbar">
                <div className="tabs">
                  {['all', 'active', 'draft', 'completed'].map((s) => (
                    <button
                      className={filter === s ? 'active' : ''}
                      key={s}
                      onClick={() => setFilter(s)}
                    >
                      {s === 'all' ? 'All projects' : label(s)}{' '}
                      <span>
                        {data.projects.filter((p) => s === 'all' || text(p, 'status') === s).length}
                      </span>
                    </button>
                  ))}
                </div>
                <span className="subtle">{data.projects.length} projects in your workspace</span>
              </div>
              <div className="project-grid">
                {filtered(data.projects)
                  .filter((p) => filter === 'all' || text(p, 'status') === filter)
                  .map((p) => {
                    const tasks = data.tasks.filter((t) => text(t, 'project_id') === p.id);
                    const complete = tasks.filter((t) => text(t, 'status') === 'completed').length;
                    return (
                      <button
                        className="project-card panel"
                        key={p.id}
                        onClick={() => open('project-detail', p)}
                      >
                        <div className="project-card-top">
                          <span className={`project-icon ${text(p, 'color') || 'blue'}`}>
                            <FolderKanban size={24} />
                          </span>
                          <Badge value={text(p, 'status')} />
                        </div>
                        <small>{text(p, 'code') || p.id.slice(0, 8)}</small>
                        <h2>{text(p, 'name')}</h2>
                        <p>{text(p, 'client') || 'Internal project'}</p>
                        <div className="project-progress">
                          <span>
                            Project progress{' '}
                            <b>
                              {preview
                                ? num(p, 'progress')
                                : tasks.length
                                  ? Math.round((complete / tasks.length) * 100)
                                  : 0}
                              %
                            </b>
                          </span>
                          <Progress
                            value={
                              preview
                                ? num(p, 'progress')
                                : tasks.length
                                  ? Math.round((complete / tasks.length) * 100)
                                  : 0
                            }
                          />
                        </div>
                        <div className="project-card-footer">
                          <span>
                            <CalendarDays size={14} />
                            {date(text(p, 'due_date'))}
                          </span>
                          <span>
                            {complete}/{tasks.length} tasks
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
              {!data.projects.length && <Empty />}
            </>
          )}
          {['hr', 'employees'].includes(section) && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={Users}
                  title="Active employees"
                  value={data.employees.filter((e) => text(e, 'status') === 'active').length}
                  detail="people making things happen"
                />
                <Stat
                  icon={CalendarDays}
                  title="Pending leave"
                  value={data.leave.filter((l) => text(l, 'status') === 'submitted').length}
                  color="yellow"
                  detail="requests to review"
                />
                <Stat
                  icon={Contact}
                  title="Onboarding"
                  value={data.employees.filter((e) => text(e, 'status') === 'onboarding').length}
                  color="blue"
                  detail="new beginnings"
                />
                <Stat
                  icon={FileText}
                  title="Reviews due"
                  value={data.reviews.filter((r) => text(r, 'state') !== 'finalized').length}
                  color="purple"
                  detail="keep the conversation going"
                />
              </div>
              <div className={section === 'hr' ? 'hr-grid' : ''}>
                <div className="main-column">
                  {section === 'hr' && (
                    <Panel
                      title={
                        <>
                          <CalendarDays size={18} />
                          Recent leave requests
                        </>
                      }
                      action={
                        <button className="text-link" onClick={() => open('leave')}>
                          Request leave <Plus size={13} />
                        </button>
                      }
                    >
                      <LeaveTable />
                    </Panel>
                  )}
                  <Panel
                    title="Employee directory"
                    action={
                      <div className="inline-actions">
                        <select
                          aria-label="Filter departments"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">All departments</option>
                          {[...new Set(data.employees.map((e) => text(e, 'department')))].map(
                            (d) => (
                              <option key={d}>{d}</option>
                            ),
                          )}
                        </select>
                        {user.roles.some((r) => ['ceo', 'admin'].includes(r)) && (
                          <button
                            className="button yellow small-button"
                            onClick={() => open('invite')}
                          >
                            <Plus size={14} />
                            Invite employee
                          </button>
                        )}
                      </div>
                    }
                  >
                    <Directory />
                  </Panel>
                  {section === 'hr' && (
                    <Panel title="Recruitment pipeline">
                      <div className="recruitment-grid">
                        {data.candidates.map((c) => (
                          <button
                            key={c.id}
                            className="recruitment-card"
                            onClick={() => open('candidate-detail', c)}
                          >
                            <Avatar name={text(c, 'name')} />
                            <strong>{text(c, 'name')}</strong>
                            <p>{text(c, 'position')}</p>
                            <Badge value={text(c, 'stage')} />
                          </button>
                        ))}
                      </div>
                      {!data.candidates.length && <Empty />}
                    </Panel>
                  )}
                </div>
                {section === 'hr' && (
                  <div className="side-column">
                    <Panel
                      title={
                        <>
                          <Clock size={18} />
                          Company schedule
                        </>
                      }
                      action={
                        <Link className="text-link" href="/settings">
                          Edit
                        </Link>
                      }
                    >
                      <div className="schedule-highlight">
                        <Clock size={27} />
                        <div>
                          <strong>9:00 AM – 5:00 PM</strong>
                          <small>Asia/Colombo</small>
                        </div>
                      </div>
                      <div className="schedule-details">
                        <div>
                          <CalendarDays size={19} />
                          <strong>Working days</strong>
                          <span>
                            {(data.settings[0]?.working_weekdays as number[])?.length
                              ? 'Configured'
                              : 'Setup required'}
                          </span>
                        </div>
                        <div>
                          <Clock size={19} />
                          <strong>Break policy</strong>
                          <span>
                            {data.settings[0]?.break_minutes == null
                              ? 'Setup required'
                              : `${data.settings[0].break_minutes} minutes`}
                          </span>
                        </div>
                      </div>
                    </Panel>
                    <Panel title="Company leave allowance">
                      <div className="leave-highlight">
                        <span>♧</span>
                        <div>
                          <strong>1 day per month</strong>
                          <small>Company policy allocation</small>
                        </div>
                      </div>
                      <p className="small-note">
                        Separate statutory and medical leave policies require configuration.
                      </p>
                    </Panel>
                    <Panel
                      title="Onboarding checklist"
                      action={
                        <span className="subtle">
                          {data.checklists.filter((c) => c.completed_at).length}/
                          {data.checklists.length}
                        </span>
                      }
                    >
                      <div className="checklist">
                        {data.checklists.map((c) => (
                          <div key={c.id}>
                            <span
                              className={c.completed_at ? 'check-circle checked' : 'check-circle'}
                            >
                              {!!c.completed_at && <Check size={14} />}
                            </span>
                            <span>
                              <strong>{text(c, 'title')}</strong>
                              <small>{employeeName(text(c, 'employee_id'))}</small>
                            </span>
                            <time>
                              {date(text(c, 'due_date')).split(' ').slice(0, 2).join(' ')}
                            </time>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                )}
              </div>
            </>
          )}
          {section === 'finance' && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={ArrowDownLeft}
                  title="Income received"
                  value={money(incomeTotal)}
                  detail="Actual receipts recorded"
                />
                <Stat
                  icon={Outgoing}
                  title="Expenses paid"
                  value={money(paid)}
                  color="red"
                  detail="Payment execution recorded"
                />
                <Stat
                  icon={Receipt}
                  title="Approved unpaid"
                  value={money(unpaid)}
                  color="purple"
                  detail="Authorized, awaiting execution"
                />
                <Stat
                  icon={Clock}
                  title="Pending CEO approval"
                  value={money(pending.reduce((a, e) => a + num(e, 'amount'), 0))}
                  color="yellow"
                  detail={`${pending.length} requests need review`}
                />
              </div>
              <div className="tabs finance-tabs">
                {['Expenses', 'Income', 'Approvals', 'Payments', 'Accounting', 'Budgets'].map(
                  (t) => (
                    <button
                      key={t}
                      className={tab === t ? 'active' : ''}
                      onClick={() => {
                        setTab(t);
                        setFilter('all');
                      }}
                    >
                      {t}
                      {t === 'Approvals' && <span>{pending.length}</span>}
                    </button>
                  ),
                )}
              </div>
              {['Expenses', 'Approvals'].includes(tab) ? (
                <Panel
                  title={tab === 'Approvals' ? 'CEO approval queue' : 'All expenses'}
                  action={
                    <div className="inline-actions">
                      <Filter size={15} />
                      <select
                        aria-label="Filter approval status"
                        value={filter}
                        onChange={(e) => {
                          setFilter(e.target.value);
                          setPage(1);
                        }}
                      >
                        <option value="all">All approval statuses</option>
                        <option value="submitted">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                  }
                >
                  <ExpenseTable compact={tab === 'Approvals'} />
                </Panel>
              ) : tab === 'Income' ? (
                <Panel
                  title="Received income"
                  action={
                    <button className="button yellow small-button" onClick={() => open('income')}>
                      <Plus size={15} />
                      Record income
                    </button>
                  }
                >
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Received date</th>
                          <th>Source</th>
                          <th>Reference</th>
                          <th>Amount</th>
                          <th>Verification</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered(data.income).map((r) => (
                          <tr key={r.id}>
                            <td>{date(text(r, 'received_at'))}</td>
                            <td>{text(r, 'source')}</td>
                            <td>{text(r, 'reference')}</td>
                            <td className="amount">{money(num(r, 'amount'))}</td>
                            <td>
                              <Badge value={text(r, 'state')} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ) : (
                <Panel title={tab}>
                  <Empty
                    message={
                      tab === 'Accounting'
                        ? 'No posted journal entries'
                        : tab === 'Budgets'
                          ? 'No active budgets'
                          : 'Payment ledger requires connected data'
                    }
                  />
                  <p className="panel-footnote">
                    {tab === 'Accounting'
                      ? 'Journals require independent CEO approval, balanced lines, and an open fiscal period.'
                      : tab === 'Budgets'
                        ? 'Budget preparation, approval, and activation are separate events.'
                        : 'Approval does not mean that payment has occurred.'}
                  </p>
                </Panel>
              )}
              <div className="finance-bottom">
                <Panel title="Cash flow">
                  <CashChart />
                </Panel>
                <Panel title="Financial controls">
                  <div className="control-row">
                    <ShieldCheck size={23} />
                    <div>
                      <strong>Independent CEO approval</strong>
                      <p>Every outgoing payment needs current, version-specific approval.</p>
                    </div>
                    <CheckCircle2 size={19} />
                  </div>
                  <div className="control-row">
                    <Receipt size={23} />
                    <div>
                      <strong>Evidence at every step</strong>
                      <p>Request, authorization, payment, and reconciliation remain distinct.</p>
                    </div>
                    <CheckCircle2 size={19} />
                  </div>
                  <div className="control-row">
                    <Clock size={23} />
                    <div>
                      <strong>Historical records stay intact</strong>
                      <p>Correct posted records through reviewed reversals.</p>
                    </div>
                    <CheckCircle2 size={19} />
                  </div>
                </Panel>
              </div>
            </>
          )}
          {section === 'work-logs' && (
            <>
              <Panel
                title="Daily work log"
                action={
                  <span className={`badge ${logWindowOpen ? 'approved' : 'draft'}`}>
                    {logWindowOpen ? 'Window open' : 'Window closed'}
                  </span>
                }
              >
                <p className="info-block">
                  <Clock size={19} />
                  Submit your work log between {time12(workStart)} and {time12(workEnd)} (
                  {companyTz}). You can edit it until {time12(workEnd)}. After that it is locked,
                  and your project leader reviews it and can comment.
                </p>
                {myReopens.map((r) => (
                  <p key={r.id} className="info-block">
                    <Clock size={19} />
                    Your leader reopened {text(r, 'work_date')} for you until{' '}
                    {new Date(text(r, 'expires_at')).toLocaleTimeString('en-GB', {
                      timeZone: companyTz,
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    . Reason: {text(r, 'reason')}
                  </p>
                ))}
                {(() => {
                  const mineToday = data.logs.filter(
                    (w) => text(w, 'employee_id') === user.id && text(w, 'work_date') === workDay,
                  );
                  const hasTasks = data.tasks.some((t) => text(t, 'assignee_id') === user.id);
                  const ledProjects = data.projects
                    .filter((p) => user.roles.includes('ceo') || text(p, 'manager_id') === user.id)
                    .map((p) => p.id);
                  const expected = [
                    ...new Set(
                      data.tasks
                        .filter(
                          (t) =>
                            ledProjects.includes(text(t, 'project_id')) &&
                            text(t, 'assignee_id') &&
                            text(t, 'assignee_id') !== user.id &&
                            !['completed', 'cancelled'].includes(text(t, 'status')),
                        )
                        .map((t) => text(t, 'assignee_id')),
                    ),
                  ];
                  const missing = expected.filter(
                    (id) =>
                      !data.logs.some(
                        (w) => text(w, 'employee_id') === id && text(w, 'work_date') === workDay,
                      ),
                  );
                  return (
                    <>
                      {hasTasks && (
                        <p>
                          <strong>Your log for today:</strong>{' '}
                          {mineToday.length
                            ? `Submitted (${mineToday.length}). ${logWindowOpen ? 'You can still edit it.' : 'It is locked.'}`
                            : logWindowOpen
                              ? `Not submitted yet. Submit before ${time12(workEnd)}.`
                              : 'Not submitted. The window is closed.'}
                        </p>
                      )}
                      {!preview && ledProjects.length > 0 && (
                        <p>
                          <strong>Team members without a log today:</strong>{' '}
                          {missing.length
                            ? missing.map((id) => (
                                <span key={id} className="missing-person">
                                  {employeeName(id)}
                                  {!logWindowOpen && (
                                    <button
                                      className="button outline small-button"
                                      onClick={() =>
                                        open('work-log-reopen', { id, work_date: workDay })
                                      }
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </span>
                              ))
                            : 'Everyone has submitted.'}
                        </p>
                      )}
                    </>
                  );
                })()}
              </Panel>
              <Panel
                title="View by date"
                action={<span className="subtle">Showing: {rangeText}</span>}
              >
                <div className="log-filter">
                  <label className="field">
                    From
                    <input
                      type="date"
                      value={logFrom}
                      max={workDay}
                      onChange={(e) => applyRange(e.target.value, logTo)}
                    />
                  </label>
                  <label className="field">
                    To
                    <input
                      type="date"
                      value={logTo}
                      max={workDay}
                      onChange={(e) => applyRange(logFrom, e.target.value)}
                    />
                  </label>
                  <button
                    className="button outline small-button"
                    onClick={() => applyRange(workDay, workDay)}
                  >
                    Today
                  </button>
                  <button
                    className="button outline small-button"
                    onClick={() => applyRange(dayShift(-1), dayShift(-1))}
                  >
                    Yesterday
                  </button>
                  <button
                    className="button outline small-button"
                    onClick={() => applyRange(dayShift(-6), workDay)}
                  >
                    Last 7 days
                  </button>
                  <button
                    className="button outline small-button"
                    onClick={() => applyRange('', '')}
                  >
                    All dates
                  </button>
                </div>
              </Panel>
              <Panel
                title="Team timesheets"
                action={<span className="subtle">Duration is calculated from timestamps</span>}
              >
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Employee</th>
                        <th>Task</th>
                        <th>Work summary</th>
                        <th>Duration</th>
                        <th>Self quality</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shownLogs.map((w) => (
                        <tr key={w.id}>
                          <td>{text(w, 'work_date') || text(w, 'start_at').slice(0, 10)}</td>
                          <td>{employeeName(text(w, 'employee_id'))}</td>
                          <td>
                            {text(
                              data.tasks.find((t) => t.id === text(w, 'task_id')) ?? { id: '' },
                              'title',
                            )}
                          </td>
                          <td>
                            {text(w, 'description')}
                            {num(w, 'edit_count') > 0 && <small> (edited)</small>}
                          </td>
                          <td>
                            {(
                              (Date.parse(text(w, 'end_at')) - Date.parse(text(w, 'start_at'))) /
                              3600000
                            ).toFixed(1)}{' '}
                            h
                          </td>
                          <td>
                            {w.self_quality_rating == null
                              ? '—'
                              : `${num(w, 'self_quality_rating')} / 5`}
                          </td>
                          <td>
                            <Badge value={text(w, 'status')} />
                          </td>
                          <td>
                            <button
                              className="button outline small-button"
                              onClick={() => open('log-detail', w)}
                            >
                              Open
                              {data.workLogComments.some((c) => text(c, 'work_log_id') === w.id)
                                ? ` (${data.workLogComments.filter((c) => text(c, 'work_log_id') === w.id).length})`
                                : ''}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!shownLogs.length && <Empty message="No work logs for this selection" />}
                </div>
              </Panel>
            </>
          )}
          {section === 'attendance' && (
            <>
              <div className="attendance-page">
                <Panel title="Your attendance today">
                  <div className="attendance-hero">
                    <span className="stat-icon green">
                      <Clock size={30} />
                    </span>
                    <h2>
                      {todayRecord && !todayRecord.check_out
                        ? 'You are checked in'
                        : 'Be present. Do good work.'}
                    </h2>
                    <p>
                      Check-in and check-out are explicit attendance events. Worked time counts only
                      while this app is open and your computer is awake.
                    </p>
                    {todayRecord && (
                      <p>
                        <strong>{formatDuration(num(todayRecord, 'active_seconds'))}</strong> worked
                        today
                      </p>
                    )}
                    <button className="button yellow" onClick={() => open('attendance')}>
                      <Clock size={17} />
                      Record attendance
                    </button>
                    <small>
                      Check in on one device and keep working on another; every device you use is
                      tracked under your account.
                    </small>
                  </div>
                </Panel>
                <Panel title="Attendance history">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Check in</th>
                          <th>Check out</th>
                          <th>Worked</th>
                          <th>Devices</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ownAttendance.map((a) => (
                          <tr key={a.id}>
                            <td>{date(text(a, 'day'))}</td>
                            <td>{clock(text(a, 'check_in'))}</td>
                            <td>{a.check_out ? clock(text(a, 'check_out')) : 'Incomplete'}</td>
                            <td>{formatDuration(num(a, 'active_seconds'))}</td>
                            <td>{deviceNames(a.id)}</td>
                            <td>
                              <Badge value={text(a, 'status')} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!ownAttendance.length && <Empty message="You haven’t checked in yet" />}
                  </div>
                </Panel>
              </div>
              <Panel
                className="operational-panel"
                title="Desktop agent"
                action={
                  <>
                    <Link className="button outline small-button" href="/install">
                      <Download size={14} />
                      Get the desktop app
                    </Link>{' '}
                    <button
                      className="button yellow small-button"
                      onClick={() => open('agent-connect')}
                    >
                      <Plus size={14} />
                      Connect this PC
                    </button>
                  </>
                }
              >
                <p className="agent-note">
                  A small app on your computer reports whether the PC is awake and really in use, so
                  your work time is counted accurately. It sends only: whether the PC is active,
                  idle or locked; seconds since your last keyboard or mouse use (never what you
                  type); CPU and memory use; and the names of the programs using the most resources
                  and the program in front. It never records screens, keystrokes, window titles,
                  files or web pages. When the PC sleeps or the app is closed, no time is counted.
                </p>
                <div className="review-queue">
                  {ownDevices.map((d) => (
                    <div key={d.id}>
                      <span>
                        <strong>{text(d, 'device_name')}</strong>
                        <small>
                          {text(d, 'os')} · agent {text(d, 'agent_version') || 'not reported yet'}
                          {d.last_seen_at ? ` · last report ${clock(text(d, 'last_seen_at'))}` : ''}
                        </small>
                      </span>
                      <button
                        className="button outline small-button"
                        onClick={() => command('revoke_agent_device', {}, d)}
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
                {!ownDevices.length && <Empty message="No computer connected yet" />}
              </Panel>
              {canSeeTeam && (
                <>
                  <div className="team-stats">
                    <Stat
                      icon={Users}
                      title="Active now"
                      value={todayRows.filter((a) => presence(a) === 'Active now').length}
                      color="green"
                      detail="working right now"
                    />
                    <Stat
                      icon={Clock}
                      title="Away"
                      value={todayRows.filter((a) => presence(a) === 'Away / offline').length}
                      color="purple"
                      detail="asleep or offline"
                    />
                    <Stat
                      icon={LogOut}
                      title="Checked out"
                      value={todayRows.filter((a) => a.check_out).length}
                      color="blue"
                      detail="finished today"
                    />
                    <Stat
                      icon={CalendarDays}
                      title="Worked today"
                      value={formatDuration(
                        todayRows.reduce((n, a) => n + num(a, 'active_seconds'), 0),
                      )}
                      color="green"
                      detail="across the team"
                    />
                  </div>
                  <Panel className="operational-panel" title="Team attendance">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Date</th>
                            <th>Check in</th>
                            <th>Check out</th>
                            <th>Worked</th>
                            <th>Away / asleep</th>
                            <th>Status</th>
                            <th>Devices</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered(data.attendance).map((a) => (
                            <tr key={a.id}>
                              <td>{employeeName(text(a, 'employee_id'))}</td>
                              <td>{date(text(a, 'day'))}</td>
                              <td>{clock(text(a, 'check_in'))}</td>
                              <td>{a.check_out ? clock(text(a, 'check_out')) : '—'}</td>
                              <td>{formatDuration(num(a, 'active_seconds'))}</td>
                              <td>{formatDuration(awaySeconds(a))}</td>
                              <td suppressHydrationWarning>
                                <span className={`badge ${presenceClass[presence(a)]}`}>
                                  {presence(a)}
                                </span>
                              </td>
                              <td>{deviceNames(a.id)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.attendance.length && <Empty message="No attendance recorded yet" />}
                    </div>
                  </Panel>
                  <Panel className="operational-panel" title="Computer activity (desktop agent)">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Computer</th>
                            <th>State</th>
                            <th>In front now</th>
                            <th>CPU</th>
                            <th>Memory</th>
                            <th>Processes</th>
                            <th>Busiest programs</th>
                            <th>Last report</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.agentStatus.map((s) => (
                            <tr key={s.id}>
                              <td>{employeeName(text(s, 'user_id'))}</td>
                              <td>{deviceName(text(s, 'device_id'))}</td>
                              <td suppressHydrationWarning>
                                <span className={`badge ${agentClass[agentLabel(s)]}`}>
                                  {agentLabel(s)}
                                </span>
                              </td>
                              <td>{text(s, 'foreground_app') || '—'}</td>
                              <td>{num(s, 'cpu_percent').toFixed(0)}%</td>
                              <td>
                                {num(s, 'ram_percent').toFixed(0)}% ·{' '}
                                {(num(s, 'ram_used_mb') / 1024).toFixed(1)} /{' '}
                                {(num(s, 'ram_total_mb') / 1024).toFixed(0)} GB
                              </td>
                              <td>{num(s, 'process_count')}</td>
                              <td className="apps-cell">
                                {(Array.isArray(s.top_apps) ? (s.top_apps as Row[]) : [])
                                  .slice(0, 3)
                                  .map((a) => `${a.name} ${Number(a.cpu).toFixed(0)}%`)
                                  .join(', ') || '—'}
                              </td>
                              <td>{clock(text(s, 'updated_at'))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!data.agentStatus.length && (
                        <Empty message="No computers are reporting yet" />
                      )}
                    </div>
                  </Panel>
                  <Panel className="operational-panel" title="Time worked by employee">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Days present</th>
                            <th>Total worked</th>
                          </tr>
                        </thead>
                        <tbody>
                          {workedByEmployee.map((w) => (
                            <tr key={w.id}>
                              <td>{employeeName(w.id)}</td>
                              <td>{w.days}</td>
                              <td>{formatDuration(w.worked)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                </>
              )}
            </>
          )}
          {section === 'performance' && (
            <>
              <div className="performance-intro">
                <span className="stat-icon purple">
                  <ChartNoAxesCombined size={28} />
                </span>
                <div>
                  <h2>Progress with perspective.</h2>
                  <p>
                    Monthly scores support a conversation. They never make employment decisions.
                  </p>
                </div>
                <span className="badge draft">Formula v1.0</span>
              </div>
              <div className="performance-grid">
                {[
                  {
                    title: 'Delivery',
                    max: 40,
                    description: 'Accepted eligible task weight ÷ agreed eligible task weight',
                    icon: ClipboardCheck,
                  },
                  {
                    title: 'Quality',
                    max: 30,
                    description: 'Task-weighted reviewed quality rating ÷ 5',
                    icon: ShieldCheck,
                  },
                  {
                    title: 'Reliability',
                    max: 20,
                    description: 'On-time accepted weight ÷ accepted eligible weight',
                    icon: Clock,
                  },
                  {
                    title: 'Teamwork',
                    max: 10,
                    description: 'Evidence-backed teamwork rating ÷ 5',
                    icon: Users,
                  },
                ].map((c) => (
                  <Panel
                    key={c.title}
                    title={
                      <>
                        <c.icon size={19} />
                        {c.title}
                      </>
                    }
                  >
                    <div className="score-value">
                      — <span>/ {c.max}</span>
                    </div>
                    <p>{c.description}</p>
                    <span className="badge draft">Insufficient Evidence</span>
                  </Panel>
                ))}
              </div>
              <Panel title="Review history">
                <div className="review-process">
                  {['Evidence collection', 'Manager review', 'Employee response', 'Finalized'].map(
                    (s, i) => (
                      <div key={s}>
                        <span>{i + 1}</span>
                        {s}
                        {i < 3 && <ChevronRight size={18} />}
                      </div>
                    ),
                  )}
                </div>
                {!data.reviews.length ? (
                  <Empty message="Your next chapter is still being written" />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>State</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.reviews.map((r) => (
                          <tr key={r.id}>
                            <td>{employeeName(text(r, 'employee_id'))}</td>
                            <td>
                              <Badge value={text(r, 'state')} />
                            </td>
                            <td>{r.score == null ? 'Insufficient Evidence' : text(r, 'score')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="panel-footnote">
                  <Info size={15} />
                  Finalized scores are immutable. Appeals require independent review. Individual
                  point awards stay separate.
                </div>
              </Panel>
            </>
          )}
          {section === 'documents' && (
            <Panel
              title="Shared with you"
              action={<span className="subtle">Private storage · authorized access only</span>}
            >
              <div className="document-grid">
                {filtered(data.documents).map((d) => (
                  <button
                    className="document-card"
                    key={d.id}
                    onClick={() =>
                      preview
                        ? inform('Fixture document. Connect Supabase to access private files.')
                        : window.open(`/api/documents/${d.id}`, '_blank', 'noopener')
                    }
                  >
                    <span className="document-icon">
                      <FileText size={28} />
                    </span>
                    <strong>{text(d, 'name')}</strong>
                    <small>
                      {Math.round(num(d, 'size_bytes') / 1000)} KB ·{' '}
                      {label(text(d, 'classification'))}
                    </small>
                    <span>
                      Open document <ExternalLink size={14} />
                    </span>
                  </button>
                ))}
              </div>
              {!data.documents.length && <Empty />}
            </Panel>
          )}
          {section === 'reports' && (
            <>
              <div className="stats-grid">
                <Stat
                  icon={Users}
                  title="Directory members"
                  value={data.employees.length}
                  detail="Authorized directory records"
                  color="blue"
                />
                <Stat
                  icon={FolderKanban}
                  title="Projects"
                  value={data.projects.length}
                  detail="Within your access scope"
                />
                <Stat
                  icon={ClipboardCheck}
                  title="Accepted tasks"
                  value={data.tasks.filter((t) => text(t, 'status') === 'completed').length}
                  detail="Independently reviewed"
                />
                <Stat
                  icon={Clock}
                  title="Submitted work logs"
                  value={data.logs.length}
                  color="purple"
                  detail="Extra hours do not award points"
                />
              </div>
              <div className="finance-bottom">
                <Panel title="Team workload">
                  <Workload />
                </Panel>
                {user.roles.some((r) => ['ceo', 'finance'].includes(r)) && (
                  <Panel title="Cash movement">
                    <CashChart />
                  </Panel>
                )}
              </div>
              <Panel title="Project delivery">
                <ProjectTable />
              </Panel>
            </>
          )}
          {section === 'settings' && (
            <div className="settings-grid">
              <Panel title="Company profile">
                <div className="settings-brand">
                  <span className="company-monogram">
                    R<span>.</span>
                  </span>
                  <div>
                    <h2>RepairMe</h2>
                    <p>One workspace. One team.</p>
                  </div>
                  <span className="badge active">Active workspace</span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Portal name</dt>
                    <dd>RepairMe One</dd>
                  </div>
                  <div>
                    <dt>Timezone</dt>
                    <dd>{companyTz}</dd>
                  </div>
                  <div>
                    <dt>Currency</dt>
                    <dd>LKR · Sri Lankan rupee</dd>
                  </div>
                  <div>
                    <dt>Working window</dt>
                    <dd>
                      {time12(workStart)} – {time12(workEnd)}
                    </dd>
                  </div>
                </dl>
              </Panel>
              <Panel
                title="Schedule & leave policy"
                action={
                  <button className="text-link" onClick={() => open('settings', data.settings[0])}>
                    Configure <Settings size={14} />
                  </button>
                }
              >
                <p className="info-block">
                  <Info size={19} />
                  Working weekdays and paid-break policy must be explicitly configured before leave
                  and attendance calculations.
                </p>
                <dl className="detail-list">
                  <div>
                    <dt>Working days</dt>
                    <dd>
                      {(data.settings[0]?.working_weekdays as number[])?.length
                        ? 'Configured'
                        : 'Setup required'}
                    </dd>
                  </div>
                  <div>
                    <dt>Monthly company leave</dt>
                    <dd>1 day</dd>
                  </div>
                  <div>
                    <dt>Joining-month proration</dt>
                    <dd>Setup required</dd>
                  </div>
                  <div>
                    <dt>Carry-forward</dt>
                    <dd>Setup required</dd>
                  </div>
                </dl>
              </Panel>
              <Panel title="Security & integrations">
                <div className="control-row">
                  <ShieldCheck size={23} />
                  <div>
                    <strong>Supabase authentication</strong>
                    <p>
                      {preview
                        ? 'Not connected · fixture preview'
                        : 'Connected · server-validated sessions'}
                    </p>
                  </div>
                </div>
                <div className="control-row">
                  <Code2 size={23} />
                  <div>
                    <strong>GitHub integration</strong>
                    <p>Disabled. No third-party repository access.</p>
                  </div>
                </div>
                <div className="control-row">
                  <Wallet size={23} />
                  <div>
                    <strong>Banking & statutory payroll</strong>
                    <p>Disabled. Payments are records, never bank transfers.</p>
                  </div>
                </div>
              </Panel>
              <Panel title="Workspace access">
                <p className="subtle">Security roles are assigned independently from job titles.</p>
                <div className="role-list">
                  {[
                    'CEO / Owner',
                    'System Administrator',
                    'HR',
                    'Finance',
                    'Project Manager',
                    'Employee',
                  ].map((r) => (
                    <div key={r}>
                      <ShieldCheck size={16} />
                      {r}
                    </div>
                  ))}
                </div>
                <p className="small-note">
                  System administration does not grant compensation or finance approval access.
                </p>
              </Panel>
            </div>
          )}
          {['my-work', 'tasks'].includes(section) && user.roles.includes('manager') && (
            <Panel className="operational-panel" title="Team leave review queue">
              <LeaveTable />
            </Panel>
          )}
          <div className={section === 'my-work' ? 'two-up' : 'plain-wrap'}>
            {section === 'my-work' && (
              <Panel
                className="operational-panel"
                title="My expense & reimbursement requests"
                action={
                  <button className="button yellow small-button" onClick={() => open('expense')}>
                    <Plus size={14} />
                    New request
                  </button>
                }
              >
                <div className="review-queue">
                  {data.expenses
                    .filter((e) => preview || text(e, 'submitted_by') === user.id)
                    .map((e) => (
                      <div key={e.id}>
                        <span>
                          <strong>{text(e, 'purpose')}</strong>
                          <small>
                            {money(num(e, 'amount'))} · {label(text(e, 'execution_status'))}
                          </small>
                        </span>
                        <Badge value={text(e, 'approval_status')} />
                      </div>
                    ))}
                </div>
              </Panel>
            )}
            <OperationalTools />
          </div>
          <footer className="page-footer">
            <span>© {new Date().getFullYear()} RepairMe. Built for the way we work.</span>
            <span>
              <span className="tiny-dot" />
              Asia/Colombo <span className="footer-separator">·</span> All amounts in LKR
            </span>
          </footer>
        </main>
      </div>
      <WorkBreak preview={preview} />
      <DesktopBridge userId={user.id} preview={preview} />
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {notice}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <Dialog.Root
        open={!!dialog}
        onOpenChange={(v) => {
          if (!v) {
            setDialog(null);
            setPairing(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className={`dialog-content ${dialog?.kind === 'expense-detail' ? 'detail-drawer' : ''}`}
          >
            <Dialog.Title>
              {dialog
                ? ((
                    {
                      expense: 'New expense request',
                      income: 'Record received income',
                      project: 'Create project',
                      task: 'Create task',
                      'task-detail': 'Task details',
                      'expense-detail': 'Expense request',
                      leave: 'Request leave',
                      'leave-detail': 'Leave review',
                      attendance: 'Record attendance',
                      'work-log': 'Submit work log',
                      'employee-detail': 'Employee profile',
                      'project-detail': 'Project overview',
                      invite: 'Invite employee',
                      settings: 'Configure working policy',
                      document: 'Upload private document',
                      'log-detail': 'Work log',
                      'work-log-edit': 'Edit work log',
                      'work-log-reopen': 'Reopen work log',
                      'agent-connect': 'Connect a computer',
                      'project-leader': 'Change project leader',
                      'project-delete': 'Delete project',
                      'candidate-detail': 'Candidate profile',
                    } as Record<string, string>
                  )[dialog.kind] ?? workflowForms[dialog.kind]?.title)
                : ''}
            </Dialog.Title>
            <Dialog.Description className="dialog-description">
              {preview
                ? 'Fixture preview · changes require a connected workspace.'
                : 'Changes are validated and audited securely.'}
            </Dialog.Description>
            <Dialog.Close className="dialog-close" aria-label="Close dialog">
              <X size={20} />
            </Dialog.Close>
            {dialog && <DialogBody kind={dialog.kind} row={dialog.row} />}{' '}
            {formError && (
              <div className="form-error" role="alert">
                <Info size={17} />
                {formError}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
  function OperationalTools() {
    const actionButton = (kind: string, row?: Row) => (
      <button key={kind} className="button outline small-button" onClick={() => open(kind, row)}>
        {workflowForms[kind]?.title ?? label(kind)}
        <ArrowRight size={12} />
      </button>
    );
    if (section === 'finance' && ['Payments', 'Accounting', 'Budgets'].includes(tab)) {
      const rows =
        tab === 'Payments' ? data.payments : tab === 'Accounting' ? data.journals : data.budgets;
      return (
        <Panel
          className="operational-panel"
          title={
            tab === 'Payments'
              ? 'Actual payment records'
              : tab === 'Accounting'
                ? 'Journal register'
                : 'Budget register'
          }
          action={
            tab === 'Accounting'
              ? actionButton('new-journal')
              : tab === 'Budgets'
                ? actionButton('new-budget')
                : undefined
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Details</th>
                  <th>Amount / date</th>
                  <th>State</th>
                  <th>Workflow action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {text(r, 'reference') || text(r, 'source_reference') || text(r, 'name')}
                    </td>
                    <td>{text(r, 'description') || text(r, 'category') || text(r, 'evidence')}</td>
                    <td>{r.amount ? money(num(r, 'amount')) : date(text(r, 'entry_date'))}</td>
                    <td>
                      <Badge value={text(r, 'state') || 'recorded'} />
                    </td>
                    <td>
                      {tab === 'Accounting'
                        ? text(r, 'state') === 'submitted'
                          ? actionButton('approve-journal', r)
                          : text(r, 'state') === 'approved'
                            ? actionButton('post-journal', r)
                            : 'Immutable posted entry'
                        : tab === 'Budgets'
                          ? text(r, 'state') === 'prepared'
                            ? actionButton('approve-budget', r)
                            : text(r, 'state') === 'approved'
                              ? actionButton('activate-budget', r)
                              : 'Active'
                          : text(r, 'paid_at') && date(text(r, 'paid_at'))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <Empty message={`No ${tab.toLowerCase()} records`} />}
          </div>
          {tab === 'Accounting' && (
            <p className="small-note">
              {data.accounts.length} chart-of-account entries · {data.periods.length} fiscal
              periods. Cash flow and accounting profit are separate reports.
            </p>
          )}
        </Panel>
      );
    }
    if (section === 'finance' && tab === 'Income')
      return (
        <Panel className="operational-panel" title="Income verification queue">
          <div className="review-queue">
            {data.income
              .filter((r) => text(r, 'state') === 'pending_verification')
              .map((r) => (
                <div key={r.id}>
                  <span>
                    <strong>{text(r, 'source')}</strong>
                    <small>{money(num(r, 'amount'))} already received</small>
                  </span>
                  {actionButton('verify-income', r)}
                </div>
              ))}
          </div>
        </Panel>
      );
    if (section === 'performance')
      return (
        <Panel
          className="operational-panel"
          title="Monthly review workflow"
          action={actionButton('new-review')}
        >
          <div className="review-queue">
            {data.reviews.map((r) => (
              <div key={r.id}>
                <span>
                  <strong>{employeeName(text(r, 'employee_id'))}</strong>
                  <small>{label(text(r, 'state'))}</small>
                </span>
                <div className="inline-actions">
                  {text(r, 'state') === 'finalized' ? (
                    actionButton('appeal', r)
                  ) : text(r, 'state') === 'employee_response' ? (
                    <>
                      {actionButton('review-response', r)}
                      {actionButton('finalize-review', r)}
                    </>
                  ) : (
                    actionButton('review-evidence', r)
                  )}
                </div>
              </div>
            ))}
          </div>
          {!data.reviews.length && (
            <p className="small-note">
              Open a configured performance period, then collect evidence and invite the employee’s
              response.
            </p>
          )}
        </Panel>
      );
    if (section === 'hr')
      return (
        <>
          <Panel
            className="operational-panel"
            title="People workflows"
            action={
              <div className="inline-actions">
                {actionButton('new-candidate')}
                {actionButton('leave-adjust')}
              </div>
            }
          >
            <div className="review-queue">
              {data.candidates.map((c) => (
                <div key={c.id}>
                  <span>
                    <strong>{text(c, 'name')}</strong>
                    <small>
                      {text(c, 'position')} · {label(text(c, 'stage'))}
                    </small>
                  </span>
                  {actionButton('candidate-stage', c)}
                </div>
              ))}
            </div>
          </Panel>
          <Panel
            className="operational-panel"
            title="Promotion & compensation proposals"
            action={actionButton('new-compensation')}
          >
            <div className="review-queue">
              {data.compensation.map((c) => (
                <div key={c.id}>
                  <span>
                    <strong>{employeeName(text(c, 'employee_id'))}</strong>
                    <small>{label(text(c, 'state'))}</small>
                  </span>
                  {text(c, 'state') === 'proposed' ? (
                    actionButton('hr-compensation', c)
                  ) : text(c, 'state') === 'hr_reviewed' ? (
                    actionButton('decide-compensation', c)
                  ) : text(c, 'state') === 'approved' ? (
                    actionButton('record-compensation', c)
                  ) : (
                    <Badge value={text(c, 'state')} />
                  )}
                </div>
              ))}
            </div>
            {!data.compensation.length && (
              <p className="small-note">
                Only HR and authorized owners can read compensation proposals. Scores never change
                compensation automatically.
              </p>
            )}
          </Panel>
        </>
      );
    if (section === 'developer-workspace')
      return (
        <div className="finance-bottom">
          <Panel title="Sprint planning" action={actionButton('new-sprint')}>
            <div className="review-queue">
              {data.sprints.map((s) => (
                <div key={s.id}>
                  <strong>{text(s, 'name')}</strong>
                  <Badge value={text(s, 'state')} />
                </div>
              ))}
            </div>
            {!data.sprints.length && <Empty message="No planned sprints" />}
          </Panel>
          <Panel title="Release records" action={actionButton('new-release')}>
            <div className="review-queue">
              {data.releases.map((r) => (
                <div key={r.id}>
                  <strong>{text(r, 'name')}</strong>
                  <Badge value={text(r, 'state')} />
                </div>
              ))}
            </div>
            {!data.releases.length && <Empty message="No release records" />}
          </Panel>
        </div>
      );
    if (section === 'employees' && user.roles.some((r) => r === 'admin' || r === 'ceo'))
      return (
        <Panel className="operational-panel" title="Account administration">
          <div className="review-queue">
            {data.employees.map((e) => (
              <div key={e.id}>
                <span>
                  <strong>{employeeName(e.id)}</strong>
                  <small>{label(text(e, 'status'))}</small>
                </span>
                {actionButton('account-status', e)}
              </div>
            ))}
          </div>
        </Panel>
      );
    if (section === 'projects')
      return (
        <Panel className="operational-panel" title="Project membership">
          <div className="review-queue">
            {data.projects.map((p) => (
              <div key={p.id}>
                <strong>{text(p, 'name')}</strong>
                {actionButton('add-member', p)}
              </div>
            ))}
          </div>
        </Panel>
      );
    if (section === 'my-work')
      return (
        <Panel className="operational-panel" title="Your leave requests">
          <div className="review-queue">
            {data.leave
              .filter((l) => preview || text(l, 'employee_id') === user.id)
              .map((l) => (
                <div key={l.id}>
                  <span>
                    <strong>
                      {date(text(l, 'start_date'))} · {num(l, 'days')} days
                    </strong>
                    <small>{label(text(l, 'status'))}</small>
                  </span>
                  {text(l, 'status') === 'recorded' ? (
                    actionButton('leave-cancel', l)
                  ) : (
                    <Badge value={text(l, 'status')} />
                  )}
                </div>
              ))}
          </div>
        </Panel>
      );
    return null;
  }
  function RemoteForm({
    endpoint,
    multipart = false,
    submit,
    children,
  }: {
    endpoint: string;
    multipart?: boolean;
    submit: string;
    children: React.ReactNode;
  }) {
    return (
      <form
        className="dialog-form"
        onSubmit={async (ev) => {
          ev.preventDefault();
          if (preview) {
            setFormError(
              'This is a read-only fixture preview. Connect Supabase to save changes securely.',
            );
            return;
          }
          setBusy(true);
          setFormError('');
          const form = new FormData(ev.currentTarget);
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: multipart ? undefined : { 'Content-Type': 'application/json' },
              body: multipart ? form : JSON.stringify(Object.fromEntries(form)),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error ?? 'Unable to complete the request');
            setDialog(null);
            inform('Request completed successfully.');
            router.refresh();
          } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Unable to complete the request');
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
        <div className="form-actions">
          <Dialog.Close className="button outline" type="button">
            Cancel
          </Dialog.Close>
          <button className="button yellow" disabled={busy}>
            {busy ? 'Saving…' : submit}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    );
  }
  function Field({
    name,
    title,
    type = 'text',
    required = true,
    defaultValue,
  }: {
    name: string;
    title: string;
    type?: string;
    required?: boolean;
    defaultValue?: string;
  }) {
    return (
      <label className="field">
        {title}
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          step={type === 'number' ? '.01' : undefined}
        />
      </label>
    );
  }
  function Form({
    children,
    action,
    row,
    transform,
    submit = 'Save changes',
  }: {
    children: React.ReactNode;
    action: string;
    row?: Row;
    transform?: (p: Record<string, unknown>) => Record<string, unknown>;
    submit?: string;
  }) {
    return (
      <form
        className="dialog-form"
        onSubmit={async (ev) => {
          ev.preventDefault();
          const payload: Record<string, unknown> = Object.fromEntries(
            new FormData(ev.currentTarget),
          );
          if (await command(action, transform ? transform(payload) : payload, row)) setDialog(null);
        }}
      >
        {children}
        <div className="form-actions">
          <Dialog.Close className="button outline" type="button">
            Cancel
          </Dialog.Close>
          <button className="button yellow" disabled={busy} type="submit">
            {busy ? 'Saving…' : submit}
            <ArrowRight size={15} />
          </button>
        </div>
      </form>
    );
  }
  function DialogBody({ kind, row }: { kind: string; row?: Row }) {
    if (workflowForms[kind]) {
      const config = workflowForms[kind];
      return (
        <Form
          action={config.action}
          row={row}
          submit={config.title}
          transform={(p) => {
            const result = { ...p };
            for (const key of ['lines', 'current_values', 'proposed_values'])
              if (typeof result[key] === 'string') {
                try {
                  result[key] = JSON.parse(String(result[key]));
                } catch {
                  result[key] = null;
                }
              }
            return result;
          }}
        >
          {config.fields.map((f) => (
            <label key={f.name} className="field">
              {f.label}
              {f.source ? (
                <select name={f.name} required>
                  {data[f.source].map((r) => (
                    <option key={r.id} value={r.id}>
                      {f.source === 'employees' ? employeeName(r.id) : text(r, 'name')}
                    </option>
                  ))}
                </select>
              ) : f.options ? (
                <select name={f.name}>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {label(o)}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea name={f.name} required={f.required !== false} rows={4} />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? 'text'}
                  required={f.required !== false}
                  step={f.type === 'number' ? '.01' : undefined}
                />
              )}
            </label>
          ))}
          {config.hint && <p className="info-block">{config.hint}</p>}
        </Form>
      );
    }

    if (kind === 'invite')
      return (
        <RemoteForm endpoint="/api/accounts/invite" submit="Send invitation">
          <div className="form-grid">
            <Field name="first_name" title="First name" />
            <Field name="last_name" title="Last name" />
          </div>
          <Field name="email" title="Work email" type="email" />
          <Field name="employee_number" title="Employee number" />
          <Field name="department" title="Department" />
          <Field name="job_title" title="Job title" />
          <p className="small-note">
            New accounts receive the Employee role only. Delivery requires configured Supabase
            email.
          </p>
        </RemoteForm>
      );
    if (kind === 'document')
      return (
        <RemoteForm endpoint="/api/documents" multipart submit="Upload private file">
          <label className="field">
            File (PDF, PNG, JPEG or text; up to 5 MB)
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/png,image/jpeg,text/plain"
            />
          </label>
          <label className="field">
            Access classification
            <select name="classification">
              <option value="own">Private to me</option>
              <option value="project">Project members</option>
              <option value="hr">HR restricted</option>
              <option value="finance">Finance restricted</option>
            </select>
          </label>
          <label className="field">
            Project (for project files)
            <select name="project_id">
              <option value="">None</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {text(p, 'name')}
                </option>
              ))}
            </select>
          </label>
        </RemoteForm>
      );
    if (kind === 'expense')
      return (
        <Form action="submit_expense" submit="Submit for approval">
          <Field name="purpose" title="Purpose" />
          <Field name="payee" title="Payee" />
          <div className="form-grid">
            <Field name="category" title="Category" />
            <Field name="amount" title="Amount (LKR)" type="number" />
          </div>
          <Field name="evidence" title="Supporting evidence reference" />
          <p className="info-block">
            <ShieldCheck size={17} />
            An independent CEO must approve this request before Finance can record payment.
          </p>
        </Form>
      );
    if (kind === 'income')
      return (
        <Form action="record_income" submit="Record receipt">
          <Field name="source" title="Customer / source" />
          <Field name="category" title="Category" />
          <Field name="amount" title="Amount received (LKR)" type="number" />
          <Field name="received_at" title="Received at (include timezone, e.g. +05:30)" />
          <Field name="reference" title="Unique payment reference" />
          <Field name="evidence" title="Receipt evidence" />
        </Form>
      );
    if (kind === 'project')
      return (
        <Form action="create_project" submit="Create project">
          <Field name="name" title="Project name" />
          <label className="field">
            Project leader
            <select
              name="leader_id"
              required
              defaultValue={data.leaders.some((l) => l.id === user.id) ? user.id : ''}
            >
              <option value="" disabled>
                Choose the leader…
              </option>
              {data.leaders.map((l) => (
                <option value={l.id} key={l.id}>
                  {employeeName(l.id)}
                </option>
              ))}
            </select>
            <small>
              The leader runs this project: creates its tasks, assigns people and reviews the work.
            </small>
          </label>
          <Field name="client" title="Client" required={false} />
          <Field name="description" title="Description" />
          <Field name="due_date" title="Due date" type="date" />
        </Form>
      );
    if (kind === 'task')
      return (
        <Form
          action="create_task"
          transform={(p) => {
            const assignees = data.employees
              .filter((e) => p[`pick_${e.id}`])
              .map((e) => ({ id: e.id, work: String(p[`work_${e.id}`] ?? '') }));
            const rest = Object.fromEntries(
              Object.entries(p).filter(([k]) => !k.startsWith('pick_') && !k.startsWith('work_')),
            );
            return {
              ...rest,
              weight: Number(rest.weight),
              ...(assignees.length ? { assignees } : {}),
            };
          }}
          submit="Create task"
        >
          <Field name="title" title="Task title" />
          <label className="field">
            Project
            <select required name="project_id">
              {data.projects
                .filter((p) => preview || text(p, 'manager_id') === user.id)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {text(p, 'name')}
                  </option>
                ))}
            </select>
            <small>Only a project’s leader can add tasks to it.</small>
          </label>
          <fieldset className="assignee-list">
            <legend>Assign to (choose one or more people)</legend>
            {data.employees.map((e) => (
              <div className="assignee-row" key={e.id}>
                <label className="check-field">
                  <input type="checkbox" name={`pick_${e.id}`} />
                  <span>{employeeName(e.id)}</span>
                </label>
                <input
                  name={`work_${e.id}`}
                  placeholder="Their individual part (optional)"
                  aria-label={`Individual part for ${employeeName(e.id)}`}
                />
              </div>
            ))}
            <small>
              With several people, each one gets their own copy of this task to submit, be reviewed
              and rated separately.
            </small>
          </fieldset>
          <p className="subtle">
            Anyone you assign is added to the project automatically; you do not need to add members
            first.
          </p>
          <Field name="acceptance_criteria" title="Acceptance criteria" />
          <div className="form-grid">
            <label className="field">
              Agreed weight
              <select name="weight">
                <option value="1">Small · 1</option>
                <option value="3">Medium · 3</option>
                <option value="5">Large · 5</option>
              </select>
            </label>
            <Field name="due_date" title="Agreed deadline" type="date" />
          </div>
        </Form>
      );
    if (kind === 'task-detail' && row)
      return (
        <>
          <div className="detail-title">
            <small>{text(row, 'code') || row.id.slice(0, 8)}</small>
            <h2>{text(row, 'title')}</h2>
            <Badge value={text(row, 'status')} />
          </div>
          <dl className="detail-list">
            <div>
              <dt>Project</dt>
              <dd>{projectName(text(row, 'project_id'))}</dd>
            </div>
            <div>
              <dt>Assignee</dt>
              <dd>{employeeName(text(row, 'assignee_id'))}</dd>
            </div>
            <div>
              <dt>Assigned by</dt>
              <dd>{employeeName(text(row, 'reporter_id'))}</dd>
            </div>
            {isOverdue(row) && (
              <div>
                <dt>Overdue</dt>
                <dd>{daysLate(row)} days late</dd>
              </div>
            )}
            {text(row, 'individual_work') && (
              <div>
                <dt>Individual part</dt>
                <dd>{text(row, 'individual_work')}</dd>
              </div>
            )}
            {groupMates(row).length > 0 && (
              <div>
                <dt>Shared with</dt>
                <dd>
                  {groupMates(row)
                    .map(
                      (o) =>
                        `${employeeName(text(o, 'assignee_id'))} (${label(text(o, 'status'))})`,
                    )
                    .join(', ')}
                </dd>
              </div>
            )}
            <div>
              <dt>Due date</dt>
              <dd>{date(text(row, 'due_date'))}</dd>
            </div>
            <div>
              <dt>Agreed weight</dt>
              <dd>{num(row, 'weight')}</dd>
            </div>
          </dl>
          <Form
            action="task_transition"
            row={row}
            transform={(p) => ({
              ...p,
              quality_rating: p.quality_rating ? Number(p.quality_rating) : undefined,
            })}
            submit="Apply transition"
          >
            <label className="field">
              Next state
              <select name="state">
                {[
                  ...(text(row, 'status') === 'todo'
                    ? ['in_progress']
                    : text(row, 'status') === 'in_progress'
                      ? ['in_review']
                      : text(row, 'status') === 'in_review'
                        ? ['completed', 'in_progress']
                        : []),
                  ...(canManageTasks && !['completed', 'cancelled'].includes(text(row, 'status'))
                    ? ['cancelled']
                    : []),
                ].map((s) => (
                  <option key={s} value={s}>
                    {transitionLabel(text(row, 'status'), s)}
                  </option>
                ))}
              </select>
            </label>
            <Field
              name="evidence"
              title={
                text(row, 'status') === 'todo'
                  ? 'Note (optional)'
                  : text(row, 'status') === 'in_progress'
                    ? 'Report / evidence of your work'
                    : 'Reviewer comments'
              }
              required={text(row, 'status') !== 'todo'}
            />
            {text(row, 'status') === 'in_review' && (
              <Field name="quality_rating" title="Reviewed quality (0 to 5)" type="number" />
            )}
            <p className="small-note">
              Only the assignee submits work. Completion requires an independent project reviewer.
            </p>
          </Form>
          {canManageTasks && !['completed', 'cancelled'].includes(text(row, 'status')) && (
            <details className="danger-zone">
              <summary>Delete this task</summary>
              <Form action="delete_task" row={row} submit="Delete task">
                <Field name="reason" title="Why is it being deleted?" />
                <p className="small-note">
                  The task disappears from every list but stays in the history and audit trail. A
                  task with submitted work logs must be closed instead.
                </p>
              </Form>
            </details>
          )}
        </>
      );
    if (kind === 'expense-detail' && row)
      return (
        <>
          <div className="expense-detail-title">
            <h2>{text(row, 'purpose')}</h2>
            <strong>{money(num(row, 'amount'))}</strong>
          </div>
          <div className="approval-highlight">
            <Clock size={24} />
            <div>
              <strong>
                {text(row, 'approval_status') === 'submitted'
                  ? 'Pending CEO approval'
                  : label(text(row, 'approval_status'))}
              </strong>
              <small>Submitted on {date(text(row, 'created_at'))}</small>
            </div>
          </div>
          <dl className="detail-list">
            <div>
              <dt>Submitted by</dt>
              <dd>{employeeName(text(row, 'submitted_by'))}</dd>
            </div>
            <div>
              <dt>Payee</dt>
              <dd>{text(row, 'payee')}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{text(row, 'category')}</dd>
            </div>
            <div>
              <dt>Payment status</dt>
              <dd>
                <Badge value={text(row, 'execution_status')} />
              </dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{text(row, 'evidence') || 'No evidence attached'}</dd>
            </div>
          </dl>
          <p className="info-block">
            <Info size={19} />
            Approval authorizes payment. It never marks this expense as paid.
          </p>
          {text(row, 'approval_status') === 'submitted' ? (
            <Form action="approve_expense" row={row} submit="Approve request">
              <Field name="reason" title="Reviewer decision reason" />
              <button
                type="button"
                className="button danger full"
                onClick={async () => {
                  if (
                    await command(
                      'reject_expense',
                      { reason: 'Request rejected by independent reviewer' },
                      row,
                    )
                  )
                    setDialog(null);
                }}
              >
                Reject request
              </button>
            </Form>
          ) : text(row, 'execution_status') === 'unpaid' ||
            text(row, 'execution_status') === 'partial' ? (
            <Form action="record_payment" row={row} submit="Record actual payment">
              <Field name="amount" title="Paid amount (LKR)" type="number" />
              <Field name="reference" title="Unique payment reference" />
              <Field name="evidence" title="Payment evidence" />
            </Form>
          ) : text(row, 'execution_status') === 'paid' ? (
            <Form action="reconcile_expense" row={row} submit="Reconcile">
              <Field name="evidence" title="Reconciliation evidence" />
            </Form>
          ) : (
            <p className="small-note">This expense is reconciled.</p>
          )}
        </>
      );
    if (kind === 'leave')
      return (
        <Form
          action="submit_leave"
          transform={(p) => ({ ...p, half_day: p.half_day === 'on' })}
          submit="Submit request"
        >
          <div className="form-grid">
            <Field name="start_date" title="Start date" type="date" />
            <Field name="end_date" title="End date" type="date" />
          </div>
          <label className="field">
            Leave type
            <select required name="type_id">
              {data.leaveTypes.map((t) => (
                <option value={t.id} key={t.id}>
                  {text(t, 'name')}
                </option>
              ))}
            </select>
          </label>
          <Field name="reason" title="Reason" />
          <label className="checkbox-field">
            <input type="checkbox" name="half_day" />
            Half day (single date only)
          </label>
          <p className="small-note">
            Working days, holidays, and leave policy determine the final day count.
          </p>
        </Form>
      );
    if (kind === 'leave-detail' && row)
      return (
        <>
          <div className="person detail-person">
            <Avatar name={employeeName(text(row, 'employee_id'))} />
            <h2>{employeeName(text(row, 'employee_id'))}</h2>
          </div>
          <dl className="detail-list">
            <div>
              <dt>From</dt>
              <dd>{date(text(row, 'start_date'))}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{date(text(row, 'end_date'))}</dd>
            </div>
            <div>
              <dt>Days</dt>
              <dd>{num(row, 'days')}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <Badge value={text(row, 'status')} />
              </dd>
            </div>
          </dl>
          <Form action="decide_leave" row={row} submit="Record decision">
            <label className="field">
              Decision
              <select name="decision">
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
              </select>
            </label>
            <Field name="reason" title="Reviewer reason" />
          </Form>
        </>
      );
    if (kind === 'agent-connect')
      return (
        <div className="dialog-form">
          {!pairing ? (
            <>
              <p>
                Install the RepairMe Agent on the computer you work on, then connect it to your
                account with a one-time code. Each account can connect up to 5 computers.
              </p>
              <button disabled={busy} className="button yellow full" onClick={createPairing}>
                {busy ? 'Creating…' : 'Create connection code'}
              </button>
            </>
          ) : (
            <>
              <div className="code-box" aria-label="Connection code">
                {pairing.code.replace(/(.{4})(?=.)/g, '$1-').toUpperCase()}
              </div>
              <ol className="agent-steps">
                <li>Install and open RepairMe Agent on your PC.</li>
                <li>
                  Enter this address: <strong>{window.location.origin}</strong>
                </li>
                <li>Enter the code above. It works once and expires in 10 minutes.</li>
              </ol>
            </>
          )}
        </div>
      );
    if (kind === 'attendance')
      return (
        <div className="dialog-form">
          <p>Record your actual attendance now. Company timezone: Asia/Colombo.</p>
          <button
            disabled={busy}
            className="button yellow full"
            onClick={async () => {
              if (
                await command(
                  data.attendance.some((a) => text(a, 'employee_id') === user.id && !a.check_out)
                    ? 'check_out'
                    : 'check_in',
                  {},
                )
              )
                setDialog(null);
            }}
          >
            <Clock size={17} />
            Confirm attendance event
          </button>
        </div>
      );
    if (kind === 'work-log') {
      const assigned = preview
        ? data.tasks
        : data.tasks.filter(
            (t) =>
              text(t, 'assignee_id') === user.id &&
              !['completed', 'cancelled'].includes(text(t, 'status')),
          );
      return (
        <Form
          action="submit_work_log"
          submit="Submit for review"
          transform={(p) => ({
            ...p,
            start_at: new Date(String(p.start_at)).toISOString(),
            end_at: new Date(String(p.end_at)).toISOString(),
          })}
        >
          <p className="info-block">
            <Clock size={19} />
            {logWindowOpen
              ? `Today’s log can be submitted and edited until ${time12(workEnd)}.`
              : `The work-log window is closed. Logs can be submitted between ${time12(workStart)} and ${time12(workEnd)}.`}
          </p>
          <label className="field">
            Assigned task
            <select name="task_id" required>
              {assigned.map((t) => (
                <option key={t.id} value={t.id}>
                  {text(t, 'title')}
                </option>
              ))}
            </select>
          </label>
          <Field name="start_at" title="Start (today)" type="datetime-local" />
          <Field name="end_at" title="End (today)" type="datetime-local" />
          <label className="field">
            Work summary — what did you do today?
            <textarea name="description" required minLength={3} rows={4} />
          </label>
          <label className="field">
            How good was today’s work? (your own rating, optional)
            <select name="self_quality_rating" defaultValue="">
              <option value="">Not rated</option>
              {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </select>
          </label>
          <p className="subtle">
            Your rating is shown to your reviewer. The reviewed rating decides the quality score.
          </p>
        </Form>
      );
    }
    if (kind === 'work-log-reopen' && row)
      return (
        <Form
          action="reopen_work_log"
          row={row}
          submit="Reopen for 4 hours"
          transform={(p) => ({ ...p, employee_id: row.id })}
        >
          <p className="info-block">
            <Clock size={19} />
            {employeeName(row.id)} will be able to submit and edit the work log for the chosen day
            for the next 4 hours. This is recorded and they are notified.
          </p>
          <Field
            name="work_date"
            title="Day to reopen"
            type="date"
            defaultValue={text(row, 'work_date') || workDay}
          />
          <Field name="reason" title="Reason" />
        </Form>
      );
    if (kind === 'work-log-edit' && row)
      return (
        <Form
          action="edit_work_log"
          row={row}
          submit="Save changes"
          transform={(p) => ({
            ...p,
            start_at: new Date(String(p.start_at)).toISOString(),
            end_at: new Date(String(p.end_at)).toISOString(),
          })}
        >
          <p className="info-block">
            <Clock size={19} />
            You can keep editing until {time12(workEnd)} today. Saving sends the log back to your
            project leader as submitted.
          </p>
          <Field
            name="start_at"
            title="Start (today)"
            type="datetime-local"
            defaultValue={toLocalInput(text(row, 'start_at'))}
          />
          <Field
            name="end_at"
            title="End (today)"
            type="datetime-local"
            defaultValue={toLocalInput(text(row, 'end_at'))}
          />
          <label className="field">
            Work summary
            <textarea
              name="description"
              required
              minLength={3}
              rows={4}
              defaultValue={text(row, 'description')}
            />
          </label>
          <label className="field">
            Your own quality rating (optional)
            <select
              name="self_quality_rating"
              defaultValue={row.self_quality_rating == null ? '' : String(row.self_quality_rating)}
            >
              <option value="">Not rated</option>
              {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5, 0].map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </select>
          </label>
        </Form>
      );
    if (kind === 'log-detail' && row) {
      const task = data.tasks.find((t) => t.id === text(row, 'task_id'));
      const own = text(row, 'employee_id') === user.id;
      const leads = !!task && leadsProject(text(task, 'project_id'));
      const canReview = !own && leads && text(row, 'status') === 'submitted';
      const reopened = myReopens.some((r) => text(r, 'work_date') === text(row, 'work_date'));
      const canEdit = own && (reopened || (text(row, 'work_date') === workDay && logWindowOpen));
      const canReopen = !own && leads && !logWindowOpen;
      const comments = data.workLogComments.filter((c) => text(c, 'work_log_id') === row.id);
      return (
        <>
          <p>
            <strong>{employeeName(text(row, 'employee_id'))}</strong> · {text(row, 'work_date')} ·{' '}
            {clock(text(row, 'start_at'))}–{clock(text(row, 'end_at'))}
          </p>
          <p>{text(row, 'description')}</p>
          <p className="subtle">
            Worker’s own quality rating:{' '}
            {row.self_quality_rating == null
              ? 'not rated'
              : `${num(row, 'self_quality_rating')} / 5`}
            {num(row, 'edit_count') > 0 && ` · edited ${num(row, 'edit_count')}×`}
          </p>
          {own && !canEdit && (
            <p className="small-note">
              This log is locked. Logs can only be edited on the same day, until {time12(workEnd)}.
            </p>
          )}
          {canReopen && (
            <div className="form-actions">
              <button
                className="button outline small-button"
                onClick={() =>
                  open('work-log-reopen', {
                    id: text(row, 'employee_id'),
                    work_date: text(row, 'work_date'),
                  })
                }
              >
                Reopen for editing
              </button>
            </div>
          )}
          {canEdit && (
            <div className="form-actions">
              <button
                className="button outline small-button"
                onClick={() => open('work-log-edit', row)}
              >
                Edit work log
              </button>
            </div>
          )}
          <h3>Comments</h3>
          {comments.length ? (
            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id}>
                  <strong>{employeeName(text(c, 'author_id'))}</strong>{' '}
                  <small>
                    {new Date(text(c, 'created_at')).toLocaleString('en-GB', {
                      timeZone: companyTz,
                    })}
                  </small>
                  <p>{text(c, 'body')}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="subtle">No comments yet.</p>
          )}
          {(own || leads) && (
            <Form action="comment_work_log" row={row} submit="Add comment">
              <label className="field">
                {own ? 'Reply to your leader' : 'Comment for the employee'}
                <textarea name="body" required maxLength={2000} rows={3} />
              </label>
            </Form>
          )}
          {canReview && (
            <Form action="review_work_log" row={row} submit="Record decision">
              <label className="field">
                Decision
                <select name="decision">
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </label>
              <Field name="reason" title="Review reason" />
            </Form>
          )}
        </>
      );
    }
    if (kind === 'employee-detail' && row)
      return (
        <>
          <div className="detail-person">
            <Avatar name={employeeName(row.id)} />
            <h2>{employeeName(row.id)}</h2>
            <p>{text(row, 'job_title')}</p>
          </div>
          <dl className="detail-list">
            {['employee_number', 'work_email', 'department', 'status'].map((k) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>{text(row, k)}</dd>
              </div>
            ))}
          </dl>
          <p className="small-note">
            Private HR and compensation information is kept separate from this directory profile.
          </p>
        </>
      );
    if (kind === 'project-detail' && row)
      return (
        <>
          <div className="detail-title">
            <h2>{text(row, 'name')}</h2>
            <p>{text(row, 'client')}</p>
            <Badge value={text(row, 'status')} />
          </div>
          {(() => {
            const tasks = data.tasks
              .filter((t) => text(t, 'project_id') === row.id)
              .sort((a, b) => text(a, 'created_at').localeCompare(text(b, 'created_at')));
            const leader = text(row, 'manager_id');
            const memberIds = [
              ...new Set([
                leader,
                ...data.projectMembers
                  .filter((m) => text(m, 'project_id') === row.id)
                  .map((m) => text(m, 'employee_id')),
                ...tasks.map((t) => text(t, 'assignee_id')).filter(Boolean),
              ]),
            ];
            const seesAll = leader === user.id || user.roles.includes('ceo') || preview;
            const openTasks = tasks.filter(
              (t) => !['completed', 'cancelled'].includes(text(t, 'status')),
            );
            return (
              <>
                {(preview || user.roles.includes('ceo') || leader === user.id) && (
                  <div className="form-actions">
                    <button
                      className="button outline small-button"
                      onClick={() => open('project-leader', row)}
                    >
                      Change leader
                    </button>
                    <button
                      className="button outline small-button"
                      onClick={() => open('project-delete', row)}
                    >
                      Delete project
                    </button>
                  </div>
                )}
                <dl className="detail-list">
                  <div>
                    <dt>Project leader</dt>
                    <dd>{employeeName(leader)}</dd>
                  </div>
                  <div>
                    <dt>Created by</dt>
                    <dd>
                      {employeeName(leader)}
                      {row.created_at ? ` · ${date(text(row, 'created_at').slice(0, 10))}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Start date</dt>
                    <dd>{date(text(row, 'start_date')) || '—'}</dd>
                  </div>
                  <div>
                    <dt>Due date</dt>
                    <dd>{date(text(row, 'due_date'))}</dd>
                  </div>
                  <div>
                    <dt>Tasks</dt>
                    <dd>
                      {tasks.length} total · {openTasks.length} open ·{' '}
                      {tasks.filter(isOverdue).length} overdue ·{' '}
                      {tasks.filter((t) => text(t, 'status') === 'completed').length} closed
                    </dd>
                  </div>
                  <div>
                    <dt>People working</dt>
                    <dd>{memberIds.length}</dd>
                  </div>
                </dl>
                <h3 className="overview-heading">Team</h3>
                <div className="review-queue">
                  {memberIds.map((id) => {
                    const theirs = tasks.filter((t) => text(t, 'assignee_id') === id);
                    return (
                      <div key={id}>
                        <span>
                          <strong>{employeeName(id)}</strong>
                          <small>
                            {id === leader ? 'Project leader · ' : ''}
                            {theirs.length} task{theirs.length === 1 ? '' : 's'} ·{' '}
                            {
                              theirs.filter(
                                (t) => !['completed', 'cancelled'].includes(text(t, 'status')),
                              ).length
                            }{' '}
                            open
                          </small>
                        </span>
                      </div>
                    );
                  })}
                </div>
                <h3 className="overview-heading">{seesAll ? 'Tasks' : 'Your tasks'}</h3>
                {!seesAll && (
                  <p className="agent-note">
                    You can see the tasks assigned to you in this project. The project leader sees
                    every task.
                  </p>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Task</th>
                        <th>Assigned to</th>
                        <th>Created by</th>
                        <th>Status</th>
                        <th>Due</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.map((t, i) => (
                        <tr key={t.id}>
                          <td>T-{i + 1}</td>
                          <td>{text(t, 'title')}</td>
                          <td>
                            {text(t, 'assignee_id') ? employeeName(text(t, 'assignee_id')) : '—'}
                          </td>
                          <td>{employeeName(text(t, 'reporter_id'))}</td>
                          <td>
                            {isOverdue(t) ? (
                              <span className="badge urgent">Overdue</span>
                            ) : (
                              <Badge value={text(t, 'status')} />
                            )}
                          </td>
                          <td>{date(text(t, 'due_date'))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!tasks.length && <Empty message="No tasks in this project yet" />}
                </div>
              </>
            );
          })()}
          <Link className="button yellow full" href="/tasks" onClick={() => setDialog(null)}>
            Open task board <ArrowRight size={16} />
          </Link>
        </>
      );
    if (kind === 'project-leader' && row)
      return (
        <Form action="set_project_leader" row={row} submit="Change leader">
          <p>
            <strong>{text(row, 'name')}</strong>
            <br />
            Current leader: {employeeName(text(row, 'manager_id'))}
          </p>
          <label className="field">
            New project leader
            <select name="leader_id" required defaultValue="">
              <option value="" disabled>
                Choose the new leader…
              </option>
              {data.leaders
                .filter((l) => l.id !== text(row, 'manager_id'))
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {employeeName(l.id)}
                  </option>
                ))}
            </select>
          </label>
          <p className="small-note">
            The new leader creates the project’s tasks, assigns people and sees every task. The
            previous leader no longer manages the project and sees only tasks assigned to them.
          </p>
        </Form>
      );
    if (kind === 'project-delete' && row) {
      const projectTasks = data.tasks.filter((t) => text(t, 'project_id') === row.id);
      const hasRecords =
        projectTasks.some((t) => text(t, 'status') === 'completed') ||
        data.logs.some(
          (l) =>
            projectTasks.some((t) => t.id === text(l, 'task_id')) &&
            ['submitted', 'approved'].includes(text(l, 'status')),
        );
      const isCeo = preview || user.roles.includes('ceo');
      return (
        <Form action="delete_project" row={row} submit="Delete project">
          <p>
            Delete <strong>{text(row, 'name')}</strong>? The project and its tasks disappear from
            every list. Open tasks are cancelled. Everything stays in the history and audit trail.
          </p>
          {hasRecords && (
            <p className="small-note">
              This project has completed tasks or work logs. They stay in the records, so reviews
              and hours do not change, but the project is hidden.{' '}
              {isCeo
                ? 'To confirm, type the project name below.'
                : 'Only the CEO can delete a project that has work records.'}
            </p>
          )}
          <Field name="reason" title="Why is it being deleted?" />
          {hasRecords && isCeo && (
            <Field name="confirm_name" title={`Type “${text(row, 'name')}” to confirm`} />
          )}
        </Form>
      );
    }
    if (kind === 'settings')
      return (
        <Form
          action="update_settings"
          row={row}
          transform={(p) => ({
            ...p,
            working_weekdays: String(p.working_weekdays).split(',').map(Number),
            break_minutes: Number(p.break_minutes),
            break_paid: p.break_paid === 'true',
          })}
        >
          <Field
            name="working_weekdays"
            title="Working weekdays (0 Sunday – 6 Saturday, comma-separated)"
          />
          <Field
            name="work_start"
            title="Work day starts (work logs open)"
            type="time"
            defaultValue={workStart}
          />
          <Field
            name="work_end"
            title="Work day ends (work logs lock)"
            type="time"
            defaultValue={workEnd}
          />
          <Field name="break_minutes" title="Break duration in minutes" type="number" />
          <label className="field">
            Break counts as working time?
            <select name="break_paid">
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
          <p className="small-note">CEO approval is required for working policy changes.</p>
        </Form>
      );
    if (kind === 'candidate-detail' && row)
      return (
        <>
          <h2>{text(row, 'name')}</h2>
          <p>{text(row, 'position')}</p>
          <Badge value={text(row, 'stage')} />
          <p className="info-block">{text(row, 'job_related_evidence')}</p>
        </>
      );
    return (
      <div className="dialog-form">
        <p className="info-block">
          <ShieldCheck size={20} />
          {kind === 'invite'
            ? 'Account invitations require a connected Supabase project, server-only administration credentials, and configured email delivery. Public signup is disabled.'
            : 'Private uploads require authorized document metadata and a connected storage bucket. No files will be made public.'}
        </p>
        <Link className="button yellow full" href="/login">
          Workspace connection <ArrowRight size={16} />
        </Link>
      </div>
    );
  }
}
