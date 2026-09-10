import { countBy, headlineRecords } from '../data/adapter';
import { describe, label, values } from '../data/taxonomy';
import type { Dataset, Incident, Summary } from '../data/types';
import type { BarDatum } from '../components/charts';
import { href } from '../router';

/**
 * Rollups for the stats views. When no record is retracted/superseded (the
 * normal case) the upstream summary.json is used verbatim. Otherwise the
 * headline excludes inactive records and the charts are recomputed from the
 * active set, and the caller shows a note saying so.
 */
export function rollups(ds: Dataset, includeInactive: boolean): { summary: Summary; recomputed: boolean; hidden: number } {
  const inactive = ds.incidents.filter((i) => !i.isActiveRecord);
  if (includeInactive || inactive.length === 0) return { summary: ds.summary, recomputed: false, hidden: 0 };
  const active = headlineRecords(ds.incidents, false);
  const summary: Summary = {
    ...ds.summary,
    total: active.length,
    by_category: countBy(active, (i) => i.category),
    by_severity: countBy(active, (i) => i.severity),
    by_status: countBy(active, (i) => i.status),
    by_actor_type: countBy(active, (i) => i.actor_type),
    by_autonomy_level: countBy(active, (i) => i.autonomy_level),
    by_ai_role: countBy(active, (i) => i.ai_role),
    by_model_family: countBy(active, (i) => i.model_families),
    by_year: countBy(active, (i) => i.year),
    ids: active.map((i) => i.id),
  };
  return { summary, recomputed: true, hidden: inactive.length };
}

/** Bars in taxonomy order, including zero-count enum values so absences are visible. */
export function enumBars(ds: Dataset, taxKey: string, counts: Record<string, number>, filterField: string, includeZero = true): BarDatum[] {
  const known = values(ds.taxonomy, taxKey);
  const bars: BarDatum[] = known
    .map((v) => ({
      key: v.id,
      label: v.label,
      value: counts[v.id] ?? 0,
      description: v.description,
      href: href('table', { [filterField]: v.id }),
      colorClass: `c-${taxKey}-${v.id}`,
    }))
    .filter((b) => includeZero || b.value > 0);
  for (const [k, v] of Object.entries(counts)) {
    if (!known.some((x) => x.id === k)) bars.push({ key: k, label: label(ds.taxonomy, taxKey, k), value: v, description: describe(ds.taxonomy, taxKey, k) });
  }
  return bars;
}

export function yearBars(counts: Record<string, number>): BarDatum[] {
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => ({ key: year, label: year, value, href: href('table', { year }) }));
}

export function relatedIncidents(ds: Dataset, inc: Incident): Incident[] {
  return inc.related.map((id) => ds.byId.get(id)).filter((x): x is Incident => Boolean(x));
}
