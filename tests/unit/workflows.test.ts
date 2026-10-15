import { describe, it, expect } from 'vitest';
import { calculatePerformance } from '@/lib/workflows/performance';
import {
  validateTaskTransition,
  intervalMinutes,
  overlaps,
  moneyMinor,
  remainingApproval,
  leaveDays,
} from '@/lib/workflows/rules';
import { canAccess, canApprove } from '@/lib/permissions';
describe('Monthly formula v1.0', () => {
  it('matches a known complete example', () => {
    const r = calculatePerformance({
      agreedWeight: 20,
      acceptedWeight: 17,
      onTimeWeight: 12.75,
      quality: [
        { weight: 5, rating: 4 },
        { weight: 12, rating: 4.236111111111111 },
      ],
      teamwork: 4,
    });
    expect(r.delivery).toBe(34);
    expect(r.quality).toBeCloseTo(25);
    expect(r.reliability).toBe(15);
    expect(r.teamwork).toBe(8);
    expect(r.total).toBeCloseTo(82);
  });
  it('shows insufficient evidence without redistributing categories', () => {
    const r = calculatePerformance({
      agreedWeight: 0,
      acceptedWeight: 0,
      onTimeWeight: 0,
      quality: [],
      teamwork: null,
    });
    expect(r.total).toBeNull();
    expect(r.status).toBe('Insufficient Evidence');
  });
  it('caps delivery at 40', () =>
    expect(
      calculatePerformance({
        agreedWeight: 3,
        acceptedWeight: 5,
        onTimeWeight: 5,
        quality: [{ weight: 5, rating: 5 }],
        teamwork: 5,
      }).total,
    ).toBe(100));
  it('rejects invented ratings', () =>
    expect(() =>
      calculatePerformance({
        agreedWeight: 3,
        acceptedWeight: 3,
        onTimeWeight: 3,
        quality: [{ weight: 3, rating: 6 }],
        teamwork: 5,
      }),
    ).toThrow());
  it('does not fabricate a total with missing teamwork evidence', () =>
    expect(
      calculatePerformance({
        agreedWeight: 3,
        acceptedWeight: 3,
        onTimeWeight: 3,
        quality: [{ weight: 3, rating: 5 }],
        teamwork: null,
      }).total,
    ).toBeNull());
});
describe('Workflow boundaries', () => {
  it('rejects employee self acceptance', () =>
    expect(() => validateTaskTransition('in_review', 'completed', false, 'Evidence')).toThrow(
      'Independent review',
    ));
  it('requires review evidence', () =>
    expect(() => validateTaskTransition('in_progress', 'in_review', false, ' ')).toThrow());
  it('prevents reopening completed work', () =>
    expect(() => validateTaskTransition('completed', 'in_progress', true, 'Fix')).toThrow());
  it('calculates work duration', () =>
    expect(intervalMinutes('2026-10-13T03:30:00Z', '2026-10-13T06:30:00Z')).toBe(180));
  it('rejects negative and invalid intervals', () => {
    expect(() => intervalMinutes('bad', 'bad')).toThrow();
    expect(() => intervalMinutes('2026-10-13T06:30:00Z', '2026-10-13T03:30:00Z')).toThrow();
  });
  it('allows adjacent intervals but rejects overlaps', () => {
    const a = { start: '2026-10-13T03:00:00Z', end: '2026-10-13T04:00:00Z' };
    expect(overlaps(a, { start: a.end, end: '2026-10-13T05:00:00Z' })).toBe(false);
    expect(overlaps(a, { start: '2026-10-13T03:30:00Z', end: '2026-10-13T05:00:00Z' })).toBe(true);
  });
  it('uses exact fractional money', () => {
    expect(moneyMinor('0.10') + moneyMinor('0.20')).toBe(30n);
    expect(remainingApproval('100.00', ['30.50', '20.25'])).toBe(4925n);
    expect(() => moneyMinor('1.001')).toThrow();
  });
  it('does not assume a workweek', () =>
    expect(() => leaveDays('2026-10-12', '2026-10-16', [], [], false)).toThrow());
  it('excludes configured holidays and nonworking days', () =>
    expect(leaveDays('2026-10-12', '2026-10-18', [1, 2, 3, 4, 5], ['2026-10-14'], false)).toBe(4));
  it('keeps half days exact', () =>
    expect(leaveDays('2026-10-12', '2026-10-12', [1, 2, 3, 4, 5], [], true)).toBe(0.5));
  it('does not grant admin finance or HR access', () => {
    expect(canAccess(['admin'], 'finance')).toBe(false);
    expect(canAccess(['admin'], 'hr')).toBe(false);
    expect(canAccess(['finance'], 'hr')).toBe(false);
    expect(canAccess(['hr'], 'finance')).toBe(false);
  });
  it('requires independent authorization', () => {
    expect(canApprove('a', 'a', true)).toBe(false);
    expect(canApprove('a', 'b', false)).toBe(false);
    expect(canApprove('a', 'b', true)).toBe(true);
  });
});
