// Static pages: every route and every record as a real HTML document whose
// body carries the content a crawler needs without JavaScript. Each page is
// the Vite-built shell (same hashed assets) with its own head and a filled
// <div id="app">; when the app boots it replaces that content with the live
// view (src/router.ts reads the path when there is no hash).
//
// Rules: every number is a count over records, every string is escaped, no
// fact is added, grades are shown with the upstream definition, nulls say
// "not stated". The hash-less URLs here are the canonical ones.
import {
  aiidUrl, atlasUrl, attackUrl, byDisclosedDesc, byIdAsc, correctionIssueUrl, cveUrl, datasetModified, esc, firstSentence, gradeLine, LICENSE_URL, owaspAsiUrl, owaspLlmUrl, PUBLISHER, SITE_NAME, tax, taxDesc, UPSTREAM,
} from './prerender-util.mjs';

/** Route pages in navigation order. `path` is relative to the site root and ends with a slash (or is empty for the root). */
export const ROUTE_PAGES = [
  { path: '', view: 'overview', nav: 'Overview', title: SITE_NAME },
  { path: 'map/', view: 'map', nav: 'Map', title: 'Map' },
  { path: 'timeline/', view: 'timeline', nav: 'Timeline', title: 'Timeline' },
  { path: 'table/', view: 'table', nav: 'Table', title: 'Table' },
  { path: 'techniques/', view: 'techniques', nav: 'Techniques', title: 'Techniques' },
  { path: 'stats/', view: 'stats', nav: 'Stats', title: 'Stats' },
  { path: 'about/', view: 'about', nav: 'About', title: 'About' },
];

const u = (ctx, p = '') => `${ctx.siteUrl}${p}`;
const recUrl = (ctx, id) => u(ctx, `incident/${encodeURIComponent(id)}/`);
const recLink = (ctx, r) => `<a href="${esc(recUrl(ctx, r.id))}">${esc(r.name)}</a>`;
const list = (items) => (items.length ? `<ul>\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ul>` : '');
const dl = (rows) => `<dl class="def">\n${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('\n')}\n</dl>`;
const notStated = (v) => (v === null || v === undefined ? '<span class="muted">not stated</span>' : esc(String(v)));
const joinOr = (arr, fallback) => (arr && arr.length ? esc(arr.join(', ')) : `<span class="muted">${esc(fallback)}</span>`);

function countRows(ctx, key, counts) {
  return Object.entries(counts ?? {})
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, n]) => [tax(ctx, key, id), `${n}`]);
}

function table(headers, rows) {
  return `<table class="table">\n<thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>\n<tbody>\n${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}\n</tbody>\n</table>`;
}

/** One record as a list item with its grades: the unit every list page is built from. */
export function recordItem(ctx, r) {
  const inactive = r.record_status && r.record_status !== 'active' ? ` <strong>[${esc(tax(ctx, 'record_status', r.record_status))}]</strong>` : '';
  return `${recLink(ctx, r)}${inactive} <span class="muted">— disclosed <time datetime="${esc(r.date_disclosed)}">${esc(r.date_disclosed)}</time> · ${esc(gradeLine(ctx, r))}</span>`;
}

// ---- chrome ------------------------------------------------------------------

export function navHtml(ctx, current) {
  return `<nav class="nav" aria-label="Primary">${ROUTE_PAGES.map((p) => `<a href="${esc(u(ctx, p.path))}"${p.view === current ? ' aria-current="page"' : ''}>${esc(p.nav)}</a>`).join('\n')}</nav>`;
}

export function footerHtml(ctx) {
  return `<footer class="site-footer"><p>Data: <a href="${UPSTREAM}">Agentic Attack Index</a> (${esc(PUBLISHER.name)}), dataset v${esc(ctx.version)}, <a href="${LICENSE_URL}">CC BY-SA 4.0</a>. Snapshot ${esc(ctx.snapshot?.source_commit?.slice(0, 8) ?? '')} fetched ${esc(ctx.snapshot?.fetched_at ?? '')}. Static site, no analytics, no trackers. <a href="${esc(u(ctx, 'feed.atom'))}">Atom feed</a> · <a href="${esc(u(ctx, 'llms.txt'))}">llms.txt</a>.</p></footer>`;
}

function page(ctx, { view, title, body }) {
  return `<header class="site-header"><p><a href="${esc(u(ctx))}"><strong>${esc(SITE_NAME)}</strong></a> — source-linked, graded records of AI-agent cyberattacks and rogue-agent incidents</p>\n${navHtml(ctx, view)}</header>\n<main id="main" class="main" data-view="${esc(view)}">\n<h1>${esc(title)}</h1>\n${body}\n</main>\n${footerHtml(ctx)}`;
}

// ---- route pages --------------------------------------------------------------

