// Vercel Web Analytics: cookieless, aggregate page views. Only a Vercel build
// enables it (VITE_VERCEL_ANALYTICS, set in vite.config.ts); local, CI and
// test builds load nothing. The script and its beacon are first-party
// (/_vercel/insights/*), so no request leaves the origin.
//
// Views live in the hash, which the script would report as "/" for every
// view, so auto-tracking is off and each view is reported under its
// canonical hash-free path (the prerendered page's URL). Filter queries are
// dropped: only which page was viewed is counted, never what was filtered.

import { inject, pageview } from '@vercel/analytics';
import { currentRoute, type Route } from './router';

const ENABLED = import.meta.env.VITE_VERCEL_ANALYTICS === '1';

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

function absolute(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href;
}

export function startAnalytics(): void {
  if (!ENABLED) return;
  inject({
    mode: 'production',
    disableAutoTrack: true,
    beforeSend: (event) => ({ ...event, url: absolute(analyticsPath(currentRoute())) }),
  });
}

/** Count one view of a route. Call on path changes, not filter-only changes. */
export function trackView(route: Route): void {
  if (!ENABLED) return;
  pageview({ route: `${import.meta.env.BASE_URL}${analyticsRoute(route)}`, path: `${import.meta.env.BASE_URL}${analyticsPath(route)}` });
}
