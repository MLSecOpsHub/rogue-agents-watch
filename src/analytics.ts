// Vercel Web Analytics: cookieless, aggregate page views and a few custom
// events. Only a Vercel build enables it (VITE_VERCEL_ANALYTICS, set in
// vite.config.ts); local, CI and test builds load nothing. The script and its
// beacon are first-party (/_vercel/insights/*), so no request leaves the origin.
//
// Views live in the hash, which the script would report as "/" for every
// view, so auto-tracking is off and each view is reported under its
// canonical hash-free path (the prerendered page's URL). Filter queries are
// dropped; only utm_* campaign parameters are kept.
//
// Custom events (names and properties are fixed here, never free text):
//   Correction link  { id, view }        "Report a correction" clicks
//   Data download    { format, source, view }
//   Share            { target, method, view }
//   Upstream check   { result }
//   Map replay       { view }             play pressed
//   Filter           { field, view }      which filter, never its value

import { inject, pageview, track } from '@vercel/analytics';
import { DATA_BASE_URL, UPSTREAM_REPO_URL, upstreamUrls } from './config';
import { currentRoute, type Route } from './router';

const ENABLED = import.meta.env.VITE_VERCEL_ANALYTICS === '1';

type Props = Record<string, string | number | boolean | null>;

/** The canonical path a route is counted under, relative to the build base. */
export function analyticsPath(route: Route): string {
  switch (route.view) {
    case 'overview':
      return '';
    case 'incident':
      return `incident/${encodeURIComponent(route.id)}/`;
    case 'actors':
      return route.slug ? `actors/${encodeURIComponent(route.slug)}/` : 'actors/';
    case 'not-found':
      return '404/';
    default:
      return `${route.view}/`;
  }
}

/** The route pattern a view is grouped under in the dashboard. */
function analyticsRoute(route: Route): string {
  if (route.view === 'incident') return 'incident/[id]/';
  if (route.view === 'actors' && route.slug) return 'actors/[slug]/';
  return analyticsPath(route);
}

/** utm_* parameters from the page query or the hash query, in that order. */
export function utmQuery(search: string, hash: string): string {
  const out = new URLSearchParams();
  const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  for (const qs of [search, hashQuery]) {
    for (const [k, v] of new URLSearchParams(qs)) {
      if (k.startsWith('utm_') && !out.has(k)) out.set(k, v);
    }
  }
  const s = out.toString();
  return s ? `?${s}` : '';
}

/** The URL a page view is reported under: canonical path plus utm_* only. */
function reportedUrl(): string {
  const path = `${import.meta.env.BASE_URL}${analyticsPath(currentRoute())}`;
  const url = new URL(path, window.location.origin);
  return `${url.href}${utmQuery(window.location.search, window.location.hash)}`;
}

const UPSTREAM_FORMATS: Record<string, string> = {
  [upstreamUrls.incidents]: 'json',
  [upstreamUrls.csv]: 'csv',
  [upstreamUrls.ndjson]: 'ndjson',
  [upstreamUrls.stix]: 'stix',
  [upstreamUrls.summary]: 'summary-json',
  [upstreamUrls.schema]: 'schema',
};

/** Format name of a downloaded file, from its name: "…-attack-layer.json" -> "attack-layer". */
export function downloadFormat(filename: string): string {
  const m = /(attack-layer|atlas-layer)\.json$/.exec(filename);
  if (m?.[1]) return m[1];
  return /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase() ?? 'file';
}

/** The event a link click counts as, or null for links that are not tracked. */
export function linkEvent(a: { href: string; download: string }): { name: string; props: Props } | null {
  const href = a.href;
  if (href.startsWith(`${UPSTREAM_REPO_URL}/issues/new?`)) {
    const id = new URL(href).searchParams.get('incident-id');
    return id ? { name: 'Correction link', props: { id } } : null;
  }
  if (a.download) {
    return { name: 'Data download', props: { format: downloadFormat(a.download), source: href.startsWith('blob:') ? 'filtered' : 'site' } };
  }
  const upstream = UPSTREAM_FORMATS[href];
  if (upstream) return { name: 'Data download', props: { format: upstream, source: 'upstream' } };
  if (href.startsWith(`${DATA_BASE_URL}/dist/incidents/`)) return { name: 'Data download', props: { format: 'record-json', source: 'upstream' } };
  return null;
}

export function startAnalytics(): void {
  if (!ENABLED) return;
  inject({
    mode: 'production',
    disableAutoTrack: true,
    beforeSend: (event) => ({ ...event, url: reportedUrl() }),
  });
  // One delegated listener covers app and prerendered links alike, and the
  // temporary anchors downloadText() clicks for in-browser exports.
  document.addEventListener(
    'click',
    (e) => {
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (!a) return;
      const ev = linkEvent(a);
      if (ev) trackEvent(ev.name, ev.props);
    },
    { capture: true },
  );
}

/** Count one view of a route. Call on path changes, not filter-only changes. */
export function trackView(route: Route): void {
  if (!ENABLED) return;
  pageview({ route: `${import.meta.env.BASE_URL}${analyticsRoute(route)}`, path: `${import.meta.env.BASE_URL}${analyticsPath(route)}` });
}

/** Send one custom event; the current view is added unless given. */
export function trackEvent(name: string, props: Props = {}): void {
  if (!ENABLED) return;
  track(name, { view: currentRoute().view, ...props });
}
