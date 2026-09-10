// Timeline: incidents by date_disclosed, swimlane per category, colour by
// category, marker outline by status (solid = confirmed, dashed = reported,
// dotted = test-eval). Filterable via the shared filter panel.
import { scaleTime, scaleBand } from 'd3-scale';
import { extent } from 'd3-array';
import { excludedInactiveNote, filterPanel, resultSummary } from '../components/filters';
import { incidentCard } from '../components/badges';
import { wrapLabel } from '../components/charts';
import { label, values } from '../data/taxonomy';
import { applyFilters, fromQuery, toQuery, type FilterState } from '../filters';
import { incidentHref, navigate, replaceQuery } from '../router';
import { h, svgEl, clear } from '../util/dom';
import type { ViewContext } from './types';

export function timelineView({ ds, route, root }: ViewContext): void {
  let state: FilterState = fromQuery(route.query);

  root.appendChild(h('h1', null, 'Timeline'));
  root.appendChild(h('p', { class: 'lede' }, 'Incidents by public disclosure date. Rows are categories; colour follows category; the outline of each marker encodes verification status. Click a marker to open the record.'));

  const layout = h('div', { class: 'with-filters' });
  const side = h('div', { class: 'filters-col' });
  const main = h('div', { class: 'results-col' });
  layout.appendChild(side);
  layout.appendChild(main);
  root.appendChild(layout);

  const rerender = () => {
    clear(side);
    clear(main);
    side.appendChild(
      filterPanel(ds, state, (next) => {
        state = next;
        replaceQuery(toQuery(state));
        rerender();
      }),
    );
    const list = applyFilters(ds.incidents, state);
    main.appendChild(h('p', { class: 'result-summary' }, resultSummary(ds.incidents.length, list.length, state)));
    const note = excludedInactiveNote(ds, state);
    if (note) main.appendChild(note);
    main.appendChild(timelineChart(ds, list));
    main.appendChild(h('div', { class: 'card-grid' }, ...list.map((i) => incidentCard(ds.taxonomy, i))));
  };
  rerender();
}

function timelineChart(ds: ViewContext['ds'], list: ViewContext['ds']['incidents']): HTMLElement {
  const cats = values(ds.taxonomy, 'category').map((v) => v.id);
  const width = 960;
  const laneH = 44;
  const margin = { top: 28, right: 24, bottom: 36, left: 200 };
  const height = margin.top + margin.bottom + cats.length * laneH;
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart chart-timeline', role: 'img', 'aria-label': 'Timeline of incidents by disclosure date and category' });

  const dates = list.map((i) => new Date(i.date_disclosed));
  const [d0, d1] = extent(dates) as [Date | undefined, Date | undefined];
  const start = d0 ?? new Date('2024-01-01');
  const end = d1 ?? new Date('2026-01-01');
  const pad = Math.max(30, (end.getTime() - start.getTime()) * 0.04);
  const x = scaleTime()
    .domain([new Date(start.getTime() - pad), new Date(end.getTime() + pad)])
    .range([margin.left, width - margin.right]);
  const y = scaleBand<string>().domain(cats).range([margin.top, height - margin.bottom]);

  // Lanes + labels
  for (const c of cats) {
    const yy = y(c) ?? 0;
    svg.appendChild(svgEl('rect', { x: margin.left, y: yy, width: width - margin.left - margin.right, height: y.bandwidth(), class: 'lane' }));
    const lines = wrapLabel(label(ds.taxonomy, 'category', c));
    const t = svgEl('text', { x: margin.left - 10, y: yy + y.bandwidth() / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'lane-label' });
    if (lines.length === 1) t.textContent = lines[0] ?? '';
    else
      lines.forEach((line, i) => {
        const span = svgEl('tspan', { x: margin.left - 10, y: yy + y.bandwidth() / 2 + (i === 0 ? -7 : 7) });
        span.textContent = line;
        t.appendChild(span);
      });
    svg.appendChild(t);
  }
  // Axis: one tick per quarter-ish
  const ticks = x.ticks(Math.min(8, Math.max(2, Math.round((end.getFullYear() - start.getFullYear() + 1) * 4))));
  for (const tk of ticks) {
    const xx = x(tk);
    svg.appendChild(svgEl('line', { x1: xx, x2: xx, y1: margin.top, y2: height - margin.bottom, class: 'tick-line' }));
    const t = svgEl('text', { x: xx, y: height - margin.bottom + 18, 'text-anchor': 'middle', class: 'tick-label' });
    t.textContent = tk.toISOString().slice(0, 7);
    svg.appendChild(t);
  }

  // Markers, nudged vertically when several share a lane and a date window.
  const placed: Array<{ x: number; y: number }> = [];
  for (const inc of list) {
    const cx = x(new Date(inc.date_disclosed));
    let cy = (y(inc.category) ?? 0) + y.bandwidth() / 2;
    let tries = 0;
    while (placed.some((p) => Math.abs(p.x - cx) < 14 && Math.abs(p.y - cy) < 14) && tries < 3) {
      cy += tries % 2 === 0 ? 12 : -24;
      tries++;
    }
    placed.push({ x: cx, y: cy });
    const g = svgEl('g', {
      class: `tl-marker c-category-${inc.category} status-${inc.status}${inc.isActiveRecord ? '' : ' inactive'}`,
      transform: `translate(${cx.toFixed(2)},${cy.toFixed(2)})`,
      tabindex: 0,
      role: 'link',
      'data-id': inc.id,
    });
    const title = svgEl('title');
    title.textContent = `${inc.date_disclosed} — ${inc.name}\nStatus: ${label(ds.taxonomy, 'status', inc.status)} · AI role: ${label(ds.taxonomy, 'ai_role', inc.ai_role)} · Severity: ${label(ds.taxonomy, 'severity', inc.severity)}`;
    g.appendChild(title);
    g.appendChild(svgEl('circle', { r: 7, class: 'tl-dot' }));
    const open = () => navigate(incidentHref(inc.id));
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        open();
      }
    });
    svg.appendChild(g);
  }

  const legend = h(
    'div',
    { class: 'legend' },
    h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch tl-status-confirmed', 'aria-hidden': 'true' }), 'Confirmed (solid outline)'),
    h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch tl-status-reported', 'aria-hidden': 'true' }), 'Reported (dashed)'),
    h('span', { class: 'legend-item' }, h('span', { class: 'legend-swatch tl-status-test-eval', 'aria-hidden': 'true' }), 'Test / eval (dotted)'),
  );
  return h('div', { class: 'timeline-wrap' }, svg, legend);
}