export function overviewBody(ctx) {
  const s = ctx.summary;
  const active = ctx.incidents.filter((r) => !r.record_status || r.record_status === 'active');
  const status = countRows(ctx, 'status', s.by_status);
  const role = countRows(ctx, 'ai_role', s.by_ai_role);
  const dates = ctx.incidents.map((r) => r.date_disclosed).sort();
  return page(ctx, {
    view: 'overview',
    title: SITE_NAME,
    body: `<p class="lede">${s.total} source-linked, graded records of real-world cyberattacks executed or orchestrated by AI agents, and of rogue-agent incidents, disclosed between <time datetime="${esc(dates[0])}">${esc(dates[0])}</time> and <time datetime="${esc(dates.at(-1))}">${esc(dates.at(-1))}</time>. Rendered from the <a href="${UPSTREAM}">Agentic Attack Index</a> dataset v${esc(ctx.version)}. Every record shows what is confirmed, what is only reported, how central the AI was, and every source behind it.</p>
<h2>By verification status</h2>
${dl(status)}
<h2>By AI role</h2>
${dl(role)}
<h2>All records, newest disclosure first</h2>
<ol>
${active.slice().sort(byDisclosedDesc).map((r) => `<li>${recordItem(ctx, r)}</li>`).join('\n')}
</ol>
${ctx.incidents.length > active.length ? `<p>${ctx.incidents.length - active.length} retracted or superseded record(s) are excluded from the counts above and listed on the <a href="${esc(u(ctx, 'table/'))}">table</a>.</p>` : ''}
<h2>Views</h2>
${list(ROUTE_PAGES.filter((p) => p.path).map((p) => `<a href="${esc(u(ctx, p.path))}">${esc(p.nav)}</a>`))}
<p>How to read the grades: <a href="${esc(u(ctx, 'about/'))}">About</a>. Machine readers: <a href="${esc(u(ctx, 'feed.atom'))}">Atom feed</a>, <a href="${esc(u(ctx, 'navigator/attack-layer.json'))}">ATT&amp;CK Navigator layer</a>, <a href="${esc(u(ctx, 'navigator/atlas-layer.json'))}">ATLAS Navigator layer</a>, <a href="${esc(u(ctx, 'misp/manifest.json'))}">MISP feed</a>, <a href="${esc(u(ctx, 'llms.txt'))}">llms.txt</a>.</p>`,
  });
}

function pointLine(ctx, p) {
  const how = p.illustrative ? 'illustrative, country-level centroid' : 'stated location';
  const basis = p.basis ? tax(ctx, 'geo_basis', p.basis).toLowerCase() : 'basis not stated';
  return `${esc(p.role)}: ${esc(p.label)} <span class="muted">(${esc(how)}; ${esc(basis)}${p.attributed_by ? `, per ${esc(p.attributed_by)}` : ''}${p.country ? `; ${esc(p.country)}` : ''})</span>`;
}

export function mapBody(ctx) {
  const withGeo = ctx.incidents.filter((r) => r.geo?.points?.length).sort(byIdAsc);
  const without = ctx.incidents.filter((r) => !r.geo?.points?.length).sort(byIdAsc);
  const points = withGeo.reduce((n, r) => n + r.geo.points.length, 0);
  const illustrative = withGeo.reduce((n, r) => n + r.geo.points.filter((p) => p.illustrative).length, 0);
  return page(ctx, {
    view: 'map',
    title: 'Map',
    body: `<p class="lede">${withGeo.length} of ${ctx.incidents.length} records carry a stated location and appear on the map; ${without.length} do not and are listed below, never plotted. ${points} points in total, ${illustrative} of them country-level centroids. Every point states its role, the basis it rests on and the publisher that stated it. Nothing is geocoded from a country list or an actor name.</p>
<h2>Records with stated map points</h2>
${withGeo.map((r) => `<h3>${recLink(ctx, r)}</h3>\n<p class="muted">${esc(gradeLine(ctx, r))}</p>\n${list(r.geo.points.map((p) => pointLine(ctx, p)))}`).join('\n')}
<h2>Records without a stated location</h2>
${list(without.map((r) => recordItem(ctx, r)))}
<p>Basis vocabulary: ${(ctx.taxonomy?.geo_basis?.values ?? []).map((v) => `<strong>${esc(v.label)}</strong> — ${esc(v.description)}`).join(' ')}</p>`,
  });
}

