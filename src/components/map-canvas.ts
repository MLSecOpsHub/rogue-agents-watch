// Shared map drawing for the map view and the overview teaser: sphere,
// graticule, lazily loaded Natural Earth land, origin→target arcs, and markers
// encoded per docs/design/map-ux-research.md (hue = ai_role, ring = status,
// size = severity, soft disc = illustrative centroid, pin = stated location).
// Markers come ONLY from each record's `geo` block.
import { geoNaturalEarth1, geoPath, geoGraticule10, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { countryFlagLabel } from '../data/links';
import { label } from '../data/taxonomy';
import type { Dataset, GeoPoint, GeoRole, Incident } from '../data/types';
import { incidentHref } from '../router';
import { h, svgEl } from '../util/dom';
import { badge } from './badges';

export interface Marker {
  inc: Incident;
  kind: GeoRole;
  point: GeoPoint;
}

/** One marker per stated point, targets first so origins draw on top of them. */
export function collectMarkers(incidents: Incident[], includeInactive: boolean): Marker[] {
  const out: Marker[] = [];
  for (const inc of incidents) {
    if (!inc.geo) continue;
    if (!includeInactive && !inc.isActiveRecord) continue;
    for (const kind of ['target', 'origin'] as const) {
      for (const point of inc.geo.points) if (point.role === kind) out.push({ inc, kind, point });
    }
  }
  return out;
}

/**
 * The place a point stands for, as a short name: the country from its ISO
 * code, else the upstream label without its trailing "(basis, per X)" note.
 * The basis and attributor are shown separately where they belong (drawer,
 * record page), never twice.
 */
export function placeName(p: GeoPoint): string {
  return p.country ? countryFlagLabel(p.country) : p.label.replace(/\s*\([^()]*\)\s*$/, '');
}

/** "sponsor attribution, per Anthropic" — the basis a point rests on, as the record states it. */
export function basisText(ds: Dataset, p: GeoPoint): string {
  const basis = p.basis ? label(ds.taxonomy, 'geo_basis', p.basis).toLowerCase() : 'basis not stated';
  return p.attributed_by ? `${basis}, per ${p.attributed_by}` : basis;
}

export const MAP_W = 960;
export const MAP_H = 500;
const SEVERITY_R: Record<string, number> = { critical: 7.5, high: 6, medium: 4.8, low: 4 };
const ROLES = ['load-bearing', 'significant', 'incidental', 'disputed', 'unknown'];

export interface MapMark {
  m: Marker;
  g: SVGGElement;
  xy: [number, number];
}

export interface PaintOptions {
  future?: (inc: Incident) => boolean;
  filtered?: (inc: Incident) => boolean;
  /** Ids whose markers should pulse on this paint. */
  pulse?: Set<string>;
  reduced?: boolean;
}

export interface MapCanvas {
  svg: SVGSVGElement;
  projection: GeoProjection;
  marks: MapMark[];
  arcs: Array<{ inc: Incident; el: SVGPathElement }>;
  /** Lazily imports the vendored topojson and draws land. Resolves false if it failed. */
  loadGeometry(): Promise<boolean>;
  /** Show exactly the ids in `shown`; arcs follow their record. */
  paint(shown: Set<string>, opts?: PaintOptions): void;
  setActive(id: string | null): void;
}

export interface CanvasOptions {
  incidents?: Incident[];
  onSelect?: (inc: Incident, m: Marker) => void;
  onHover?: (m: Marker | null, xy: [number, number]) => void;
  ariaLabel?: string;
}

export function tooltipText(ds: Dataset, m: Marker): string {
  const kind = m.kind === 'target' ? 'Target' : 'Origin';
  const how = m.point.illustrative ? 'illustrative, country-level centroid' : 'stated location';
  const n = m.inc.sources.length;
  return `${m.inc.name}\n${kind}: ${m.point.label} (${how})\n${basisText(ds, m.point)}\n${label(ds.taxonomy, 'status', m.inc.status)} · AI ${label(ds.taxonomy, 'ai_role', m.inc.ai_role).toLowerCase()} · ${label(ds.taxonomy, 'severity', m.inc.severity).toLowerCase()} · ${n} source${n === 1 ? '' : 's'}`;
}

/**
 * Where to hang the tooltip so it stays inside the stage, which clips
 * overflow: below the marker in the top third, and anchored to the near edge
 * in the outer quarters. Pure, so the smoke test can pin it.
 */
export function tooltipPlacement(xy: [number, number]): { below: boolean; edge: 'left' | 'right' | null } {
  return { below: xy[1] < MAP_H / 3, edge: xy[0] < MAP_W / 4 ? 'left' : xy[0] > (MAP_W * 3) / 4 ? 'right' : null };
}

/**
 * A hover card positioned inside `stage`, linking to the record: name, the
 * role and place, the three grades, source count. The full basis text stays
 * in the marker's <desc> for assistive tech and on the record page. Returns
 * the hover handler to pass as `onHover`. The card stays open for a moment
 * after the pointer leaves the marker so it can be moved onto and clicked.
 */
export function attachTooltip(ds: Dataset, stage: HTMLElement): (m: Marker | null, xy: [number, number]) => void {
  const tip = h('a', { class: 'tooltip', hidden: true, tabindex: -1 }) as HTMLAnchorElement;
  stage.appendChild(tip);
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  const cancelHide = () => {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
  };
  const hide = () => {
    cancelHide();
    tip.hidden = true;
  };
  tip.addEventListener('mouseenter', cancelHide);
  tip.addEventListener('mouseleave', hide);
  return (m, xy) => {
    if (!m) {
      cancelHide();
      hideTimer = setTimeout(hide, 180);
      return;
    }
    cancelHide();
    const place = tooltipPlacement(xy);
    const tax = ds.taxonomy;
    const n = m.inc.sources.length;
    tip.href = incidentHref(m.inc.id);
    tip.replaceChildren(
      h('span', { class: 'tip-name' }, m.inc.name),
      h('span', { class: 'tip-place' }, h('span', { class: `tip-role tip-role-${m.kind}` }, m.kind === 'target' ? 'Target' : 'Origin'), ' ', placeName(m.point)),
      h(
        'span',
        { class: 'tip-grades' },
        badge(tax, 'status', m.inc.status, { compact: true }),
        badge(tax, 'ai_role', m.inc.ai_role, { compact: true, prefix: 'AI role' }),
        badge(tax, 'severity', m.inc.severity, { compact: true }),
      ),
      h('span', { class: 'tip-meta' }, `${n} source${n === 1 ? '' : 's'}`, h('span', { class: 'tip-cta' }, 'Open record →')),
    );
    tip.className = `tooltip${place.below ? ' below' : ''}${place.edge ? ` edge-${place.edge}` : ''}`;
    tip.hidden = false;
    tip.style.left = `${(xy[0] / MAP_W) * 100}%`;
    tip.style.top = `${(xy[1] / MAP_H) * 100}%`;
  };
}

export function createMapCanvas(ds: Dataset, opts: CanvasOptions = {}): MapCanvas {
  const incidents = opts.incidents ?? ds.incidents;
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [MAP_W - 6, MAP_H - 6]], { type: 'Sphere' });
  const path = geoPath(projection);
  // role=group (not img): an image role would hide the focusable markers inside from assistive tech.
  const svg = svgEl('svg', { viewBox: `0 0 ${MAP_W} ${MAP_H}`, class: 'map', role: 'group', 'aria-label': opts.ariaLabel ?? 'World map of incidents with stated coordinates' });
  const defs = svgEl('defs');
  for (const role of ROLES) {
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

  const arcs: Array<{ inc: Incident; el: SVGPathElement }> = [];
  // One arc per stated origin-target pair; a record with several origins fans out.
  for (const inc of incidents) {
    if (!inc.geo) continue;
    const origins = inc.geo.points.filter((p) => p.role === 'origin');
    const targets = inc.geo.points.filter((p) => p.role === 'target');
    for (const o of origins) {
      for (const t of targets) {
        const line = { type: 'LineString' as const, coordinates: [[o.lng, o.lat], [t.lng, t.lat]] };
        const countryLevel = o.illustrative || t.illustrative;
        const el = svgEl('path', { d: path(line) ?? '', class: `map-arc${countryLevel ? ' illustrative' : ''}` });
        const title = svgEl('title');
        title.textContent = `${inc.name}: ${o.label} to ${t.label}${countryLevel ? ', country-level' : ''}`;
        el.appendChild(title);
        gArcs.appendChild(el);
        arcs.push({ inc, el });
      }
    }
  }

  const marks: MapMark[] = [];
  for (const m of collectMarkers(incidents, true)) {
    const p = projection([m.point.lng, m.point.lat]);
    if (!p) continue;
    const xy: [number, number] = [p[0], p[1]];
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
    // <desc>, not <title>: the marker's accessible name is its aria-label and
    // its hover text is the positioned .tooltip; an SVG <title> would add the
    // browser's native tooltip on top of it.
    const desc = svgEl('desc');
    desc.textContent = tooltipText(ds, m);
    g.appendChild(desc);
    if (m.point.illustrative) g.appendChild(svgEl('circle', { r: 30, class: 'marker-halo', fill: `url(#halo-${m.inc.ai_role})` }));
    g.appendChild(svgEl('circle', { r: r + 6, class: 'marker-pulse' }));
    g.appendChild(svgEl('circle', { r, class: m.point.illustrative ? 'marker-core' : 'marker-core marker-pin' }));
    g.appendChild(svgEl('circle', { r: r + 3.2, class: 'marker-status' }));
    if (!m.point.illustrative) g.appendChild(svgEl('circle', { r: 1.6, class: 'marker-dot' }));
    const lab = svgEl('text', { y: r + 14, class: 'marker-label', 'text-anchor': 'middle' });
    lab.textContent = m.kind;
    g.appendChild(lab);
    const select = () => opts.onSelect?.(m.inc, m);
    g.addEventListener('click', select);
    g.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
        e.preventDefault();
        select();
      }
    });
    const over = () => opts.onHover?.(m, xy);
    const out = () => opts.onHover?.(null, xy);
    g.addEventListener('mouseenter', over);
    g.addEventListener('focus', over);
    g.addEventListener('mouseleave', out);
    g.addEventListener('blur', out);
    gMarkers.appendChild(g);
    marks.push({ m, g, xy });
  }

  let geometryLoaded = false;
  return {
    svg,
    projection,
    marks,
    arcs,
    async loadGeometry() {
      if (geometryLoaded) return true;
      try {
        const topo = (await import('../../data/geo/countries-110m.json')).default as unknown as Topology<{ countries: GeometryCollection }>;
        const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;
        for (const f of countries.features) gLand.appendChild(svgEl('path', { d: path(f) ?? '', class: 'map-country' }));
        geometryLoaded = true;
        return true;
      } catch {
        return false;
      }
    },
    paint(shown, o = {}) {
      for (const { m, g } of marks) {
        const inc = m.inc;
        g.classList.toggle('future', o.future ? o.future(inc) : !shown.has(inc.id));
        g.classList.toggle('filtered', o.filtered ? o.filtered(inc) : false);
        if (o.pulse?.has(inc.id) && !o.reduced) {
          g.classList.remove('just');
          void g.getBoundingClientRect();
          g.classList.add('just');
          window.setTimeout(() => g.classList.remove('just'), 1700);
        }
      }
      for (const a of arcs) a.el.classList.toggle('hidden', !shown.has(a.inc.id));
    },
    setActive(id) {
      for (const { m, g } of marks) g.classList.toggle('active', m.inc.id === id);
    },
  };
}
