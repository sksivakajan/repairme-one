'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Coffee } from 'lucide-react';
import { canAskForNotifications, notifyUser } from '@/lib/desktop';

export type WorkStatus = {
  on_break: boolean;
  break_ends_at: string | null;
  break_seconds_left: number;
  streak_seconds: number;
  break_due: boolean;
  work_block_seconds: number;
  break_seconds: number;
};
const POLL_MS = 20000;
const mmss = (seconds: number) =>
  `${String(Math.floor(Math.max(0, seconds) / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(seconds)) % 60).padStart(2, '0')}`;

// After 60 minutes of continuous work: offer a 10 minute coffee break. The employee can start it or push it back
// 10 minutes. While on a break nothing is counted as work. The same prompt shows in the web portal and the desktop app.
export function WorkBreak({ preview }: { preview: boolean }) {
  const [status, setStatus] = useState<WorkStatus | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [askNotify, setAskNotify] = useState(false);
  const previous = useRef<WorkStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/work/status', { cache: 'no-store' });
      if (res.ok) setStatus(await res.json());
    } catch {
      /* offline: keep the last known state */
    }
  }, []);

  useEffect(() => {
    // Fixture preview only: /preview/my-work?break=due or ?break=on shows the break prompts.
    if (!preview) return;
    const demo = new URLSearchParams(window.location.search).get('break');
    if (demo !== 'due' && demo !== 'on') return;
    const timer = setTimeout(
      () =>
        setStatus({
          on_break: demo === 'on',
          break_ends_at: demo === 'on' ? new Date(Date.now() + 7 * 60000).toISOString() : null,
          break_seconds_left: demo === 'on' ? 420 : 0,
          streak_seconds: 3720,
          break_due: demo === 'due',
          work_block_seconds: 3600,
          break_seconds: 600,
        }),
      0,
    );
    return () => clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    const wake = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [preview, refresh]);

  useEffect(() => {
    if (!status) return;
    const before = previous.current;
    previous.current = status;
    window.dispatchEvent(new CustomEvent('repairme:work-status', { detail: status }));
    if (status.break_due && !before?.break_due)
      void notifyUser(
        'Time for a coffee break ☕',
        'You have worked for an hour. Take a 10-minute break, or push it back.',
      );
    if (before?.on_break && !status.on_break)
      void notifyUser('Break over', 'Welcome back! Your work time is counting again.');
    const timer = setTimeout(() => setAskNotify(canAskForNotifications()), 0);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!status?.on_break || !status.break_ends_at) return;
    const ends = Date.parse(status.break_ends_at);
    const tick = () => {
      const remaining = (ends - Date.now()) / 1000;
      setLeft(remaining);
      if (remaining <= 0) void refresh();
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [status, refresh]);

  async function act(action: 'start_break' | 'snooze_break' | 'end_break') {
    setBusy(true);
    try {
      await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload: {} }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;
  if (status.on_break)
    return (
      <div className="break-banner" role="status">
        <Coffee size={18} />
        <strong>Coffee break</strong>
        <span className="break-clock">{mmss(left)}</span>
        <span>left · your work time is paused</span>
        <button
          className="button outline small-button"
          disabled={busy}
          onClick={() => act('end_break')}
        >
          End break
        </button>
      </div>
    );
  if (status.break_due)
    return (
      <div className="break-card" role="alertdialog" aria-label="Coffee break">
        <span className="stat-icon green">
          <Coffee size={22} />
        </span>
        <div>
          <strong>Time for a coffee break ☕</strong>
          <p>You have worked for an hour without a break. Take 10 minutes to rest.</p>
          <div className="form-actions">
            <button
              className="button outline small-button"
              disabled={busy}
              onClick={() => act('snooze_break')}
            >
              Not now · remind me in 10 min
            </button>
            <button
              className="button yellow small-button"
              disabled={busy}
              onClick={() => act('start_break')}
            >
              Start 10-minute break
            </button>
          </div>
          {askNotify && (
            <button
              className="plain-link"
              onClick={() => Notification.requestPermission().then(() => setAskNotify(false))}
            >
              <Bell size={13} /> Allow Windows notifications for break reminders
            </button>
          )}
        </div>
      </div>
    );
  return askNotify ? (
    <button
      className="break-allow"
      onClick={() => Notification.requestPermission().then(() => setAskNotify(false))}
    >
      <Bell size={14} /> Allow Windows notifications for break reminders
    </button>
  ) : null;
}
