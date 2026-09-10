// Build smoke test against the REAL vendored snapshot: every id in
// summary.json.ids must produce a detail route and render a detail page; the
// map must render exactly the records that carry geo; the honesty grades must
// appear on every card, row, and page.
import { beforeEach, describe, expect, it } from 'vitest';
import { buildDataset } from '../src/data/adapter';
import { loadDataset } from '../src/data/load';
import { correctionIssueUrl } from '../src/config';
import { atlasUrl, attackUrl } from '../src/data/links';
import { applyFilters, fromQuery } from '../src/filters';
import { incidentHref, parseRoute } from '../src/router';
import { collectMarkers, mapView } from '../src/views/map';
import { incidentView } from '../src/views/incident';
import { overviewView } from '../src/views/overview';
import { statsView } from '../src/views/stats';
import { tableView } from '../src/views/table';
import { timelineView } from '../src/views/timeline';
import { aboutView } from '../src/views/about';
import { rollups } from '../src/views/shared';
import summary from '../data/snapshot/summary.json';
import type { ViewContext } from '../src/views/types';
import { rawRecord, snapshot, summaryFor, taxonomy } from './fixtures';

const ds = loadDataset();
const GRADES = ['status', 'confidence', 'ai_role'] as const;

function ctx(hash: string): ViewContext {
  const root = document.createElement('main');
  document.body.appendChild(root);
  return { ds, route: parseRoute(hash), root };
}

function gradesOn(el: Element): Record<(typeof GRADES)[number], string | undefined> {
  return Object.fromEntries(GRADES.map((g) => [g, el.querySelector<HTMLElement>(`.badge-${g}`)?.dataset.value])) as never;
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.location.hash = '';
});

describe('every id in summary.ids', () => {
  it('produces an incident route carrying the id unchanged', () => {
    for (const id of summary.ids) {
      expect(parseRoute(incidentHref(id))).toMatchObject({ view: 'incident', id });
      expect(ds.byId.has(id), id).toBe(true);
    }
  });

  it.each(summary.ids)('%s renders a detail page with grades, sources, citation and correction link', (id) => {
    const inc = ds.byId.get(id)!;
    const c = ctx(incidentHref(id));
    incidentView(c);
    const root = c.root;
    expect(root.querySelector('h1')?.textContent).toBe(inc.name);
    expect(document.title).toContain(inc.name);

    // Honesty grades, shown as badges with the upstream definition as tooltip.
    const grades = gradesOn(root);
    expect(grades).toEqual({ status: inc.status, confidence: inc.confidence, ai_role: inc.ai_role });
    for (const g of GRADES) expect(root.querySelector<HTMLElement>(`.badge-${g}`)?.title, `${id} ${g} tooltip`).toMatch(/ — .+/);

    // Actor verbatim.
    expect(root.textContent).toContain(inc.actor);

    // Every source with its live URL and archive link when present.
    const sourceItems = root.querySelectorAll('ol.sources > li');
    expect(sourceItems).toHaveLength(inc.sources.length);
    inc.sources.forEach((s, i) => {
      const li = sourceItems[i]!;
      expect(li.querySelector(`a[href="${s.url}"]`), `${id} source ${i} url`).not.toBeNull();
      if (s.archive_url) expect(li.querySelector(`a[href="${s.archive_url}"]`), `${id} source ${i} archive`).not.toBeNull();
      else expect(li.textContent).toContain('no archive recorded');
    });

    // Null numbers render as "not stated", never 0.
    if (inc.autonomy_pct === null) expect(root.textContent).toContain('not stated');
    expect(root.textContent).not.toMatch(/Autonomy \(source-stated %\)\s*0%/);

    // Related records resolve to cards.
    expect(root.querySelectorAll('.card')).toHaveLength(inc.related.length);

    // Citation carries dataset version, id, and upstream permalink.
    const cite = root.querySelector('pre.cite')?.textContent ?? '';
    expect(cite).toContain(`v${ds.summary.dataset_version}`);
    expect(cite).toContain(`"${id}"`);
    expect(cite).toContain(`/dist/incidents/${id}.json`);

    // Correction link opens the upstream template pre-filled with the id.
    const correction = root.querySelector<HTMLAnchorElement>(`a[href="${correctionIssueUrl(id)}"]`);
    expect(correction).not.toBeNull();
    expect(correction!.href).toContain('template=data-correction.yml');
    expect(correction!.href).toContain(`incident-id=${encodeURIComponent(id)}`);

    // Record-status banner only when not active.
    expect(root.querySelector('.record-banner') !== null).toBe(inc.record_status !== 'active');

    // Mappings link to official pages, ids verbatim.
    for (const t of inc.mappings.mitre_attack) expect(root.querySelector(`a[href="${attackUrl(t)}"]`)?.textContent, t).toBe(t);
    for (const t of inc.mappings.mitre_atlas) expect(root.querySelector(`a[href="${atlasUrl(t)}"]`)?.textContent, t).toBe(t);
    for (const cve of inc.mappings.cve) expect(root.querySelector(`a[href="https://nvd.nist.gov/vuln/detail/${cve}"]`), cve).not.toBeNull();
  });

  it('renders a not-found page for an unknown id without throwing', () => {
    const c = ctx('#/incident/this-id-does-not-exist');
    incidentView(c);
    expect(c.root.querySelector('h1')?.textContent).toBe('Record not found');
    expect(c.root.textContent).toContain('this-id-does-not-exist');
  });
});

