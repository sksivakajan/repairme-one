'use client';
import { useEffect } from 'react';
import { desktopApi } from '@/lib/desktop';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Inside RepairMe Desktop, signing in to the portal also connects this PC: the portal makes a one-time code and
// hands it to the app, so no code has to be typed. Outside the app this does nothing.
export function DesktopBridge({ userId, preview }: { userId: string; preview: boolean }) {
  useEffect(() => {
    if (preview) return;
    let stopped = false;
    (async () => {
      for (let i = 0; i < 20 && !desktopApi(); i++) await sleep(250);
      const api = desktopApi();
      if (!api || stopped) return;
      document.documentElement.dataset.desktop = '1';
      const status = await api.status();
      if (stopped || (status.paired && status.user_id === userId)) return;
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_agent_pairing', payload: {} }),
      });
      if (!res.ok || stopped) return;
      const { code } = await res.json();
      await api.pair(String(code), window.location.origin, userId);
    })().catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [userId, preview]);
  return null;
}
