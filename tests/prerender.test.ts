// The prerender step runs after the Vite build; these tests cover its pure
// generators against the real snapshot so a build that would produce a broken
// card, page, or feed fails here first.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import summary from '../data/snapshot/summary.json';
import { atomFeed, CARD_H, CARD_W, cardSvg, changesJson, esc, FALLBACK_SHELL, firstSentence, incidentHtml, loadContext, mapCardSvg, renderPng, routeHtml, routeImageUrl, SEVERITY_HEX, sitemapXml, siteCardSvg, siteImageUrl, siteOgTags, STATUS_HEX, statsCardSvg, wrapText } from '../scripts/prerender.mjs';
import type { PrerenderContext, PrerenderRecord } from '../scripts/prerender.mjs';
import { OG_CARD } from '../src/site-copy.mjs';

// The fallback shell keeps the suite independent of whatever a previous build left in dist/.
const ctx = loadContext('https://example.test/site/', { shell: FALLBACK_SHELL });
const byId = new Map(ctx.incidents.map((r) => [r.id, r]));

describe('prerender generators', () => {
  it.each(summary.ids)('%s gets a card and a share page carrying the grades and an absolute image URL', (id) => {
    const rec = byId.get(id)!;
    const svg = cardSvg(rec, ctx);
    expect(svg.startsWith('<svg')).toBe(true);
    // The four grades with their upstream labels, the disclosure date, the source count and the name's first words.
    expect(svg).toContain(`>${ctx.labels['status']![rec.status]!.label}</text>`);
    expect(svg).toContain(`>${ctx.labels['confidence']![rec.confidence]!.label}</text>`);
    expect(svg).toContain(`>${ctx.labels['ai_role']![rec.ai_role ?? 'unknown']?.label ?? rec.ai_role}</text>`);
    expect(svg).toContain(`fill="${SEVERITY_HEX[rec.severity]}">${ctx.labels['severity']![rec.severity]!.label}</text>`);
    expect(svg).toContain(`disclosed ${rec.date_disclosed}`);
    expect(svg).toMatch(new RegExp(`>${rec.sources.length}</tspan> sources?`));
    expect(svg).toContain('>rogueagentswatch.com</text>'.replace('rogueagentswatch.com', 'example.test'));
    expect(svg).not.toContain('not stated');
    for (const line of rec.name.split(' ').slice(0, 2)) expect(svg).toContain(line.replace(/&/g, '&amp;').replace(/'/g, '&#39;').slice(0, 8));
    const html = incidentHtml(rec, ctx);
    expect(html).toMatch(new RegExp(`<meta property="og:image" content="https://example\\.test/site/og/${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\.png\\?v=[0-9a-f]{10}">`));
    expect(html).toContain(`<meta property="og:url" content="https://example.test/site/incident/${id}/">`);
    expect(html).toContain(`<link rel="canonical" href="https://example.test/site/incident/${id}/">`);
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('summary_large_image');
    expect(html).toMatch(/og:description" content="[^"]*(Confirmed|Reported|Test)/);
    // Title is the record name alone; the description leads with the event and ends with the grades.
    const escName = rec.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    expect(html).toContain(`<title>${escName}</title>`);
    const desc = /<meta name="description" content="([^"]*)">/.exec(html)![1]!;
    expect(desc.startsWith(firstSentence(rec.summary).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'))).toBe(true);
    expect(desc).toMatch(/severity\.$/);
    // A real page, not a redirect: search engines drop instant-refresh pages.
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).not.toContain('location.replace');
    expect(html).not.toContain('<script src=');
    // The record is in the static HTML for crawlers that do not run JavaScript.
    expect(html).toContain(`<h1>${rec.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}</h1>`);
    for (const s of rec.sources) expect(html).toContain(`href="${s.url.replace(/&/g, '&amp;')}"`);
    expect(html).toContain('Report a correction');
    expect(html).toContain('"@type":"Article"');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it('route pages carry static content for every record, grade definitions, and no redirect', async () => {
    const { routeHtml, bareShell, pageHtml } = await import('../scripts/prerender.mjs');
    const overview = routeHtml('overview', ctx);
    for (const id of summary.ids) expect(overview).toContain(`href="https://example.test/site/incident/${id}/"`);
    expect(overview).toContain('<link rel="canonical" href="https://example.test/site/">');
    expect(overview).toContain('"@type":"Dataset"');
    expect(overview).toContain('"@type":"ItemList"');
    const about = routeHtml('about', ctx);
    expect(about).toContain('"@type":"DefinedTermSet"');
    for (const v of ctx.taxonomy['status']!.values) expect(about).toContain(v.label);
    const map = routeHtml('map', ctx);
    expect(map).toContain('never plotted');
    // The map and stats routes carry their own card, versioned by content; the others share the site card.
    expect(map).toMatch(/<meta property="og:image" content="https:\/\/example\.test\/site\/og\/map\.png\?v=[0-9a-f]{10}">/);
    expect(routeHtml('stats', ctx)).toMatch(/og:image" content="https:\/\/example\.test\/site\/og\/stats\.png\?v=[0-9a-f]{10}"/);
    expect(routeHtml('timeline', ctx)).toContain('og:image" content="https://example.test/site/og/site.png?v=');
    expect(routeImageUrl(ctx, 'about')).toBeNull();
    expect(sitemapXml(ctx)).toContain('<image:loc>https://example.test/site/og/map.png?v=');
    for (const view of ['timeline', 'table', 'techniques', 'stats'] as const) {
      const html = routeHtml(view, ctx);
      expect(html).toContain(`<link rel="canonical" href="https://example.test/site/${view}/">`);
      expect(html).not.toContain('http-equiv="refresh"');
      expect(html).toContain('"@type":"BreadcrumbList"');
    }
    // Re-prerendering an already prerendered page yields the same bytes.
    const once = pageHtml(ctx, { title: 'T', description: 'D', url: 'https://example.test/site/x/' }, '<p>x</p>');
    expect(pageHtml({ ...ctx, shell: once }, { title: 'T', description: 'D', url: 'https://example.test/site/x/' }, '<p>x</p>')).toBe(once);
    expect(bareShell(once)).toBe(bareShell(ctx.shell));
  });

  it('actor pages carry every record behind the verbatim actor string, the publishers, and CollectionPage JSON-LD', async () => {
    const { actorHtml, routeHtml } = await import('../scripts/prerender.mjs');
    const { actorGroups } = await import('../scripts/prerender-util.mjs');
    const groups = actorGroups(ctx.incidents);
    const listPage = routeHtml('actors', ctx);
    for (const g of groups) {
      expect(listPage).toContain(`href="https://example.test/site/actors/${g.slug}/"`);
      const html = actorHtml(g, ctx);
      expect(html).toContain(`<link rel="canonical" href="https://example.test/site/actors/${g.slug}/">`);
      expect(html).toContain('"@type":"CollectionPage"');
      for (const r of g.incidents) expect(html).toContain(`href="https://example.test/site/incident/${r.id}/"`);
      expect(html).not.toContain('http-equiv="refresh"');
    }
  });

  it('llms.txt indexes every record and the pages; llms-full.txt carries every source', async () => {
    const { llmsTxt, llmsFullTxt } = await import('../scripts/prerender-pages.mjs');
    const idx = llmsTxt(ctx);
    for (const id of summary.ids) expect(idx).toContain(`(https://example.test/site/incident/${id}/)`);
    expect(idx).toContain('llms-full.txt');
    const full = llmsFullTxt(ctx);
    for (const r of ctx.incidents) for (const s of r.sources) expect(full).toContain(s.url);
    expect(full).not.toContain('undefined');
    expect(idx).not.toContain('undefined');
  });

  it('escapes dataset text in every generated surface', () => {
    const hostile = { ...byId.get(summary.ids[0]!)!, id: 'x-y', name: 'Name <b>"bold"</b> & \'quotes\'', summary: 'One. <script>alert(1)</script>', actor: '<img src=x>', sources: [], geo: null };
    const html = incidentHtml(hostile, ctx);
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;b&gt;');
    const svg = cardSvg(hostile, ctx);
    expect(svg).not.toContain('<IMG SRC');
    expect(svg).toContain('&lt;');
    const feed = atomFeed([hostile], ctx);
    expect(feed).not.toContain('<script>');
    expect(feed).toContain('&lt;script&gt;');
  });

  it('feed and changes are derived from the data only and stable across runs', () => {
    const a = atomFeed(ctx.incidents, ctx);
    const b = atomFeed(ctx.incidents.slice().reverse(), ctx);
    expect(a).toBe(b);
    expect((a.match(/<entry>/g) ?? []).length).toBe(summary.total);
    expect(a).toMatch(/<updated>\d{4}-\d{2}-\d{2}T00:00:00Z<\/updated>/);
    const maxDate = ctx.incidents.flatMap((r) => [r.last_updated, r.added?.date]).filter(Boolean).sort().at(-1);
    expect(a).toContain(`<updated>${maxDate}T00:00:00Z</updated>`);
    const c = changesJson(ctx.incidents, ctx);
    expect(c.total).toBe(summary.total);
    expect(c.additions.length).toBeLessThanOrEqual(10);
    expect(c.additions.map((x) => x.date)).toEqual([...c.additions.map((x) => x.date)].sort().reverse());
    expect(JSON.stringify(changesJson(ctx.incidents.slice().reverse(), ctx))).toBe(JSON.stringify(c));
  });

  it('site card and tags use the headline count and the canonical URL', () => {
    expect(siteCardSvg(ctx)).toContain(`>${summary.total}<`);
    const tags = siteOgTags(ctx);
    expect(tags).toContain('https://example.test/site/og/site.png');
    expect(tags).toContain('application/atom+xml');
  });

  it('wraps titles without clipping and picks a first sentence', () => {
    expect(wrapText('Short', 27, 3)).toEqual(['Short']);
    const lines = wrapText('Microsoft/OpenAI disruption of state-affiliated actors misusing LLMs (2024)', 27, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(27);
    expect(wrapText('a '.repeat(80).trim(), 10, 2).at(-1)).toMatch(/…$/);
    expect(firstSentence('First one. Second one.')).toBe('First one.');
    expect(firstSentence('No terminator here')).toBe('No terminator here');
  });
});

// The site share image (dist/og/site.png): every number on it comes from the
// snapshot, and it claims nothing the site does not do.
describe('site share card', () => {
  const textOf = (svg: string) => svg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const statuses = Object.entries(summary.by_status) as Array<[string, number]>;

  it('is 1200x630 with the brand, category, the two terms, supporting line and hook', () => {
    const svg = siteCardSvg(ctx);
    expect(svg).toMatch(new RegExp(`^<svg [^>]*width="${CARD_W}" height="${CARD_H}" viewBox="0 0 1200 630"`));
    const text = textOf(svg);
    expect(text).toContain('ROGUE AGENTS WATCH');
    expect(text).toContain(`// ${OG_CARD.category}`);
    expect(text).toContain(`&gt; ${OG_CARD.terms.join(' · ')}`);
    expect(text).toContain(OG_CARD.description.replace('&', '&amp;'));
    expect(text).toContain(OG_CARD.hook);
    expect(text).toContain(`MLSECOPSHUB · v${summary.dataset_version}`);
    // One family in two weights, rasterised from vendored files: nothing else is named.
    expect(svg.match(/font-family="([^"]+)"/g)?.every((m) => m === 'font-family="IBM Plex Mono"')).toBe(true);
  });

  it('shows the record total and the status breakdown from summary.json, with the upstream labels', () => {
    const svg = siteCardSvg(ctx);
    expect(svg).toContain(`font-size="136" fill="#e6edf3">${summary.total}</text>`);
    expect(textOf(svg)).toContain(`${summary.total} ${OG_CARD.countNoun.replace('&', '&amp;')}`);
    for (const [id, n] of statuses) expect(textOf(svg)).toContain(`${n} ${ctx.labels['status']![id]!.label.toLowerCase().replace('&', '&amp;')}`);
    expect(textOf(svg)).toContain(`${summary.by_status.confirmed} confirmed · ${summary.by_status.reported} reported`);
    // Same hues as the site's --status-* tokens; confirmed and reported never share one.
    const css = readFileSync('src/styles.css', 'utf8').split("data-theme='light'")[0]!;
    const tokens = Object.fromEntries([...css.matchAll(/--status-([\w-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1], m[2]]));
    expect(tokens).toEqual(STATUS_HEX);
    expect(STATUS_HEX['confirmed']).not.toBe(STATUS_HEX['reported']);
  });

  it('takes the host from the canonical URL, never a hard-coded domain', () => {
    expect(siteCardSvg(ctx)).toContain('>example.test<');
    expect(siteCardSvg(ctx)).not.toContain('rogueagentswatch.com');
    expect(siteCardSvg(loadContext('https://www.rogueagentswatch.com/', { shell: FALLBACK_SHELL }))).toContain('>rogueagentswatch.com<');
    // A long preview host shrinks, and the footer's left line shrinks to clear it.
    const preview = siteCardSvg(loadContext('https://rogue-agents-watch-git-feat-terminal-share-cards-mlsecopshub.vercel.app/', { shell: FALLBACK_SHELL }));
    expect(preview).toContain('>rogue-agents-watch-git-feat-terminal-share-cards-mlsecopshub.vercel.app<');
    expect(preview).toMatch(/font-size="1[0-3]" letter-spacing="1" fill="#ff8a4c">rogue-agents/);
  });

  it('makes no live, real-time or monitoring claim and draws no paths between points', () => {
    const svg = siteCardSvg(ctx);
    expect(textOf(svg)).not.toMatch(/\b(live|real[- ]?time|monitor(ing)?|scann(ing|er)|detect(ion|ing)?|telemetry|score)\b/i);
    expect(svg).not.toMatch(/<(line|path|polyline)[^>]*class="arc"/);
    // One disc + one dot per illustrative point, ring + dot per stated point: nothing else is a circle.
    const pts = ctx.incidents.filter((r) => !r.record_status || r.record_status === 'active').flatMap((r) => r.geo?.points ?? []);
    expect((svg.match(/<circle /g) ?? []).length).toBe(pts.length * 2);
    expect(textOf(svg)).toContain(`threat map · ${pts.length} points`);
  });

  it('follows the data: other totals and breakdowns, no geo, retracted points left off', () => {
    const point = { role: 'target' as const, lat: 48.85, lng: 2.35, label: 'Paris', country: 'FR' };
    const rec = (id: string, extra: Partial<PrerenderRecord>): PrerenderRecord => ({ ...ctx.incidents[0]!, id, ai_role: 'significant', ...extra });
    const other: PrerenderContext = {
      ...ctx,
      summary: { ...ctx.summary, total: 1234, dataset_version: '9.9.9', by_status: { confirmed: 400, reported: 800, 'test-eval': 34 } },
      incidents: [rec('a', { geo: { points: [point] } }), rec('b', { record_status: 'retracted', geo: { points: [{ ...point, lat: -33.9, lng: 151.2, illustrative: true }] } }), rec('c', { geo: null })],
    };
    const svg = siteCardSvg(other);
    const text = textOf(svg);
    expect(svg).toContain('fill="#e6edf3">1234</text>');
    for (const n of [400, 800, 34]) expect(svg).toContain(`>${n}</tspan>`);
    for (const [, n] of statuses) expect(svg).not.toContain(`>${n}</tspan>`);
    expect(svg).not.toContain(`>${summary.total}</text>`);
    expect(text).toContain('MLSECOPSHUB · v9.9.9');
    // The active stated point is a pin (ring + dot); the retracted record's disc is not drawn.
    expect((svg.match(/<circle /g) ?? []).length).toBe(2);
    expect(svg).not.toContain('opacity="0.2"');
    expect(text).toContain('threat map · 1 point · stated · 1 of 1234 records');
    const empty = siteCardSvg({ ...other, incidents: [] });
    expect(empty).not.toContain('<circle');
    expect(textOf(empty)).toContain('threat map · no stated locations · 0 of 1234 records');
  });

  it('the map card states the located share, every basis by its taxonomy noun, and the unplotted remainder', () => {
    const svg = mapCardSvg(ctx);
    const text = textOf(svg);
    const geo = ctx.incidents.filter((r) => !r.record_status || r.record_status === 'active').filter((r) => r.geo?.points?.length);
    const pts = geo.flatMap((r) => r.geo!.points);
    expect(text).toContain('THREAT MAP');
    expect(text).toContain(`${geo.length} of ${summary.total} records located`);
    expect(text).toContain(`${summary.total - geo.length} records listed, not plotted`);
    expect(text).toContain(`${pts.length} ${pts.every((p) => p.illustrative) ? 'country-level ' : ''}points, each with its basis`);
    const byBasis = new Map<string, number>();
    for (const p of pts) if (p.basis) byBasis.set(p.basis, (byBasis.get(p.basis) ?? 0) + 1);
    for (const [id, n] of byBasis) expect(text).toContain(`${n} ${ctx.labels['geo_basis']![id]!.label.toLowerCase().split(' ')[0]}`);
    expect((svg.match(/<circle /g) ?? []).length).toBe(pts.length * 2);
    expect(svg).toContain('>example.test/map<');
    expect(text).not.toMatch(/\b(live|real[- ]?time|monitor(ing)?|score)\b/i);
  });

  it('the stats card is the status × AI-role crosstab from summary.evidence_split, with the year split and no score', () => {
    const svg = statsCardSvg(ctx);
    const text = textOf(svg);
    const split = summary.evidence_split as { confirmed_load_bearing: number; by_status_ai_role: Record<string, Record<string, number>> };
    expect(text).toContain('EVIDENCE STATS');
    expect(svg).toContain(`font-size="136" fill="#ff8a4c">${split.confirmed_load_bearing}</text>`);
    expect(text).toContain(`of ${summary.total} records`);
    for (const [status, row] of Object.entries(split.by_status_ai_role)) {
      expect(svg).toContain(`fill="${STATUS_HEX[status]}">${ctx.labels['status']![status]!.label.toLowerCase()} <tspan fill="#7d8b99">${Object.values(row).reduce((a, b) => a + b, 0)}</tspan>`);
      for (const n of Object.values(row)) expect(svg).toContain(`font-size="36" fill="#${n ? 'e6edf3' : '566677'}">${n}</text>`.replace('e6edf3">22<', 'ff8a4c">22<'));
    }
    for (const [year, n] of Object.entries(summary.by_year)) expect(text).toContain(`${n} in ${year}`);
    expect(text).toContain('every number is a count of records');
    expect(svg).toContain('>example.test/stats<');
    // Without the rollup the table is counted over active records (the dashboard's headline rule, which may exclude a record upstream still counts).
    const counted = statsCardSvg({ ...ctx, summary: { ...ctx.summary, evidence_split: undefined } });
    const active = ctx.incidents.filter((r) => !r.record_status || r.record_status === 'active');
    const confirmedLoadBearing = active.filter((r) => r.status === 'confirmed' && r.ai_role === 'load-bearing').length;
    expect(counted).toContain(`font-size="136" fill="#ff8a4c">${confirmedLoadBearing}</text>`);
    expect(counted).toContain(`fill="${STATUS_HEX['confirmed']}">confirmed <tspan fill="#7d8b99">${active.filter((r) => r.status === 'confirmed').length}</tspan>`);
  });

  it('rasterises to a 1200x630 PNG', async () => {
    const png = await renderPng(siteCardSvg(ctx));
    expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(CARD_W);
    expect(png.readUInt32BE(20)).toBe(CARD_H);
  });

  it('the homepage declares it as a large image at /og/site.png, versioned by content, with its size', () => {
    const url = siteImageUrl(ctx);
    expect(url).toMatch(/^https:\/\/example\.test\/site\/og\/site\.png\?v=[0-9a-f]{10}$/);
    expect(siteImageUrl(ctx)).toBe(url);
    // A different card is a different URL, so platforms that cache by URL fetch it again.
    expect(siteImageUrl({ ...ctx, summary: { ...ctx.summary, total: ctx.summary.total + 1 } })).not.toBe(url);
    expect(sitemapXml(ctx)).toContain(esc(url));
    for (const head of [siteOgTags(ctx), routeHtml('overview', ctx)]) {
      expect(head).toContain(`<meta property="og:image" content="${esc(url)}">`);
      expect(head).toContain(`<meta name="twitter:image" content="${esc(url)}">`);
      expect(head).toContain('<meta name="twitter:card" content="summary_large_image">');
    }
    expect(siteOgTags(ctx)).toContain(`<meta property="og:image:width" content="${CARD_W}">`);
    expect(siteOgTags(ctx)).toContain(`<meta property="og:image:height" content="${CARD_H}">`);
  });
});

describe('discoverability and interop generators', () => {
  it('site Dataset JSON-LD and per-incident Article JSON-LD are valid schema.org objects with absolute URLs', async () => {
    const { siteJsonLd, incidentJsonLd } = await import('../scripts/prerender.mjs');
    const graph = siteJsonLd(ctx)['@graph'] as Array<Record<string, unknown>>;
    const ld = graph.find((n) => n['@type'] === 'Dataset')!;
    expect(ld['url']).toBe('https://example.test/site/');
    expect(ld['license']).toContain('creativecommons.org/licenses/by-sa/4.0');
    expect(Array.isArray(ld['distribution'])).toBe(true);
    expect((ld['hasPart'] as unknown[]).length).toBe(summary.total);
    expect(graph.map((n) => n['@type'])).toEqual(['Organization', 'WebSite', 'Dataset', 'CollectionPage']);
    // The Dataset's hasPart entries and each record's own Article agree on @id and datePublished.
    for (const part of ld['hasPart'] as Array<Record<string, unknown>>) {
      const id = decodeURIComponent(String(part['@id']).replace('https://example.test/site/incident/', '').replace(/\/$/, ''));
      const own = incidentJsonLd(byId.get(id)!, ctx);
      expect(own['@id']).toBe(part['@id']);
      expect(part['datePublished']).toBe(own['datePublished']);
    }
    const art = incidentJsonLd(byId.get(summary.ids[0]!)!, ctx);
    expect(art['@type']).toBe('Article');
    expect(art['url']).toBe(`https://example.test/site/incident/${summary.ids[0]}/`);
    expect(art['image']).toMatch(new RegExp(`^https://example\\.test/site/og/${summary.ids[0]}\\.png\\?v=[0-9a-f]{10}$`));
    expect((art['citation'] as unknown[]).length).toBe(byId.get(summary.ids[0]!)!.sources.length);
  });

  it('sitemap lists every route page and one URL per record; robots allows crawling, names the AI crawlers, and points at it', async () => {
    const { sitemapXml, robotsTxt } = await import('../scripts/prerender.mjs');
    const { ROUTE_PAGES } = await import('../scripts/prerender-pages.mjs');
    const { actorGroups } = await import('../scripts/prerender-util.mjs');
    const actors = actorGroups(ctx.incidents);
    const sm = sitemapXml(ctx);
    expect((sm.match(/<url>/g) ?? []).length).toBe(summary.total + ROUTE_PAGES.length + actors.length);
    for (const g of actors) expect(sm).toContain(`<loc>https://example.test/site/actors/${g.slug}/</loc>`);
    for (const id of summary.ids) expect(sm).toContain(`<loc>https://example.test/site/incident/${id}/</loc>`);
    for (const p of ROUTE_PAGES) expect(sm).toContain(`<loc>https://example.test/site/${p.path}</loc>`);
    expect(sm).not.toContain('embed.html');
    const rb = robotsTxt(ctx);
    expect(rb).toContain('User-agent: *\nAllow: /');
    expect(rb).toContain('User-agent: GPTBot\nAllow: /');
    expect(rb).toContain('User-agent: ClaudeBot\nAllow: /');
    expect(rb).toContain('Sitemap: https://example.test/site/sitemap.xml');
  });

  it('Navigator layers carry every mapped technique with the record count as score and stable ordering', async () => {
    const { attackLayer, atlasLayer } = await import('../scripts/prerender.mjs');
    const atk = attackLayer(ctx);
    const atl = atlasLayer(ctx);
    expect(atk.domain).toBe('enterprise-attack');
    expect(atk.versions).toEqual({ layer: '4.5', navigator: '4.9.0' });
    expect(atl.domain).toBe('atlas-atlas');
    expect(atl.versions.layer).toBe('4.3');
    const expectAtlas = new Map<string, number>();
    // Techniques only: ATLAS case studies (AML.CS…) are not Navigator cells.
    for (const r of ctx.incidents) for (const t of (r.mappings as { mitre_atlas?: string[] })?.mitre_atlas ?? []) if (/^AML\.T\d{4}/.test(t)) expectAtlas.set(t, (expectAtlas.get(t) ?? 0) + 1);
    expect(atl.techniques.map((t) => [t.techniqueID, t.score])).toEqual([...expectAtlas.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    for (const t of atl.techniques) expect(t.techniqueID).toMatch(/^AML\.T\d{4}(\.\d{3})?$/);
    for (const t of atk.techniques) expect(t.techniqueID).toMatch(/^T\d{4}(\.\d{3})?$/);
    expect(atl.gradient.maxValue).toBe(Math.max(...atl.techniques.map((t) => t.score)));
    expect(JSON.stringify(attackLayer({ ...ctx, incidents: ctx.incidents.slice().reverse() }))).toBe(JSON.stringify(atk));
  });

  it('MISP feed has one event per record with stable v5 UUIDs, tags for grades and techniques, and source links', async () => {
    const { mispFeed, uuid5, MISP_NAMESPACE } = await import('../scripts/prerender.mjs');
    const feed = mispFeed(ctx.incidents, ctx);
    expect(Object.keys(feed.events)).toHaveLength(summary.total);
    expect(Object.keys(feed.manifest).sort()).toEqual(Object.keys(feed.events).sort());
    const rec = byId.get(summary.ids[0]!)!;
    const uuid = uuid5(MISP_NAMESPACE, `event:${rec.id}`);
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid5(MISP_NAMESPACE, `event:${rec.id}`)).toBe(uuid);
    const ev = feed.events[uuid]!.Event;
    expect(ev.info).toContain(rec.name);
    expect(ev.Tag.map((t) => t.name)).toContain(`rogue-agent-watch:status="${rec.status}"`);
    for (const t of (rec.mappings as { mitre_atlas?: string[] })?.mitre_atlas ?? []) expect(ev.Tag.map((x) => x.name)).toContain(`mitre-atlas:technique="${t}"`);
    const links = ev.Attribute.filter((a) => a.type === 'link').map((a) => a.value);
    for (const s of rec.sources) expect(links).toContain(s.url);
    expect(ev.Attribute.find((a) => a.type === 'text' && a.category === 'Attribution')?.value).toBe(rec.actor);
    expect(feed.hashes.split('\n').filter(Boolean).every((l) => /^[0-9a-f]{32},[0-9a-f-]{36}$/.test(l))).toBe(true);
    expect(JSON.stringify(mispFeed(ctx.incidents.slice().reverse(), ctx))).toBe(JSON.stringify(feed));
  });
});
