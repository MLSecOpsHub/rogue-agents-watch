#!/usr/bin/env node
// Build-time prerender for sharing. Runs after `vite build` and writes, from the
// vendored snapshot only:
//   dist/incident/<id>/index.html   per-incident page with Open Graph / Twitter
//                                   meta tags that redirects to #/incident/<id>
//   dist/og/<id>.png                1200x630 share card per incident
//   dist/og/site.png                site-level card
//   dist/og/map.png, og/stats.png   route cards (the other routes share the site card)
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
// Usage: node scripts/prerender.mjs   (canonical URL from scripts/site-env.mjs;
// VITE_SITE_URL overrides, Vercel builds resolve to their own host)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCAL_SITE_URL, resolveSiteUrl } from './site-env.mjs';
import { actorBody, incidentBody, llmsFullTxt, llmsTxt, ROUTE_BODIES, ROUTE_PAGES, routeDescription } from './prerender-pages.mjs';
import { actorGroups, byDisclosedDesc, byIdAsc, CARD_H, CARD_W, datasetModified, esc, firstSentence, gradeLine, LICENSE_URL, PUBLISHER, SITE_NAME, tax, UPSTREAM, wrapText } from './prerender-util.mjs';
import { DATASET_DESCRIPTION, DATASET_NAME, HOME_COPY } from '../src/site-copy.mjs';

export { CARD_H, CARD_W, esc, firstSentence, SITE_NAME, UPSTREAM, wrapText };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SNAP = path.join(ROOT, 'data', 'snapshot');
const FONTS = path.join(ROOT, 'assets', 'fonts');

export const DEFAULT_SITE_URL = LOCAL_SITE_URL;

// The share cards are drawn in prerender-cards.mjs (one terminal treatment for
// the site card, the route cards and every record card); this file rasterises
// and places them. The hues are re-exported for the tests that tie them to
// the site's tokens.
import { buildGeo, cardSvg, ROUTE_CARDS, siteCardSvg, T } from './prerender-cards.mjs';
export { cardSvg, mapCardSvg, ROLE_HEX, ROUTE_CARDS, SEVERITY_HEX, siteCardSvg, STATUS_HEX, statsCardSvg } from './prerender-cards.mjs';

/** Content hash of a card: a changed card is a new URL, same snapshot, same URL. */
const cardVersion = (svg) => createHash('sha256').update(svg).digest('hex').slice(0, 10);

/**
 * Public URL of the site card, versioned by its content. Social platforms
 * cache an image by URL, so a new card gets a new URL; same snapshot, same
 * version. The file itself stays at og/site.png.
 */
export function siteImageUrl(ctx) {
  return `${ctx.siteUrl}og/site.png?v=${cardVersion(siteCardSvg(ctx))}`;
}

/** Public URL of a record's card, versioned by its content so a redrawn card is fetched afresh by platforms that cache by URL. */
export function recordImageUrl(ctx, rec) {
  return `${ctx.siteUrl}og/${encodeURIComponent(rec.id)}.png?v=${cardVersion(cardSvg(rec, ctx))}`;
}

/** Public URL of a route's own card (og/map.png, og/stats.png), versioned the same way; null for routes that share the site card. */
export function routeImageUrl(ctx, view) {
  const draw = ROUTE_CARDS[view];
  return draw ? `${ctx.siteUrl}og/${view}.png?v=${cardVersion(draw(ctx))}` : null;
}

// ---- pages ---------------------------------------------------------------------
//
// Every page is the Vite-built shell with its own head and a filled #app, so a
// crawler (JavaScript or not) sees the content at a stable, hash-free URL and a
// person gets the live app at the same URL. No meta refresh, no redirect: an
// instant refresh makes search engines treat the page as a redirect and drop it.

const HEAD_OPEN = '<!-- prerender:head -->';
const HEAD_CLOSE = '<!-- /prerender:head -->';

/** A shell with no page-specific head or body, whether given the raw Vite output or an already prerendered page. */
export function bareShell(html) {
  return html
    .replace(new RegExp(`\\s*${HEAD_OPEN}[\\s\\S]*?${HEAD_CLOSE}`), '')
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    .replace(/\s*<\/head>/, '\n</head>')
    .replace(/<div id="app">[\s\S]*?<\/div>(\s*<\/body>)/, '<div id="app"></div>$1');
}

