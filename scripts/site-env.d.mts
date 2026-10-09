export const LOCAL_BASE: string;
export const LOCAL_SITE_URL: string;
/** Path prefix the assets are served under, with leading and trailing slash. */
export function resolveBasePath(env?: NodeJS.ProcessEnv): string;
/** Absolute public URL of the site root, with a trailing slash. */
export function resolveSiteUrl(env?: NodeJS.ProcessEnv): string;
