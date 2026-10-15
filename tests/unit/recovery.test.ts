import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { reset } = vi.hoisted(() => ({ reset: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  isConfigured: () => true,
  serverClient: async () => ({ auth: { resetPasswordForEmail: reset } }),
}));
import { POST } from '@/app/auth/session/route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function request() {
  vi.stubEnv('APP_ORIGIN', 'https://workspace.example');
  return POST(
    new NextRequest('https://workspace.example/auth/session', {
      method: 'POST',
      headers: { origin: 'https://workspace.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'recovery', email: 'employee@example.com' }),
    }),
  );
}
test('recovery uses the hosted callback and keeps account eligibility private', async () => {
  reset.mockResolvedValue({ error: null });
  const response = await request();
  expect(response.status).toBe(200);
  expect(reset).toHaveBeenLastCalledWith('employee@example.com', {
    redirectTo: 'https://workspace.example/auth/callback?next=/account',
  });
  expect((await response.json()).message).toContain('If this account is eligible');
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});
test.each([
  [{ status: 429, code: 'over_email_send_rate_limit' }, 429, 'limit reached'],
  [{ status: 500, code: 'unexpected_failure' }, 503, 'could not be sent'],
])(
  'recovery reports provider failure without claiming an email was sent',
  async (error, status, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    reset.mockResolvedValue({ error });
    const response = await request();
    expect(response.status).toBe(status);
    expect((await response.json()).error).toContain(message);
  },
);
