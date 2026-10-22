// The 1200x630 Open Graph share cards, drawn as SVG strings and rasterised by
// resvg in prerender.mjs: the site card (dist/og/site.png), the route cards
// (dist/og/map.png, dist/og/stats.png) and one card per record
// (dist/og/<id>.png). One terminal treatment for the whole family: IBM Plex
// Mono only, a near-black ground, a thin frame, an accent tick, scanlines and a
// vignette as the finish. Everything here is pure and deterministic; every
// dataset string goes through esc(); every number is read from the snapshot.
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { CARD_H, CARD_W, esc, PUBLISHER, SITE_NAME, tax, wrapText } from './prerender-util.mjs';
import { OG_CARD } from '../src/site-copy.mjs';

// Card palette, fixed (a share image has no viewer theme). Status hues are the
// --status-* tokens of src/styles.css (a test keeps them equal) so the card and
// the site grade records the same way; marker hues stay ROLE_HEX (hue = ai_role).
export const T = { ground: '#05080c', frame: '#16222c', ink: '#e6edf3', ink2: '#a9b6c2', muted: '#7d8b99', dim: '#566677', accent: '#ff8a4c', land: '#14212d', coast: '#24384a', graticule: '#0f1c28' };
export const STATUS_HEX = { confirmed: '#6ecf95', reported: '#f0b658', 'test-eval': '#a7a9f0' };
export const ROLE_HEX = { 'load-bearing': '#ffb070', significant: '#e07a2f', incidental: '#a8511f', disputed: '#6f7d8a', unknown: '#6f7d8a' };
export const SEVERITY_HEX = { low: '#a9b6c2', medium: '#f0b658', high: '#ff8a4c', critical: '#ff5f5f' };

const MONO = 'font-family="IBM Plex Mono"';
const BOLD = 'font-family="IBM Plex Mono" font-weight="700"';
/** Advance width of IBM Plex Mono: 0.6 em for every glyph. */
const mono = (text, size) => [...String(text)].length * size * 0.6;
const LEFT = 64;
const RIGHT = CARD_W - 64;
const COL = RIGHT - LEFT;

/** Records that count toward headlines: missing record_status means active. */
export const isActive = (r) => !r.record_status || r.record_status === 'active';

/** Land path + projection shared by every card; built once from the vendored topojson. */
export function buildGeo(topo) {
  const projection = geoNaturalEarth1().fitExtent([[6, 6], [954, 494]], { type: 'Sphere' });
  const pathGen = geoPath(projection);
  const land = feature(topo, topo.objects.countries);
  return { landPath: pathGen(land) ?? '', graticulePath: pathGen(geoGraticule10()) ?? '', project: (lng, lat) => projection([lng, lat]) };
}

// ---- shared pieces ------------------------------------------------------------

/** Ground, inset frame, accent tick and the glow filters. Drawn first. */
function ground() {
  return `<defs>
<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="12"/></filter>
<pattern id="scan" width="1" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#ffffff" opacity="0.028"/></pattern>
<radialGradient id="crt" cx="0.5" cy="0.5" r="0.5"><stop offset="0.62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.32"/></radialGradient>
</defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="${T.ground}"/>
<rect x="24" y="24" width="${CARD_W - 48}" height="${CARD_H - 48}" fill="none" stroke="${T.frame}"/>
<rect x="24" y="24" width="140" height="2" fill="${T.accent}"/>`;
}

/** Scanlines and vignette over everything. Drawn last. */
function finish() {
  return `<rect width="${CARD_W}" height="${CARD_H}" fill="url(#scan)"/>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#crt)"/>`;
}

/** The two 15 px lines at the top: a code comment on the left, a fact on the right. */
function header(left, right) {
  return `<text x="${LEFT}" y="58" ${MONO} font-size="15" letter-spacing="1" fill="${T.muted}">${esc(left)}</text>
<text x="${RIGHT}" y="58" text-anchor="end" ${MONO} font-size="15" letter-spacing="1" fill="${T.muted}">${esc(right)}</text>`;
}

/** A glowing block cursor, as a terminal would draw it after the title. */
function cursor(x, y, w = 22, h = 42) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${T.accent}" filter="url(#glow)" opacity="0.8"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${T.accent}"/>`;
}

