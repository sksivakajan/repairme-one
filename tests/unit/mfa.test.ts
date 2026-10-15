import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { client } = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ serverClient: client }));
import { POST } from '@/app/auth/mfa/route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test('MFA enrollment returns the provider QR privately for scanning', async () => {
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3100');
  const qr = 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  client.mockResolvedValue({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: 'test-user' } } }),
      mfa: {
        listFactors: async () => ({ data: { totp: [], all: [] } }),
        enroll: async () => ({
          data: { id: 'factor', totp: { secret: 'test-only-secret', qr_code: qr } },
          error: null,
        }),
      },
    },
  });
  const response = await POST(
    new NextRequest('http://localhost:3100/auth/mfa', {
      method: 'POST',
      headers: { origin: 'http://localhost:3100', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prepare' }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(await response.json()).toEqual({ id: 'factor', secret: 'test-only-secret', qrCode: qr });
});
test('MFA enrollment rejects a foreign origin before reading the account', async () => {
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3100');
  const response = await POST(
    new NextRequest('http://localhost:3100/auth/mfa', {
      method: 'POST',
      headers: { origin: 'https://untrusted.example' },
      body: '{}',
    }),
  );
  expect(response.status).toBe(403);
  expect(client).not.toHaveBeenCalled();
});
