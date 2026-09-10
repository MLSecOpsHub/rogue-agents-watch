// World map: the shared canvas (src/components/map-canvas.ts) plus filter
// chips, a replay scrubber, the field log, and an in-place drawer. Encoding
// per docs/design/map-ux-research.md. Records without geo appear in the field
// log, never as a pin.
import { recordStatusTag } from '../components/badges';
import { whatChanged } from '../components/changes';
import { incidentDrawer } from '../components/drawer';
import { attachTooltip, collectMarkers, createMapCanvas } from '../components/map-canvas';
import { createReplay, dateMs, formatT, parseT, replayBounds } from '../components/replay';
import { describe, label, values } from '../data/taxonomy';
import type { Incident } from '../data/types';
import { applyFilters, fieldValues, fromQuery, matches, toQuery, toggleValue, type FilterField, type FilterState } from '../filters';
import { replaceQuery } from '../router';
import { h, svgEl } from '../util/dom';
import type { ViewContext } from './types';

export { collectMarkers } from '../components/map-canvas';

const MAP_FILTERS: FilterField[] = ['ai_role', 'status'];

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
  const canvas = createMapCanvas(ds, {
    ariaLabel: 'World map of incidents with stated coordinates, replayed by disclosure date',
    onSelect: (inc) => openDrawer(inc),
    onHover: attachTooltip(ds, stage),
  });
  stage.insertBefore(canvas.svg, stage.firstChild);
  const status = h('p', { class: 'map-status', 'aria-live': 'polite' }, 'Loading map geometry…');
  stage.appendChild(status);
  if (await canvas.loadGeometry()) status.remove();
  else status.textContent = 'Map geometry could not be loaded; markers and the field log still work.';

  // HUD: hero count + caption
  const count = h('div', { class: 'hud-count num' }, '0');
  const caption = h('div', { class: 'hud-caption' });
  stage.appendChild(h('div', { class: 'map-hud', 'aria-live': 'polite' }, count, caption));

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
    canvas.setActive(openId);
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
  function render(): void {
    const shown = new Set(applyFilters(ds.incidents, state).filter((i) => dateMs(i.date_disclosed) <= t).map((i) => i.id));
    let latest: Incident | null = null;
    for (const inc of ds.incidents) if (shown.has(inc.id) && (!latest || inc.date_disclosed > latest.date_disclosed)) latest = inc;
    const pulse = lastShown === null ? new Set(latest ? [latest.id] : []) : new Set([...shown].filter((id) => !lastShown!.has(id)));
    canvas.paint(shown, { future: (inc) => dateMs(inc.date_disclosed) > t, filtered: (inc) => !matches(inc, state), pulse, reduced });
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

  if (openId && ds.byId.has(openId)) openDrawer(ds.byId.get(openId)!);
  else openId = null;
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
