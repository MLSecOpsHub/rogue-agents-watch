#!/usr/bin/env node
// Build-time prerender for sharing. Runs after `vite build` and writes, from the
// vendored snapshot only:
//   dist/incident/<id>/index.html   per-incident page with Open Graph / Twitter
//                                   meta tags that redirects to #/incident/<id>
//   dist/og/<id>.png                1200x630 share card per incident
//   dist/og/site.png                site-level card
//   dist/feed.atom                  Atom feed of records (by added date)
//   dist/changes.json               latest additions / revisions / status changes
//   dist/sitemap.xml, robots.txt    crawl surface for search and Dataset Search
//   dist/navigator/*.json           ATT&CK (layer 4.5) and ATLAS (layer 4.3) Navigator layers
//   dist/misp/                      static MISP feed: manifest.json, <uuid>.json, hashes.csv
// and injects site-level Open Graph tags and schema.org Dataset JSON-LD into
// dist/index.html; each incident page also carries Article JSON-LD.
//
// Deterministic by construction: no wall clock, stable sort orders, vendored
// fonts, resvg with system fonts disabled. The same snapshot yields identical
// bytes, which CI checks by building twice.
//
// Usage: node scripts/prerender.mjs   (VITE_SITE_URL overrides the canonical URL)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SNAP = path.join(ROOT, 'data', 'snapshot');
const FONTS = path.join(ROOT, 'assets', 'fonts');

export const SITE_NAME = 'Rogue Agent Watch';
export const DEFAULT_SITE_URL = 'https://mlsecopshub.github.io/rogue-agents-dashboard/';
export const UPSTREAM = 'https://github.com/MLSecOpsHub/agentic-attack-index';
export const CARD_W = 1200;
export const CARD_H = 630;

