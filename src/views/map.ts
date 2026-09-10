// World map: d3-geo + topojson-client with vendored Natural Earth 110m geometry.
// Markers come ONLY from each record's `geo` block. Encoding (see
// docs/design/map-ux-research.md): hue = ai_role (one ordinal ramp), ring =
// status, size = severity, soft disc = illustrative centroid, pin = stated
// location. Records without geo appear in the field log, never as a pin.
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { recordStatusTag } from '../components/badges';
import { whatChanged } from '../components/changes';
import { incidentDrawer } from '../components/drawer';
import { createReplay, dateMs, formatT, parseT, replayBounds } from '../components/replay';
import { describe, label, values } from '../data/taxonomy';
import type { Dataset, GeoPoint, Incident } from '../data/types';
import { applyFilters, fieldValues, fromQuery, matches, toQuery, toggleValue, type FilterField, type FilterState } from '../filters';
import { replaceQuery } from '../router';
import { h, svgEl } from '../util/dom';
import type { ViewContext } from './types';

interface Marker {
  inc: Incident;
  kind: 'target' | 'origin';
  point: GeoPoint;
}

export function collectMarkers(incidents: Incident[], includeInactive: boolean): Marker[] {
  const out: Marker[] = [];
  for (const inc of incidents) {
    if (!inc.geo) continue;
    if (!includeInactive && !inc.isActiveRecord) continue;
    if (inc.geo.target) out.push({ inc, kind: 'target', point: inc.geo.target });
    if (inc.geo.origin) out.push({ inc, kind: 'origin', point: inc.geo.origin });
  }
  return out;
}

const SEVERITY_R: Record<string, number> = { critical: 7.5, high: 6, medium: 4.8, low: 4 };
const MAP_FILTERS: FilterField[] = ['ai_role', 'status'];
const W = 960;
const H = 500;

