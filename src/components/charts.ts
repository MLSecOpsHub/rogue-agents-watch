// Small d3-based charts. Colours come from CSS custom properties so they follow
// the theme; d3 only computes geometry.
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import { h, svgEl } from '../util/dom';

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  description?: string;
  href?: string;
  colorClass?: string;
}

/**
 * Horizontal bar chart. Renders an accessible table fallback (visually hidden)
 * so screen readers get the numbers.
 */
export function barChart(title: string, data: BarDatum[], opts: { note?: string; sort?: boolean } = {}): HTMLElement {
  const rows = opts.sort === false ? data : [...data].sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const width = 420;
  const barH = 22;
  const gap = 6;
  const labelW = 170;
  const valueW = 36;
  const height = rows.length * (barH + gap) + gap;
  const x = scaleLinear()
    .domain([0, Math.max(1, max(rows, (d) => d.value) ?? 1)])
    .range([0, width - labelW - valueW - 8]);
  const y = scaleBand<string>()
    .domain(rows.map((d) => d.key))
    .range([gap, height])
    .paddingInner(gap / (barH + gap));

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart chart-bar', role: 'img', 'aria-label': `${title} bar chart` });
  for (const d of rows) {
    const g = svgEl('g', { transform: `translate(0,${y(d.key) ?? 0})`, class: `bar ${d.colorClass ?? ''}` });
    if (d.description) {
      const t = svgEl('title');
      t.textContent = `${d.label}: ${d.value} — ${d.description}`;
      g.appendChild(t);
    }
    const lines = wrapLabel(d.label);
    const lbl = svgEl('text', { x: labelW - 8, y: barH / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: lines.length > 1 ? 'bar-label bar-label-wrapped' : 'bar-label' });
    if (lines.length === 1) {
      lbl.textContent = d.label;
    } else {
      lines.forEach((line, i) => {
        const t = svgEl('tspan', { x: labelW - 8, y: barH / 2 + (i === 0 ? -6 : 6) });
        t.textContent = line;
        lbl.appendChild(t);
      });
    }
    g.appendChild(lbl);
    g.appendChild(svgEl('rect', { x: labelW, y: 0, width: Math.max(2, x(d.value)), height: barH, rx: 3, class: 'bar-rect' }));
    const val = svgEl('text', { x: labelW + x(d.value) + 6, y: barH / 2, 'dominant-baseline': 'middle', class: 'bar-value' });
    val.textContent = String(d.value);
    g.appendChild(val);
    if (d.href) {
      const a = svgEl('a');
      a.setAttribute('href', d.href);
      a.appendChild(g);
      svg.appendChild(a);
    } else {
      svg.appendChild(g);
    }
  }

  const table = h(
    'table',
    { class: 'sr-only' },
    h('caption', null, title),
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Value'), h('th', { scope: 'col' }, 'Count'))),
    h('tbody', null, ...rows.map((d) => h('tr', null, h('th', { scope: 'row' }, d.label), h('td', null, String(d.value))))),
  );

  return h('section', { class: 'chart-card' }, h('h3', null, title), svg, table, opts.note ? h('p', { class: 'chart-note' }, opts.note) : null);
}

/**
 * Break a label longer than `max` characters into two lines at the best
 * space (preferring a " / " separator) so long taxonomy labels are not clipped.
 */
export function wrapLabel(label: string, max = 22): string[] {
  if (label.length <= max) return [label];
  const slash = label.indexOf(' / ');
  let cut = slash > 0 && slash <= max ? slash + 2 : -1;
  if (cut < 0) {
    cut = label.lastIndexOf(' ', max);
    if (cut <= 0) cut = label.indexOf(' ');
  }
  if (cut <= 0) return [label];
  return [label.slice(0, cut).trimEnd(), label.slice(cut).trimStart()];
}

/** Side-by-side pair of bar charts with a shared heading (used for status vs ai_role). */
export function chartPair(heading: string, intro: string, left: HTMLElement, right: HTMLElement): HTMLElement {
  return h('section', { class: 'chart-pair' }, h('h2', null, heading), h('p', { class: 'lede' }, intro), h('div', { class: 'chart-pair-grid' }, left, right));
}

export function statTile(labelText: string, value: string | number, opts: { sub?: string; href?: string; title?: string } = {}): HTMLElement {
  const inner = [h('span', { class: 'stat-value' }, String(value)), h('span', { class: 'stat-label' }, labelText), opts.sub ? h('span', { class: 'stat-sub' }, opts.sub) : null];
  return opts.href
    ? h('a', { class: 'stat', href: opts.href, title: opts.title ?? undefined }, ...inner)
    : h('div', { class: 'stat', title: opts.title ?? undefined }, ...inner);
}