// Card palette: the dark map theme, fixed (a share image has no viewer theme).
const C = { ground: '#0b1117', surface: '#16232f', ink: '#e8eef4', ink2: '#b9c4ce', muted: '#93a1af', hair: '#223040', land: '#1f2d3a', coast: '#2f4256', badge: '#17222d', badgeEdge: '#2d3d4f' };
export const ROLE_HEX = { 'load-bearing': '#ffb070', significant: '#e07a2f', incidental: '#a8511f', disputed: '#6f7d8a', unknown: '#6f7d8a' };

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Greedy word wrap by character budget; the last allowed line gets an ellipsis if text remains. */
export function wrapText(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxChars) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
      if (lines.length === maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length > maxLines || (lines.length === maxLines && words.join(' ').length > lines.join(' ').length)) {
    const last = lines[maxLines - 1] ?? '';
    lines.length = maxLines;
    lines[maxLines - 1] = `${last.replace(/…$/, '').slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  }
  return lines;
}

export function firstSentence(text) {
  const m = /^(.+?[.!?])(\s|$)/.exec(String(text).trim());
  return (m ? m[1] : String(text).trim()).slice(0, 220);
}

function tax(ctx, key, id) {
  return ctx.labels?.[key]?.[id]?.label ?? id;
}

function badgeSvg(x, y, text, opts = {}) {
  const w = Math.round(text.length * 11.4 + 30);
  const fill = opts.fill ?? C.badge;
  const stroke = opts.fill ? 'none' : C.badgeEdge;
  const ink = opts.ink ?? C.ink;
  return {
    w,
    svg: `<rect x="${x}" y="${y}" width="${w}" height="40" rx="6" fill="${fill}" stroke="${stroke}"/><text x="${x + 15}" y="${y + 27}" font-family="Barlow" font-weight="600" font-size="22" fill="${ink}">${esc(text)}</text>`,
  };
}

/** Land path + projection shared by every card; built once from the vendored topojson. */
export function buildGeo(topo) {
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [954, 494]], { type: 'Sphere' });
  const pathGen = geoPath(projection);
  const land = feature(topo, topo.objects.countries);
  return { landPath: pathGen(land) ?? '', project: (lng, lat) => projection([lng, lat]) };
}

function miniMap(geo, markers, opacity = 0.55) {
  const parts = [`<g transform="translate(470 40) scale(0.78)" opacity="${opacity}"><path d="${geo.landPath}" fill="${C.land}" stroke="${C.coast}" stroke-width="0.6"/>`];
  for (const m of markers) {
    const xy = geo.project(m.lng, m.lat);
    if (!xy) continue;
    const [x, y] = xy.map((n) => n.toFixed(1));
    if (m.illustrative) parts.push(`<circle cx="${x}" cy="${y}" r="34" fill="${m.color}" opacity="0.28"/>`);
    parts.push(`<circle cx="${x}" cy="${y}" r="9" fill="${m.color}" stroke="${C.ground}" stroke-width="3"/>`);
  }
  parts.push('</g>');
  return parts.join('');
}

/** Per-incident 1200x630 share card as an SVG string. */
export function cardSvg(rec, ctx) {
  const role = rec.ai_role ?? 'unknown';
  const roleHex = ROLE_HEX[role] ?? ROLE_HEX.unknown;
  const geoPoints = [];
  if (rec.geo?.target) geoPoints.push({ ...rec.geo.target, color: roleHex });
  if (rec.geo?.origin) geoPoints.push({ ...rec.geo.origin, color: roleHex });
  const big = rec.name.length > 70;
  const lines = wrapText(rec.name, big ? 34 : 27, 3);
  const fs = big ? 50 : 60;
  const lh = big ? 52 : 62;
  const titleY = 150;
  const title = lines.map((l, i) => `<text x="64" y="${titleY + i * lh}" font-family="Barlow Condensed" font-weight="700" font-size="${fs}" fill="${C.ink}" style="text-transform:uppercase">${esc(l.toUpperCase())}</text>`).join('');
  let y = titleY + (lines.length - 1) * lh + 30;
  const badges = [];
  let x = 64;
  for (const [text, fill, ink] of [
    [tax(ctx, 'status', rec.status), null, null],
    [tax(ctx, 'confidence', rec.confidence), null, null],
    [`AI ${tax(ctx, 'ai_role', role).toLowerCase()}`, roleHex, '#1a0d05'],
    [tax(ctx, 'severity', rec.severity), null, null],
  ]) {
    const b = badgeSvg(x, y, text, fill ? { fill, ink } : {});
    badges.push(b.svg);
    x += b.w + 10;
  }
  y += 40 + 26;
  const actorLines = wrapText(`Actor: ${rec.actor}`, 52, 2);
  const actor = actorLines
    .map((l, i) => {
      const body = i === 0 ? l.replace(/^Actor: /, '') : l;
      return `<text x="64" y="${y + 18 + i * 30}" font-family="Barlow" font-size="24" fill="${C.ink2}">${i === 0 ? 'Actor: ' : ''}<tspan font-weight="600" fill="${C.ink}">${esc(body)}</tspan></text>`;
    })
    .join('');
  y += 18 + actorLines.length * 30 + 14;
  const summaryLines = wrapText(firstSentence(rec.summary), 66, 2);
  const summary = summaryLines.map((l, i) => `<text x="64" y="${y + 20 + i * 30}" font-family="Barlow" font-size="22" fill="${C.ink2}">${esc(l)}</text>`).join('');
  const n = (rec.sources ?? []).length;
  const archived = (rec.sources ?? []).filter((s) => s.archive_url).length;
  const eyebrow = `${SITE_NAME.toUpperCase()} · ${rec.date_disclosed}${geoPoints.length ? '' : ' · NO STATED LOCATION'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs><radialGradient id="g" cx="0.78" cy="0.4" r="0.7"><stop offset="0" stop-color="${C.surface}"/><stop offset="0.6" stop-color="${C.ground}"/></radialGradient></defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#g)"/>
<rect x="0" y="0" width="10" height="${CARD_H}" fill="${roleHex}"/>
${miniMap(ctx.geo, geoPoints, geoPoints.length ? 0.55 : 0.28)}
<text x="64" y="88" font-family="Barlow Condensed" font-weight="700" font-size="22" letter-spacing="3" fill="${C.muted}">${esc(eyebrow)}</text>
${title}
${badges.join('')}
${actor}
${summary}
<line x1="64" y1="556" x2="1136" y2="556" stroke="${C.hair}"/>
<text x="64" y="592" font-family="Barlow" font-size="20" fill="${C.muted}"><tspan font-weight="600" fill="${C.ink}">${n} source${n === 1 ? '' : 's'}</tspan>, ${archived} archived · every dot has a footnote</text>
<text x="1136" y="592" text-anchor="end" font-family="IBM Plex Mono" font-size="18" fill="${C.muted}">agentic-attack-index v${esc(ctx.version)} · CC BY-SA 4.0</text>
</svg>`;
}

/** Site-level card: headline count and every stated point. */
export function siteCardSvg(ctx) {
  const points = [];
  for (const r of ctx.incidents) {
    const hex = ROLE_HEX[r.ai_role ?? 'unknown'] ?? ROLE_HEX.unknown;
    if (r.geo?.target) points.push({ ...r.geo.target, color: hex });
    if (r.geo?.origin) points.push({ ...r.geo.origin, color: hex });
  }
  const s = ctx.summary;
  const confirmed = s.by_status?.confirmed ?? 0;
  const withGeo = ctx.incidents.filter((r) => r.geo && (r.geo.target || r.geo.origin)).length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">
<defs><radialGradient id="g" cx="0.78" cy="0.4" r="0.7"><stop offset="0" stop-color="${C.surface}"/><stop offset="0.6" stop-color="${C.ground}"/></radialGradient></defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#g)"/>
<rect x="0" y="0" width="10" height="${CARD_H}" fill="${ROLE_HEX.significant}"/>
${miniMap(ctx.geo, points, 0.6)}
<text x="64" y="88" font-family="Barlow Condensed" font-weight="700" font-size="22" letter-spacing="3" fill="${C.muted}">${esc(SITE_NAME.toUpperCase())} · MLSECOPSHUB</text>
<text x="64" y="230" font-family="Barlow Condensed" font-weight="700" font-size="150" fill="${C.ink}">${s.total}</text>
<text x="64" y="290" font-family="Barlow Condensed" font-weight="700" font-size="44" fill="${C.ink}">AI-AGENT CYBER INCIDENTS, SOURCE-LINKED</text>
<text x="64" y="340" font-family="Barlow" font-size="26" fill="${C.ink2}">${confirmed} confirmed · ${withGeo} with a stated location · every record graded and cited</text>
<line x1="64" y1="556" x2="1136" y2="556" stroke="${C.hair}"/>
<text x="64" y="592" font-family="Barlow" font-size="20" fill="${C.muted}"><tspan font-weight="600" fill="${C.ink}">Every dot has a footnote.</tspan> No trackers, no invented pins.</text>
<text x="1136" y="592" text-anchor="end" font-family="IBM Plex Mono" font-size="18" fill="${C.muted}">agentic-attack-index v${esc(s.dataset_version)} · CC BY-SA 4.0</text>
</svg>`;
}

/** Per-incident HTML: Open Graph tags for crawlers, redirect for people. */
export function incidentHtml(rec, ctx) {
  const url = `${ctx.siteUrl}incident/${encodeURIComponent(rec.id)}/`;
  const app = `${ctx.siteUrl}#/incident/${encodeURIComponent(rec.id)}`;
  const image = `${ctx.siteUrl}og/${encodeURIComponent(rec.id)}.png`;
  const grades = `${tax(ctx, 'status', rec.status)} · ${tax(ctx, 'confidence', rec.confidence)} sourcing · AI ${tax(ctx, 'ai_role', rec.ai_role ?? 'unknown').toLowerCase()} · ${tax(ctx, 'severity', rec.severity)} severity`;
  const desc = `${grades}. ${firstSentence(rec.summary)}`;
  const title = `${rec.name} — ${SITE_NAME}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" type="application/json" href="${esc(ctx.upstreamIncidentUrl(rec.id))}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(rec.name)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="${CARD_W}">
<meta property="og:image:height" content="${CARD_H}">
<meta property="og:image:alt" content="${esc(`${rec.name}: ${grades}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(rec.name)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(app)}">
<script>location.replace(${JSON.stringify(app)});</script>
</head>
<body style="font-family:system-ui,sans-serif;padding:1.5rem;max-width:60ch">
<p>Opening <a href="${esc(app)}">${esc(rec.name)}</a> on ${esc(SITE_NAME)}.</p>
<p>${esc(grades)}.</p>
<p>${esc(rec.summary)}</p>
<p>Data: <a href="${UPSTREAM}">Agentic Attack Index</a> (MLSecOpsHub), dataset v${esc(ctx.version)}, CC BY-SA 4.0.</p>
</body>
</html>
`;
}

const byAddedDesc = (a, b) => {
  const da = a.added?.date ?? a.date_disclosed;
  const db = b.added?.date ?? b.date_disclosed;
  return da < db ? 1 : da > db ? -1 : a.id.localeCompare(b.id);
};

/** Atom feed of records, newest additions first. `updated` is derived from the data, never from the clock. */
export function atomFeed(records, ctx) {
  const sorted = records.slice().sort(byAddedDesc);
  const maxDate = records.reduce((m, r) => {
    const d = [r.last_updated, r.added?.date, r.date_disclosed, ...(r.revisions ?? []).map((v) => v.date)].filter(Boolean).sort().at(-1) ?? '1970-01-01';
    return d > m ? d : m;
  }, '1970-01-01');
  const entries = sorted
    .map((r) => {
      const added = r.added?.date ?? r.date_disclosed;
      const updated = r.last_updated ?? added;
      const url = `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`;
      const grades = `${tax(ctx, 'status', r.status)} · AI ${tax(ctx, 'ai_role', r.ai_role ?? 'unknown').toLowerCase()} · ${tax(ctx, 'severity', r.severity)}`;
      return `  <entry>
    <id>tag:mlsecopshub.com,${added.slice(0, 4)}:rogue-agent-watch/${esc(r.id)}</id>
    <title>${esc(r.name)}</title>
    <link rel="alternate" type="text/html" href="${esc(url)}"/>
    <link rel="related" type="application/json" href="${esc(ctx.upstreamIncidentUrl(r.id))}"/>
    <published>${added}T00:00:00Z</published>
    <updated>${updated}T00:00:00Z</updated>
    <category term="${esc(r.category)}"/>
    <category term="status:${esc(r.status)}"/>
    <category term="ai_role:${esc(r.ai_role ?? 'unknown')}"/>
    <summary>${esc(`${grades}. ${r.summary}`)}</summary>
  </entry>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${esc(SITE_NAME)} — new and revised records</title>
  <subtitle>Source-linked, graded records of AI-agent cyber incidents from the Agentic Attack Index (CC BY-SA 4.0). Dataset v${esc(ctx.version)}.</subtitle>
  <id>${esc(ctx.siteUrl)}feed.atom</id>
  <link rel="self" type="application/atom+xml" href="${esc(ctx.siteUrl)}feed.atom"/>
  <link rel="alternate" type="text/html" href="${esc(ctx.siteUrl)}"/>
  <updated>${maxDate}T00:00:00Z</updated>
  <rights>Data CC BY-SA 4.0, Agentic Attack Index (MLSecOpsHub)</rights>
  <generator>rogue-agents-dashboard prerender</generator>
${entries}
</feed>
`;
}

/** Latest additions, revisions, and non-active records, for the "what changed" strip and machine readers. */
export function changesJson(records, ctx) {
  const additions = records
    .slice()
    .sort(byAddedDesc)
    .slice(0, 10)
    .map((r) => ({ id: r.id, name: r.name, date: r.added?.date ?? r.date_disclosed, url: `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/` }));
  const revisions = records
    .flatMap((r) => (r.revisions ?? []).map((v) => ({ id: r.id, name: r.name, date: v.date, note: v.note })))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id)))
    .slice(0, 10);
  const record_status = records
    .filter((r) => r.record_status && r.record_status !== 'active')
    .map((r) => ({ id: r.id, name: r.name, record_status: r.record_status, superseded_by: r.superseded_by ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return {
    dataset_version: ctx.version,
    snapshot_commit: ctx.snapshot?.source_commit ?? null,
    snapshot_fetched_at: ctx.snapshot?.fetched_at ?? null,
    total: records.length,
    additions,
    revisions,
    record_status,
    attribution: 'Agentic Attack Index (MLSecOpsHub), CC BY-SA 4.0',
  };
}

export function siteOgTags(ctx) {
  const image = `${ctx.siteUrl}og/site.png`;
  const desc = `${ctx.summary.total} source-linked, graded records of real-world cyberattacks executed or orchestrated by AI agents, and rogue-agent incidents. Every dot has a footnote.`;
  return `<link rel="canonical" href="${esc(ctx.siteUrl)}">
    <link rel="alternate" type="application/atom+xml" title="${esc(SITE_NAME)} — new and revised records" href="${esc(ctx.siteUrl)}feed.atom">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(SITE_NAME)}">
    <meta property="og:title" content="${esc(SITE_NAME)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${esc(ctx.siteUrl)}">
    <meta property="og:image" content="${esc(image)}">
    <meta property="og:image:width" content="${CARD_W}">
    <meta property="og:image:height" content="${CARD_H}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(SITE_NAME)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${esc(image)}">
