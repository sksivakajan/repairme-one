import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const { identity, rpc } = vi.hoisted(() => ({ identity: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/identity', () => ({ identity }));
vi.mock('@/lib/supabase/server', () => ({
  isConfigured: () => true,
  serverClient: async () => ({ rpc }),
}));
import { GET } from '@/app/api/work/status/route';
beforeEach(() => {
  identity.mockResolvedValue({ id: 'u1' });
});
afterEach(() => vi.clearAllMocks());
test('a signed-out request gets nothing', async () => {
  identity.mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
test('the break state of the signed-in employee is returned', async () => {
  rpc.mockResolvedValue({ data: { break_due: true, streak_seconds: 3700 }, error: null });
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ break_due: true, streak_seconds: 3700 });
  expect(rpc).toHaveBeenCalledWith('work_status');
});
test('a database failure is reported without details', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'secret detail' } });
  const res = await GET();
  expect(res.status).toBe(502);
  expect(JSON.stringify(await res.json())).not.toContain('secret');
});