export function timelineBody(ctx) {
  const years = [...new Set(ctx.incidents.map((r) => r.date_disclosed.slice(0, 4)))].sort().reverse();
  return page(ctx, {
    view: 'timeline',
    title: 'Timeline',
    body: `<p class="lede">${ctx.incidents.length} records by disclosure date, newest first. Status, sourcing confidence, AI role and severity are shown for each.</p>
${years.map((y) => `<h2>${esc(y)} <span class="muted">(${ctx.summary.by_year?.[y] ?? ctx.incidents.filter((r) => r.date_disclosed.startsWith(y)).length})</span></h2>\n<ol>\n${ctx.incidents.filter((r) => r.date_disclosed.startsWith(y)).sort(byDisclosedDesc).map((r) => `<li>${recordItem(ctx, r)}<br><span class="muted">${esc(tax(ctx, 'category', r.category))} · actor as stated: ${esc(r.actor)}</span></li>`).join('\n')}\n</ol>`).join('\n')}`,
  });
}

export function tableBody(ctx) {
  const rows = ctx.incidents.slice().sort(byDisclosedDesc).map((r) => [
    recLink(ctx, r) + (r.record_status && r.record_status !== 'active' ? ` <strong>[${esc(tax(ctx, 'record_status', r.record_status))}]</strong>` : ''),
    `<time datetime="${esc(r.date_disclosed)}">${esc(r.date_disclosed)}</time>`,
    esc(tax(ctx, 'status', r.status)),
    esc(tax(ctx, 'confidence', r.confidence)),
    esc(tax(ctx, 'ai_role', r.ai_role ?? 'unknown')),
    esc(tax(ctx, 'severity', r.severity)),
    esc(tax(ctx, 'category', r.category)),
    `${esc(r.actor)} <span class="muted">(${esc(tax(ctx, 'actor_type', r.actor_type))})</span>`,
    esc((r.model_families ?? []).map((f) => tax(ctx, 'model_families', f)).join(', ')),
    `${(r.sources ?? []).length}`,
  ]);
  return page(ctx, {
    view: 'table',
    title: 'Table',
    body: `<p class="lede">Every record in the dataset with its grades, category, actor as stated by sources, model families and source count. The live table adds filters, search and CSV/JSON download.</p>
${table(['Record', 'Disclosed', 'Status', 'Confidence', 'AI role', 'Severity', 'Category', 'Actor (as stated)', 'Model families', 'Sources'], rows)}
<p>Downloads of the full dataset: <a href="${esc(ctx.rawBase)}incidents.json">incidents.json</a>, <a href="${esc(ctx.rawBase)}incidents.csv">incidents.csv</a>, <a href="${esc(ctx.rawBase)}stix/bundle.json">STIX 2.1 bundle</a>.</p>`,
  });
}