`;
}

// ---- discoverability -------------------------------------------------------

export function siteJsonLd(ctx) {
  const dates = ctx.incidents.map((r) => r.date_disclosed).sort();
  const modified = ctx.incidents.map((r) => r.last_updated ?? r.added?.date ?? r.date_disclosed).sort().at(-1) ?? ctx.snapshot?.fetched_at ?? null;
  const dist = (url, fmt) => ({ '@type': 'DataDownload', encodingFormat: fmt, contentUrl: url });
  const raw = `https://raw.githubusercontent.com/MLSecOpsHub/agentic-attack-index/${ctx.snapshot?.source_ref ?? 'main'}/dist/`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Agentic Attack Index',
    alternateName: SITE_NAME,
    description: `Curated, source-linked, graded records of real-world cyberattacks executed or orchestrated by AI agents, and rogue-agent incidents. ${ctx.summary.total} records, dataset v${ctx.version}. Each record carries status, confidence, AI-role and severity grades, MITRE ATLAS mappings, and every source with an archive copy where available.`,
    url: ctx.siteUrl,
    sameAs: [UPSTREAM],
    identifier: `agentic-attack-index v${ctx.version}`,
    version: ctx.version,
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'MLSecOpsHub', url: 'https://mlsecopshub.com' },
    publisher: { '@type': 'Organization', name: 'MLSecOpsHub', url: 'https://mlsecopshub.com' },
    keywords: ['AI security', 'agentic AI', 'cyberattack', 'incident tracker', 'MITRE ATLAS', 'prompt injection', 'rogue agents', 'threat intelligence'],
    temporalCoverage: dates.length ? `${dates[0]}/${dates.at(-1)}` : undefined,
    dateModified: modified ?? undefined,
    distribution: [dist(`${raw}incidents.json`, 'application/json'), dist(`${raw}incidents.csv`, 'text/csv'), dist(`${raw}incidents.ndjson`, 'application/x-ndjson'), dist(`${raw}stix/bundle.json`, 'application/stix+json'), dist(`${ctx.siteUrl}feed.atom`, 'application/atom+xml'), dist(`${ctx.siteUrl}misp/manifest.json`, 'application/json')],
    includedInDataCatalog: { '@type': 'DataCatalog', name: SITE_NAME, url: ctx.siteUrl },
  };
}

