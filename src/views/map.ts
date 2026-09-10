// World map: d3-geo + topojson-client with vendored Natural Earth 110m geometry.
// Markers come ONLY from each record's `geo` block. Illustrative points (country
// centroids) are drawn as hollow dashed rings; stated points as solid pins.
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import { incidentCard } from '../components/badges';
import { label } from '../data/taxonomy';
import type { Dataset, GeoPoint, Incident } from '../data/types';
import { incidentHref, navigate } from '../router';
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

export async function mapView({ ds, route, root }: ViewContext): Promise<void> {
  const includeInactive = route.query.get('inactive') === '1';
  const markers = collectMarkers(ds.incidents, includeInactive);
  const withGeo = new Set(markers.map((m) => m.inc.id));
  const considered = includeInactive ? ds.incidents : ds.incidents.filter((i) => i.isActiveRecord);
  const withoutGeo = considered.filter((i) => !withGeo.has(i.id));
  const illustrative = markers.filter((m) => m.point.illustrative).length;

  root.appendChild(h('h1', null, 'Map'));
  root.appendChild(
    h(
      'p',
      { class: 'lede' },
      `${withGeo.size} of ${considered.length} records carry stated coordinates and appear below. `,
      `${withoutGeo.length} record${withoutGeo.length === 1 ? ' has' : 's have'} no geo block in the dataset and ${withoutGeo.length === 1 ? 'is' : 'are'} therefore not on the map. `,
      'Nothing is geocoded here: no marker is derived from country lists or actor names.',
    ),
  );

  const legend = h(
    'div',
    { class: 'legend', role: 'list', 'aria-label': 'Map legend' },
    legendItem('marker target stated', 'Target, stated location'),
    legendItem('marker origin stated', 'Origin, stated location'),
    legendItem('marker target illustrative', 'Target, illustrative (country-level centroid)'),
    legendItem('marker origin illustrative', 'Origin, illustrative (country-level centroid)'),
    h('span', { class: 'legend-note', role: 'listitem' }, `${illustrative} of ${markers.length} markers are illustrative.`),
  );
  root.appendChild(legend);

  const wrap = h('div', { class: 'map-wrap' });
  root.appendChild(wrap);
  const status = h('p', { class: 'map-status', 'aria-live': 'polite' }, 'Loading map geometry…');
  wrap.appendChild(status);

  const width = 960;
  const height = 480;
  const projection = geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });
  const path = geoPath(projection);

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'map', role: 'img', 'aria-label': 'World map of incidents with stated coordinates' });
  const gLand = svgEl('g', { class: 'map-land' });
  const gLines = svgEl('g', { class: 'map-lines' });
  const gMarkers = svgEl('g', { class: 'map-markers' });
  svg.appendChild(svgEl('path', { d: path({ type: 'Sphere' }) ?? '', class: 'map-sphere' }));
  svg.appendChild(svgEl('path', { d: path(geoGraticule10()) ?? '', class: 'map-graticule' }));
  svg.appendChild(gLand);
  svg.appendChild(gLines);
  svg.appendChild(gMarkers);

  try {
    const topo = (await import('../../data/geo/countries-110m.json')).default as unknown as Topology<{ countries: GeometryCollection }>;
    const countries = feature(topo, topo.objects.countries) as FeatureCollection<Geometry>;
    for (const f of countries.features) gLand.appendChild(svgEl('path', { d: path(f) ?? '', class: 'map-country' }));
    status.remove();
  } catch {
    status.textContent = 'Map geometry could not be loaded; markers are still listed below.';
  }

  // Origin→target arcs where both exist.
  for (const inc of considered) {
    if (inc.geo?.origin && inc.geo.target) {
      const line = { type: 'LineString' as const, coordinates: [[inc.geo.origin.lng, inc.geo.origin.lat], [inc.geo.target.lng, inc.geo.target.lat]] };
      gLines.appendChild(svgEl('path', { d: path(line) ?? '', class: `map-arc${inc.geo.origin.illustrative || inc.geo.target.illustrative ? ' illustrative' : ''}` }));
    }
  }

  const tooltip = h('div', { class: 'tooltip', role: 'tooltip', hidden: true });
  wrap.appendChild(tooltip);

  for (const m of markers) {
    const xy = projection([m.point.lng, m.point.lat]);
    if (!xy) continue;
    const [x, y] = xy;
    const g = svgEl('g', {
      class: `marker ${m.kind} ${m.point.illustrative ? 'illustrative' : 'stated'}`,
      transform: `translate(${x.toFixed(2)},${y.toFixed(2)})`,
      tabindex: 0,
      role: 'link',
      'data-id': m.inc.id,
      'data-kind': m.kind,
      'data-illustrative': String(m.point.illustrative),
    });
    const t = svgEl('title');
    t.textContent = tooltipText(ds, m);
    g.appendChild(t);
    if (m.point.illustrative) {
      g.appendChild(svgEl('circle', { r: 14, class: 'marker-ring' }));
      g.appendChild(svgEl('circle', { r: 3, class: 'marker-core' }));
    } else {
      g.appendChild(m.kind === 'target' ? svgEl('circle', { r: 6, class: 'marker-pin' }) : svgEl('rect', { x: -5, y: -5, width: 10, height: 10, transform: 'rotate(45)', class: 'marker-pin' }));
    }
    const open = () => navigate(incidentHref(m.inc.id));
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
      tooltip.style.left = `${(x / width) * 100}%`;
      tooltip.style.top = `${(y / height) * 100}%`;
    };
    const hide = () => {
      tooltip.hidden = true;
    };
    g.addEventListener('mouseenter', show);
    g.addEventListener('focus', show);
    g.addEventListener('mouseleave', hide);
    g.addEventListener('blur', hide);
    gMarkers.appendChild(g);
  }
  wrap.appendChild(svg);

  const listed = considered.filter((i) => withGeo.has(i.id));
  root.appendChild(
    h(
      'section',
      null,
      h('h2', null, `On the map (${listed.length})`),
      h('ul', { class: 'geo-list' }, ...listed.map((inc) => h('li', null, geoLine(inc)))),
      h('div', { class: 'card-grid' }, ...listed.map((i) => incidentCard(ds.taxonomy, i))),
    ),
  );
  root.appendChild(
    h(
      'section',
      null,
      h('h2', null, `Not on the map (${withoutGeo.length})`),
      h('p', { class: 'note' }, 'These records have no geo block upstream. Adding one requires a source that states a location; propose it via a data-correction issue on the record page.'),
      h('ul', { class: 'plain-list' }, ...withoutGeo.map((i) => h('li', null, h('a', { href: incidentHref(i.id) }, i.name)))),
    ),
  );
}

