// Hash-based routing so every view is deep-linkable on GitHub Pages without
// server rewrites. Incident URLs carry the upstream id unchanged.

export type Route =
  | { view: 'overview'; query: URLSearchParams }
  | { view: 'map'; query: URLSearchParams }
  | { view: 'timeline'; query: URLSearchParams }
  | { view: 'table'; query: URLSearchParams }
  | { view: 'stats'; query: URLSearchParams }
  | { view: 'techniques'; query: URLSearchParams }
  | { view: 'about'; query: URLSearchParams }
  | { view: 'incident'; id: string; query: URLSearchParams }
  | { view: 'not-found'; path: string; query: URLSearchParams };

export const VIEWS = ['map', 'timeline', 'table', 'techniques', 'stats', 'about'] as const;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Parse a location.hash (with or without the leading '#') into a Route. */
export function parseRoute(hash: string): Route {
  let h = hash.startsWith('#') ? hash.slice(1) : hash;
  const qIndex = h.indexOf('?');
  const query = new URLSearchParams(qIndex >= 0 ? h.slice(qIndex + 1) : '');
  if (qIndex >= 0) h = h.slice(0, qIndex);
  const path = h.replace(/^\/+|\/+$/g, '');
  const segments = path === '' ? [] : path.split('/').map((s) => decodeURIComponent(s));

  if (segments.length === 0) return { view: 'overview', query };
  const [head, ...rest] = segments;

  if (head === 'incident') {
    const id = rest.join('/');
    if (rest.length === 1 && id && ID_PATTERN.test(id)) return { view: 'incident', id, query };
    return { view: 'not-found', path, query };
  }
  if (rest.length === 0 && (VIEWS as readonly string[]).includes(head as string)) {
    return { view: head as (typeof VIEWS)[number], query };
  }
  return { view: 'not-found', path, query };
}

/** Build a hash href for a view, optionally with query parameters. */
export function href(view: Exclude<Route['view'], 'incident' | 'not-found'>, query?: URLSearchParams | Record<string, string>): string {
  const path = view === 'overview' ? '#/' : `#/${view}`;
  return path + queryString(query);
}

export function incidentHref(id: string): string {
  return `#/incident/${encodeURIComponent(id)}`;
}

function queryString(query?: URLSearchParams | Record<string, string>): string {
  if (!query) return '';
  const qp = query instanceof URLSearchParams ? query : new URLSearchParams(query);
  const s = qp.toString();
  return s ? `?${s}` : '';
}

export function currentRoute(): Route {
  return parseRoute(window.location.hash || '#/');
}

export function navigate(hash: string): void {
  if (window.location.hash === hash) return;
  window.location.hash = hash;
}

/** Replace the query part of the current hash without adding a history entry. */
export function replaceQuery(query: URLSearchParams): void {
  const h = window.location.hash || '#/';
  const base = h.split('?')[0] ?? '#/';
  const next = base + queryString(query);
  if (next !== h) history.replaceState(null, '', next);
}

export function onRouteChange(handler: (route: Route) => void): () => void {
  const fn = () => handler(currentRoute());
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}
