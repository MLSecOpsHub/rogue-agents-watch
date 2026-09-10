// Synthetic records for unit tests. These are NOT incidents and never ship;
// they exist only to exercise adapter and filter edge cases deterministically.
import type { RawIncident, Snapshot, Summary, Taxonomy } from '../src/data/types';
import taxonomyJson from '../data/snapshot/taxonomy.json';

export const taxonomy = taxonomyJson as unknown as Taxonomy;

export function rawRecord(overrides: Partial<RawIncident> = {}): RawIncident {
  return {
    id: 'test-record-alpha',
    name: 'Test record alpha',
    summary: 'A synthetic record used only by the unit tests of the dashboard.',
    date_disclosed: '2025-03-04',
    status: 'reported',
    confidence: 'secondary',
    category: 'autonomous-attack',
    severity: 'medium',
    models: ['Example Model 1'],
    model_families: ['other'],
    actor: 'Unknown',
    actor_type: 'unknown',
    sources: [{ title: 'Example source', url: 'https://example.invalid/report', publisher: 'Example', type: 'other', date: '2025-03-04' }],
    ...overrides,
  };
}

export const snapshot: Snapshot = {
  source_repo: 'https://github.com/MLSecOpsHub/agentic-attack-index',
  source_ref: 'main',
  source_commit: null,
  source_commit_date: null,
  dataset_version: '0.0.0-test',
  schema_id: null,
  total: 0,
  fetched_at: '2026-01-01',
  files: {},
  data_license: 'CC-BY-SA-4.0',
  attribution: 'test',
};

export function summaryFor(raw: RawIncident[]): Summary {
  return {
    dataset_version: '0.0.0-test',
    schema: '',
    total: raw.length,
    archive_coverage: { sources: 0, archived: 0, pct: 0 },
    by_category: {},
    by_severity: {},
    by_status: {},
    by_actor_type: {},
    by_autonomy_level: {},
    by_ai_role: {},
    by_model_family: {},
    by_year: {},
    ids: raw.map((r) => r.id),
  };
}
