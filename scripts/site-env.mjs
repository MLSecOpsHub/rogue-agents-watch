// Where the built site will be served from. Shared by vite.config.ts (asset
// base path) and scripts/prerender.mjs (canonical URL for share links, Open
// Graph tags, the feed and the sitemap) so the two never disagree.
//
// Resolution order, explicit first:
//   VITE_BASE_PATH / VITE_SITE_URL   set by the operator (custom domain)
//   Vercel build env                 VERCEL=1: served at "/", host from
//                                    VERCEL_PROJECT_PRODUCTION_URL (production)
//                                    or VERCEL_URL (preview deployments)
//   GitHub Pages project site        "/rogue-agents-dashboard/" under mlsecopshub.github.io
//
// Deterministic: the same environment always yields the same strings.

export const GITHUB_PAGES_BASE = '/rogue-agents-dashboard/';
export const GITHUB_PAGES_SITE_URL = 'https://mlsecopshub.github.io/rogue-agents-dashboard/';

function onVercel(env) {
  return env.VERCEL === '1' || env.VERCEL === 'true';
}

function vercelHost(env) {
  const prod = env.VERCEL_ENV === 'production' || !env.VERCEL_URL;
  return (prod ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL) || env.VERCEL_PROJECT_PRODUCTION_URL || env.VERCEL_URL || null;
}

/** Path prefix the assets are served under, with leading and trailing slash. */
export function resolveBasePath(env = process.env) {
  const explicit = env.VITE_BASE_PATH;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  if (onVercel(env)) return '/';
  return GITHUB_PAGES_BASE;
}

/** Absolute public URL of the site root, with a trailing slash. */
export function resolveSiteUrl(env = process.env) {
  const explicit = env.VITE_SITE_URL;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  if (onVercel(env)) {
    const host = vercelHost(env);
    if (host) return `https://${host}${resolveBasePath(env)}`;
  }
  return GITHUB_PAGES_SITE_URL;
}
