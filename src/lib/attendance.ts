export const AWAY_AFTER_MS = 3 * 60 * 1000;
export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}
// A stable per-browser id, so one account can be tracked across several devices.
export function deviceId() {
  try {
    const stored = localStorage.getItem('repairme-device-id');
    if (stored) return stored;
    const created = crypto.randomUUID();
    localStorage.setItem('repairme-device-id', created);
    return created;
  } catch {
    return 'session-' + Math.random().toString(36).slice(2, 12);
  }
}
export function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Browser';
  const system = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS/.test(ua)
          ? 'Mac'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'device';
  return `${browser} on ${system}`;
}
