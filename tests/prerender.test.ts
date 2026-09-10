// The prerender step runs after the Vite build; these tests cover its pure
// generators against the real snapshot so a build that would produce a broken
// card, page, or feed fails here first.
import { describe, expect, it } from 'vitest';
import summary from '../data/snapshot/summary.json';
import { atomFeed, cardSvg, changesJson, firstSentence, incidentHtml, loadContext, siteCardSvg, siteOgTags, wrapText } from '../scripts/prerender.mjs';

const ctx = loadContext('https://example.test/site/');
const byId = new Map(ctx.incidents.map((r) => [r.id, r]));

describe('prerender generators', () => {
  it.each(summary.ids)('%s gets a card and a share page carrying the grades and an absolute image URL', (id) => {
    const rec = byId.get(id)!;
    const svg = cardSvg(rec, ctx);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('every dot has a footnote');
    expect(svg).toContain(`v${summary.dataset_version}`);
    for (const line of rec.name.toUpperCase().split(' ').slice(0, 2)) expect(svg).toContain(line.replace(/&/g, '&amp;').replace(/'/g, '&#39;').slice(0, 8));
    const html = incidentHtml(rec, ctx);
    expect(html).toContain(`<meta property="og:image" content="https://example.test/site/og/${id}.png">`);
    expect(html).toContain(`<meta property="og:url" content="https://example.test/site/incident/${id}/">`);
    expect(html).toContain(`url=https://example.test/site/#/incident/${id}`);
    expect(html).toContain('summary_large_image');
    expect(html).toMatch(/og:description" content="[^"]*(Confirmed|Reported|Test)/);
    expect(html).not.toContain('<script src=');
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

describe('discoverability and interop generators', () => {
  it('site Dataset JSON-LD and per-incident Article JSON-LD are valid schema.org objects with absolute URLs', async () => {
    const { siteJsonLd, incidentJsonLd } = await import('../scripts/prerender.mjs');
    const ld = siteJsonLd(ctx);
    expect(ld['@type']).toBe('Dataset');
    expect(ld['url']).toBe('https://example.test/site/');
    expect(ld['license']).toContain('creativecommons.org/licenses/by-sa/4.0');
    expect(Array.isArray(ld['distribution'])).toBe(true);
    const art = incidentJsonLd(byId.get(summary.ids[0]!)!, ctx);
    expect(art['@type']).toBe('Article');
    expect(art['url']).toBe(`https://example.test/site/incident/${summary.ids[0]}/`);
    expect(art['image']).toBe(`https://example.test/site/og/${summary.ids[0]}.png`);
  });

  it('sitemap lists the landing page and one URL per record; robots allows crawling and points at it', async () => {
    const { sitemapXml, robotsTxt } = await import('../scripts/prerender.mjs');
    const sm = sitemapXml(ctx);
    expect((sm.match(/<url>/g) ?? []).length).toBe(summary.total + 1);
    for (const id of summary.ids) expect(sm).toContain(`<loc>https://example.test/site/incident/${id}/</loc>`);
    expect(sm).not.toContain('embed.html');
    const rb = robotsTxt(ctx);
    expect(rb).toContain('Allow: /');
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
    for (const r of ctx.incidents) for (const t of (r.mappings as { mitre_atlas?: string[] })?.mitre_atlas ?? []) expectAtlas.set(t, (expectAtlas.get(t) ?? 0) + 1);
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