// JSON inside <script> is not HTML, so "<" is encoded as \u003c (valid JSON) to keep dataset text from ever forming a tag.
const jsonLdTag = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/**
 * Assemble one page. `meta`: { title, description, url, image, imageAlt, ogType, jsonLd, extraHead }.
 * Head order matters little, but canonical, hreflang and description precede the social tags for readability.
 */
export function pageHtml(ctx, meta, body) {
  const image = meta.image ?? siteImageUrl(ctx);
  const head = `${HEAD_OPEN}
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${esc(meta.url)}">
<link rel="alternate" hreflang="en" href="${esc(meta.url)}">
<link rel="alternate" hreflang="x-default" href="${esc(meta.url)}">
<link rel="alternate" type="application/atom+xml" title="${esc(SITE_NAME)} — new and revised records" href="${esc(ctx.siteUrl)}feed.atom">
<meta name="theme-color" content="#0b1117">
${meta.extraHead ?? ''}<meta property="og:type" content="${esc(meta.ogType ?? 'website')}">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(meta.ogTitle ?? meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(meta.url)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="${CARD_W}">
<meta property="og:image:height" content="${CARD_H}">
<meta property="og:image:alt" content="${esc(meta.imageAlt ?? meta.title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.ogTitle ?? meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${esc(image)}">
${(Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]).filter(Boolean).map(jsonLdTag).join('\n')}
${HEAD_CLOSE}`;
  return bareShell(ctx.shell)
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="app"></div>', `<div id="app">\n${body}\n</div>`);
}

/** Per-incident page: the full record in static HTML, Open Graph card, Article JSON-LD, and the app boots in place. */
/** First sentence of a summary for a description, marked with an ellipsis when firstSentence() had to cut it. */
function leadSentence(summary) {
  const lead = firstSentence(summary);
  return /[.!?]$/.test(lead) ? lead : `${lead}…`;
}

export function incidentHtml(rec, ctx) {
  const url = `${ctx.siteUrl}incident/${encodeURIComponent(rec.id)}/`;
  const grades = gradeLine(ctx, rec);
  const added = rec.added?.date ?? rec.date_disclosed;
  return pageHtml(
    ctx,
    {
      // The record name alone: og:site_name carries the brand, and the names are long as published.
      title: rec.name,
      ogTitle: rec.name,
      // Event first so a search snippet leads with what happened; the grades follow.
      description: `${leadSentence(rec.summary)} ${grades}.`,
      url,
      image: recordImageUrl(ctx, rec),
      imageAlt: `${rec.name}: ${grades}`,
      ogType: 'article',
      extraHead: `<link rel="alternate" type="application/json" href="${esc(ctx.upstreamIncidentUrl(rec.id))}">
<meta property="article:published_time" content="${esc(added)}">
<meta property="article:modified_time" content="${esc(rec.last_updated ?? added)}">
<meta property="article:section" content="${esc(tax(ctx, 'category', rec.category))}">
${[`status:${rec.status}`, `ai_role:${rec.ai_role ?? 'unknown'}`, rec.category].map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}
`,
      jsonLd: [incidentJsonLd(rec, ctx), breadcrumbJsonLd(ctx, [[SITE_NAME, ctx.siteUrl], ['Records', `${ctx.siteUrl}timeline/`], [rec.name, url]])],
    },
    incidentBody(ctx, rec),
  );
}

/** Per-actor page: every record behind one verbatim actor string, with CollectionPage JSON-LD. */
export function actorHtml(group, ctx) {
  const url = `${ctx.siteUrl}actors/${encodeURIComponent(group.slug)}/`;
  const n = group.incidents.length;
  const types = group.actorTypes.map((t) => tax(ctx, 'actor_type', t)).join(', ');
  const description = `${group.actor}: ${n} AI-agent cyber incident record${n === 1 ? '' : 's'} in the Agentic Attack Index (actor type ${types}), as stated by the cited sources, with verification status, AI role, techniques, models and stated origin points.`;
  const { site, dataset } = ids(ctx);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': url,
    url,
    name: `${group.actor} — ${SITE_NAME}`,
    description,
    isPartOf: { '@id': site },
    about: { '@id': dataset },
    inLanguage: 'en',
    license: LICENSE_URL,
    mainEntity: { '@type': 'ItemList', numberOfItems: n, itemListElement: group.incidents.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, name: r.name })) },
  };
  return pageHtml(ctx, { title: `${group.actor} — ${SITE_NAME}`, ogTitle: `${group.actor} · ${SITE_NAME}`, description, url, jsonLd: [jsonLd, breadcrumbJsonLd(ctx, [[SITE_NAME, ctx.siteUrl], ['Actors', `${ctx.siteUrl}actors/`], [group.actor, url]])] }, actorBody(ctx, group));
}

