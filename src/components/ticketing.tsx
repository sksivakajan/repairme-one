'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Row } from '@/features/fixtures';
export type TicketData = { tickets: Row[]; comments: Row[]; events: Row[]; error?: string };
const categories = [
  'it_support',
  'hardware',
  'software_accounts',
  'internet',
  'office_equipment',
  'facilities',
  'supplies',
  'hr',
  'other',
];
const statuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const transitions: Record<string, string[]> = {
  open: ['in_progress', 'waiting', 'resolved'],
  in_progress: ['waiting', 'resolved'],
  waiting: ['in_progress', 'resolved'],
  resolved: ['open', 'closed'],
  closed: ['open'],
};
const label = (s: unknown) => String(s ?? '').replaceAll('_', ' ');
export function Ticketing({
  data,
  employees,
  userId,
  admin,
  preview,
}: {
  data: TicketData;
  employees: Row[];
  userId: string;
  admin: boolean;
  preview: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ticket = data.tickets.find((t) => t.id === selected);
  const employee = (id: unknown) => {
    const e = employees.find((e) => e.id === id);
    return e ? `${e.first_name} ${e.last_name}` : id ? 'Team member' : 'Unassigned';
  };
  async function submit(event: React.FormEvent<HTMLFormElement>, action: string, row?: Row) {
    event.preventDefault();
    setError('');
    if (preview) {
      setError('This fixture preview is read only. Sign in to create or update tickets.');
      return;
    }
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: row?.id, version: row?.version, payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      form.reset();
      if (action === 'create_ticket') {
        setCreating(false);
        setSelected(result.id);
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save ticket');
    } finally {
      setBusy(false);
    }
  }
  if (data.error)
    return (
      <div className="panel">
        <h2>Ticketing setup required</h2>
        <p>{data.error}</p>
      </div>
    );
  const visible = data.tickets.filter(
    (t) =>
      (filter === 'all' || t.status === filter) &&
      [t.title, t.ticket_number, t.category, t.location].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
  );
  return (
    <div className="ticketing">
      <div className="ticket-toolbar">
        <label className="field">
          Search tickets
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Number, title, category or location"
          />
        </label>
        <label className="field">
          Status
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button yellow"
          onClick={() => {
            setCreating(!creating);
            setError('');
          }}
        >
          Report an issue
        </button>
      </div>
      {error && (
        <p role="alert" className="ticket-error">
          {error}
        </p>
      )}
      {creating && (
        <section className="panel">
          <h2>Report an office issue</h2>
          <form className="form-grid" onSubmit={(e) => submit(e, 'create_ticket')}>
            <label className="field">
              Title
              <input name="title" required minLength={3} maxLength={160} />
            </label>
            <label className="field">
              Category
              <select name="category">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {label(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Priority
              <select name="priority" defaultValue="medium">
                {['low', 'medium', 'high', 'urgent'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Location
              <input name="location" maxLength={200} placeholder="Office, floor or room" />
            </label>
            <label className="field">
              Description
              <textarea name="description" required minLength={5} maxLength={5000} />
            </label>
            <button className="button yellow" disabled={busy}>
              Create ticket
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>
          Support tickets <span className="muted">({visible.length} loaded)</span>
        </h2>
        <p>
          Tickets you reported or are assigned to appear here. Owners and admins can view all
          tickets.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Category / location</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned to</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td>
                    #{String(t.ticket_number)} · {String(t.title)}
                  </td>
                  <td>
                    {label(t.category)}
                    <br />
                    {String(t.location)}
                  </td>
                  <td>{label(t.priority)}</td>
                  <td>{label(t.status)}</td>
                  <td>{employee(t.assignee_id)}</td>
                  <td>
                    <button
                      className="button outline"
                      onClick={() => {
                        setSelected(t.id);
                        setError('');
                      }}
                    >
                      View ticket
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <p>No tickets found. Report an issue to get started.</p>}
        <p className="muted">Showing up to 100 most recently updated tickets.</p>
      </section>
      {ticket && (
        <section className="panel ticket-detail" aria-label="Ticket details">
          <h2>
            #{String(ticket.ticket_number)} · {String(ticket.title)}
          </h2>
          <p className="ticket-description">{String(ticket.description)}</p>
          <p>
            Reported by {employee(ticket.requester_id)} · {label(ticket.status)} ·{' '}
            {label(ticket.priority)}
          </p>
          {admin && (
            <form className="ticket-toolbar" onSubmit={(e) => submit(e, 'assign_ticket', ticket)}>
              <label className="field">
                Assign support staff
                <select
                  name="assignee_id"
                  key={String(ticket.assignee_id)}
                  defaultValue={String(ticket.assignee_id ?? '')}
                >
                  <option value="">Unassigned</option>
                  {employees
                    .filter((e) => e.status === 'active')
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {employee(e.id)}
                      </option>
                    ))}
                </select>
              </label>
              <button className="button yellow" disabled={busy}>
                Save assignment
              </button>
            </form>
          )}
          <form className="ticket-toolbar" onSubmit={(e) => submit(e, 'transition_ticket', ticket)}>
            <label className="field">
              Update status
              <select name="status">
                {(transitions[String(ticket.status)] ?? [])
                  .filter(
                    (s) => admin || ticket.assignee_id === userId || s === 'open' || s === 'closed',
                  )
                  .map((s) => (
                    <option key={s} value={s}>
                      {s === 'open' ? 'Reopen' : label(s)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Update reason
              <input name="reason" required minLength={3} maxLength={5000} />
            </label>
            <button
              className="button yellow"
              disabled={
                busy ||
                (!admin &&
                  ticket.assignee_id !== userId &&
                  !['resolved', 'closed'].includes(String(ticket.status)))
              }
            >
              Update status
            </button>
          </form>
          <h3>Comments</h3>
          {data.comments
            .filter((c) => c.ticket_id === ticket.id)
            .map((c) => (
              <article className="ticket-entry" key={c.id}>
                <strong>{employee(c.author_id)}</strong>
                <small>
                  {' '}
                  ·{' '}
                  {new Date(String(c.created_at)).toLocaleString('en-GB', {
                    timeZone: 'Asia/Colombo',
                  })}
                </small>
                <p>{String(c.body)}</p>
              </article>
            ))}
          {ticket.status !== 'closed' && (
            <form onSubmit={(e) => submit(e, 'comment_ticket', ticket)}>
              <label className="field">
                Add an update
                <textarea name="body" required maxLength={5000} />
              </label>
              <button className="button yellow" disabled={busy}>
                Add comment
              </button>
            </form>
          )}
          <h3>Update history</h3>
          {data.events
            .filter((e) => e.ticket_id === ticket.id)
            .map((e) => (
              <article className="ticket-entry" key={e.id}>
                <strong>
                  {employee(e.actor_id)} · {label(e.event)}
                </strong>
                <small>
                  {' '}
                  ·{' '}
                  {new Date(String(e.created_at)).toLocaleString('en-GB', {
                    timeZone: 'Asia/Colombo',
                  })}
                </small>
                <p>
                  {Object.entries((e.details ?? {}) as Record<string, unknown>)
                    .map(
                      ([key, value]) =>
                        `${key}: ${key === 'from' || key === 'to' ? label(value) : String(value ?? '')}`,
                    )
                    .join(' · ')}
                </p>
              </article>
            ))}
        </section>
      )}
    </div>
  );
}