describe('map', () => {
  it('collects markers only from records with geo, preserving the illustrative flag', () => {
    const markers = collectMarkers(ds.incidents, false);
    const expected = ds.incidents.filter((i) => i.isActiveRecord && i.hasGeo);
    expect(new Set(markers.map((m) => m.inc.id))).toEqual(new Set(expected.map((i) => i.id)));
    const expectedCount = expected.reduce((n, i) => n + (i.geo?.target ? 1 : 0) + (i.geo?.origin ? 1 : 0), 0);
    expect(markers).toHaveLength(expectedCount);
    for (const m of markers) expect(m.point.illustrative).toBe(m.inc.geo?.[m.kind]?.illustrative);
  });

  it('renders exactly the geo records, styles illustrative points distinctly, and lists the rest', async () => {
    const c = ctx('#/map');
    await mapView(c);
    const markers = collectMarkers(ds.incidents, false);
    const drawn = c.root.querySelectorAll('g.marker');
    expect(drawn).toHaveLength(markers.length);
    expect(c.root.querySelectorAll('g.marker.illustrative')).toHaveLength(markers.filter((m) => m.point.illustrative).length);
    expect(c.root.querySelectorAll('g.marker.stated')).toHaveLength(markers.filter((m) => !m.point.illustrative).length);
    for (const g of drawn) {
      const title = g.querySelector('title')?.textContent ?? '';
      if (g.classList.contains('illustrative')) {
        expect(title).toContain('illustrative, country-level');
        expect(g.querySelector('.marker-ring')).not.toBeNull();
      } else {
        expect(title).toContain('stated location');
        expect(g.querySelector('.marker-pin')).not.toBeNull();
      }
    }
    // Country outlines came from the vendored topojson.
    expect(c.root.querySelectorAll('path.map-country').length).toBeGreaterThan(100);
    // Records without geo are named as not on the map, never plotted.
    const withoutGeo = ds.incidents.filter((i) => i.isActiveRecord && !i.hasGeo);
    expect(c.root.textContent).toContain(`${withoutGeo.length} record${withoutGeo.length === 1 ? ' has' : 's have'} no geo block`);
    expect(c.root.querySelectorAll('.plain-list li')).toHaveLength(withoutGeo.length);
    expect(c.root.querySelector('.legend')?.textContent).toContain('illustrative');
  });
});

