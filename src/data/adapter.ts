import type { Dataset, GeoPoint, Incident, RawIncident, Snapshot, Summary, Taxonomy } from './types';

function arr<T>(v: T[] | undefined | null): T[] {
  return Array.isArray(v) ? v : [];
}

function point(p: GeoPoint | null | undefined): GeoPoint | null {
  if (!p || typeof p.lat !== 'number' || typeof p.lng !== 'number') return null;
  return { lat: p.lat, lng: p.lng, label: p.label, illustrative: p.illustrative === true };
}

/**
 * Normalise one raw record. Rules (see CLAUDE.md):
 *  - nulls stay null (never coerced to 0 or "")
 *  - missing record_status => 'active'
 *  - geo is only what the dataset states; illustrative flag preserved verbatim
 *  - no field is invented, inferred, or enriched
 */
export function normalizeIncident(raw: RawIncident): Incident {
  const recordStatus = raw.record_status ?? 'active';
  const target = point(raw.geo?.target);
  const origin = point(raw.geo?.origin);
  const geo = target || origin ? { target, origin } : null;
  return {
    id: raw.id,
    name: raw.name,
    summary: raw.summary,
    impact: raw.impact ?? null,
    date_disclosed: raw.date_disclosed,
    year: Number(raw.date_disclosed.slice(0, 4)),
    added: raw.added ?? null,
    last_updated: raw.last_updated ?? null,

    status: raw.status,
    confidence: raw.confidence,
    ai_role: raw.ai_role ?? 'unknown',
    severity: raw.severity,

    category: raw.category,
    actor: raw.actor,
    actor_type: raw.actor_type,
    models: arr(raw.models),
    model_families: arr(raw.model_families),
    autonomy_level: raw.autonomy_level ?? 'unknown',
    autonomy_pct: typeof raw.autonomy_pct === 'number' ? raw.autonomy_pct : null,
    guardrail_bypass: arr(raw.guardrail_bypass),
    lifecycle_phases: arr(raw.lifecycle_phases),

    targets: {
      orgs_affected: typeof raw.targets?.orgs_affected === 'number' ? raw.targets.orgs_affected : null,
      records_exfiltrated:
        typeof raw.targets?.records_exfiltrated === 'number' ? raw.targets.records_exfiltrated : null,
      sectors: arr(raw.targets?.sectors),
      countries: arr(raw.targets?.countries),
    },

    geo,
    hasGeo: geo !== null,

    mappings: {
      mitre_atlas: arr(raw.mappings?.mitre_atlas),
      mitre_attack: arr(raw.mappings?.mitre_attack),
      owasp_llm: arr(raw.mappings?.owasp_llm),
      owasp_asi: arr(raw.mappings?.owasp_asi),
      cve: arr(raw.mappings?.cve),
      aiid: arr(raw.mappings?.aiid),
    },

    sources: arr(raw.sources),
    related: arr(raw.related),
    mitigations: arr(raw.mitigations),

    record_status: recordStatus,
    superseded_by: raw.superseded_by ?? null,
    revisions: arr(raw.revisions),
    isActiveRecord: recordStatus !== 'retracted' && recordStatus !== 'superseded',
  };
}

export function buildDataset(
  rawIncidents: RawIncident[],
  summary: Summary,
  snapshot: Snapshot,
  taxonomy: Taxonomy,
): Dataset {
  const incidents = rawIncidents
    .map(normalizeIncident)
    .sort((a, b) => (a.date_disclosed < b.date_disclosed ? 1 : a.date_disclosed > b.date_disclosed ? -1 : a.id.localeCompare(b.id)));
  const byId = new Map(incidents.map((i) => [i.id, i]));
  return { incidents, byId, summary, snapshot, taxonomy };
}

/** Records shown in headline counts: active + disputed (flagged), not retracted/superseded. */
export function headlineRecords(incidents: Incident[], includeInactive: boolean): Incident[] {
  return includeInactive ? incidents : incidents.filter((i) => i.isActiveRecord);
}

/** Count values of a field (string or string[]) across records. */
export function countBy(incidents: Incident[], pick: (i: Incident) => string | string[] | number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const inc of incidents) {
    const v = pick(inc);
    const values = Array.isArray(v) ? v : [String(v)];
    for (const key of values) out[key] = (out[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}
