// Shared map drawing for the map view and the overview teaser: sphere,
// graticule, lazily loaded Natural Earth land, origin→target arcs, and markers
// encoded per docs/design/map-ux-research.md (hue = ai_role, ring = status,
// size = severity, soft disc = illustrative centroid, pin = stated location).
// Markers come ONLY from each record's `geo` block.
import { geoNaturalEarth1, geoPath, geoGraticule10, type GeoProjection } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { label } from '../data/taxonomy';
import type { Dataset, GeoPoint, Incident } from '../data/types';
import { h, svgEl } from '../util/dom';

export interface Marker {
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
  return `${m.inc.name}\n${kind}: ${m.point.label} (${how})\n${label(ds.taxonomy, 'status', m.inc.status)} · AI ${label(ds.taxonomy, 'ai_role', m.inc.ai_role).toLowerCase()} · ${label(ds.taxonomy, 'severity', m.inc.severity).toLowerCase()} · ${n} source${n === 1 ? '' : 's'}`;
}

/** A tooltip element positioned inside `stage`; returns the hover handler to pass as `onHover`. */
export function attachTooltip(ds: Dataset, stage: HTMLElement): (m: Marker | null, xy: [number, number]) => void {
  const tip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
  stage.appendChild(tip);
  return (m, xy) => {
    if (!m) {
      tip.hidden = true;
      return;
    }
    tip.textContent = tooltipText(ds, m);
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
  for (const inc of incidents) {
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