export function incidentJsonLd(rec, ctx) {
  const url = `${ctx.siteUrl}incident/${encodeURIComponent(rec.id)}/`;
  const added = rec.added?.date ?? rec.date_disclosed;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: rec.name,
    description: firstSentence(rec.summary),
    url,
    mainEntityOfPage: url,
    datePublished: added,
    dateModified: rec.last_updated ?? added,
    author: { '@type': 'Organization', name: 'MLSecOpsHub', url: 'https://mlsecopshub.com' },
    publisher: { '@type': 'Organization', name: 'MLSecOpsHub', url: 'https://mlsecopshub.com' },
    image: `${ctx.siteUrl}og/${encodeURIComponent(rec.id)}.png`,
    isPartOf: { '@type': 'Dataset', name: 'Agentic Attack Index', url: ctx.siteUrl },
    license: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: [rec.category, `status:${rec.status}`, `ai_role:${rec.ai_role ?? 'unknown'}`, ...(rec.model_families ?? [])],
    citation: (rec.sources ?? []).map((s) => s.url),
    identifier: rec.id,
  };
}

export function sitemapXml(ctx) {
  const rows = [{ loc: ctx.siteUrl, lastmod: ctx.snapshot?.fetched_at ?? null, priority: '1.0' }];
  for (const r of ctx.incidents.slice().sort((a, b) => a.id.localeCompare(b.id))) rows.push({ loc: `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, lastmod: r.last_updated ?? r.added?.date ?? r.date_disclosed, priority: '0.8' });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
}

export function robotsTxt(ctx) {
  return `User-agent: *\nAllow: /\nDisallow: /embed.html\n\nSitemap: ${ctx.siteUrl}sitemap.xml\n`;
}

// ---- Navigator layers -------------------------------------------------------

function techniqueCounts(records, key) {
  const m = new Map();
  for (const r of records.slice().sort((a, b) => a.id.localeCompare(b.id))) for (const id of r.mappings?.[key] ?? []) m.set(id, [...(m.get(id) ?? []), r.id]);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const LAYER_GRADIENT = ['#fde8d7', '#e07a2f', '#7f2a06'];

export function attackLayer(ctx) {
  const entries = techniqueCounts(ctx.incidents, 'mitre_attack');
  const max = Math.max(1, ...entries.map(([, ids]) => ids.length));
  return {
    name: `${SITE_NAME} — ATT&CK techniques (dataset v${ctx.version})`,
    versions: { layer: '4.5', navigator: '4.9.0' },
    domain: 'enterprise-attack',
    description: `Enterprise ATT&CK techniques mapped upstream in the Agentic Attack Index, dataset v${ctx.version}. Score = number of records carrying the technique; the comment lists the record ids. Mapped in ${ctx.incidents.filter((r) => (r.mappings?.mitre_attack ?? []).length).length} of ${ctx.incidents.length} records. CC BY-SA 4.0.`,
    techniques: entries.map(([id, ids]) => ({ techniqueID: id, score: ids.length, comment: ids.join(', '), enabled: true, showSubtechniques: true, links: ids.map((rid) => ({ label: rid, url: `${ctx.siteUrl}incident/${encodeURIComponent(rid)}/` })) })),
    gradient: { colors: LAYER_GRADIENT, minValue: 0, maxValue: max },
    legendItems: [{ label: 'records carrying the technique', color: LAYER_GRADIENT[1] }],
    metadata: [{ name: 'dataset', value: `agentic-attack-index v${ctx.version}` }, { name: 'license', value: 'CC BY-SA 4.0' }],
    links: [{ label: SITE_NAME, url: ctx.siteUrl }, { label: 'Agentic Attack Index', url: UPSTREAM }],
    layout: { layout: 'side', showID: true, showName: true },
    hideDisabled: false,
    sorting: 3,
  };
}

export function atlasLayer(ctx) {
  const entries = techniqueCounts(ctx.incidents, 'mitre_atlas');
  const max = Math.max(1, ...entries.map(([, ids]) => ids.length));
  return {
    name: `${SITE_NAME} — ATLAS techniques (dataset v${ctx.version})`,
    versions: { layer: '4.3', navigator: '4.6.4' },
    domain: 'atlas-atlas',
    description: `MITRE ATLAS techniques mapped upstream in the Agentic Attack Index, dataset v${ctx.version}. Score = number of records carrying the technique; the comment lists the record ids. Mapped in ${ctx.incidents.filter((r) => (r.mappings?.mitre_atlas ?? []).length).length} of ${ctx.incidents.length} records. CC BY-SA 4.0.`,
    techniques: entries.map(([id, ids]) => ({ techniqueID: id, score: ids.length, comment: ids.join(', '), enabled: true, showSubtechniques: true })),
    gradient: { colors: LAYER_GRADIENT, minValue: 0, maxValue: max },
    legendItems: [{ label: 'records carrying the technique', color: LAYER_GRADIENT[1] }],
    metadata: [{ name: 'dataset', value: `agentic-attack-index v${ctx.version}` }, { name: 'url', value: ctx.siteUrl }, { name: 'license', value: 'CC BY-SA 4.0' }],
    hideDisabled: false,
    sorting: 3,
  };
}

// ---- MISP feed ---------------------------------------------------------------

/** RFC 4122 v5 UUID (SHA-1) so every event and attribute id is stable across builds. */
export function uuid5(namespace, name) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(Buffer.concat([ns, Buffer.from(String(name), 'utf8')])).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const MISP_NAMESPACE = '5b7a3f2e-9c1d-4e8a-a6f0-2d3c4b5a6e7f';
const ORG = { name: 'MLSecOpsHub', uuid: uuid5(MISP_NAMESPACE, 'org:MLSecOpsHub') };
const THREAT_LEVEL = { critical: '1', high: '1', medium: '2', low: '3' };
const epoch = (iso) => String(Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000));

export function mispFeed(records, ctx) {
  const manifest = {};
  const events = {};
  const hashes = [];
  for (const r of records.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const uuid = uuid5(MISP_NAMESPACE, `event:${r.id}`);
    const ts = epoch(r.last_updated ?? r.added?.date ?? r.date_disclosed);
    const tags = [
      { name: 'tlp:clear' },
      { name: `rogue-agent-watch:status="${r.status}"` },
      { name: `rogue-agent-watch:confidence="${r.confidence}"` },
      { name: `rogue-agent-watch:ai-role="${r.ai_role ?? 'unknown'}"` },
      { name: `rogue-agent-watch:category="${r.category}"` },
      ...(r.mappings?.mitre_atlas ?? []).map((t) => ({ name: `mitre-atlas:technique="${t}"` })),
      ...(r.mappings?.mitre_attack ?? []).map((t) => ({ name: `mitre-attack:technique="${t}"` })),
      ...(r.mappings?.owasp_asi ?? []).map((t) => ({ name: `owasp-asi:${t}` })),
      ...(r.model_families ?? []).map((f) => ({ name: `rogue-agent-watch:model-family="${f}"` })),
    ];
    const attr = (type, category, value, comment = '') => {
      const a = { uuid: uuid5(MISP_NAMESPACE, `attr:${r.id}:${type}:${value}`), type, category, value, comment, to_ids: false, disable_correlation: false, timestamp: ts, distribution: '5' };
      hashes.push(`${createHash('md5').update(String(value)).digest('hex')},${uuid}`);
      return a;
    };
    const attributes = [
      attr('link', 'External analysis', `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, 'Rogue Agent Watch record'),
      attr('link', 'External analysis', ctx.upstreamIncidentUrl(r.id), 'Agentic Attack Index record (JSON)'),
      attr('text', 'Other', r.summary, 'Summary (defensive framing, lifecycle level)'),
      attr('text', 'Attribution', r.actor, `Actor as stated by sources (${r.actor_type})`),
      ...(r.sources ?? []).map((s) => attr('link', 'External analysis', s.url, `${s.publisher} — ${s.title}`)),
      ...(r.mappings?.cve ?? []).map((c) => attr('vulnerability', 'External analysis', c, 'CVE named by sources')),
    ];
    const head = { uuid, info: `${r.name} (${SITE_NAME})`, date: r.date_disclosed, timestamp: ts, analysis: '2', threat_level_id: THREAT_LEVEL[r.severity] ?? '4', Orgc: ORG, Tag: tags, extends_uuid: '' };
    manifest[uuid] = head;
    events[uuid] = { Event: { ...head, published: true, distribution: '3', Attribute: attributes } };
  }
  return { manifest, events, hashes: hashes.sort().join('\n') + '\n' };
}

