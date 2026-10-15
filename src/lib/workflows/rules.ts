export const taskTransitions: Record<string, string[]> = {
  backlog: ['todo', 'cancelled'],
  todo: ['in_progress', 'cancelled'],
  in_progress: ['in_review', 'cancelled'],
  in_review: ['in_progress', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function validateTaskTransition(
  from: string,
  to: string,
  independentReviewer: boolean,
  evidence: string,
) {
  if (!taskTransitions[from]?.includes(to)) throw new Error('Invalid transition');
  if (to === 'completed' && !independentReviewer) throw new Error('Independent review required');
  if (['in_review', 'completed', 'cancelled'].includes(to) && !evidence.trim())
    throw new Error('Evidence or reason required');
}
export function intervalMinutes(start: string, end: string) {
  const n = (Date.parse(end) - Date.parse(start)) / 60000;
  if (!Number.isFinite(n) || n <= 0) throw new Error('End must be after start');
  return n;
}
export function overlaps(a: { start: string; end: string }, b: { start: string; end: string }) {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}
export function moneyMinor(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value))
    throw new Error('Use a positive amount with at most two decimal places');
  const [whole, frac = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
}
export function remainingApproval(approved: string, payments: string[]) {
  return moneyMinor(approved) - payments.reduce((a, p) => a + moneyMinor(p), 0n);
}
export function leaveDays(
  start: string,
  end: string,
  weekdays: number[],
  holidays: string[],
  halfDay: boolean,
) {
  if (!weekdays.length) throw new Error('Configure working weekdays first');
  const first = new Date(start + 'T00:00:00Z'),
    last = new Date(end + 'T00:00:00Z');
  if (!Number.isFinite(+first) || !Number.isFinite(+last) || last < first)
    throw new Error('Invalid leave range');
  if (halfDay && start !== end) throw new Error('Half day must be a single date');
  let units = 0;
  for (let d = first; d <= last; d = new Date(+d + 86400000))
    if (weekdays.includes(d.getUTCDay()) && !holidays.includes(d.toISOString().slice(0, 10)))
      units += halfDay ? 0.5 : 1;
  return units;
}