/** The 48 px title with its cursor; `top` is the text box top as laid out in the design. */
function title(text, top = 92) {
  const t = String(text).toUpperCase();
  return `<text x="${LEFT}" y="${top + 37}" ${BOLD} font-size="48" letter-spacing="-0.5" fill="${T.ink}">${esc(t)}</text>
${cursor(LEFT + mono(t, 48) - 0.5 * t.length + 12, top + 3)}`;
}

/** `> part · part` in the accent, 22 px. */
function prompt(parts, top) {
  const body = parts.map((p) => esc(p)).join(` <tspan fill="${T.muted}">·</tspan> `);
  return `<text x="${LEFT}" y="${top + 17}" ${MONO} font-size="22" fill="${T.accent}"><tspan fill="${T.muted}">&gt;</tspan> ${body}</text>`;
}

/** The big number (136 px), its 30 px label and a 19 px line or two under it. */
function hero(n, label, lines, top, color = T.ink) {
  const num = esc(n);
  return `<text x="${LEFT - 4}" y="${top + 105}" ${BOLD} font-size="136" fill="${color}" filter="url(#soft)" opacity="0.18">${num}</text>
<text x="${LEFT - 4}" y="${top + 105}" ${BOLD} font-size="136" fill="${color}">${num}</text>
<text x="${LEFT}" y="${top + 151}" ${BOLD} font-size="30" fill="${T.ink}">${esc(label)}</text>
${lines.map((l, i) => `<text x="${LEFT}" y="${top + 189 + i * 25}" ${MONO} font-size="19" fill="${T.ink2}">${esc(l)}</text>`).join('\n')}`;
}

/** A 16 px line of `n label` pairs with the numbers in the accent. */
function tally(pairs, top, lead = '') {
  const body = pairs.map(([n, label]) => `<tspan fill="${T.accent}">${esc(n)}</tspan> ${esc(label)}`).join(` <tspan fill="${T.muted}">·</tspan> `);
  return `<text x="${LEFT}" y="${top + 12}" ${MONO} font-size="16" letter-spacing="1" fill="${T.muted}">${lead ? `${esc(lead)} <tspan fill="${T.muted}">·</tspan> ` : ''}${body}</text>`;
}

/** Hairline, an 18 px line on the left (already-escaped SVG) and the host, with its route, on the right in the accent. */
function footer(ctx, leftSvg, route = '') {
  // Preview hosts are long; shrink so they never run into the left text.
  const host = `${new URL(ctx.siteUrl).host.replace(/^www\./, '')}${route}`;
  const size = host.length > 30 ? Math.max(11, Math.floor(420 / (host.length * 0.6))) : 18;
  // The left line gives way: it shrinks until it clears the host by 40 px.
  const leftChars = leftSvg.replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, 'x').length;
  const leftSize = Math.min(18, Math.floor((COL - mono(host, size) - host.length - 40) / (leftChars * 0.6)));
  return `<line x1="${LEFT}" y1="560" x2="${RIGHT}" y2="560" stroke="${T.frame}"/>
<text x="${LEFT}" y="590" ${MONO} font-size="${leftSize}" fill="${T.ink2}">${leftSvg}</text>
<text x="${RIGHT}" y="590" text-anchor="end" ${MONO} font-size="${size}" letter-spacing="1" fill="${T.accent}">${esc(host)}</text>`;
}

const version = (ctx) => `${PUBLISHER.name.toUpperCase()} · v${ctx.summary.dataset_version}`;

/**
 * World map with the points of active records only, in the site's map
 * encoding (hue = ai_role, soft disc = illustrative country-level point, pin =
 * stated location). No connecting lines: the dataset records places, not paths.
 * Returns the SVG and the counts the caption states.
 */
