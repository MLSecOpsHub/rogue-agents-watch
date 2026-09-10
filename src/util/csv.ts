import type { Incident } from '../data/types';

const COLUMNS: Array<[string, (i: Incident) => string]> = [
  ['id', (i) => i.id],
  ['name', (i) => i.name],
  ['date_disclosed', (i) => i.date_disclosed],
  ['status', (i) => i.status],
  ['confidence', (i) => i.confidence],
  ['ai_role', (i) => i.ai_role],
  ['severity', (i) => i.severity],
  ['category', (i) => i.category],
  ['actor', (i) => i.actor],
  ['actor_type', (i) => i.actor_type],
  ['models', (i) => i.models.join('; ')],
  ['model_families', (i) => i.model_families.join('; ')],
  ['autonomy_level', (i) => i.autonomy_level],
  ['autonomy_pct', (i) => (i.autonomy_pct === null ? '' : String(i.autonomy_pct))],
  ['guardrail_bypass', (i) => i.guardrail_bypass.join('; ')],
  ['lifecycle_phases', (i) => i.lifecycle_phases.join('; ')],
  ['sectors', (i) => i.targets.sectors.join('; ')],
  ['countries', (i) => i.targets.countries.join('; ')],
  ['orgs_affected', (i) => (i.targets.orgs_affected === null ? '' : String(i.targets.orgs_affected))],
  ['records_exfiltrated', (i) => (i.targets.records_exfiltrated === null ? '' : String(i.targets.records_exfiltrated))],
  ['mitre_atlas', (i) => i.mappings.mitre_atlas.join('; ')],
  ['mitre_attack', (i) => i.mappings.mitre_attack.join('; ')],
  ['owasp_llm', (i) => i.mappings.owasp_llm.join('; ')],
  ['cve', (i) => i.mappings.cve.join('; ')],
  ['record_status', (i) => i.record_status],
  ['sources', (i) => i.sources.map((s) => s.url).join('; ')],
  ['summary', (i) => i.summary],
];

function cell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(list: Incident[]): string {
  const head = COLUMNS.map(([k]) => k).join(',');
  const rows = list.map((i) => COLUMNS.map(([, f]) => cell(f(i))).join(','));
  return [head, ...rows].join('\r\n') + '\r\n';
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
