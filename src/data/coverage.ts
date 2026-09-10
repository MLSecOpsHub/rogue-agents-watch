// Field completeness across the dataset. Counts only; never a score. Used by
// the Stats "dataset gaps" panel, the evidence panel, and to decide whether a
// row that is null in every record is worth showing.
import type { Incident } from './types';

export interface CoverageRow {
  key: string;
  label: string;
  /** Records where the field carries a value (non-null, non-empty). */
  have: number;
  total: number;
}

export function fieldCoverage(incidents: Incident[]): CoverageRow[] {
  const total = incidents.length;
  const row = (key: string, label: string, pick: (i: Incident) => boolean): CoverageRow => ({ key, label, have: incidents.filter(pick).length, total });
  return [
    row('geo', 'Stated location (geo)', (i) => i.hasGeo),
    row('sectors', 'Target sectors', (i) => i.targets.sectors.length > 0),
    row('countries', 'Target countries', (i) => i.targets.countries.length > 0),
    row('orgs_affected', 'Organisations affected (number)', (i) => i.targets.orgs_affected !== null),
    row('records_exfiltrated', 'Records exfiltrated (number)', (i) => i.targets.records_exfiltrated !== null),
    row('autonomy_pct', 'Autonomy percentage (source-stated)', (i) => i.autonomy_pct !== null),
    row('mitre_atlas', 'MITRE ATLAS mapping', (i) => i.mappings.mitre_atlas.length > 0),
    row('mitre_attack', 'MITRE ATT&CK mapping', (i) => i.mappings.mitre_attack.length > 0),
    row('owasp_llm', 'OWASP LLM Top 10 mapping', (i) => i.mappings.owasp_llm.length > 0),
    row('owasp_asi', 'OWASP Agentic Top 10 (ASI) mapping', (i) => i.mappings.owasp_asi.length > 0),
    row('cve', 'CVE', (i) => i.mappings.cve.length > 0),
    row('aiid', 'AI Incident Database cross-link', (i) => i.mappings.aiid.length > 0),
    row('mitigations', 'Mitigations described', (i) => i.mitigations.length > 0),
    row('archived', 'Every source archived', (i) => i.sources.length > 0 && i.sources.every((s) => Boolean(s.archive_url))),
  ];
}

/** True when at least one record states a source-given autonomy percentage. */
export function datasetStatesAutonomyPct(incidents: Incident[]): boolean {
  return incidents.some((i) => i.autonomy_pct !== null);
}

export interface EvidenceSummary {
  sources: number;
  firstParty: number;
  archived: number;
  earliest: string | null;
  latest: string | null;
}

export function evidenceSummary(inc: Incident): EvidenceSummary {
  const dates = inc.sources.map((s) => s.date).filter((d): d is string => Boolean(d)).sort();
  return {
    sources: inc.sources.length,
    firstParty: inc.sources.filter((s) => s.type === 'first-party-disclosure' || s.type === 'vendor-report' || s.type === 'government-advisory').length,
    archived: inc.sources.filter((s) => Boolean(s.archive_url)).length,
    earliest: dates[0] ?? null,
    latest: dates[dates.length - 1] ?? null,
  };
}