/** One of the route pages (overview, map, timeline, table, actors, techniques, stats, about). */
export function routeHtml(view, ctx) {
  const route = ROUTE_PAGES.find((p) => p.view === view);
  if (!route) throw new Error(`unknown route page ${view}`);
  const url = `${ctx.siteUrl}${route.path}`;
  const title = view === 'overview' ? HOME_COPY.title : `${route.title} — ${SITE_NAME}`;
  const jsonLd = view === 'overview' ? [siteJsonLd(ctx)] : [routeJsonLd(ctx, route), breadcrumbJsonLd(ctx, [[SITE_NAME, ctx.siteUrl], [route.title, url]])];
  if (view === 'about') jsonLd.push(...definedTermSetsJsonLd(ctx));
  const image = routeImageUrl(ctx, view);
  return pageHtml(ctx, { title, ogTitle: view === 'overview' ? HOME_COPY.title : `${route.title} · ${SITE_NAME}`, description: routeDescription(ctx, view), url, jsonLd, ...(image ? { image, imageAlt: `${route.title} · ${SITE_NAME}` } : {}) }, ROUTE_BODIES[view](ctx));
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
  const image = siteImageUrl(ctx);
  const desc = HOME_COPY.metaDescription;
  return `<link rel="canonical" href="${esc(ctx.siteUrl)}">
    <link rel="alternate" type="application/atom+xml" title="${esc(SITE_NAME)} — new and revised records" href="${esc(ctx.siteUrl)}feed.atom">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${esc(SITE_NAME)}">
    <meta property="og:title" content="${esc(HOME_COPY.title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:url" content="${esc(ctx.siteUrl)}">
    <meta property="og:image" content="${esc(image)}">
    <meta property="og:image:width" content="${CARD_W}">
    <meta property="og:image:height" content="${CARD_H}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(HOME_COPY.title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${esc(image)}">
`;
}

// ---- discoverability -------------------------------------------------------

// Stable @ids so every page's JSON-LD refers to the same WebSite, Organization and Dataset nodes.
const ids = (ctx) => ({ site: `${ctx.siteUrl}#website`, org: `${PUBLISHER.url}/#organization`, dataset: `${ctx.siteUrl}#dataset` });

export function organizationJsonLd() {
  return { '@type': 'Organization', '@id': `${PUBLISHER.url}/#organization`, name: PUBLISHER.name, url: PUBLISHER.url, sameAs: [PUBLISHER.github] };
}

export function websiteJsonLd(ctx) {
  const { site, org } = ids(ctx);
  return {
    '@type': 'WebSite',
    '@id': site,
    name: SITE_NAME,
    url: ctx.siteUrl,
    description: routeDescription(ctx, 'overview'),
    inLanguage: 'en',
    publisher: { '@id': org },
    license: LICENSE_URL,
  };
}

