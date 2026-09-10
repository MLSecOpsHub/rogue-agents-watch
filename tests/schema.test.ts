// Schema validation of the vendored snapshot, hermetic (no network). This
// duplicates scripts/validate-data.mjs on purpose so `vitest run` alone still
// catches drift, and so the check runs in the same process as the adapter tests.
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../data/snapshot/incident.schema.json';
import incidents from '../data/snapshot/incidents.json';
import summary from '../data/snapshot/summary.json';
import snapshot from '../data/snapshot/SNAPSHOT.json';
import taxonomy from '../data/snapshot/taxonomy.json';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('vendored snapshot', () => {
  it('is a non-empty array of records', () => {
    expect(Array.isArray(incidents)).toBe(true);
    expect(incidents.length).toBeGreaterThan(0);
  });

  it.each(incidents.map((r) => [r.id, r] as const))('%s validates against the vendored schema', (_id, record) => {
    const ok = validate(record);
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });

  it('has unique ids that match summary.ids exactly', () => {
    const ids = incidents.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...summary.ids].sort());
    expect(summary.total).toBe(incidents.length);
  });

  it('has related[] and superseded_by references that resolve', () => {
    const ids = new Set(incidents.map((r) => r.id));
    for (const r of incidents as Array<{ id: string; related?: string[]; superseded_by?: string }>) {
      for (const ref of r.related ?? []) expect(ids.has(ref), `${r.id} -> ${ref}`).toBe(true);
      if (r.superseded_by) expect(ids.has(r.superseded_by), `${r.id} -> ${r.superseded_by}`).toBe(true);
    }
  });

  it('records provenance that agrees with the artifacts', () => {
    expect(snapshot.dataset_version).toBe(summary.dataset_version);
    expect(snapshot.total).toBe(incidents.length);
    expect(snapshot.source_repo).toBe('https://github.com/MLSecOpsHub/agentic-attack-index');
    expect(snapshot.fetched_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(schema.$id).toBe(summary.schema);
  });

  it('has taxonomy definitions for every enum value the UI labels', () => {
    const p = schema.properties;
    const pairs: Array<[string, string[]]> = [
      ['status', p.status.enum],
      ['confidence', p.confidence.enum],
      ['ai_role', p.ai_role.enum],
      ['severity', p.severity.enum],
      ['category', p.category.enum],
      ['actor_type', p.actor_type.enum],
      ['model_families', p.model_families.items.enum],
      ['autonomy_level', p.autonomy_level.enum],
      ['guardrail_bypass', p.guardrail_bypass.items.enum],
      ['lifecycle_phases', p.lifecycle_phases.items.enum],
      ['record_status', p.record_status.enum],
      ['source_type', p.sources.items.properties.type.enum],
    ];
    const tax = taxonomy as Record<string, { values: Array<{ id: string; description: string }> }>;
    for (const [key, values] of pairs) {
      const have = new Map(tax[key]?.values.map((v) => [v.id, v.description]) ?? []);
      for (const v of values) {
        expect(have.has(v), `${key}.${v}`).toBe(true);
        expect(have.get(v)?.length ?? 0, `${key}.${v} description`).toBeGreaterThan(0);
      }
    }
  });
});
