import type { PrerenderContext, PrerenderRecord } from './prerender.d.mts';

export const SITE_NAME: string;
export const UPSTREAM: string;
export const PUBLISHER: { name: string; url: string; github: string };
export const LICENSE_URL: string;
export const CARD_W: number;
export const CARD_H: number;
export function esc(s: unknown): string;
export function wrapText(text: string, maxChars: number, maxLines: number): string[];
export function firstSentence(text: string): string;
export function tax(ctx: PrerenderContext, key: string, id: string): string;
export function taxDesc(ctx: PrerenderContext, key: string, id: string): string;
export function gradeLine(ctx: PrerenderContext, rec: PrerenderRecord): string;
export function datasetModified(records: PrerenderRecord[], fallback?: string | null): string | null;
export const SLUG_MAX: number;
export function actorSlug(actor: string): string;
export interface PrerenderActorGroup {
  actor: string;
  slug: string;
  incidents: PrerenderRecord[];
  actorTypes: string[];
}
export function actorGroups(records: PrerenderRecord[]): PrerenderActorGroup[];