function legendItem(cls: string, text: string): HTMLElement {
  return h('span', { class: 'legend-item', role: 'listitem' }, h('span', { class: `legend-swatch ${cls}`, 'aria-hidden': 'true' }), text);
}

function tooltipText(ds: Dataset, m: Marker): string {
  const kind = m.kind === 'target' ? 'Target' : 'Origin';
  const how = m.point.illustrative ? 'illustrative, country-level centroid' : 'stated location';
  return `${m.inc.name}\n${kind}: ${m.point.label} (${how})\nStatus: ${label(ds.taxonomy, 'status', m.inc.status)} · AI role: ${label(ds.taxonomy, 'ai_role', m.inc.ai_role)}`;
}

function geoLine(inc: Incident): HTMLElement[] {
  const parts: HTMLElement[] = [h('a', { href: incidentHref(inc.id) }, inc.name), h('span', null, ' — ')];
  const pts: string[] = [];
  if (inc.geo?.target) pts.push(`target ${inc.geo.target.label}${inc.geo.target.illustrative ? ' (illustrative)' : ''}`);
  if (inc.geo?.origin) pts.push(`origin ${inc.geo.origin.label}${inc.geo.origin.illustrative ? ' (illustrative)' : ''}`);
  parts.push(h('span', { class: 'muted' }, pts.join('; ')));
  return parts;
}
