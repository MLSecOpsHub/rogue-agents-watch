// Where the built site will be served from. Shared by vite.config.ts (asset
// base path) and scripts/prerender.mjs (canonical URL for share links, Open
// Graph tags, the feed and the sitemap) so the two never disagree.
//
// Resolution order, explicit first:
//   VITE_BASE_PATH / VITE_SITE_URL   set by the operator (custom domain)
//   Vercel build env                 VERCEL=1: served at "/", host from
//                                    VERCEL_PROJECT_PRODUCTION_URL (production)
//                                    or VERCEL_URL (preview deployments)
//   GitHub Actions build env         GITHUB_REPOSITORY=owner/repo: the Pages
//                                    project site "/repo/" under owner.github.io
//                                    (or "/" for an owner.github.io repository)
//   Local fallback                   "/" at the vite preview address. A build
//                                    with no deploy environment is a local one;
//                                    its share links say so instead of pointing
//                                    at a host it was not built for.
//
// Deterministic: the same environment always yields the same strings.

export const LOCAL_BASE = '/';
export const LOCAL_SITE_URL = 'http://localhost:4173/';

function onVercel(env) {
  return env.VERCEL === '1' || env.VERCEL === 'true';
}

/** { owner, repo } when building inside GitHub Actions, else null. */
function githubRepo(env) {
  if (env.GITHUB_ACTIONS !== 'true' || !env.GITHUB_REPOSITORY) return null;
  const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
  return owner && repo ? { owner: owner.toLowerCase(), repo } : null;
}

function githubPagesBase(gh) {
  return gh.repo.toLowerCase() === `${gh.owner}.github.io` ? '/' : `/${gh.repo}/`;
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
  const gh = githubRepo(env);
  if (gh) return githubPagesBase(gh);
  return LOCAL_BASE;
}

/** Absolute public URL of the site root, with a trailing slash. */
export function resolveSiteUrl(env = process.env) {
  const explicit = env.VITE_SITE_URL;
  if (explicit) return explicit.endsWith('/') ? explicit : `${explicit}/`;
  if (onVercel(env)) {
    const host = vercelHost(env);
    if (host) return `https://${host}${resolveBasePath(env)}`;
  }
  const gh = githubRepo(env);
  if (gh) return `https://${gh.owner}.github.io${githubPagesBase(gh)}`;
  return LOCAL_SITE_URL;
}
