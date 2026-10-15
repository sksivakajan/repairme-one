import { afterEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { verify, exchange } = vi.hoisted(() => ({ verify: vi.fn(), exchange: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({
  serverClient: async () => ({ auth: { verifyOtp: verify, exchangeCodeForSession: exchange } }),
}));
import { GET as confirm } from '@/app/auth/confirm/route';
import { GET as callback } from '@/app/auth/callback/route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test('verified recovery token opens the password page', async () => {
  vi.stubEnv('APP_ORIGIN', 'https://workspace.example');
  verify.mockResolvedValue({ error: null });
  const response = await confirm(
    new NextRequest('https://workspace.example/auth/confirm?token_hash=test-token&type=recovery'),
  );
  expect(verify).toHaveBeenCalledWith({ token_hash: 'test-token', type: 'recovery' });
  expect(response.headers.get('location')).toBe('https://workspace.example/account');
});
test('expired recovery token opens recovery guidance instead of login', async () => {
  vi.stubEnv('APP_ORIGIN', 'https://workspace.example');
  verify.mockResolvedValue({ error: { message: 'expired' } });
  const response = await confirm(
    new NextRequest('https://workspace.example/auth/confirm?token_hash=test-token&type=recovery'),
  );
  expect(response.headers.get('location')).toBe(
    'https://workspace.example/recovery?error=invalid_link',
  );
});
test('PKCE recovery callback opens the password page', async () => {
  vi.stubEnv('APP_ORIGIN', 'https://workspace.example');
  exchange.mockResolvedValue({ error: null });
  const response = await callback(
    new NextRequest('https://workspace.example/auth/callback?code=test-code&next=/account'),
  );
  expect(response.headers.get('location')).toBe('https://workspace.example/account');
});
