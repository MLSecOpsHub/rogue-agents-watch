import type { Taxonomy, TaxonomyValue } from './types';

/** Map from record field name to taxonomy key (they match upstream except sectors). */
export const FIELD_TAXONOMY: Record<string, string> = {
  status: 'status',
  confidence: 'confidence',
  ai_role: 'ai_role',
  severity: 'severity',
  category: 'category',
  actor_type: 'actor_type',
  model_families: 'model_families',
  autonomy_level: 'autonomy_level',
  guardrail_bypass: 'guardrail_bypass',
  lifecycle_phases: 'lifecycle_phases',
  record_status: 'record_status',
  source_type: 'source_type',
  sectors: 'sectors',
};

export function taxonomyValue(tax: Taxonomy, key: string, id: string): TaxonomyValue | null {
  return tax[key]?.values.find((v) => v.id === id) ?? null;
}

/** Human label for an enum value; falls back to the raw id so nothing is hidden. */
export function label(tax: Taxonomy, key: string, id: string): string {
  return taxonomyValue(tax, key, id)?.label ?? id;
}

/** Upstream definition text for tooltips. Empty string when the taxonomy lacks it. */
export function describe(tax: Taxonomy, key: string, id: string): string {
  return taxonomyValue(tax, key, id)?.description ?? '';
}

/** Enum values in upstream order (for filters and chart ordering). */
export function values(tax: Taxonomy, key: string): TaxonomyValue[] {
  return tax[key]?.values ?? [];
}
