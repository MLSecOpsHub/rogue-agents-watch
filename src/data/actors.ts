// Actors, grouped by the verbatim `actor` string. Nothing is merged, inferred
// or normalised: "GTG-1002" and "GTG-1002 (per Anthropic)" are two groups if
// the dataset states them differently, and "Unknown" is a group like any
// other. The slug exists only to give each group a URL; the name shown is
// always the dataset's string. scripts/prerender-util.mjs mirrors actorSlug
// for the static pages; tests/smoke.test.ts pins the two together.
import type { ActorType, Incident } from './types';

export interface ActorGroup {
  /** The actor exactly as stated by sources. */
  actor: string;
  slug: string;
  incidents: Incident[];
  actorTypes: ActorType[];
}

/** Max slug length; some actor strings are whole sentences. Cut at a word boundary; uniqueness is restored by actorGroups. */
export const SLUG_MAX = 60;

export function actorSlug(actor: string): string {
  let s = actor
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length > SLUG_MAX) {
    const cut = s.lastIndexOf('-', SLUG_MAX);
    s = s.slice(0, cut > SLUG_MAX / 2 ? cut : SLUG_MAX).replace(/-+$/g, '');
  }
  return s || 'unnamed';
}

const byDateDesc = (a: Incident, b: Incident) => (a.date_disclosed < b.date_disclosed ? 1 : a.date_disclosed > b.date_disclosed ? -1 : a.id.localeCompare(b.id));

/** Groups ordered by record count, then name; slugs made unique deterministically (by name order). */
export function actorGroups(incidents: Incident[]): ActorGroup[] {
  const map = new Map<string, Incident[]>();
  for (const inc of incidents) map.set(inc.actor, [...(map.get(inc.actor) ?? []), inc]);
  const groups: ActorGroup[] = [...map.entries()]
    .map(([actor, incs]) => ({ actor, slug: actorSlug(actor), incidents: incs.slice().sort(byDateDesc), actorTypes: [...new Set(incs.map((i) => i.actor_type))].sort() }))
    .sort((a, b) => a.actor.localeCompare(b.actor));
  const seen = new Map<string, number>();
  for (const g of groups) {
    const n = (seen.get(g.slug) ?? 0) + 1;
    seen.set(g.slug, n);
    if (n > 1) g.slug = `${g.slug}-${n}`;
  }
  return groups.sort((a, b) => b.incidents.length - a.incidents.length || a.actor.localeCompare(b.actor));
}

export function findActor(groups: ActorGroup[], slug: string): ActorGroup | undefined {
  return groups.find((g) => g.slug === slug);
}

/** Distinct values of a per-record list across a group, with record counts, most common first. */
export function tally<T extends string>(incidents: Incident[], pick: (inc: Incident) => T[]): Array<[T, number]> {
  const m = new Map<T, number>();
  for (const inc of incidents) for (const v of new Set(pick(inc))) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}