function worldMap(ctx, x, y, w) {
  const k = w / 960;
  const parts = [`<g transform="translate(${x} ${y}) scale(${k.toFixed(4)})"><path d="${ctx.geo.graticulePath ?? ''}" fill="none" stroke="${T.graticule}" stroke-width="1.4"/><path d="${ctx.geo.landPath}" fill="${T.land}" stroke="${T.coast}" stroke-width="0.9"/>`];
  const discs = [];
  const dots = [];
  let points = 0;
  let illustrative = 0;
  let withGeo = 0;
  const byBasis = {};
  for (const r of ctx.incidents.filter(isActive)) {
    const hex = ROLE_HEX[r.ai_role ?? 'unknown'] ?? ROLE_HEX.unknown;
    const ps = r.geo?.points ?? [];
    if (ps.length) withGeo++;
    for (const p of ps) {
      const xy = ctx.geo.project(p.lng, p.lat);
      if (!xy) continue;
      points++;
      if (p.basis) byBasis[p.basis] = (byBasis[p.basis] ?? 0) + 1;
      const [cx, cy] = xy.map((n) => n.toFixed(1));
      if (p.illustrative) {
        illustrative++;
        discs.push(`<circle cx="${cx}" cy="${cy}" r="30" fill="${hex}" opacity="0.2"/>`);
        dots.push(`<circle cx="${cx}" cy="${cy}" r="7" fill="${hex}" stroke="${T.ground}" stroke-width="3"/>`);
      } else {
        dots.push(`<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${hex}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="6" fill="${hex}"/>`);
      }
    }
  }
  parts.push(...discs, ...dots, '</g>');
  return { svg: parts.join(''), points, illustrative, stated: points - illustrative, withGeo, byBasis };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "31 points · country-level" / "3 points · 1 stated" / "no stated locations". */
function pointsPhrase(m) {
  if (!m.points) return 'no stated locations';
  if (!m.stated) return `${plural(m.points, 'point')} · country-level`;
  if (m.stated === m.points) return `${plural(m.points, 'point')} · stated`;
  return `${plural(m.points, 'point')} · ${m.stated} stated`;
}

/** The 14 px caption under a map, right-aligned. */
const caption = (text, top) => `<text x="${RIGHT}" y="${top + 11}" text-anchor="end" ${MONO} font-size="14" letter-spacing="1" fill="${T.muted}">${esc(text)}</text>`;

/** Status ids in taxonomy order, then any the taxonomy lacks, so nothing is hidden. */
function statusIds(ctx, counts) {
  const order = (ctx.taxonomy?.status?.values ?? []).map((v) => v.id);
  return [...order.filter((id) => id in counts), ...Object.keys(counts).filter((id) => !order.includes(id))];
}

const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}">`;

// ---- the site card ------------------------------------------------------------

