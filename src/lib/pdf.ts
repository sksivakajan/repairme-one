// A small PDF writer for table reports. It uses the standard Helvetica fonts, so no font or library is shipped.
export type PdfCell = {
  text: string;
  /** Hex background for the cell, for example a status colour. */
  fill?: string;
  /** Hex text colour. */
  color?: string;
  bold?: boolean;
};
export type PdfColumn = { title: string; width: number };
export type PdfReport = {
  title: string;
  subtitle?: string;
  columns: PdfColumn[];
  rows: (PdfCell | string)[][];
};
const PAGE_W = 842; // A4 landscape, points
const PAGE_H = 595;
const MARGIN = 36;
const FONT = 8.5;
const LEAD = 11;
const PAD = 4;
const HEAD_H = 20;
function rgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => +(v / 255).toFixed(3)).join(' ');
}
// Characters the standard fonts can print. Anything else becomes "?".
function latin1(value: string) {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');
}
function escape(value: string) {
  return latin1(value).replace(/[\\()]/g, (c) => `\\${c}`);
}
// Approximate Helvetica widths, in em, used only to decide where lines wrap.
function width(value: string, size: number, bold = false) {
  let em = 0;
  for (const c of value) {
    em += "iljtf.,:;'!| ".includes(c)
      ? 0.28
      : 'mwMW'.includes(c)
        ? 0.82
        : c >= 'A' && c <= 'Z'
          ? 0.67
          : 0.53;
  }
  return em * size * (bold ? 1.06 : 1);
}
function wrap(value: string, max: number, size: number, bold = false) {
  const lines: string[] = [];
  let line = '';
  for (const word of latin1(value).split(' ')) {
    let w = word;
    // A word wider than the cell is cut.
    while (width(w, size, bold) > max && w.length > 1) {
      let cut = w.length - 1;
      while (cut > 1 && width(w.slice(0, cut), size, bold) > max) cut--;
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const next = line ? `${line} ${w}` : w;
    if (width(next, size, bold) <= max) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}
export function buildPdf(report: PdfReport): Uint8Array {
  const pages: string[][] = [[]];
  const cols = report.columns;
  const totalWidth = cols.reduce((n, c) => n + c.width, 0);
  const scale = (PAGE_W - MARGIN * 2) / totalWidth;
  const widths = cols.map((c) => c.width * scale);
  const xs = widths.reduce<number[]>((acc, w, i) => [...acc, (acc[i] ?? MARGIN) + w], [MARGIN]);
  let y = PAGE_H - MARGIN;
  const out = () => pages[pages.length - 1];
  const text = (
    value: string,
    x: number,
    baseline: number,
    bold: boolean,
    color: string,
    size = FONT,
  ) =>
    out().push(
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${x.toFixed(1)} ${baseline.toFixed(1)} Td (${escape(value)}) Tj ET`,
    );
  const rect = (x: number, top: number, w: number, h: number, fill: string) =>
    out().push(
      `${rgb(fill)} rg ${x.toFixed(1)} ${(top - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`,
    );
  const header = () => {
    rect(MARGIN, y, PAGE_W - MARGIN * 2, HEAD_H, '#101820');
    cols.forEach((c, i) => text(c.title, xs[i] + PAD, y - 13, true, '#ffcc00'));
    y -= HEAD_H;
  };
  text(report.title, MARGIN, y - 14, true, '#101820', 16);
  y -= 24;
  if (report.subtitle) {
    text(report.subtitle, MARGIN, y - 8, false, '#6b7686', 9);
    y -= 18;
  }
  y -= 4;
  header();
  report.rows.forEach((row, index) => {
    const cells = row.map((c) => (typeof c === 'string' ? { text: c } : c));
    const wrapped = cells.map((c, i) => wrap(c.text, widths[i] - PAD * 2, FONT, c.bold));
    const height = Math.max(...wrapped.map((l) => l.length)) * LEAD + PAD * 2;
    if (y - height < MARGIN + 14) {
      pages.push([]);
      y = PAGE_H - MARGIN;
      header();
    }
    if (index % 2 === 1) rect(MARGIN, y, PAGE_W - MARGIN * 2, height, '#f7f8fa');
    cells.forEach((c, i) => {
      if (c.fill) rect(xs[i] + 1, y - 1, widths[i] - 2, height - 2, c.fill);
      wrapped[i].forEach((line, n) =>
        text(line, xs[i] + PAD, y - PAD - 8 - n * LEAD, !!c.bold, c.color ?? '#101820'),
      );
    });
    out().push(
      `0.9 0.92 0.95 RG ${MARGIN} ${(y - height).toFixed(1)} m ${PAGE_W - MARGIN} ${(y - height).toFixed(1)} l S`,
    );
    y -= height;
  });
  if (!report.rows.length)
    text('No records for this selection.', MARGIN + PAD, y - 16, false, '#6b7686', 10);
  pages.forEach((_, i) =>
    pages[i].push(
      `BT /F1 8 Tf ${rgb('#6b7686')} rg ${MARGIN} ${MARGIN - 18} Td (RepairMe One  -  page ${i + 1} of ${pages.length}) Tj ET`,
    ),
  );
  // Objects: 1 catalog, 2 page tree, 3 and 4 fonts, then a page and its content stream for every page.
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  pages.forEach((content, i) => {
    const stream = content.join('\n');
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (pdf += `${String(o).padStart(10, '0')} 00000 n \n`));
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Every character is Latin-1, so one character is one byte and the offsets above are byte offsets.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 255;
  return bytes;
}
// Status colours, the same as the badges in the portal: waiting yellow, in progress blue, done green, problem red.
const COLORS = {
  waiting: { fill: '#fff6db', color: '#ba922c' },
  progress: { fill: '#edf4ff', color: '#5a87c8' },
  done: { fill: '#eaf7ee', color: '#3d9d66' },
  problem: { fill: '#fff0ef', color: '#d3736e' },
  neutral: { fill: '#f0f2f6', color: '#8b94a3' },
} as const;
const STATUS: Record<string, [keyof typeof COLORS, string]> = {
  submitted: ['waiting', 'Pending'],
  in_review: ['waiting', 'In review'],
  pending: ['waiting', 'Pending'],
  approved: ['done', 'Approved'],
  completed: ['done', 'Completed'],
  in_progress: ['progress', 'In progress'],
  active: ['progress', 'In progress'],
  rejected: ['problem', 'Rejected'],
  overdue: ['problem', 'Overdue'],
  draft: ['neutral', 'Draft'],
  backlog: ['neutral', 'Backlog'],
  todo: ['neutral', 'To do'],
  cancelled: ['neutral', 'Cancelled'],
};
export function statusCell(status: string): PdfCell {
  const [kind, label] = STATUS[status] ?? ['neutral', status.replaceAll('_', ' ')];
  return { text: label, bold: true, ...COLORS[kind] };
}