describe('overview, stats, timeline, table, about', () => {
  it('overview leads with status and AI role side by side and uses summary.json counts', () => {
    const c = ctx('#/');
    overviewView(c);
    const pair = c.root.querySelector('.chart-pair-grid');
    expect(pair?.querySelectorAll('svg.chart-bar')).toHaveLength(2);
    expect(pair?.textContent).toContain('Verification status');
    expect(pair?.textContent).toContain('AI role');
    expect(c.root.querySelector('.stat-value')?.textContent).toBe(String(summary.total));
    for (const card of c.root.querySelectorAll('.card')) {
      const g = gradesOn(card);
      expect(g.status && g.confidence && g.ai_role, 'card grades').toBeTruthy();
    }
  });

  it('stats renders one chart per breakdown from summary.json', () => {
    const c = ctx('#/stats');
    statsView(c);
    const titles = [...c.root.querySelectorAll('.chart-card h3')].map((e) => e.textContent);
    for (const t of ['Verification status', 'AI role', 'Category', 'Model family', 'Autonomy level', 'Year disclosed']) expect(titles).toContain(t);
    const rows = [...c.root.querySelectorAll('.chart-card')].find((s) => s.querySelector('h3')?.textContent === 'Category')!.querySelectorAll('tbody tr');
    const rendered = Object.fromEntries([...rows].map((r) => [r.querySelector('th')?.textContent, Number(r.querySelector('td')?.textContent)]));
    for (const [k, v] of Object.entries(summary.by_category)) {
      const labelText = taxonomy.category?.values.find((x) => x.id === k)?.label ?? k;
      expect(rendered[labelText], k).toBe(v);
    }
  });

  it('timeline renders one marker per visible record and filters from the query', () => {
    const c = ctx('#/timeline');
    timelineView(c);
    expect(c.root.querySelectorAll('.tl-marker')).toHaveLength(ds.incidents.filter((i) => i.isActiveRecord).length);
    const filtered = ctx('#/timeline?status=test-eval');
    timelineView(filtered);
    expect(filtered.root.querySelectorAll('.tl-marker')).toHaveLength(ds.incidents.filter((i) => i.isActiveRecord && i.status === 'test-eval').length);
  });

  it('table renders every visible record with its three grades and honours sort and filter params', () => {
    const c = ctx('#/table');
    tableView(c);
    const rows = c.root.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(ds.incidents.filter((i) => i.isActiveRecord).length);
    for (const r of rows) expect(Object.values(gradesOn(r)).every(Boolean)).toBe(true);
    const sorted = ctx('#/table?sort=name&dir=asc&q=copilot');
    tableView(sorted);
    const names = [...sorted.root.querySelectorAll('tbody th a')].map((a) => a.textContent ?? '');
    expect(names.length).toBeGreaterThan(0);
    expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    const expected = applyFilters(ds.incidents, fromQuery(new URLSearchParams('q=copilot'))).map((i) => i.name).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    expect(names).toEqual(expected);
    expect(sorted.root.querySelector('.downloads')?.textContent).toContain(`CSV (${names.length})`);
  });

  it('about states that the dashboard adds no facts and lists every grade definition', () => {
    const c = ctx('#/about');
    aboutView(c);
    expect(c.root.textContent).toContain('This dashboard adds no facts');
    for (const v of taxonomy.status!.values) expect(c.root.textContent).toContain(v.description);
    expect(c.root.textContent).toContain('illustrative');
    expect(c.root.textContent).toContain('CC BY-SA 4.0');
  });
});

describe('inactive records', () => {
  const raw = [rawRecord({ id: 'keep-one', status: 'confirmed' }), rawRecord({ id: 'gone-two', status: 'confirmed', record_status: 'retracted' })];
  const synthetic = buildDataset(raw, { ...summaryFor(raw), by_status: { confirmed: 2 } }, snapshot, taxonomy);

  it('are excluded from headline rollups by default and included with the toggle', () => {
    expect(rollups(synthetic, false)).toMatchObject({ recomputed: true, hidden: 1, summary: { total: 1, by_status: { confirmed: 1 } } });
    expect(rollups(synthetic, true)).toMatchObject({ recomputed: false, hidden: 0, summary: { total: 2 } });
  });

  it('are visibly flagged on cards and detail pages', () => {
    const root = document.createElement('main');
    incidentView({ ds: synthetic, route: parseRoute('#/incident/gone-two'), root });
    expect(root.querySelector('.record-banner-retracted')?.textContent).toContain('retracted');
    const table = document.createElement('main');
    tableView({ ds: synthetic, route: parseRoute('#/table?inactive=1'), root: table });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.querySelector('tr.row-inactive .badge-record_status')?.textContent).toMatch(/retracted/i);
  });
});