export function loadContext(siteUrl = process.env.VITE_SITE_URL ?? DEFAULT_SITE_URL) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
  const incidents = read(path.join(SNAP, 'incidents.json'));
  const summary = read(path.join(SNAP, 'summary.json'));
  const snapshot = read(path.join(SNAP, 'SNAPSHOT.json'));
  const taxonomy = read(path.join(SNAP, 'taxonomy.json'));
  const topo = read(path.join(ROOT, 'data', 'geo', 'countries-110m.json'));
  const labels = {};
  for (const [k, v] of Object.entries(taxonomy)) labels[k] = Object.fromEntries((v.values ?? []).map((x) => [x.id, { label: x.label }]));
  const url = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  return {
    incidents,
    summary,
    snapshot,
    labels,
    version: summary.dataset_version,
    siteUrl: url,
    geo: buildGeo(topo),
    upstreamIncidentUrl: (id) => `https://raw.githubusercontent.com/MLSecOpsHub/agentic-attack-index/${snapshot.source_ref ?? 'main'}/dist/incidents/${encodeURIComponent(id)}.json`,
  };
}

async function renderPng(svg) {
  const { Resvg } = await import('@resvg/resvg-js');
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_W },
    background: C.ground,
    font: {
      loadSystemFonts: false,
      fontFiles: ['BarlowCondensed-Bold.ttf', 'Barlow-Regular.ttf', 'Barlow-SemiBold.ttf', 'IBMPlexMono-Regular.ttf'].map((f) => path.join(FONTS, f)),
      defaultFontFamily: 'Barlow',
    },
  });
  return r.render().asPng();
}

