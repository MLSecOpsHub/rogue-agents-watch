// Crosstab of two enum fields as a real table: counts, row and column totals,
// each non-zero cell a link to the filtered table. Shading is a single-hue
// ramp of the accent via --heat; the number is always printed, so colour is
// never the only encoding.
import { h } from '../util/dom';

export interface MatrixAxis {
  id: string;
  label: string;
  description?: string;
}

export interface MatrixSpec {
  caption: string;
  rowHeader: string;
  rows: MatrixAxis[];
  cols: MatrixAxis[];
  count: (row: MatrixAxis, col: MatrixAxis) => number;
  link?: (row: MatrixAxis, col: MatrixAxis) => string | null;
  rowLink?: (row: MatrixAxis) => string | null;
  note?: string;
}

export function matrix(spec: MatrixSpec): HTMLElement {
  const counts = spec.rows.map((r) => spec.cols.map((c) => spec.count(r, c)));
  const max = Math.max(1, ...counts.flat());
  const colTotals = spec.cols.map((_, j) => counts.reduce((n, row) => n + (row[j] ?? 0), 0));
  const thead = h(
    'thead',
    null,
    h('tr', null, h('th', { scope: 'col' }, spec.rowHeader), ...spec.cols.map((c) => h('th', { scope: 'col', title: c.description || undefined }, c.label)), h('th', { scope: 'col', class: 'matrix-total' }, 'Records')),
  );
  const tbody = h(
    'tbody',
    null,
    ...spec.rows.map((r, i) => {
      const rowCounts = counts[i] ?? [];
      const rowTotal = rowCounts.reduce((n, v) => n + v, 0);
      const rl = spec.rowLink?.(r) ?? null;
      return h(
        'tr',
        null,
        h('th', { scope: 'row', title: r.description || undefined }, rl ? h('a', { href: rl }, r.label) : r.label),
        ...spec.cols.map((c, j) => {
          const v = rowCounts[j] ?? 0;
          const href = v > 0 ? (spec.link?.(r, c) ?? null) : null;
          const cell = h('td', { class: v > 0 ? 'matrix-cell heat' : 'matrix-cell zero', style: v > 0 ? `--heat: ${(v / max).toFixed(2)}` : undefined });
          if (v > 0) cell.appendChild(href ? h('a', { href, title: `${r.label} × ${c.label}: ${v} record${v === 1 ? '' : 's'}` }, String(v)) : document.createTextNode(String(v)));
          else cell.appendChild(h('span', { class: 'sr-only' }, '0'));
          return cell;
        }),
        h('td', { class: 'matrix-total num' }, String(rowTotal)),
      );
    }),
  );
  const tfoot = h('tfoot', null, h('tr', null, h('th', { scope: 'row' }, 'Records'), ...colTotals.map((t) => h('td', { class: 'matrix-total num' }, String(t))), h('td', null)));
  return h(
    'div',
    { class: 'matrix-wrap' },
    h('table', { class: 'matrix' }, h('caption', null, spec.caption), thead, tbody, tfoot),
    spec.note ? h('p', { class: 'chart-note' }, spec.note) : null,
  );
}
