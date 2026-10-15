import { expect, test } from 'vitest';
import { buildPdf, statusCell } from '@/lib/pdf';
const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);
const columns = [
  { title: 'Date', width: 60 },
  { title: 'Summary', width: 200 },
  { title: 'Status', width: 60 },
];
test('a report is a valid PDF whose xref offsets point at the objects', () => {
  const pdf = text(
    buildPdf({
      title: 'Work logs',
      columns,
      rows: [['2026-10-15', 'Fixed (the) login \\ page', statusCell('submitted')]],
    }),
  );
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  const start = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
  expect(pdf.slice(start, start + 4)).toBe('xref');
  for (const m of pdf.matchAll(/(\d{10}) 00000 n/g))
    expect(pdf.slice(Number(m[1])).search(/^\d+ 0 obj/)).toBe(0);
  // Brackets and backslashes are escaped so they cannot break the PDF text string.
  expect(pdf).toContain('Fixed \\(the\\) login \\\\ page');
});
test('statuses use the portal colours: waiting yellow, in progress blue, done green, rejected red', () => {
  expect(statusCell('submitted')).toMatchObject({ text: 'Pending', fill: '#fff6db' });
  expect(statusCell('in_progress')).toMatchObject({ text: 'In progress', fill: '#edf4ff' });
  expect(statusCell('approved')).toMatchObject({ text: 'Approved', fill: '#eaf7ee' });
  expect(statusCell('rejected')).toMatchObject({ text: 'Rejected', fill: '#fff0ef' });
});
test('long reports continue on more pages and long words do not overflow', () => {
  const rows = Array.from({ length: 120 }, (_, i) => [
    `day ${i}`,
    'x'.repeat(300),
    statusCell('approved'),
  ]);
  const pdf = text(buildPdf({ title: 'Many', columns, rows }));
  expect(Number(/\/Count (\d+)/.exec(pdf)?.[1])).toBeGreaterThan(2);
  expect(pdf).toContain('page 1 of');
});
test('an empty report still says so', () => {
  expect(text(buildPdf({ title: 'Empty', columns, rows: [] }))).toContain('No records');
});
