// Type surface of scripts/prerender.mjs for the vitest suite. The script is
// plain ESM JavaScript (it runs in the build without a compile step); this
// declaration only describes the pure generators the tests exercise.
export interface PrerenderSource {
  title: string;
  url: string;
  archive_url?: string;
  publisher?: string;
}
/** One geo.points[] entry (upstream schema 0.3.0). */
export interface PrerenderPoint {
  role: 'origin' | 'target';
  basis?: string;
  attributed_by?: string;
  country?: string | null;
  lat: number;
  lng: number;
  label: string;
  illustrative?: boolean;
}
export interface PrerenderRecord {
  id: string;
  name: string;
  summary: string;
  actor: string;
  date_disclosed: string;
  status: string;
  confidence: string;
  ai_role?: string;
  severity: string;
  category: string;
  sources: PrerenderSource[];
  geo?: { points: PrerenderPoint[] } | null;
  added?: { date: string; by: string };
  last_updated?: string;
  revisions?: Array<{ date: string; note: string }>;
  record_status?: string;
  superseded_by?: string;
  [extra: string]: unknown;
}
export interface TaxonomyValue {
  id: string;
  label: string;
  description: string;
}
export interface PrerenderContext {
  incidents: PrerenderRecord[];
  summary: { dataset_version: string; total: number; ids: string[]; by_status?: Record<string, number>; [extra: string]: unknown };
  snapshot: { source_commit: string | null; fetched_at: string; source_ref?: string };
  taxonomy: Record<string, { title: string; values: TaxonomyValue[] }>;
  labels: Record<string, Record<string, { label: string }>>;
  version: string;
  siteUrl: string;
  rawBase: string;
  schemaUrl: string;
  /** The Vite-built index.html every page is assembled from (or FALLBACK_SHELL). */
  shell: string;
  geo: { landPath: string; project: (lng: number, lat: number) => [number, number] | null };
  upstreamIncidentUrl: (id: string) => string;
}
export interface PageMeta {
  title: string;
  ogTitle?: string;
  description: string;
  url: string;
  image?: string;
  imageAlt?: string;
  ogType?: string;
  extraHead?: string;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown> | null | undefined>;
}
export interface RoutePage {
  path: string;
  view: 'overview' | 'map' | 'timeline' | 'table' | 'techniques' | 'stats' | 'about';
  nav: string;
  title: string;
}
export interface ChangesJson {
  dataset_version: string;
  snapshot_commit: string | null;
  snapshot_fetched_at: string | null;
  total: number;
  additions: Array<{ id: string; name: string; date: string; url: string }>;
  revisions: Array<{ id: string; name: string; date: string; note: string }>;
  record_status: Array<{ id: string; name: string; record_status: string; superseded_by: string | null }>;
  attribution: string;
}
export const SITE_NAME: string;
export const DEFAULT_SITE_URL: string;
export const CARD_W: number;
export const CARD_H: number;
export const ROLE_HEX: Record<string, string>;
export function esc(s: unknown): string;
export function wrapText(text: string, maxChars: number, maxLines: number): string[];
export function firstSentence(text: string): string;
export const FALLBACK_SHELL: string;
export function loadContext(siteUrl?: string, opts?: { shell?: string }): PrerenderContext;
export function cardSvg(rec: PrerenderRecord, ctx: PrerenderContext): string;
export function siteCardSvg(ctx: PrerenderContext): string;
export function bareShell(html: string): string;
export function pageHtml(ctx: PrerenderContext, meta: PageMeta, body: string): string;
export function incidentHtml(rec: PrerenderRecord, ctx: PrerenderContext): string;
export function routeHtml(view: RoutePage['view'], ctx: PrerenderContext): string;
export function organizationJsonLd(): Record<string, unknown>;
export function websiteJsonLd(ctx: PrerenderContext): Record<string, unknown>;
export function datasetJsonLd(ctx: PrerenderContext): Record<string, unknown>;
export function routeJsonLd(ctx: PrerenderContext, route: RoutePage): Record<string, unknown>;
export function breadcrumbJsonLd(ctx: PrerenderContext, crumbs: Array<[string, string]>): Record<string, unknown>;
export function definedTermSetsJsonLd(ctx: PrerenderContext): Array<Record<string, unknown>>;
export function atomFeed(records: PrerenderRecord[], ctx: PrerenderContext): string;
export function changesJson(records: PrerenderRecord[], ctx: PrerenderContext): ChangesJson;
export function siteOgTags(ctx: PrerenderContext): string;
export function siteJsonLd(ctx: PrerenderContext): Record<string, unknown>;
export function incidentJsonLd(rec: PrerenderRecord, ctx: PrerenderContext): Record<string, unknown>;
export function sitemapXml(ctx: PrerenderContext): string;
export function robotsTxt(ctx: PrerenderContext): string;
export interface NavigatorLayer {
  name: string;
  versions: { layer: string; navigator: string };
  domain: string;
  description: string;
  techniques: Array<{ techniqueID: string; score: number; comment: string; enabled: boolean; showSubtechniques: boolean; links?: Array<{ label: string; url: string }> }>;
  gradient: { colors: string[]; minValue: number; maxValue: number };
  [extra: string]: unknown;
}
export function attackLayer(ctx: PrerenderContext): NavigatorLayer;
export function atlasLayer(ctx: PrerenderContext): NavigatorLayer;
export function uuid5(namespace: string, name: string): string;
export const MISP_NAMESPACE: string;
export interface MispFeed {
  manifest: Record<string, { uuid: string; info: string; date: string; timestamp: string; analysis: string; threat_level_id: string; Orgc: { name: string; uuid: string }; Tag: Array<{ name: string }>; extends_uuid: string }>;
  events: Record<string, { Event: { uuid: string; info: string; date: string; timestamp: string; published: boolean; Attribute: Array<{ uuid: string; type: string; category: string; value: string; comment: string; to_ids: boolean }>; Tag: Array<{ name: string }> } }>;
  hashes: string;
}
export function mispFeed(records: PrerenderRecord[], ctx: PrerenderContext): MispFeed;
