// Helpers shared by the prerender generators. Everything here is pure and
// deterministic; every string that reaches HTML goes through esc().

import { DATASET_URL } from '../src/site-copy.mjs';

export { SITE_NAME } from '../src/site-copy.mjs';
export const UPSTREAM = DATASET_URL;
export const PUBLISHER = { name: 'MLSecOpsHub', url: 'https://mlsecopshub.com', github: 'https://github.com/MLSecOpsHub' };
export const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const CARD_W = 1200;
export const CARD_H = 630;

/** The URL if it is an absolute http(s) URL, else null. Mirrors isHttpUrl() in src/util/dom.ts. */
export function safeHref(url) {
  return typeof url === 'string' && /^https?:\/\/[^\s]/i.test(url) ? url : null;
}

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

/** Upstream label for an enum value; the raw id when the taxonomy lacks it, so nothing is hidden. */
export function tax(ctx, key, id) {
  return ctx.labels?.[key]?.[id]?.label ?? id;
}

/** Upstream definition text for an enum value, or ''. */
export function taxDesc(ctx, key, id) {
  return ctx.taxonomy?.[key]?.values?.find((v) => v.id === id)?.description ?? '';
}

/** "Confirmed · Primary sourcing · AI load-bearing · Critical severity" */
export function gradeLine(ctx, rec) {
  return `${tax(ctx, 'status', rec.status)} · ${tax(ctx, 'confidence', rec.confidence)} sourcing · AI ${tax(ctx, 'ai_role', rec.ai_role ?? 'unknown').toLowerCase()} · ${tax(ctx, 'severity', rec.severity)} severity`;
}

export const byIdAsc = (a, b) => a.id.localeCompare(b.id);
export const byDisclosedDesc = (a, b) => (a.date_disclosed < b.date_disclosed ? 1 : a.date_disclosed > b.date_disclosed ? -1 : a.id.localeCompare(b.id));

/** Latest date any record carries; the only "modified" date the site states. Never the clock. */
export function datasetModified(records, fallback = null) {
  return records.map((r) => r.last_updated ?? r.added?.date ?? r.date_disclosed).filter(Boolean).sort().at(-1) ?? fallback;
}

// Official reference URLs, mirroring src/data/links.ts.
export function atlasUrl(id) {
  const m = /^AML\.(T|TA|M|CS)\d{4}/.exec(id);
  const kind = m?.[1];
  const p = kind === 'TA' ? 'tactics' : kind === 'M' ? 'mitigations' : kind === 'CS' ? 'studies' : 'techniques';
  return `https://atlas.mitre.org/${p}/${encodeURIComponent(id)}`;
}
export function attackUrl(id) {
  const m = /^(TA|T|S|G|M)(\d{4})(?:\.(\d{3}))?$/.exec(id);
  if (!m) return 'https://attack.mitre.org/';
  const [, kind, num, sub] = m;
  const b = kind === 'TA' ? 'tactics' : kind === 'S' ? 'software' : kind === 'G' ? 'groups' : kind === 'M' ? 'mitigations' : 'techniques';
  return `https://attack.mitre.org/${b}/${kind}${num}${sub ? `/${sub}` : ''}/`;
}
export const owaspLlmUrl = (id) => `https://genai.owasp.org/llmrisk/${String(id).toLowerCase()}/`;
export const owaspAsiUrl = () => 'https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/';
export const cveUrl = (id) => `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`;
export const aiidUrl = (n) => `https://incidentdatabase.ai/cite/${n}/`;

// Actor grouping, mirroring src/data/actors.ts (tests pin the slugs together).
export const SLUG_MAX = 60;

export function actorSlug(actor) {
  let s = String(actor)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > SLUG_MAX) {
    const cut = s.lastIndexOf('-', SLUG_MAX);
    s = s.slice(0, cut > SLUG_MAX / 2 ? cut : SLUG_MAX).replace(/-+$/g, '');
  }
  return s || 'unnamed';
}

export function actorGroups(records) {
  const map = new Map();
  for (const r of records) map.set(r.actor, [...(map.get(r.actor) ?? []), r]);
  const groups = [...map.entries()]
    .map(([actor, incs]) => ({ actor, slug: actorSlug(actor), incidents: incs.slice().sort(byDisclosedDesc), actorTypes: [...new Set(incs.map((i) => i.actor_type))].sort() }))
    .sort((a, b) => a.actor.localeCompare(b.actor));
  const seen = new Map();
  for (const g of groups) {
    const n = (seen.get(g.slug) ?? 0) + 1;
    seen.set(g.slug, n);
    if (n > 1) g.slug = `${g.slug}-${n}`;
  }
  return groups.sort((a, b) => b.incidents.length - a.incidents.length || a.actor.localeCompare(b.actor));
}

export function correctionIssueUrl(id) {
  const params = new URLSearchParams({ template: 'data-correction.yml', title: `[correction] ${id}`, 'incident-id': id });
  return `${UPSTREAM}/issues/new?${params.toString()}`;
}
