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
import { techniquesView } from '../src/views/techniques';
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
    const expectedCount = expected.reduce((n, i) => n + (i.geo?.points.length ?? 0), 0);
    expect(markers).toHaveLength(expectedCount);
    for (const m of markers) {
      expect(m.kind).toBe(m.point.role);
      expect(m.inc.geo?.points).toContain(m.point);
    }
  });

  it('renders exactly the geo records, styles illustrative points distinctly, and logs the rest', async () => {
    const c = ctx('#/map');
    await mapView(c);
    const markers = collectMarkers(ds.incidents, false);
    const drawn = c.root.querySelectorAll('g.marker');
    expect(drawn).toHaveLength(collectMarkers(ds.incidents, true).length);
    expect(c.root.querySelectorAll('g.marker.illustrative')).toHaveLength(markers.filter((m) => m.point.illustrative).length);
    expect(c.root.querySelectorAll('g.marker.stated')).toHaveLength(markers.filter((m) => !m.point.illustrative).length);
    for (const g of drawn) {
      const title = g.querySelector('title')?.textContent ?? '';
      const inc = ds.byId.get((g as SVGGElement).dataset.id ?? '')!;
      // hue = ai_role, ring = status, size = severity: encoded as classes the CSS tokens key on
      expect(g.classList.contains(`role-${inc.ai_role}`)).toBe(true);
      expect(g.classList.contains(`status-${inc.status}`)).toBe(true);
      expect(g.querySelector('.marker-status')).not.toBeNull();
      if (g.classList.contains('illustrative')) {
        expect(title).toContain('illustrative, country-level');
        expect(g.querySelector('.marker-halo')).not.toBeNull();
        expect(g.querySelector('.marker-pin')).toBeNull();
      } else {
        expect(title).toContain('stated location');
        expect(g.querySelector('.marker-pin')).not.toBeNull();
      }
      expect(g.querySelector('.marker-label')?.textContent).toMatch(/^(origin|target)$/);
    }
    // Country outlines came from the vendored topojson.
    expect(c.root.querySelectorAll('path.map-country').length).toBeGreaterThan(100);
    // Records without geo are named in the field log, never plotted.
    const withoutGeo = ds.incidents.filter((i) => i.isActiveRecord && !i.hasGeo);
    expect(c.root.textContent).toContain(`${withoutGeo.length} record${withoutGeo.length === 1 ? ' has' : 's have'} no geo block`);
    expect(c.root.querySelectorAll('.log-row')).toHaveLength(ds.incidents.length);
    expect(c.root.querySelectorAll('.log-row .log-where.off')).toHaveLength(ds.incidents.filter((i) => !i.hasGeo).length);
    for (const row of c.root.querySelectorAll('.log-row')) expect(row.querySelector('.log-dot')).not.toBeNull();
    expect(c.root.querySelector('.map-legend')?.textContent).toContain('country-level');
    // Replay opens at the end of the range with everything shown and the latest named.
    expect(c.root.querySelector('.hud-count')?.textContent).toBe(String(ds.incidents.filter((i) => i.isActiveRecord).length));
    const latest = [...ds.incidents].filter((i) => i.isActiveRecord).sort((a, b) => (a.date_disclosed < b.date_disclosed ? 1 : -1))[0]!;
    expect(c.root.querySelector('.hud-caption')?.textContent).toContain(latest.name);
    expect(c.root.querySelector('.replay-range')).not.toBeNull();
    expect(c.root.querySelector('.drawer')?.hasAttribute('hidden')).toBe(true);
    // What changed strip comes from the snapshot.
    expect(c.root.querySelector('.changes')?.textContent).toContain('Latest additions');
  });

  it('honours replay position, filters, and the open drawer from the URL', async () => {
    const c = ctx('#/map?t=2025-06&ai_role=load-bearing&open=echoleak-m365-copilot');
    await mapView(c);
    const cutoff = Date.UTC(2025, 5, 30);
    const expected = ds.incidents.filter((i) => i.isActiveRecord && i.ai_role === 'load-bearing' && Date.parse(`${i.date_disclosed}T00:00:00Z`) <= cutoff);
    expect(c.root.querySelector('.hud-count')?.textContent).toBe(String(expected.length));
    expect(c.root.querySelector('.replay-when')?.textContent).toBe('2025-06');
    expect(c.root.querySelector('button.chip[data-value="load-bearing"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(c.root.querySelectorAll('.log-row.filtered').length).toBe(ds.incidents.filter((i) => i.ai_role !== 'load-bearing').length);
    const drawer = c.root.querySelector('.drawer')!;
    expect(drawer.hasAttribute('hidden')).toBe(false);
    expect(drawer.querySelector('h2')?.textContent).toBe(ds.byId.get('echoleak-m365-copilot')!.name);
    expect(drawer.querySelectorAll('.badge-status, .badge-confidence, .badge-ai_role').length).toBeGreaterThanOrEqual(3);
    expect(drawer.querySelector(`a[href="${incidentHref('echoleak-m365-copilot')}"]`)).not.toBeNull();
    expect(drawer.textContent).toContain('Copy share link');
  });

  it('opens the drawer from a field-log row and closes it with Escape', async () => {
    const c = ctx('#/map');
    await mapView(c);
    const row = c.root.querySelector<HTMLButtonElement>('.log-row[data-id="gtg-1002-ai-espionage"]')!;
    row.click();
    const drawer = c.root.querySelector('.drawer')!;
    expect(drawer.hasAttribute('hidden')).toBe(false);
    expect(drawer.querySelector('h2')?.textContent).toBe(ds.byId.get('gtg-1002-ai-espionage')!.name);
    expect(c.root.querySelector('g.marker.active')).not.toBeNull();
    c.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(drawer.hasAttribute('hidden')).toBe(true);
    expect(c.root.querySelector('g.marker.active')).toBeNull();
  });
});

