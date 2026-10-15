import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { readFileSync } from 'node:fs';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/anon', () => ({ anonClient: () => ({ rpc }) }));
import { POST as pair } from '@/app/api/agent/pair/route';
import { POST as heartbeat } from '@/app/api/agent/heartbeat/route';
const token = 'a'.repeat(64);
const post = (path: string, body: unknown, auth?: string) =>
  new NextRequest('https://workspace.example' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.example');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'publishable');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test('pairing returns the device token', async () => {
  rpc.mockResolvedValue({ data: { ok: true, token, employee: 'Nimal' }, error: null });
  const res = await pair(post('/api/agent/pair', { code: 'abcd-1234-ef56', device_name: 'PC-1' }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ token, employee: 'Nimal' });
  expect(rpc).toHaveBeenCalledWith('agent_pair', expect.objectContaining({ device_name: 'PC-1' }));
});
test('pairing with a wrong code is rejected without a token', async () => {
  rpc.mockResolvedValue({
    data: { ok: false, error: 'Code is not valid or has expired' },
    error: null,
  });
  const res = await pair(post('/api/agent/pair', { code: 'abcd-1234-ef56', device_name: 'PC-1' }));
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: 'Code is not valid or has expired' });
});
test('pairing validates the request', async () => {
  const res = await pair(post('/api/agent/pair', { code: 'x' }));
  expect(res.status).toBe(422);
  expect(rpc).not.toHaveBeenCalled();
});
const report = {
  state: 'active',
  active_seconds: 30,
  cpu_percent: 12.5,
  top_apps: [{ name: 'code.exe', cpu: 3, ram_mb: 400 }],
};
test('heartbeat needs a bearer token', async () => {
  expect((await heartbeat(post('/api/agent/heartbeat', report))).status).toBe(401);
  expect((await heartbeat(post('/api/agent/heartbeat', report, 'Bearer short'))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
test('heartbeat rejects impossible values', async () => {
  const res = await heartbeat(
    post('/api/agent/heartbeat', { ...report, active_seconds: 99999 }, `Bearer ${token}`),
  );
  expect(res.status).toBe(422);
  expect(rpc).not.toHaveBeenCalled();
});
test('heartbeat forwards the token and report', async () => {
  rpc.mockResolvedValue({
    data: { ok: true, credited: 30, today_active_seconds: 90 },
    error: null,
  });
  const res = await heartbeat(post('/api/agent/heartbeat', report, `Bearer ${token}`));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ credited: 30 });
  expect(rpc).toHaveBeenCalledWith('agent_heartbeat', {
    token,
    payload: expect.objectContaining({ state: 'active', active_seconds: 30 }),
  });
});
test('a revoked device is told to stop', async () => {
  rpc.mockResolvedValue({ data: { ok: false, reason: 'revoked' }, error: null });
  const res = await heartbeat(post('/api/agent/heartbeat', report, `Bearer ${token}`));
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ ok: false, reason: 'revoked' });
});
test('a real report from the desktop agent passes the portal validation', async () => {
  rpc.mockResolvedValue({ data: { ok: true, credited: 28 }, error: null });
  const sample = JSON.parse(readFileSync('agent/tests/sample_report.json', 'utf8'));
  const res = await heartbeat(post('/api/agent/heartbeat', sample, `Bearer ${token}`));
  expect(res.status).toBe(200);
});
