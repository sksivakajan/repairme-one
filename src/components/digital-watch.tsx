'use client';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
const FRESH_MS = 150000;
type Mode = 'running' | 'idle' | 'locked' | 'break' | 'offline';
const labels: Record<Mode, string> = {
  running: 'Running',
  idle: 'Idle · not counted',
  locked: 'PC locked · not counted',
  break: 'Coffee break · paused',
  offline: 'Not tracking',
};
function clock(total: number) {
  const s = Math.max(0, Math.floor(total));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(':');
}
// Today's tracked work time. It ticks only while the desktop agent reports real activity (or, without an
// agent, while the employee is checked in and this tab is open). Remount with a new key to resync.
export function DigitalWatch({
  baseSeconds,
  agentState,
  agentUpdatedAt,
  checkedIn,
}: {
  baseSeconds: number;
  agentState: string | null;
  agentUpdatedAt: string | null;
  checkedIn: boolean;
}) {
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<Mode>('offline');
  const [onBreak, setOnBreak] = useState(false);
  useEffect(() => {
    const listen = (event: Event) => setOnBreak(Boolean((event as CustomEvent).detail?.on_break));
    window.addEventListener('repairme:work-status', listen);
    return () => window.removeEventListener('repairme:work-status', listen);
  }, []);
  useEffect(() => {
    const evaluate = (): Mode => {
      if (onBreak) return 'break';
      if (agentUpdatedAt && Date.now() - Date.parse(agentUpdatedAt) < FRESH_MS)
        return agentState === 'active'
          ? 'running'
          : agentState === 'locked'
            ? 'locked'
            : agentState === 'break'
              ? 'break'
              : 'idle';
      return checkedIn && document.visibilityState === 'visible' ? 'running' : 'offline';
    };
    const id = setInterval(() => {
      const next = evaluate();
      setMode(next);
      if (next === 'running') setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [agentState, agentUpdatedAt, checkedIn, onBreak]);
  return (
    <div className={`watch-card ${mode}`} role="timer" aria-label="Tracked work time today">
      <span className="stat-icon green">
        <Clock size={24} />
      </span>
      <div>
        <p>Work time today</p>
        <strong className="watch-digits">{clock(baseSeconds + tick)}</strong>
        <small>
          <i className="watch-dot" />
          {labels[mode]}
          {agentUpdatedAt ? ' · desktop agent' : checkedIn ? ' · this browser' : ''}
        </small>
      </div>
    </div>
  );
}