/** dist/og/site.png: brand, the two terms, the headline count, the map of every active point, the status breakdown. */
export function siteCardSvg(ctx) {
  const s = ctx.summary;
  const map = worldMap(ctx, 630, 148, 506);
  const counts = s.by_status ?? {};
  const breakdown = statusIds(ctx, counts)
    .map((id) => `<tspan fill="${T.ink}">${esc(counts[id])}</tspan> ${esc(tax(ctx, 'status', id).toLowerCase())}`)
    .join(' · ');
  return `${svgOpen}
${ground()}
${header(`// ${OG_CARD.category}`, version(ctx))}
${title(SITE_NAME)}
${prompt(OG_CARD.terms, 158)}
${hero(s.total, OG_CARD.countNoun, [OG_CARD.description], 268)}
${map.svg}
${caption(`threat map · ${pointsPhrase(map)} · ${map.withGeo} of ${s.total} records`, 424)}
${footer(ctx, `${breakdown} · ${esc(OG_CARD.hook)}`)}
${finish()}
</svg>`;
}

// ---- the route cards ----------------------------------------------------------

/** dist/og/map.png: where the records point, the located share, the basis of every point, the map. */
export function mapCardSvg(ctx) {
  const s = ctx.summary;
  const map = worldMap(ctx, 580, 130, 556);
  const kind = !map.stated ? 'country-level ' : map.stated === map.points ? 'stated ' : '';
  const lines = wrapText(map.points ? `${map.points} ${kind}${map.points === 1 ? 'point' : 'points'}${kind ? '' : ` (${map.stated} stated)`}, each with its basis and the publisher that stated it.` : 'No cited source states a location yet; every record is listed instead.', 41, 2);
  // Basis labels from the geo_basis taxonomy, trimmed to their noun ("Victim location" → "victim"), most frequent first.
  const basis = Object.entries(map.byBasis)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, n]) => [n, tax(ctx, 'geo_basis', id).toLowerCase().replace(/ (location|attribution|precise location)$/, '')]);
  return `${svgOpen}
${ground()}
${header(`// ${SITE_NAME.toLowerCase()} / map`, version(ctx))}
${title('Threat map')}
${prompt(['where the records point'], 158)}
${hero(map.withGeo, `of ${s.total} records located`, lines, 240)}
${basis.length ? tally(basis, 482) : ''}
${map.svg}
${caption(map.points ? `threat map · ${map.stated ? 'no invented pins' : 'country-level · no invented pins'}` : 'threat map · no invented pins', 432)}
${footer(ctx, `<tspan fill="${T.ink}">${esc(s.total - map.withGeo)}</tspan> records listed, not plotted`, '/map')}
${finish()}
</svg>`;
}

/** The status × AI-role crosstab from summary.evidence_split, else counted over active records. */
function crosstab(ctx) {
  const split = ctx.summary.evidence_split?.by_status_ai_role;
  if (split) return split;
  const out = {};
  for (const r of ctx.incidents.filter(isActive)) {
    const role = r.ai_role ?? 'unknown';
    out[r.status] ??= {};
    out[r.status][role] = (out[r.status][role] ?? 0) + 1;
  }
  return out;
}

/** dist/og/stats.png: the confirmed-and-load-bearing count, records by year, the status × AI-role crosstab. */
export function statsCardSvg(ctx) {
  const s = ctx.summary;
  const table = crosstab(ctx);
  const roles = (ctx.taxonomy?.ai_role?.values ?? []).map((v) => v.id).filter((id) => id !== 'unknown');
  const extraRoles = [...new Set(Object.values(table).flatMap((row) => Object.keys(row)))].filter((id) => !roles.includes(id));
  const cols = [...roles, ...extraRoles];
  const rows = statusIds(ctx, table);
  const key = s.evidence_split?.confirmed_load_bearing ?? table.confirmed?.['load-bearing'] ?? 0;
  const years = Object.entries(s.by_year ?? {}).sort(([a], [b]) => a.localeCompare(b));
  // The table: label column 160 px, then one column per AI role, right-aligned.
  const x0 = 580;
  const w = RIGHT - x0;
  const colW = (w - 160) / cols.length;
  const colX = (i) => x0 + 160 + (i + 1) * colW;
  const head = cols.map((id, i) => `<text x="${colX(i)}" y="${196}" text-anchor="end" ${MONO} font-size="11" letter-spacing="1" fill="${T.ink2}">${esc(tax(ctx, 'ai_role', id).toUpperCase())}</text>`).join('');
  const body = rows
    .map((status, r) => {
      const y = 208 + r * 68;
      const total = Object.values(table[status] ?? {}).reduce((a, b) => a + b, 0);
      const cells = cols
        .map((role, i) => {
          const n = table[status]?.[role] ?? 0;
          const fill = status === 'confirmed' && role === 'load-bearing' && n ? T.accent : n ? T.ink : T.dim;
          return `<text x="${colX(i)}" y="${y + 46}" text-anchor="end" ${BOLD} font-size="36" fill="${fill}">${n}</text>`;
        })
        .join('');
      return `${r ? `<line x1="${x0}" y1="${y}" x2="${RIGHT}" y2="${y}" stroke="${T.frame}"/>` : ''}<text x="${x0}" y="${y + 42}" ${MONO} font-size="17" fill="${STATUS_HEX[status] ?? T.ink2}">${esc(tax(ctx, 'status', status).toLowerCase())} <tspan fill="${T.muted}">${total}</tspan></text>${cells}`;
    })
    .join('');
  return `${svgOpen}
${ground()}
${header(`// ${SITE_NAME.toLowerCase()} / stats`, version(ctx))}
${title('Evidence stats')}
${prompt(['how solid is the evidence?'], 158)}
${hero(key, 'confirmed & AI load-bearing', wrapText(`of ${s.total} records: AI was central to the operation as described.`, 41, 2), 240, T.accent)}
${years.length ? tally(years.map(([y, n]) => [n, `in ${y}`]), 482, 'disclosed') : ''}
<text x="${x0}" y="${165}" ${MONO} font-size="14" letter-spacing="1" fill="${T.muted}">verification status × AI role</text>
${head}
<line x1="${x0}" y1="208" x2="${RIGHT}" y2="208" stroke="${T.frame}"/>
${body}
${footer(ctx, 'every number is a count of records · no scores', '/stats')}
${finish()}
</svg>`;
}

/** The route cards that exist, by view; other routes share the site card. */
export const ROUTE_CARDS = { map: mapCardSvg, stats: statsCardSvg };

// ---- the record card ----------------------------------------------------------

/** One detail line: a dim 16 px label, then the value, cut to the column with an ellipsis. */
function detail(label, value, top, maxLines = 1) {
  const room = Math.floor(COL / (16 * 0.6)) - 9;
  const lines = wrapText(value, room, maxLines);
  return lines.map((l, i) => `<text x="${LEFT}" y="${top + 12 + i * 26}" ${MONO} font-size="16" letter-spacing="0.5" fill="${T.ink2}"><tspan fill="${T.muted}">${esc((i ? '' : label).padEnd(9, '\u00a0'))}</tspan>${esc(l)}</text>`).join('\n');
}

/** dist/og/<id>.png: the record's name, its four grades, two details and its sources. No map: the record page has it. */
export function cardSvg(rec, ctx) {
  const role = rec.ai_role ?? 'unknown';
  const fs = rec.name.length > 132 ? 34 : 40;
  const lh = Math.round(fs * 1.18);
  const lines = wrapText(rec.name, Math.floor(COL / (fs * 0.6)), 3);
  const titleTop = 138;
  const name = lines.map((l, i) => `<text x="${LEFT}" y="${titleTop + 38 + i * lh}" ${BOLD} font-size="${fs}" letter-spacing="-0.5" fill="${T.ink}">${esc(l)}</text>`).join('\n');
  const last = lines[lines.length - 1] ?? '';
  const cur = cursor(LEFT + mono(last, fs) - 0.5 * last.length + 12, titleTop + 38 + (lines.length - 1) * lh - Math.round(fs * 0.72), 18, Math.round(fs * 0.85));
  const grades = [
    ['VERIFICATION', tax(ctx, 'status', rec.status), STATUS_HEX[rec.status] ?? T.ink],
    ['SOURCING', tax(ctx, 'confidence', rec.confidence), T.ink],
    ['AI ROLE', tax(ctx, 'ai_role', role), T.ink],
    ['SEVERITY', tax(ctx, 'severity', rec.severity), SEVERITY_HEX[rec.severity] ?? T.ink],
  ];
  const cellW = (COL - 3 * 32) / 4;
  const strip = grades
    .map(([label, value, fill], i) => {
      const x = LEFT + i * (cellW + 32);
      const size = mono(value, 30) > cellW ? Math.max(18, Math.floor(cellW / (value.length * 0.6))) : 30;
      return `<line x1="${x}" y1="326" x2="${x + cellW}" y2="326" stroke="${T.frame}"/><text x="${x}" y="350" ${MONO} font-size="13" letter-spacing="2" fill="${T.muted}">${label}</text><text x="${x}" y="385" ${BOLD} font-size="${size}" fill="${fill}">${esc(value)}</text>`;
    })
    .join('\n');
  // Two detail lines, in order of what this audience scans for; a field the record does not state is left out, never "not stated".
  const countries = rec.targets?.countries ?? [];
  const sectors = (rec.targets?.sectors ?? []).map((id) => tax(ctx, 'sectors', id));
  const targets = [countries.join(', '), sectors.join(', ')].filter(Boolean).join(' · ');
  const models = (rec.models ?? []).join(', ');
  const details = [targets && ['targets', targets], models && ['models', models], rec.actor && ['actor', rec.actor]].filter(Boolean).slice(0, 2);
  const detailSvg = details.map(([label, value], i) => detail(label, value, 446 + i * 34, details.length === 1 ? 2 : 1)).join('\n');
  const n = (rec.sources ?? []).length;
  const atlas = rec.mappings?.mitre_atlas ?? [];
  const attack = rec.mappings?.mitre_attack ?? [];
  const ids = atlas.length ? ['MITRE ATLAS', atlas] : attack.length ? ['MITRE ATT&CK', attack] : null;
  const mapping = ids ? ` · ${esc(ids[0])} ${esc(ids[1].slice(0, 3).join(' · '))}${ids[1].length > 3 ? ` +${ids[1].length - 3}` : ''}` : '';
  return `${svgOpen}
${ground()}
${header(`// ${SITE_NAME.toLowerCase()} / incident`, `disclosed ${rec.date_disclosed}`)}
${prompt([tax(ctx, 'category', rec.category).toLowerCase(), tax(ctx, 'actor_type', rec.actor_type ?? 'unknown').toLowerCase()], 92)}
${name}
${cur}
${strip}
${detailSvg}
${footer(ctx, `<tspan fill="${T.ink}">${n}</tspan> ${n === 1 ? 'source' : 'sources'}${mapping}`)}
${finish()}
</svg>`;
}
