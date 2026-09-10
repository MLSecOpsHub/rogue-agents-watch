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