async function main() {
  if (!existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/index.html not found; run `vite build` first');
  const ctx = loadContext();
  const ids = new Set(ctx.summary.ids ?? []);
  for (const r of ctx.incidents) if (!ids.has(r.id)) throw new Error(`incident ${r.id} missing from summary.ids`);
  mkdirSync(path.join(DIST, 'og'), { recursive: true });
  let n = 0;
  for (const rec of ctx.incidents.slice().sort((a, b) => a.id.localeCompare(b.id))) {
    const dir = path.join(DIST, 'incident', rec.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), incidentHtml(rec, ctx).replace('</head>', `<script type="application/ld+json">${JSON.stringify(incidentJsonLd(rec, ctx)).replace(/<\//g, '<\\/')}</script>\n</head>`));
    writeFileSync(path.join(DIST, 'og', `${rec.id}.png`), await renderPng(cardSvg(rec, ctx)));
    n++;
  }
  writeFileSync(path.join(DIST, 'og', 'site.png'), await renderPng(siteCardSvg(ctx)));
  writeFileSync(path.join(DIST, 'feed.atom'), atomFeed(ctx.incidents, ctx));
  writeFileSync(path.join(DIST, 'changes.json'), JSON.stringify(changesJson(ctx.incidents, ctx), null, 2) + '\n');
  writeFileSync(path.join(DIST, 'sitemap.xml'), sitemapXml(ctx));
  writeFileSync(path.join(DIST, 'robots.txt'), robotsTxt(ctx));
  mkdirSync(path.join(DIST, 'navigator'), { recursive: true });
  writeFileSync(path.join(DIST, 'navigator', 'attack-layer.json'), JSON.stringify(attackLayer(ctx), null, 2) + '\n');
  writeFileSync(path.join(DIST, 'navigator', 'atlas-layer.json'), JSON.stringify(atlasLayer(ctx), null, 2) + '\n');
  const feed = mispFeed(ctx.incidents, ctx);
  mkdirSync(path.join(DIST, 'misp'), { recursive: true });
  writeFileSync(path.join(DIST, 'misp', 'manifest.json'), JSON.stringify(feed.manifest, null, 2) + '\n');
  for (const [uuid, ev] of Object.entries(feed.events)) writeFileSync(path.join(DIST, 'misp', `${uuid}.json`), JSON.stringify(ev, null, 2) + '\n');
  writeFileSync(path.join(DIST, 'misp', 'hashes.csv'), feed.hashes);
  const indexPath = path.join(DIST, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  if (!html.includes('property="og:title"')) {
    const ld = `<script type="application/ld+json">${JSON.stringify(siteJsonLd(ctx)).replace(/<\//g, '<\\/')}</script>\n`;
    writeFileSync(indexPath, html.replace('</head>', `    ${siteOgTags(ctx)}    ${ld}  </head>`));
  }
  console.log(`prerender: ${n} incident pages + cards, site card, feed.atom, changes.json, sitemap, robots, 2 Navigator layers, MISP feed (${Object.keys(feed.events).length} events) → ${path.relative(ROOT, DIST)} (site ${ctx.siteUrl})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`prerender: FAIL — ${err.message}`);
    process.exit(1);
  });
}