export async function mapView({ ds, route, root }: ViewContext): Promise<void> {
  const tax = ds.taxonomy;
  let state: FilterState = fromQuery(route.query);
  const bounds = replayBounds(ds.incidents);
  let t = parseT(route.query.get('t'), bounds) ?? bounds.end;
  let openId: string | null = route.query.get('open');
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inactiveCount = ds.incidents.filter((i) => !i.isActiveRecord).length;

  const considered = () => (state.includeInactive ? ds.incidents : ds.incidents.filter((i) => i.isActiveRecord));
  const withGeoIds = new Set(ds.incidents.filter((i) => i.hasGeo).map((i) => i.id));
  const allMarkers = collectMarkers(ds.incidents, true);
  const illustrativeCount = allMarkers.filter((m) => m.point.illustrative).length;

  // ---- header ---------------------------------------------------------------
  const lede = h('p', { class: 'lede' });
  const paintLede = () => {
    const c = considered();
    const onMap = c.filter((i) => withGeoIds.has(i.id)).length;
    const off = c.length - onMap;
    lede.textContent = `${onMap} of ${c.length} records carry stated coordinates and appear on the map. ${off} record${off === 1 ? ' has' : 's have'} no geo block in the dataset and ${off === 1 ? 'is' : 'are'} therefore not on the map; the field log lists ${off === 1 ? 'it' : 'them'}. Nothing is geocoded here: no marker is derived from country lists or actor names.`;
  };
  paintLede();
  root.appendChild(h('h1', null, 'Map'));
  root.appendChild(lede);

  // ---- URL sync -------------------------------------------------------------
  const sync = () => {
    const q = toQuery(state);
    if (t < bounds.end) q.set('t', formatT(t));
    if (openId) q.set('open', openId);
    replaceQuery(q);
  };

  // ---- filter chips ---------------------------------------------------------
  const toolbar = h('div', { class: 'chips-bar', role: 'group', 'aria-label': 'Map filters' });
  const chipGroups: Array<{ field: FilterField; el: HTMLElement }> = [];
  const paintChips = () => {
    for (const g of chipGroups) {
      for (const b of g.el.querySelectorAll<HTMLButtonElement>('button.chip')) {
        const v = b.dataset.value ?? '';
        b.setAttribute('aria-pressed', String(state.values[g.field]?.has(v) ?? false));
      }
    }
    inactiveChip?.setAttribute('aria-pressed', String(state.includeInactive));
  };
  for (const field of MAP_FILTERS) {
    const group = h('div', { class: 'chips' }, h('span', { class: 'chips-label' }, field === 'ai_role' ? 'AI role' : 'Evidence'));
    for (const v of values(tax, field)) {
      const count = ds.incidents.filter((i) => i.isActiveRecord && fieldValues(i, field).includes(v.id)).length;
      const swatch = field === 'ai_role' ? h('span', { class: `chip-sw role-${v.id}`, 'aria-hidden': 'true' }) : h('span', { class: `chip-sw ring status-${v.id}`, 'aria-hidden': 'true' });
      const btn = h(
        'button',
        { type: 'button', class: 'chip', 'aria-pressed': 'false', title: v.description || undefined, dataset: { field, value: v.id }, onClick: () => {
          state = toggleValue(state, field, v.id);
          paintChips();
          sync();
          render();
        } },
        swatch,
        v.label,
        h('span', { class: 'chip-n mono', 'aria-label': `${count} records` }, String(count)),
      );
      group.appendChild(btn);
    }
    chipGroups.push({ field, el: group });
    toolbar.appendChild(group);
  }
  let inactiveChip: HTMLButtonElement | null = null;
  if (inactiveCount) {
    inactiveChip = h(
      'button',
      { type: 'button', class: 'chip', 'aria-pressed': 'false', onClick: () => {
        state = { ...state, includeInactive: !state.includeInactive };
        paintChips();
        paintLede();
        sync();
        render();
      } },
      `Include retracted / superseded (${inactiveCount})`,
    );
    toolbar.appendChild(h('div', { class: 'chips' }, inactiveChip));
  }
  const clearBtn = h('button', { type: 'button', class: 'btn btn-small btn-quiet', onClick: () => {
    state = { values: {}, q: '', includeInactive: false };
    paintChips();
    paintLede();
    sync();
    render();
  } }, 'Clear filters');
  toolbar.appendChild(clearBtn);
  root.appendChild(toolbar);
  paintChips();

  // ---- layout ---------------------------------------------------------------
  const stage = h('div', { class: 'map-stage' });
  const logBox = h('div', { class: 'field-log' });
  root.appendChild(h('div', { class: 'map-layout' }, stage, logBox));

  // ---- map ------------------------------------------------------------------
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'Sphere' });
  const path = geoPath(projection);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'map', role: 'img', 'aria-label': 'World map of incidents with stated coordinates, replayed by disclosure date' });
  const defs = svgEl('defs');
  for (const role of ['load-bearing', 'significant', 'incidental', 'disputed', 'unknown']) {
    const grad = svgEl('radialGradient', { id: `halo-${role}`, class: `halo-grad role-${role}` });
    grad.appendChild(svgEl('stop', { offset: '0%', 'stop-opacity': 0.5 }));
    grad.appendChild(svgEl('stop', { offset: '55%', 'stop-opacity': 0.16 }));
    grad.appendChild(svgEl('stop', { offset: '100%', 'stop-opacity': 0 }));
    defs.appendChild(grad);
  }
  svg.appendChild(defs);
  const gLand = svgEl('g', { class: 'map-land' });
  const gArcs = svgEl('g', { class: 'map-arcs' });
  const gMarkers = svgEl('g', { class: 'map-markers' });
  svg.appendChild(svgEl('path', { d: path({ type: 'Sphere' }) ?? '', class: 'map-sphere' }));
  svg.appendChild(svgEl('path', { d: path(geoGraticule10()) ?? '', class: 'map-graticule' }));
  svg.appendChild(gLand);
  svg.appendChild(gArcs);
  svg.appendChild(gMarkers);
  stage.appendChild(svg);

  const status = h('p', { class: 'map-status', 'aria-live': 'polite' }, 'Loading map geometry…');
  stage.appendChild(status);
  try {
    const topo = (await import('../../data/geo/countries-110m.json')).default as unknown as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;
    for (const f of countries.features) gLand.appendChild(svgEl('path', { d: path(f) ?? '', class: 'map-country' }));
    status.remove();
  } catch {
    status.textContent = 'Map geometry could not be loaded; markers and the field log still work.';
  }

  // HUD: hero count + caption
  const count = h('div', { class: 'hud-count num' }, '0');
  const caption = h('div', { class: 'hud-caption' });
  stage.appendChild(h('div', { class: 'map-hud', 'aria-live': 'polite' }, count, caption));

  // tooltip
  const tooltip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
  stage.appendChild(tooltip);

  // arcs (origin → target when both stated)
  const arcs: Array<{ inc: Incident; el: SVGElement }> = [];
  for (const inc of ds.incidents) {
    if (inc.geo?.origin && inc.geo.target) {
      const line = { type: 'LineString' as const, coordinates: [[inc.geo.origin.lng, inc.geo.origin.lat], [inc.geo.target.lng, inc.geo.target.lat]] };
      const el = svgEl('path', { d: path(line) ?? '', class: `map-arc${inc.geo.origin.illustrative || inc.geo.target.illustrative ? ' illustrative' : ''}` });
      const title = svgEl('title');
      title.textContent = `${inc.name}: origin to target${inc.geo.origin.illustrative || inc.geo.target.illustrative ? ', country-level' : ''}`;
      el.appendChild(title);
      gArcs.appendChild(el);
      arcs.push({ inc, el });
    }
  }

  // markers
  const marks: Array<{ m: Marker; g: SVGGElement; xy: [number, number] }> = [];
  for (const m of allMarkers) {
    const xy = projection([m.point.lng, m.point.lat]);
    if (!xy) continue;
    const r = SEVERITY_R[m.inc.severity] ?? 5;
    const g = svgEl('g', {
      class: `marker ${m.kind} ${m.point.illustrative ? 'illustrative' : 'stated'} role-${m.inc.ai_role} status-${m.inc.status}${m.inc.isActiveRecord ? '' : ' inactive'}`,
      transform: `translate(${xy[0].toFixed(2)},${xy[1].toFixed(2)})`,
      tabindex: 0,
      role: 'button',
      'aria-label': `${m.inc.name}, ${m.kind} ${m.point.label}${m.point.illustrative ? ', country-level' : ''}`,
      'data-id': m.inc.id,
      'data-kind': m.kind,
      'data-illustrative': String(m.point.illustrative),
    });
    const title = svgEl('title');
    title.textContent = tooltipText(ds, m);
    g.appendChild(title);
    if (m.point.illustrative) g.appendChild(svgEl('circle', { r: 30, class: 'marker-halo', fill: `url(#halo-${m.inc.ai_role})` }));
    g.appendChild(svgEl('circle', { r: r + 6, class: 'marker-pulse' }));
    g.appendChild(svgEl('circle', { r, class: m.point.illustrative ? 'marker-core' : 'marker-core marker-pin' }));
    g.appendChild(svgEl('circle', { r: r + 3.2, class: 'marker-status' }));
    if (!m.point.illustrative) g.appendChild(svgEl('circle', { r: 1.6, class: 'marker-dot' }));
    const lab = svgEl('text', { y: r + 14, class: 'marker-label', 'text-anchor': 'middle' });
    lab.textContent = m.kind;
    g.appendChild(lab);
    const open = () => openDrawer(m.inc);
    g.addEventListener('click', open);
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        open();
      }
    });
    const show = () => {
      tooltip.textContent = tooltipText(ds, m);
      tooltip.hidden = false;
      tooltip.style.left = `${(xy[0] / W) * 100}%`;
      tooltip.style.top = `${(xy[1] / H) * 100}%`;
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    g.addEventListener('mouseenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('mouseleave', hide);
    g.addEventListener('blur', hide);
    gMarkers.appendChild(g);
    marks.push({ m, g, xy: [xy[0], xy[1]] });
  }

  // ---- replay ---------------------------------------------------------------
  const replay = createReplay(
    bounds,
    t,
    (next, _playing, final) => {
      t = next;
      render();
      if (final) sync();
    },
    reduced,
  );
  stage.appendChild(replay.el);

  // ---- drawer ---------------------------------------------------------------
  const drawer = h('aside', { class: 'drawer', hidden: true, 'aria-label': 'Incident detail' });
  stage.appendChild(drawer);
  function openDrawer(inc: Incident): void {
    openId = inc.id;
    drawer.replaceChildren(incidentDrawer(ds, inc, closeDrawer));
    drawer.hidden = false;
    paintActive();
    sync();
    (drawer.querySelector('.drawer-inner') as HTMLElement | null)?.focus({ preventScroll: true });
  }
  function closeDrawer(): void {
    drawer.hidden = true;
    drawer.replaceChildren();
    openId = null;
    paintActive();
    sync();
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && !drawer.hidden) closeDrawer();
  };
  root.addEventListener('keydown', onKey);
  function paintActive(): void {
    for (const { m, g } of marks) g.classList.toggle('active', m.inc.id === openId);
    for (const r of logRows) r.el.classList.toggle('active', r.inc.id === openId);
  }

  // ---- field log ------------------------------------------------------------
  const logCount = h('span', { class: 'field-log-count mono' });
  logBox.appendChild(h('div', { class: 'field-log-head' }, h('h2', null, 'Field log'), logCount));
  const logList = h('ol', { class: 'field-log-list' });
  logBox.appendChild(logList);
  const logRows: Array<{ inc: Incident; el: HTMLButtonElement }> = [];
  for (const inc of ds.incidents) {
    const btn = h(
      'button',
      { type: 'button', class: 'log-row', dataset: { id: inc.id }, onClick: () => openDrawer(inc) },
      h('span', { class: 'log-date mono' }, inc.date_disclosed.slice(0, 7)),
      h('span', { class: 'log-name' }, inc.name),
      h(
        'span',
        { class: 'log-grades' },
        h('span', { class: 'log-grade', title: describe(tax, 'ai_role', inc.ai_role) }, h('span', { class: `log-dot role-${inc.ai_role}`, 'aria-hidden': 'true' }), `AI ${label(tax, 'ai_role', inc.ai_role).toLowerCase()}`),
        h('span', { class: 'log-grade', title: describe(tax, 'status', inc.status) }, label(tax, 'status', inc.status)),
        h('span', { class: 'log-grade' }, label(tax, 'severity', inc.severity)),
        h('span', { class: `log-where${withGeoIds.has(inc.id) ? '' : ' off'}` }, withGeoIds.has(inc.id) ? 'on map' : 'no geo'),
        recordStatusTag(tax, inc),
      ),
    ) as HTMLButtonElement;
    logList.appendChild(h('li', null, btn));
    logRows.push({ inc, el: btn });
  }

  // ---- legend ---------------------------------------------------------------
  root.appendChild(legend(illustrativeCount, allMarkers.length));
  root.appendChild(
    h(
      'p',
      { class: 'note' },
      `${illustrativeCount} of ${allMarkers.length} points in the dataset are country-level centroids and render as soft discs; ${allMarkers.length - illustrativeCount} ${allMarkers.length - illustrativeCount === 1 ? 'is' : 'are'} a stated location and render${allMarkers.length - illustrativeCount === 1 ? 's' : ''} as a pin. Adding a location to a record requires a source that states it; propose it via a data-correction issue from the record page.`,
    ),
  );

  // ---- what changed ---------------------------------------------------------
  root.appendChild(h('h2', { class: 'changes-title' }, 'What changed'));
  root.appendChild(whatChanged(ds));

  // ---- render ---------------------------------------------------------------
  let lastShown: Set<string> | null = null;
  function visible(inc: Incident): boolean {
    return matches(inc, state) && dateMs(inc.date_disclosed) <= t;
  }
  function render(): void {
    const shown = new Set(applyFilters(ds.incidents, state).filter((i) => dateMs(i.date_disclosed) <= t).map((i) => i.id));
    let latest: Incident | null = null;
    for (const inc of ds.incidents) if (shown.has(inc.id) && (!latest || inc.date_disclosed > latest.date_disclosed)) latest = inc;
    const firstPaint = lastShown === null;
    for (const { m, g } of marks) {
      const inc = m.inc;
      g.classList.toggle('future', dateMs(inc.date_disclosed) > t);
      g.classList.toggle('filtered', !matches(inc, state));
      const isNew = shown.has(inc.id) && (firstPaint ? latest?.id === inc.id : !lastShown!.has(inc.id));
      if (isNew && !reduced) {
        g.classList.remove('just');
        void g.getBoundingClientRect();
        g.classList.add('just');
        window.setTimeout(() => g.classList.remove('just'), 1700);
      }
    }
    for (const a of arcs) a.el.classList.toggle('hidden', !shown.has(a.inc.id));
    for (const r of logRows) {
      r.el.classList.toggle('future', dateMs(r.inc.date_disclosed) > t);
      r.el.classList.toggle('filtered', !matches(r.inc, state));
    }
    count.textContent = String(shown.size);
    caption.replaceChildren(
      document.createTextNode(`${shown.size === 1 ? 'incident' : 'incidents'} disclosed by ${formatT(t)}`),
      ...(latest ? [h('br'), h('strong', null, 'Latest: ', latest.name)] : []),
    );
    logCount.textContent = `${shown.size} of ${ds.incidents.length} shown`;
    lastShown = shown;
  }
  render();
  void visible;

  if (openId && ds.byId.has(openId)) openDrawer(ds.byId.get(openId)!);
  else openId = null;
}