describe('overview, stats, timeline, table, about', () => {
  it('overview leads with one hero figure, the honesty split, and a live map teaser', () => {
    const c = ctx('#/');
    overviewView(c);
    // Exactly one hero figure on the view, bound to the teaser's replay and equal to the headline count at rest.
    const figures = c.root.querySelectorAll('.hero-number');
    expect(figures).toHaveLength(1);
    expect(figures[0]?.textContent).toBe(String(summary.total));
    expect(c.root.querySelector('.hud-count')).toBeNull();
    const latest = [...ds.incidents].filter((i) => i.isActiveRecord).sort((a, b) => (a.date_disclosed < b.date_disclosed ? 1 : -1))[0]!;
    expect(c.root.querySelector('.hero-caption')?.textContent).toContain(latest.name);
    // Honesty split stays in the hero, status next to AI role.
    const honesty = c.root.querySelector('.honesty')!;
    expect(honesty.querySelectorAll('svg.chart-bar')).toHaveLength(2);
    expect(honesty.textContent).toContain('Verification status');
    expect(honesty.textContent).toContain('AI role');
    // Live map teaser with every marker, clicking through to the map view.
    const teaser = c.root.querySelector('.map-teaser')!;
    expect(teaser.querySelectorAll('g.marker')).toHaveLength(collectMarkers(ds.incidents, false).length);
    expect(teaser.querySelector('.replay-range')).not.toBeNull();
    expect(teaser.querySelector<HTMLAnchorElement>('a.teaser-open')?.getAttribute('href')).toBe('#/map');
    // Share affordance and the small numbers.
    expect(c.root.querySelector('.hero-share')).not.toBeNull();
    expect(c.root.querySelector('.hero-smalls')?.textContent).toContain(`${summary.by_status['confirmed']} confirmed`);
    expect(c.root.querySelectorAll('.stat')).toHaveLength(0);
    // Latest and what-changed sit above the breakdowns.
    const text = c.root.textContent ?? '';
    expect(text.indexOf('Latest')).toBeLessThan(text.indexOf('Breakdowns'));
    expect(c.root.querySelector('.recent .changes')).not.toBeNull();
    for (const card of c.root.querySelectorAll('.card')) {
      const g = gradesOn(card);
      expect(g.status && g.confidence && g.ai_role, 'card grades').toBeTruthy();
    }
  });

  it('overview teaser opens the full map with the record when a marker is activated', () => {
    const c = ctx('#/');
    overviewView(c);
    const marker = c.root.querySelector<SVGGElement>('.map-teaser g.marker')!;
    marker.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(window.location.hash).toBe(`#/map?open=${marker.dataset.id}`);
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

  it('techniques view lists every mapped id with its records, states coverage, links Navigator layers, and cross-tabs models by guardrails', () => {
    const c = ctx('#/techniques');
    techniquesView(c);
    const atlasIds = new Set(ds.incidents.filter((i) => i.isActiveRecord).flatMap((i) => i.mappings.mitre_atlas));
    const rows = c.root.querySelectorAll('.technique-table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(atlasIds.size);
    for (const id of atlasIds) expect(c.root.querySelector(`a[href="https://atlas.mitre.org/techniques/${id}"]`), id).not.toBeNull();
    expect(c.root.textContent).toMatch(/Mapped in \d+ of \d+ records/);
    expect(c.root.querySelector('a[href$="navigator/attack-layer.json"]')).not.toBeNull();
    expect(c.root.querySelector('a[href$="navigator/atlas-layer.json"]')).not.toBeNull();
    expect(c.root.querySelector('a[href$="misp/manifest.json"]')).not.toBeNull();
    const m = c.root.querySelector('table.matrix')!;
    expect(m.querySelector('caption')?.textContent).toContain('Model family by guardrail bypass');
    const total = [...m.querySelectorAll('tbody .matrix-total')].reduce((n, td) => n + Number(td.textContent), 0);
    expect(total).toBeGreaterThan(0);
    expect(m.querySelector('.matrix-cell.heat a')?.getAttribute('href')).toMatch(/^#\/table\?model_families=.*guardrail_bypass=/);
  });

  it('record page shows the evidence panel and hides the autonomy % row while no record states one', () => {
    const c = ctx(incidentHref(summary.ids[0]!));
    incidentView(c);
    expect(c.root.querySelector('.panel-evidence')).not.toBeNull();
    expect(c.root.querySelector('.panel-evidence')?.textContent).toContain('Archived copies');
    const anyStated = ds.incidents.some((i) => i.autonomy_pct !== null);
    expect(c.root.textContent?.includes('Autonomy (source-stated %)')).toBe(anyStated);
  });

  it('stats surfaces the upstream geo_coverage: records with points, and points by role and by basis', () => {
    const c = ctx('#/stats');
    statsView(c);
    const panel = c.root.querySelector('.panel-geo');
    expect(panel).not.toBeNull();
    expect(panel!.textContent).toContain(`${summary.geo_coverage.records} of ${summary.total} records carry at least one map point`);
    expect(panel!.textContent).toContain(`${summary.geo_coverage.illustrative} illustrative`);
    const titles = [...panel!.querySelectorAll('.chart-card h3')].map((e) => e.textContent);
    expect(titles).toEqual(['Points by role', 'Points by basis']);
    const basisRows = [...panel!.querySelectorAll('.chart-card')].find((s) => s.querySelector('h3')?.textContent === 'Points by basis')!.querySelectorAll('tbody tr');
    const rendered = Object.fromEntries([...basisRows].map((r) => [r.querySelector('th')?.textContent, Number(r.querySelector('td')?.textContent)]));
    const basisTax = taxonomy.geo_basis?.values ?? [];
    expect(basisTax.length).toBeGreaterThan(0);
    for (const v of basisTax) expect(rendered[v.label], v.id).toBe((summary.geo_coverage.by_basis as Record<string, number>)[v.id] ?? 0);
    const roleRows = [...panel!.querySelectorAll('.chart-card')].find((s) => s.querySelector('h3')?.textContent === 'Points by role')!.querySelectorAll('tbody tr');
    const roles = Object.fromEntries([...roleRows].map((r) => [r.querySelector('th')?.textContent, Number(r.querySelector('td')?.textContent)]));
    expect(roles).toEqual({ Origin: summary.geo_coverage.by_role.origin ?? 0, Target: summary.geo_coverage.by_role.target ?? 0 });
  });

  it('record page lists every map point with its basis and the publisher that stated it, or says that no source states a location', () => {
    const withGeo = ds.incidents.find((i) => i.hasGeo)!;
    const c = ctx(incidentHref(withGeo.id));
    incidentView(c);
    const items = c.root.querySelectorAll('.geo-points-detail > li');
    expect(items).toHaveLength(withGeo.geo!.points.length);
    withGeo.geo!.points.forEach((p, i) => {
      const text = items[i]!.textContent ?? '';
      expect(text).toContain(p.label);
      expect(text).toContain(p.attributed_by!);
      expect(text).toContain(taxonomy.geo_basis?.values.find((v) => v.id === p.basis)?.label ?? 'missing-label');
      expect(text).toContain(p.illustrative ? 'country-level centroid' : 'stated location');
      expect(items[i]!.querySelector('a.plain')?.getAttribute('href')).toBe(withGeo.sources.find((s) => s.publisher === p.attributed_by)?.url);
    });
    const without = ds.incidents.find((i) => !i.hasGeo)!;
    const d = ctx(incidentHref(without.id));
    incidentView(d);
    expect(d.root.querySelector('.geo-points-detail')).toBeNull();
    expect(d.root.textContent).toContain('No cited source states a location');
  });

  it('stats shows the dataset gaps table with one row per optional field', () => {
    const c = ctx('#/stats');
    statsView(c);
    const rows = c.root.querySelectorAll('.gaps-table tbody tr');
    expect(rows.length).toBeGreaterThanOrEqual(12);
    expect(c.root.querySelector('.gaps-table')?.textContent).toContain('MITRE ATT&CK mapping');
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
