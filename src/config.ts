// Single source of truth for where the data comes from and how to reach upstream.
// The dashboard renders ONLY from the vendored snapshot in data/snapshot/; these
// URLs are used for links, citations, and the optional user-initiated
// "check for a newer dataset" action.

export const UPSTREAM_REPO = 'MLSecOpsHub/agentic-attack-index';
export const UPSTREAM_REPO_URL = `https://github.com/${UPSTREAM_REPO}`;

/** Git ref (branch or tag) the vendored snapshot tracks. Changed only by sync-data. */
export const DATA_REF = 'main';

/** Base URL of the published dist/ artifacts for the configured ref. */
export const DATA_BASE_URL = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${DATA_REF}`;

export const upstreamUrls = {
  incidents: `${DATA_BASE_URL}/dist/incidents.json`,
  summary: `${DATA_BASE_URL}/dist/summary.json`,
  ndjson: `${DATA_BASE_URL}/dist/incidents.ndjson`,
  csv: `${DATA_BASE_URL}/dist/incidents.csv`,
  stix: `${DATA_BASE_URL}/dist/stix/bundle.json`,
  schema: `${DATA_BASE_URL}/schema/incident.schema.json`,
  /** Per-incident permalink to the upstream JSON artifact. */
  incident: (id: string) => `${DATA_BASE_URL}/dist/incidents/${encodeURIComponent(id)}.json`,
  /** Per-incident source record (YAML) in the upstream repo. */
  incidentSource: (id: string) => `${UPSTREAM_REPO_URL}/blob/${DATA_REF}/data/incidents/${encodeURIComponent(id)}.yml`,
};

/** Opens an upstream "Data correction" issue pre-filled with the record id. */
export function correctionIssueUrl(id: string): string {
  const params = new URLSearchParams({
    template: 'data-correction.yml',
    title: `[correction] ${id}`,
    'incident-id': id,
  });
  return `${UPSTREAM_REPO_URL}/issues/new?${params.toString()}`;
}

/**
 * Canonical public URL of the deployed site, with a trailing slash. Used for
 * share links and Open Graph tags; override at build time with VITE_SITE_URL
 * (e.g. for a custom domain). Keep in step with `base` in vite.config.ts.
 */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL as string | undefined) ?? 'https://mlsecopshub.github.io/rogue-agents-dashboard/';

/** Share link: the prerendered per-incident page that unfurls with a card and redirects to the hash route. */
export function shareUrl(id: string): string {
  return `${SITE_URL}incident/${encodeURIComponent(id)}/`;
}

/** Opens the upstream "New incident" issue template. */
export function newIncidentIssueUrl(): string {
  return `${UPSTREAM_REPO_URL}/issues/new?template=new-incident.yml`;
}

export const SITE = {
  name: 'Rogue Agent Watch',
  url: SITE_URL,
  tagline: 'Real-world cyberattacks executed or orchestrated by AI agents, and rogue-agent incidents',
  publisher: 'MLSecOpsHub',
  publisherUrl: 'https://mlsecopshub.com',
  repoUrl: 'https://github.com/MLSecOpsHub/rogue-agents-dashboard',
  dataLicense: 'CC BY-SA 4.0',
  dataLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  codeLicense: 'MIT',
};