function tooltipText(ds: Dataset, m: Marker): string {
  const kind = m.kind === 'target' ? 'Target' : 'Origin';
  const how = m.point.illustrative ? 'illustrative, country-level centroid' : 'stated location';
  return `${m.inc.name}\n${kind}: ${m.point.label} (${how})\n${label(ds.taxonomy, 'status', m.inc.status)} · AI ${label(ds.taxonomy, 'ai_role', m.inc.ai_role).toLowerCase()} · ${label(ds.taxonomy, 'severity', m.inc.severity).toLowerCase()} · ${m.inc.sources.length} source${m.inc.sources.length === 1 ? '' : 's'}`;
}

function legend(illustrative: number, total: number): HTMLElement {
  const item = (svgInner: SVGElement[], title: string, note: string) => {
    const s = svgEl('svg', { viewBox: '0 0 44 32', 'aria-hidden': 'true', class: 'legend-svg' });
    for (const c of svgInner) s.appendChild(c);
    return h('div', { class: 'legend-item', role: 'listitem' }, s, h('div', null, h('b', null, title), h('span', null, note)));
  };
  const c = (attrs: Record<string, string | number>) => svgEl('circle', attrs);
  return h(
    'div',
    { class: 'legend map-legend', role: 'list', 'aria-label': 'Map legend' },
    item([c({ cx: 22, cy: 16, r: 14, fill: 'url(#halo-significant)' }), c({ cx: 22, cy: 16, r: 5, class: 'lg-core role-significant' })], 'Soft disc', `Illustrative: a country-level centroid, not a real coordinate. Disc size is fixed and means nothing. ${illustrative} of ${total} points.`),
    item([c({ cx: 22, cy: 16, r: 6, class: 'lg-core lg-pin role-significant' }), c({ cx: 22, cy: 16, r: 1.6, class: 'lg-dot' })], 'Pin', `A location a source states. ${total - illustrative === 0 ? 'None in the dataset yet; the style waits for the first.' : `${total - illustrative} in the dataset.`}`),
    item([c({ cx: 8, cy: 16, r: 5, class: 'lg-core role-incidental' }), c({ cx: 22, cy: 16, r: 5, class: 'lg-core role-significant' }), c({ cx: 36, cy: 16, r: 5, class: 'lg-core role-load-bearing' })], 'Colour: AI role', 'Incidental → significant → load-bearing. Disputed and unknown are grey.'),
    item([c({ cx: 8, cy: 16, r: 5, class: 'lg-ring status-confirmed' }), c({ cx: 22, cy: 16, r: 5, class: 'lg-ring status-reported' }), c({ cx: 36, cy: 16, r: 5, class: 'lg-ring status-test-eval' })], 'Ring: evidence', 'Solid confirmed, dashed reported, dotted test / evaluation.'),
    item([c({ cx: 7, cy: 16, r: 3, class: 'lg-size' }), c({ cx: 18, cy: 16, r: 4, class: 'lg-size' }), c({ cx: 31, cy: 16, r: 5.5, class: 'lg-size' })], 'Size: severity', 'Low, medium, high, critical.'),
    item([svgEl('path', { d: 'M4 24 C 14 4, 30 4, 40 8', class: 'lg-arc' })], 'Arc', 'Origin to target, drawn only when the record states both. The dash travels toward the target.'),
  );
}