function mappingSection(ctx, title, key, link, note = '') {
  const m = new Map();
  for (const r of ctx.incidents.slice().sort(byIdAsc)) for (const id of r.mappings?.[key] ?? []) m.set(id, [...(m.get(id) ?? []), r]);
  const entries = [...m.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const mapped = ctx.incidents.filter((r) => (r.mappings?.[key] ?? []).length).length;
  return `<h2>${esc(title)} <span class="muted">(${mapped} of ${ctx.incidents.length} records mapped)</span></h2>
${note ? `<p class="muted">${esc(note)}</p>` : ''}
${entries.length ? list(entries.map(([id, recs]) => `<a href="${esc(link(id))}" rel="external">${esc(id)}</a> — ${recs.length} record${recs.length === 1 ? '' : 's'}: ${recs.map((r) => recLink(ctx, r)).join(', ')}`)) : '<p class="muted">No record carries a mapping in this framework yet. A gap here is a missing value upstream, never zero.</p>'}`;
}

export function techniquesBody(ctx) {
  const phases = new Map();
  for (const r of ctx.incidents.slice().sort(byIdAsc)) for (const p of r.lifecycle_phases ?? []) phases.set(p, (phases.get(p) ?? 0) + 1);
  const phaseOrder = (ctx.taxonomy?.lifecycle_phases?.values ?? []).map((v) => v.id);
  return page(ctx, {
    view: 'techniques',
    title: 'Techniques',
    body: `<p class="lede">Framework ids carried by the ${ctx.incidents.length} records, with the records behind each id. Mappings come from the dataset as published; counts are counts of records, never scores. Navigator layers: <a href="${esc(u(ctx, 'navigator/attack-layer.json'))}">ATT&amp;CK (layer 4.5)</a>, <a href="${esc(u(ctx, 'navigator/atlas-layer.json'))}">ATLAS (layer 4.3)</a>.</p>
${mappingSection(ctx, 'MITRE ATLAS', 'mitre_atlas', atlasUrl)}
${mappingSection(ctx, 'MITRE ATT&CK', 'mitre_attack', attackUrl)}
${mappingSection(ctx, 'OWASP Top 10 for Agentic Applications (ASI)', 'owasp_asi', owaspAsiUrl)}
${mappingSection(ctx, 'OWASP Top 10 for LLM Applications', 'owasp_llm', owaspLlmUrl)}
${mappingSection(ctx, 'CVE', 'cve', cveUrl)}
${mappingSection(ctx, 'AI Incident Database', 'aiid', aiidUrl)}
<h2>Attack lifecycle phases <span class="muted">(records per phase)</span></h2>
${dl(phaseOrder.filter((p) => phases.has(p)).map((p) => [tax(ctx, 'lifecycle_phases', p), `${phases.get(p)}`]))}`,
  });
}

export function statsBody(ctx) {
  const s = ctx.summary;
  const sections = [
    ['Verification status', 'status', s.by_status],
    ['Severity', 'severity', s.by_severity],
    ['AI role', 'ai_role', s.by_ai_role],
    ['Incident category', 'category', s.by_category],
    ['Actor type', 'actor_type', s.by_actor_type],
    ['Agentic autonomy level', 'autonomy_level', s.by_autonomy_level],
    ['Model family', 'model_families', s.by_model_family],
    ['Year of disclosure', null, s.by_year],
  ];
  const geo = s.geo_coverage;
  const arch = s.archive_coverage;
  return page(ctx, {
    view: 'stats',
    title: 'Stats',
    body: `<p class="lede">Counts over the ${s.total} records of dataset v${esc(ctx.version)}, taken verbatim from the upstream summary. Every figure is a number of records; a gap is a missing value upstream, never zero.</p>
${sections.map(([t, key, counts]) => `<h2>${esc(t)}</h2>\n${dl(key ? countRows(ctx, key, counts) : Object.entries(counts ?? {}).sort().map(([k, n]) => [k, `${n}`]))}`).join('\n')}
${geo ? `<h2>Map coverage</h2>\n${dl([['Records with a stated location', `${geo.records} of ${s.total}`], ['Points', `${geo.points} (${geo.illustrative} country-level centroids)`], ['By role', esc(Object.entries(geo.by_role ?? {}).map(([k, n]) => `${k} ${n}`).join(', '))], ['By basis', esc(Object.entries(geo.by_basis ?? {}).map(([k, n]) => `${tax(ctx, 'geo_basis', k)} ${n}`).join(', '))]])}` : ''}
${arch ? `<h2>Source archiving</h2>\n${dl([['Source URLs', `${arch.sources}`], ['With an archived copy', `${arch.archived} (${arch.pct}%)`]])}` : ''}`,
  });
}

const GRADE_KEYS = [
  ['status', 'Verification status'],
  ['confidence', 'Sourcing confidence'],
  ['ai_role', 'AI role'],
  ['severity', 'Severity'],
  ['record_status', 'Record status'],
  ['category', 'Incident category'],
  ['autonomy_level', 'Agentic autonomy level'],
  ['guardrail_bypass', 'Guardrail bypass'],
  ['geo_basis', 'Map-point basis'],
];

export function aboutBody(ctx) {
  const defs = (key) => (ctx.taxonomy?.[key]?.values ?? []).map((v) => [v.label, esc(v.description)]);
  return page(ctx, {
    view: 'about',
    title: 'About',
    body: `<h2>What this is</h2>
<p>${esc(SITE_NAME)} renders the <a href="${UPSTREAM}">Agentic Attack Index</a>, an open, source-linked dataset of real-world cyberattacks executed or orchestrated by AI agents, and of rogue-agent incidents, published by <a href="${PUBLISHER.url}">${esc(PUBLISHER.name)}</a> under CC BY-SA 4.0. This site is the presentation layer only: it adds no facts, computes no score, and shows every record with the grades the dataset assigns and every source the dataset cites.</p>
<h2>What counts as an incident</h2>
<p>A record describes one disclosed event in which an AI agent or model executed, orchestrated or materially enabled a cyberattack, or in which an agent acted against its operator's intent, with at least one resolvable source. Research demonstrations are included only when graded as test-eval. Lifecycle phases and framework mappings are shown; exploit detail, payloads and prompts are not.</p>
<h2>How to read the grades</h2>
<p>Three independent grades appear on every card, row and page. Verification status says how well the event is established; sourcing confidence says how direct the evidence is; AI role says how central the AI actually was. "Reported" is not "confirmed", and "AI incidental" means the AI was present but not what made the attack work. The definitions below are the upstream taxonomy, verbatim.</p>
${GRADE_KEYS.map(([key, title]) => `<h3 id="${esc(key)}">${esc(ctx.taxonomy?.[key]?.title ?? title)}</h3>\n${dl(defs(key))}`).join('\n')}
<h2>The map and the illustrative-geo rule</h2>
<p>A record appears on the map only if the dataset carries a geo block with coordinates. Every point states its role (origin or target), the basis it rests on and the publisher that stated it; a state sponsor is never presented as an operator location. Points flagged illustrative are country-level centroids, not real locations, and are labelled as such. The dashboard never geocodes a country list, an actor name or a sector into a point; records without geo are listed beside the map rather than placed on it.</p>
<h2>Nulls, attribution, victims</h2>
<p>A null means the sources did not state a figure and is rendered "not stated", never zero. Actors are shown exactly as stated; "Unknown" stays Unknown, and no country of origin is inferred from a name. Only organisations named in the dataset appear.</p>
<h2>Corrections</h2>
<p>Every record page links to a pre-filled upstream issue. Corrections are made in the dataset, never here. <a href="${UPSTREAM}/issues">Open an issue</a>.</p>
<h2>Interop and reuse</h2>
${list([
  `<a href="${esc(u(ctx, 'feed.atom'))}">Atom feed</a> of new and revised records`,
  `<a href="${esc(u(ctx, 'navigator/attack-layer.json'))}">ATT&amp;CK Navigator layer</a> and <a href="${esc(u(ctx, 'navigator/atlas-layer.json'))}">ATLAS Navigator layer</a>`,
  `<a href="${esc(u(ctx, 'misp/manifest.json'))}">MISP feed</a> (static, v5 UUIDs stable across builds)`,
  `<a href="${esc(ctx.rawBase)}stix/bundle.json">STIX 2.1 bundle</a> (upstream)`,
  `<a href="${esc(u(ctx, 'llms.txt'))}">llms.txt</a> and <a href="${esc(u(ctx, 'llms-full.txt'))}">llms-full.txt</a> for AI assistants and agents`,
])}
<h2>Licences and privacy</h2>
<p>Code MIT; data CC BY-SA 4.0, attribute "Agentic Attack Index (${esc(PUBLISHER.name)})" with a link and share alike. The site is static, sets no cookies, loads no external fonts and runs no analytics.</p>`,
  });
}

export const ROUTE_BODIES = { overview: overviewBody, map: mapBody, timeline: timelineBody, table: tableBody, techniques: techniquesBody, stats: statsBody, about: aboutBody };

/** Meta description for a route page, derived from the dataset. */
export function routeDescription(ctx, view) {
  const n = ctx.incidents.length;
  const dates = ctx.incidents.map((r) => r.date_disclosed).sort();
  const withGeo = ctx.incidents.filter((r) => r.geo?.points?.length).length;
  switch (view) {
    case 'overview':
      return `${n} source-linked, graded records of real-world cyberattacks executed or orchestrated by AI agents, and rogue-agent incidents (${dates[0]} to ${dates.at(-1)}). Every record shows verification status, sourcing confidence, AI role and severity, with every source cited. Agentic Attack Index v${ctx.version}, CC BY-SA 4.0.`;
    case 'map':
      return `World map of the ${withGeo} of ${n} AI-agent cyber incidents that carry a stated location. Every point states its role, its basis (sponsor attribution, operator location, victim location…) and the publisher that stated it; the other ${n - withGeo} records are listed, never plotted.`;
    case 'timeline':
      return `${n} AI-agent cyberattacks and rogue-agent incidents by disclosure date, ${dates[0]} to ${dates.at(-1)}, each with verification status, sourcing confidence, AI role and severity.`;
    case 'table':
      return `Every record of the Agentic Attack Index v${ctx.version}: ${n} AI-agent cyber incidents with grades, category, actor as stated by sources, model families and source counts. Filterable table with CSV and JSON download.`;
    case 'techniques':
      return `MITRE ATLAS and ATT&CK techniques, OWASP agentic and LLM risks, CVEs and AI Incident Database ids mapped across ${n} AI-agent cyber incidents, with the records behind each id and Navigator layers to download.`;
    case 'stats':
      return `Counts over ${n} AI-agent cyber incident records by verification status, severity, AI role, category, actor type, autonomy level, model family and year, plus map and source-archiving coverage. Agentic Attack Index v${ctx.version}.`;
    case 'about':
      return `What counts as an AI-agent cyber incident, how records are graded (verification status, sourcing confidence, AI role, severity), the map-point basis rule, corrections, interop feeds and licences for ${SITE_NAME}.`;
    default:
      return '';
  }
}

// ---- incident page -------------------------------------------------------------

function gradeRows(ctx, r) {
  const row = (key, label, id) => [label, `<strong>${esc(tax(ctx, key, id))}</strong>${taxDesc(ctx, key, id) ? ` <span class="muted">— ${esc(taxDesc(ctx, key, id))}</span>` : ''}`];
  return [row('status', 'Verification status', r.status), row('confidence', 'Sourcing confidence', r.confidence), row('ai_role', 'AI role', r.ai_role ?? 'unknown'), row('severity', 'Severity', r.severity)];
}

function sourceItem(ctx, s) {
  const bits = [esc(s.publisher), esc(tax(ctx, 'source_type', s.type))];
  if (s.date) bits.push(`<time datetime="${esc(s.date)}">${esc(s.date)}</time>`);
  bits.push(s.archive_url ? `<a href="${esc(s.archive_url)}" rel="external">archived copy</a>` : '<span class="muted">no archive recorded</span>');
  return `<a href="${esc(s.url)}" rel="external">${esc(s.title)}</a><br><span class="muted">${bits.join(' · ')}</span>`;
}

export function incidentBody(ctx, r) {
  const byId = new Map(ctx.incidents.map((x) => [x.id, x]));
  const mappings = [
    ['MITRE ATLAS', r.mappings?.mitre_atlas, atlasUrl],
    ['MITRE ATT&CK', r.mappings?.mitre_attack, attackUrl],
    ['OWASP Agentic Top 10', r.mappings?.owasp_asi, owaspAsiUrl],
    ['OWASP LLM Top 10', r.mappings?.owasp_llm, owaspLlmUrl],
    ['CVE', r.mappings?.cve, cveUrl],
    ['AI Incident Database', r.mappings?.aiid, aiidUrl],
  ].filter(([, ids]) => ids && ids.length);
  const inactive = r.record_status && r.record_status !== 'active';
  const sup = r.superseded_by ? byId.get(r.superseded_by) : null;
  const citation = `Agentic Attack Index (${PUBLISHER.name}), dataset v${ctx.version}, record "${r.id}". ${ctx.upstreamIncidentUrl(r.id)} — CC BY-SA 4.0.`;
  const body = `<article>
<p class="crumbs"><a href="${esc(u(ctx))}">${esc(SITE_NAME)}</a> › <a href="${esc(u(ctx, 'timeline/'))}">Records</a> › <code>${esc(r.id)}</code></p>
<h1>${esc(r.name)}</h1>
<p>Disclosed <time datetime="${esc(r.date_disclosed)}">${esc(r.date_disclosed)}</time>${r.added?.date ? ` · added to the index <time datetime="${esc(r.added.date)}">${esc(r.added.date)}</time>` : ''}${r.last_updated ? ` · last updated <time datetime="${esc(r.last_updated)}">${esc(r.last_updated)}</time>` : ''}</p>
${inactive ? `<p><strong>Record status: ${esc(tax(ctx, 'record_status', r.record_status))}.</strong> ${esc(taxDesc(ctx, 'record_status', r.record_status))}${sup ? ` Superseded by ${recLink(ctx, sup)}.` : ''} Excluded from headline counts.</p>` : ''}
<h2>Grades</h2>
${dl(gradeRows(ctx, r))}
<h2>Summary</h2>
<p>${esc(r.summary)}</p>
${r.impact ? `<h2>Impact as stated</h2>\n<p>${esc(r.impact)}</p>` : ''}
<h2>Facts as stated by sources</h2>
${dl([
  ['Actor', `<strong>${esc(r.actor)}</strong> <span class="muted">(${esc(tax(ctx, 'actor_type', r.actor_type))})</span>`],
  ['Category', esc(tax(ctx, 'category', r.category))],
  ['Models named', joinOr(r.models, 'not named by sources')],
  ['Model families', joinOr((r.model_families ?? []).map((f) => tax(ctx, 'model_families', f)), 'not stated')],
  ['Agentic autonomy level', esc(tax(ctx, 'autonomy_level', r.autonomy_level ?? 'unknown'))],
  ...(typeof r.autonomy_pct === 'number' ? [['Autonomy stated by source', `${esc(r.autonomy_pct)}%`]] : []),
  ['Guardrail bypass', joinOr((r.guardrail_bypass ?? []).map((g) => tax(ctx, 'guardrail_bypass', g)), 'not stated')],
  ['Attack lifecycle phases', joinOr((r.lifecycle_phases ?? []).map((p) => tax(ctx, 'lifecycle_phases', p)), 'not stated')],
  ['Target sectors', joinOr((r.targets?.sectors ?? []).map((s) => tax(ctx, 'sectors', s)), 'not stated')],
  ['Target countries', joinOr(r.targets?.countries ?? [], 'not stated')],
  ['Organisations affected', notStated(r.targets?.orgs_affected)],
  ['Records exfiltrated', notStated(r.targets?.records_exfiltrated)],
])}
<h2>Framework mappings</h2>
${mappings.length ? dl(mappings.map(([t, ids, link]) => [t, ids.map((id) => `<a href="${esc(link(id))}" rel="external">${esc(id)}</a>`).join(', ')])) : '<p class="muted">None recorded upstream.</p>'}
${(r.mitigations ?? []).length ? `<h2>Mitigations as stated</h2>\n${list(r.mitigations.map((m) => esc(m)))}` : ''}
${r.geo?.points?.length ? `<h2>Map points</h2>\n${list(r.geo.points.map((p) => pointLine(ctx, p)))}` : '<h2>Map</h2>\n<p class="muted">No cited source states a location; this record is listed beside the map, never plotted.</p>'}
${(r.related ?? []).length ? `<h2>Related records</h2>\n${list(r.related.map((id) => (byId.get(id) ? recLink(ctx, byId.get(id)) : `<code>${esc(id)}</code>`)))}` : ''}
<h2>Sources (${(r.sources ?? []).length})</h2>
<ol class="sources">
${(r.sources ?? []).map((s) => `<li>${sourceItem(ctx, s)}</li>`).join('\n')}
</ol>
${(r.revisions ?? []).length ? `<h2>Revisions</h2>\n${list(r.revisions.map((v) => `<time datetime="${esc(v.date)}">${esc(v.date)}</time> — ${esc(v.note)}`))}` : ''}
<h2>Cite this record</h2>
<pre class="cite">${esc(citation)}</pre>
<p><a href="${esc(ctx.upstreamIncidentUrl(r.id))}">Record JSON</a> · <a href="${esc(`${UPSTREAM}/blob/${ctx.snapshot?.source_ref ?? 'main'}/data/incidents/${encodeURIComponent(r.id)}.yml`)}">Source YAML</a> · <a href="${esc(correctionIssueUrl(r.id))}">Report a correction</a></p>
</article>`;
  return page(ctx, { view: 'incident', title: '', body }).replace('<h1></h1>\n', '');
}

// ---- llms.txt -----------------------------------------------------------------

export function llmsTxt(ctx) {
  const sorted = ctx.incidents.slice().sort(byDisclosedDesc);
  const s = ctx.summary;
  const status = Object.entries(s.by_status ?? {}).map(([k, n]) => `${n} ${tax(ctx, 'status', k).toLowerCase()}`).join(', ');
  return `# ${SITE_NAME}

> ${s.total} source-linked, graded records of real-world cyberattacks executed or orchestrated by AI agents, and of rogue-agent incidents. Rendered from the Agentic Attack Index dataset v${ctx.version} (${PUBLISHER.name}), CC BY-SA 4.0. Latest data: ${datasetModified(ctx.incidents, ctx.snapshot?.fetched_at ?? '')}.

Every record carries three independent grades: verification status (confirmed, reported, test-eval), sourcing confidence (primary, secondary, unverified) and AI role (load-bearing, significant, incidental, disputed, unknown), plus severity. Of ${s.total} records: ${status}. A "reported" record is not confirmed; "AI incidental" means the AI was present but not what made the attack work. Nulls mean "not stated", never zero. Actors are shown as stated by sources; nothing is inferred. Cite the dataset as "Agentic Attack Index (${PUBLISHER.name})" with a link.

## Pages

${ROUTE_PAGES.map((p) => `- [${p.nav}](${u(ctx, p.path)}): ${routeDescription(ctx, p.view)}`).join('\n')}
- [Grade definitions](${u(ctx, 'about/')}#status): the upstream taxonomy, verbatim.

## Records (newest disclosure first)

${sorted.map((r) => `- [${r.name}](${recUrl(ctx, r.id)}): disclosed ${r.date_disclosed}; ${gradeLine(ctx, r)}. ${firstSentence(r.summary)}`).join('\n')}

## Data and interop

- [incidents.json](${ctx.rawBase}incidents.json): the full dataset, one object per record
- [incidents.csv](${ctx.rawBase}incidents.csv)
- [JSON Schema](${ctx.schemaUrl})
- [STIX 2.1 bundle](${ctx.rawBase}stix/bundle.json)
- [Atom feed](${u(ctx, 'feed.atom')}): new and revised records
- [changes.json](${u(ctx, 'changes.json')}): latest additions and revisions
- [ATT&CK Navigator layer](${u(ctx, 'navigator/attack-layer.json')}) and [ATLAS Navigator layer](${u(ctx, 'navigator/atlas-layer.json')})
- [MISP feed](${u(ctx, 'misp/manifest.json')})
- [Full text of every record](${u(ctx, 'llms-full.txt')})
- [Upstream repository](${UPSTREAM}): propose a record or a correction
`;
}

export function llmsFullTxt(ctx) {
  const byId = new Map(ctx.incidents.map((x) => [x.id, x]));
  const field = (k, v) => `- ${k}: ${v}`;
  const rec = (r) => {
    const m = r.mappings ?? {};
    const maps = [['MITRE ATLAS', m.mitre_atlas], ['MITRE ATT&CK', m.mitre_attack], ['OWASP ASI', m.owasp_asi], ['OWASP LLM', m.owasp_llm], ['CVE', m.cve], ['AIID', m.aiid]].filter(([, v]) => v && v.length);
    return `## ${r.name}

URL: ${recUrl(ctx, r.id)}
Record id: ${r.id}
Disclosed: ${r.date_disclosed}${r.last_updated ? ` · last updated ${r.last_updated}` : ''}${r.record_status && r.record_status !== 'active' ? `\nRecord status: ${tax(ctx, 'record_status', r.record_status)} (excluded from headline counts)` : ''}

Grades:
${field('Verification status', `${tax(ctx, 'status', r.status)} — ${taxDesc(ctx, 'status', r.status)}`)}
${field('Sourcing confidence', `${tax(ctx, 'confidence', r.confidence)} — ${taxDesc(ctx, 'confidence', r.confidence)}`)}
${field('AI role', `${tax(ctx, 'ai_role', r.ai_role ?? 'unknown')} — ${taxDesc(ctx, 'ai_role', r.ai_role ?? 'unknown')}`)}
${field('Severity', tax(ctx, 'severity', r.severity))}

Summary: ${r.summary}
${r.impact ? `\nImpact as stated: ${r.impact}\n` : ''}
Facts as stated by sources:
${field('Actor', `${r.actor} (${tax(ctx, 'actor_type', r.actor_type)})`)}
${field('Category', tax(ctx, 'category', r.category))}
${field('Models named', (r.models ?? []).join(', ') || 'not named by sources')}
${field('Model families', (r.model_families ?? []).map((f) => tax(ctx, 'model_families', f)).join(', ') || 'not stated')}
${field('Agentic autonomy level', tax(ctx, 'autonomy_level', r.autonomy_level ?? 'unknown'))}
${field('Guardrail bypass', (r.guardrail_bypass ?? []).map((g) => tax(ctx, 'guardrail_bypass', g)).join(', ') || 'not stated')}
${field('Attack lifecycle phases', (r.lifecycle_phases ?? []).map((p) => tax(ctx, 'lifecycle_phases', p)).join(', ') || 'not stated')}
${field('Target sectors', (r.targets?.sectors ?? []).map((s) => tax(ctx, 'sectors', s)).join(', ') || 'not stated')}
${field('Target countries', (r.targets?.countries ?? []).join(', ') || 'not stated')}
${field('Organisations affected', r.targets?.orgs_affected ?? 'not stated')}
${field('Records exfiltrated', r.targets?.records_exfiltrated ?? 'not stated')}
${maps.length ? `\nFramework mappings:\n${maps.map(([t, ids]) => field(t, ids.join(', '))).join('\n')}\n` : '\nFramework mappings: none recorded upstream.\n'}${(r.mitigations ?? []).length ? `\nMitigations as stated:\n${r.mitigations.map((x) => `- ${x}`).join('\n')}\n` : ''}${r.geo?.points?.length ? `\nMap points:\n${r.geo.points.map((p) => `- ${p.role}: ${p.label} (${p.illustrative ? 'illustrative, country-level centroid' : 'stated location'}; ${p.basis ? tax(ctx, 'geo_basis', p.basis).toLowerCase() : 'basis not stated'}${p.attributed_by ? `, per ${p.attributed_by}` : ''}${p.country ? `; ${p.country}` : ''})`).join('\n')}\n` : '\nMap: no cited source states a location.\n'}${(r.related ?? []).length ? `\nRelated records: ${r.related.map((id) => (byId.get(id) ? `${byId.get(id).name} (${recUrl(ctx, id)})` : id)).join('; ')}\n` : ''}
Sources (${(r.sources ?? []).length}):
${(r.sources ?? []).map((s) => `- ${s.title} — ${s.publisher}, ${tax(ctx, 'source_type', s.type)}${s.date ? `, ${s.date}` : ''}. ${s.url}${s.archive_url ? ` (archived: ${s.archive_url})` : ''}`).join('\n')}

Cite: Agentic Attack Index (${PUBLISHER.name}), dataset v${ctx.version}, record "${r.id}". ${ctx.upstreamIncidentUrl(r.id)} — CC BY-SA 4.0.
`;
  };
  return `# ${SITE_NAME}: every record in full

Dataset: Agentic Attack Index v${ctx.version} (${PUBLISHER.name}), ${ctx.incidents.length} records, CC BY-SA 4.0. Latest data: ${datasetModified(ctx.incidents, ctx.snapshot?.fetched_at ?? '')}. Grade definitions: ${u(ctx, 'about/')}. Index: ${u(ctx, 'llms.txt')}.

Grades are independent: verification status (how well the event is established), sourcing confidence (how direct the evidence is), AI role (how central the AI was). Nulls are "not stated", never zero. Actors are as stated by sources.

${ctx.incidents.slice().sort(byDisclosedDesc).map(rec).join('\n')}`;
}
