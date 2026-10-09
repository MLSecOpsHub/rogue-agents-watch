// Type surface of scripts/prerender-pages.mjs for the vitest suite.
import type { PrerenderContext, PrerenderRecord, RoutePage } from './prerender.d.mts';

export const ROUTE_PAGES: RoutePage[];
export const ROUTE_BODIES: Record<RoutePage['view'], (ctx: PrerenderContext) => string>;
export function recordItem(ctx: PrerenderContext, r: PrerenderRecord): string;
export function navHtml(ctx: PrerenderContext, current: string): string;
export function footerHtml(ctx: PrerenderContext): string;
export function overviewBody(ctx: PrerenderContext): string;
export function mapBody(ctx: PrerenderContext): string;
export function timelineBody(ctx: PrerenderContext): string;
export function tableBody(ctx: PrerenderContext): string;
export function techniquesBody(ctx: PrerenderContext): string;
export function statsBody(ctx: PrerenderContext): string;
export function aboutBody(ctx: PrerenderContext): string;
export function routeDescription(ctx: PrerenderContext, view: string): string;
export function incidentBody(ctx: PrerenderContext, r: PrerenderRecord): string;
export function llmsTxt(ctx: PrerenderContext): string;
export function llmsFullTxt(ctx: PrerenderContext): string;