export function datasetJsonLd(ctx) {
  const { org, dataset } = ids(ctx);
  const dates = ctx.incidents.map((r) => r.date_disclosed).sort();
  const modified = datasetModified(ctx.incidents, ctx.snapshot?.fetched_at ?? null);
  const dist = (url, fmt) => ({ '@type': 'DataDownload', encodingFormat: fmt, contentUrl: url });
  const raw = ctx.rawBase;
  return {
    '@type': 'Dataset',
    '@id': dataset,
    name: DATASET_NAME,
    description: `${DATASET_DESCRIPTION} ${ctx.summary.total} records, dataset v${ctx.version}. Each record carries verification status, sourcing confidence, AI-role and severity grades, MITRE ATLAS and ATT&CK mappings, and every source with an archive copy where available.`,
    url: ctx.siteUrl,
    sameAs: [UPSTREAM],
    identifier: `agentic-attack-index v${ctx.version}`,
    version: ctx.version,
    license: LICENSE_URL,
    isAccessibleForFree: true,
    inLanguage: 'en',
    creator: { '@id': org },
    publisher: { '@id': org },
    keywords: ['AI security', 'agentic AI', 'AI agents', 'cyberattack', 'incident database', 'MITRE ATLAS', 'MITRE ATT&CK', 'OWASP agentic top 10', 'prompt injection', 'rogue agents', 'threat intelligence', 'LLM security'],
    temporalCoverage: dates.length ? `${dates[0]}/${dates.at(-1)}` : undefined,
    dateModified: modified ?? undefined,
    conformsTo: ctx.schemaUrl,
    distribution: [dist(`${raw}incidents.json`, 'application/json'), dist(`${raw}incidents.csv`, 'text/csv'), dist(`${raw}incidents.ndjson`, 'application/x-ndjson'), dist(`${raw}stix/bundle.json`, 'application/stix+json'), dist(`${ctx.siteUrl}feed.atom`, 'application/atom+xml'), dist(`${ctx.siteUrl}misp/manifest.json`, 'application/json'), dist(`${ctx.siteUrl}llms-full.txt`, 'text/plain')],
    includedInDataCatalog: { '@type': 'DataCatalog', name: SITE_NAME, url: ctx.siteUrl },
    // datePublished is when the record was published here (added.date), the same value the
    // record's own Article emits; the disclosure date is a fact of the event, shown on the page.
    hasPart: ctx.incidents.slice().sort(byDisclosedDesc).map((r) => ({ '@type': 'Article', '@id': `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, headline: r.name, datePublished: r.added?.date ?? r.date_disclosed })),
  };
}

/** The landing page: one graph with the site, the publisher, the dataset and the ordered list of records. */
export function siteJsonLd(ctx) {
  const { site, dataset } = ids(ctx);
  const sorted = ctx.incidents.slice().sort(byDisclosedDesc);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationJsonLd(),
      websiteJsonLd(ctx),
      datasetJsonLd(ctx),
      {
        '@type': 'CollectionPage',
        '@id': ctx.siteUrl,
        url: ctx.siteUrl,
        name: SITE_NAME,
        description: routeDescription(ctx, 'overview'),
        isPartOf: { '@id': site },
        about: { '@id': dataset },
        inLanguage: 'en',
        mainEntity: {
          '@type': 'ItemList',
          itemListOrder: 'https://schema.org/ItemListOrderDescending',
          numberOfItems: sorted.length,
          itemListElement: sorted.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, name: r.name })),
        },
      },
    ],
  };
}

export function routeJsonLd(ctx, route) {
  const { site, dataset } = ids(ctx);
  const url = `${ctx.siteUrl}${route.path}`;
  return {
    '@context': 'https://schema.org',
    '@type': route.view === 'about' ? 'AboutPage' : 'CollectionPage',
    '@id': url,
    url,
    name: `${route.title} — ${SITE_NAME}`,
    description: routeDescription(ctx, route.view),
    isPartOf: { '@id': site },
    about: { '@id': dataset },
    inLanguage: 'en',
    license: LICENSE_URL,
  };
}

export function breadcrumbJsonLd(ctx, crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
  };
}

/** The grading vocabularies as DefinedTermSets, definitions verbatim from the upstream taxonomy. */
export function definedTermSetsJsonLd(ctx) {
  const { dataset } = ids(ctx);
  const keys = ['status', 'confidence', 'ai_role', 'severity', 'record_status', 'category', 'autonomy_level', 'guardrail_bypass', 'geo_basis'];
  return keys
    .filter((k) => ctx.taxonomy?.[k])
    .map((k) => {
      const setId = `${ctx.siteUrl}about/#${k}`;
      return {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        '@id': setId,
        name: `${ctx.taxonomy[k].title} (Agentic Attack Index)`,
        url: setId,
        isPartOf: { '@id': dataset },
        hasDefinedTerm: (ctx.taxonomy[k].values ?? []).map((v) => ({ '@type': 'DefinedTerm', '@id': `${setId}-${v.id}`, termCode: v.id, name: v.label, description: v.description, inDefinedTermSet: { '@id': setId } })),
      };
    });
}

export function incidentJsonLd(rec, ctx) {
  const { site, dataset } = ids(ctx);
  const url = `${ctx.siteUrl}incident/${encodeURIComponent(rec.id)}/`;
  const added = rec.added?.date ?? rec.date_disclosed;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': url,
    headline: rec.name,
    description: `${leadSentence(rec.summary)} ${gradeLine(ctx, rec)}.`,
    abstract: rec.summary,
    url,
    mainEntityOfPage: url,
    datePublished: added,
    dateModified: rec.last_updated ?? added,
    author: organizationJsonLd(),
    publisher: organizationJsonLd(),
    image: recordImageUrl(ctx, rec),
    isPartOf: [{ '@id': site }, { '@id': dataset }],
    about: { '@id': dataset },
    articleSection: tax(ctx, 'category', rec.category),
    inLanguage: 'en',
    license: LICENSE_URL,
    keywords: [rec.category, `status:${rec.status}`, `confidence:${rec.confidence}`, `ai_role:${rec.ai_role ?? 'unknown'}`, `severity:${rec.severity}`, ...(rec.model_families ?? []), ...(rec.mappings?.mitre_atlas ?? []), ...(rec.mappings?.mitre_attack ?? []), ...(rec.mappings?.cve ?? [])],
    citation: (rec.sources ?? []).map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url, publisher: { '@type': 'Organization', name: s.publisher }, ...(s.date ? { datePublished: s.date } : {}), ...(s.archive_url ? { archivedAt: s.archive_url } : {}) })),
    identifier: rec.id,
  };
}

