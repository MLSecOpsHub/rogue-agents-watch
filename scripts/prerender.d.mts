// Type surface of scripts/prerender.mjs for the vitest suite. The script is
// plain ESM JavaScript (it runs in the build without a compile step); this
// declaration only describes the pure generators the tests exercise.
export interface PrerenderSource {
  title: string;
  url: string;
  archive_url?: string;
  publisher?: string;
}
export interface PrerenderPoint {
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
  geo?: { target?: PrerenderPoint; origin?: PrerenderPoint } | null;
  added?: { date: string; by: string };
  last_updated?: string;
  revisions?: Array<{ date: string; note: string }>;
  record_status?: string;
  superseded_by?: string;
  [extra: string]: unknown;
}
export interface PrerenderContext {
  incidents: PrerenderRecord[];
  summary: { dataset_version: string; total: number; ids: string[]; by_status?: Record<string, number> };
  snapshot: { source_commit: string | null; fetched_at: string; source_ref?: string };
  labels: Record<string, Record<string, { label: string }>>;
  version: string;
  siteUrl: string;
  geo: { landPath: string; project: (lng: number, lat: number) => [number, number] | null };
  upstreamIncidentUrl: (id: string) => string;
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
export function loadContext(siteUrl?: string): PrerenderContext;
export function cardSvg(rec: PrerenderRecord, ctx: PrerenderContext): string;
export function siteCardSvg(ctx: PrerenderContext): string;
export function incidentHtml(rec: PrerenderRecord, ctx: PrerenderContext): string;
export function atomFeed(records: PrerenderRecord[], ctx: PrerenderContext): string;
export function changesJson(records: PrerenderRecord[], ctx: PrerenderContext): ChangesJson;
export function siteOgTags(ctx: PrerenderContext): string;
