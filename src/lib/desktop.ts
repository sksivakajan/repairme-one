// The RepairMe Desktop app shows this portal inside its own window and exposes a small API to it.
export type DesktopStatus = {
  paired: boolean;
  user_id: string | null;
  version: string;
  today_seconds: number;
};
export type DesktopApi = {
  status(): Promise<DesktopStatus>;
  pair(code: string, server: string, userId: string): Promise<{ ok: boolean; error?: string }>;
  notify(title: string, body: string): Promise<void>;
};
declare global {
  interface Window {
    pywebview?: { api?: DesktopApi };
  }
}
export const desktopApi = (): DesktopApi | undefined =>
  typeof window === 'undefined' ? undefined : window.pywebview?.api;

// A Windows notification: through the desktop app when it hosts the page, otherwise through the browser
// (which shows it as a Windows notification once the employee has allowed it).
export async function notifyUser(title: string, body: string) {
  const api = desktopApi();
  if (api) {
    try {
      await api.notify(title, body);
      return;
    } catch {
      /* fall back to the browser */
    }
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
    new Notification(title, { body, icon: '/brand/repairme-logo-transparent.png' });
}
export const canAskForNotifications = () =>
  !desktopApi() && typeof Notification !== 'undefined' && Notification.permission === 'default';