export function sitemapXml(ctx) {
  const modified = datasetModified(ctx.incidents, ctx.snapshot?.fetched_at ?? null);
  const rows = ROUTE_PAGES.map((p) => ({ loc: `${ctx.siteUrl}${p.path}`, lastmod: p.view === 'about' ? (ctx.snapshot?.fetched_at ?? modified) : modified, priority: p.view === 'overview' ? '1.0' : '0.7', image: p.view === 'overview' ? siteImageUrl(ctx) : routeImageUrl(ctx, p.view) }));
  for (const r of ctx.incidents.slice().sort(byIdAsc)) rows.push({ loc: `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, lastmod: r.last_updated ?? r.added?.date ?? r.date_disclosed, priority: '0.8', image: recordImageUrl(ctx, r) });
  for (const g of actorGroups(ctx.incidents).slice().sort((a, b) => a.slug.localeCompare(b.slug))) rows.push({ loc: `${ctx.siteUrl}actors/${encodeURIComponent(g.slug)}/`, lastmod: datasetModified(g.incidents, modified), priority: '0.6', image: null });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.map((u) => `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority>${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc></image:image>` : ''}</url>`).join('\n')}
</urlset>
`;
}

// Crawlers that fetch pages for AI answers and training. The data is CC BY-SA and
// the site exists to be cited, so each is allowed explicitly rather than left to
// the wildcard; the embed page is a map-only iframe and never a useful result.
const AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider', 'cohere-ai', 'meta-externalagent', 'Amazonbot', 'DuckAssistBot', 'YouBot', 'MistralAI-User'];

export function robotsTxt(ctx) {
  const group = (ua) => `User-agent: ${ua}\nAllow: /\nDisallow: /embed.html\n`;
  return `${group('*')}\n${AI_CRAWLERS.map(group).join('\n')}\nSitemap: ${ctx.siteUrl}sitemap.xml\n\n# Machine-readable index of this site for AI assistants: ${ctx.siteUrl}llms.txt\n`;
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

// A Navigator layer holds techniques only; ATLAS case studies (AML.CS…) and tactics stay on record pages.
const ATLAS_TECHNIQUE = /^AML\.T\d{4}/;

export function atlasLayer(ctx) {
  const entries = techniqueCounts(ctx.incidents, 'mitre_atlas').filter(([id]) => ATLAS_TECHNIQUE.test(id));
  const max = Math.max(1, ...entries.map(([, ids]) => ids.length));
  return {
    name: `${SITE_NAME} — ATLAS techniques (dataset v${ctx.version})`,
    versions: { layer: '4.3', navigator: '4.6.4' },
    domain: 'atlas-atlas',
    description: `MITRE ATLAS techniques mapped upstream in the Agentic Attack Index, dataset v${ctx.version}. Score = number of records carrying the technique; the comment lists the record ids. Mapped in ${ctx.incidents.filter((r) => (r.mappings?.mitre_atlas ?? []).some((id) => ATLAS_TECHNIQUE.test(id))).length} of ${ctx.incidents.length} records. ATLAS case studies mapped upstream are linked from record pages, not included here. CC BY-SA 4.0.`,
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
      attr('link', 'External analysis', `${ctx.siteUrl}incident/${encodeURIComponent(r.id)}/`, `${SITE_NAME} record`),
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

/** Minimal shell used when dist/index.html is absent (tests); the real build supplies the Vite output. */
export const FALLBACK_SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="referrer" content="no-referrer" />
    <title>${SITE_NAME}</title>
  </head>
  <body>
    <div id="app"></div>
  </body>
</html>
`;

export function loadContext(siteUrl = resolveSiteUrl(), { shell } = {}) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
  const incidents = read(path.join(SNAP, 'incidents.json'));
  const summary = read(path.join(SNAP, 'summary.json'));
  const snapshot = read(path.join(SNAP, 'SNAPSHOT.json'));
  const taxonomy = read(path.join(SNAP, 'taxonomy.json'));
  const topo = read(path.join(ROOT, 'data', 'geo', 'countries-110m.json'));
  const labels = {};
  for (const [k, v] of Object.entries(taxonomy)) labels[k] = Object.fromEntries((v.values ?? []).map((x) => [x.id, { label: x.label }]));
  const url = siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`;
  const ref = snapshot.source_ref ?? 'main';
  const rawBase = `https://raw.githubusercontent.com/MLSecOpsHub/agentic-attack-index/${ref}/dist/`;
  const indexPath = path.join(DIST, 'index.html');
  return {
    incidents,
    summary,
    snapshot,
    taxonomy,
    labels,
    version: summary.dataset_version,
    siteUrl: url,
    rawBase,
    schemaUrl: `https://raw.githubusercontent.com/MLSecOpsHub/agentic-attack-index/${ref}/schema/incident.schema.json`,
    shell: shell ?? (existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : FALLBACK_SHELL),
    geo: buildGeo(topo),
    upstreamIncidentUrl: (id) => `${rawBase}incidents/${encodeURIComponent(id)}.json`,
  };
}

export async function renderPng(svg, background = T.ground) {
  const { Resvg } = await import('@resvg/resvg-js');
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: CARD_W },
    background,
    font: {
      loadSystemFonts: false,
      fontFiles: ['IBMPlexMono-Regular.ttf', 'IBMPlexMono-Bold.ttf'].map((f) => path.join(FONTS, f)),
      defaultFontFamily: 'IBM Plex Mono',
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
  for (const rec of ctx.incidents.slice().sort(byIdAsc)) {
    const dir = path.join(DIST, 'incident', rec.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), incidentHtml(rec, ctx));
    writeFileSync(path.join(DIST, 'og', `${rec.id}.png`), await renderPng(cardSvg(rec, ctx)));
    n++;
  }
  for (const p of ROUTE_PAGES) {
    const dir = p.path ? path.join(DIST, p.path) : DIST;
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), routeHtml(p.view, ctx));
  }
  const actors = actorGroups(ctx.incidents);
  for (const g of actors) {
    const dir = path.join(DIST, 'actors', g.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), actorHtml(g, ctx));
  }
  writeFileSync(path.join(DIST, 'llms.txt'), llmsTxt(ctx));
  writeFileSync(path.join(DIST, 'llms-full.txt'), llmsFullTxt(ctx));
  writeFileSync(path.join(DIST, 'og', 'site.png'), await renderPng(siteCardSvg(ctx)));
  for (const [view, draw] of Object.entries(ROUTE_CARDS)) writeFileSync(path.join(DIST, 'og', `${view}.png`), await renderPng(draw(ctx)));
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
  console.log(`prerender: ${n} incident pages + cards, ${ROUTE_PAGES.length} route pages, ${actors.length} actor pages, site card, ${Object.keys(ROUTE_CARDS).length} route cards, llms.txt, feed.atom, changes.json, sitemap, robots, 2 Navigator layers, MISP feed (${Object.keys(feed.events).length} events) → ${path.relative(ROOT, DIST)} (site ${ctx.siteUrl})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`prerender: FAIL — ${err.message}`);
    process.exit(1);
  });
}
