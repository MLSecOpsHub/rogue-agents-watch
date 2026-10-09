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

interface GeoRecord {
  id: string;
  sources: Array<{ publisher: string }>;
  geo?: { points: Array<{ role: string; basis: string; attributed_by: string; country: string | null; illustrative: boolean }> };
}

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

  it('keeps map points in geo.points[] only, each with a basis allowed for its role, a cited publisher and a consistent illustrative flag', () => {
    const byRole: Record<string, string[]> = {
      origin: ['sponsor-attribution', 'operator-location', 'actor-location', 'infrastructure', 'stated-location'],
      target: ['victim-location', 'stated-location'],
    };
    let points = 0;
    for (const r of incidents as unknown as GeoRecord[]) {
      if (!r.geo) continue;
      expect('target' in r.geo, `${r.id}: legacy geo.target`).toBe(false);
      expect('origin' in r.geo, `${r.id}: legacy geo.origin`).toBe(false);
      expect(r.geo.points.length, `${r.id}: empty geo.points`).toBeGreaterThan(0);
      const publishers = new Set(r.sources.map((s) => s.publisher));
      for (const p of r.geo.points) {
        points++;
        expect(byRole[p.role], `${r.id}: ${p.basis} on ${p.role}`).toContain(p.basis);
        expect(publishers.has(p.attributed_by), `${r.id}: "${p.attributed_by}" is not a cited publisher`).toBe(true);
        expect(p.illustrative, `${r.id}: ${p.basis} illustrative flag`).toBe(p.basis !== 'stated-location');
        if (p.country === null) expect(p.illustrative, `${r.id}: null country on a stated point`).toBe(true);
        else expect(p.country, `${r.id}: country`).toMatch(/^[A-Z]{2}$/);
      }
    }
    expect(points).toBe(summary.geo_coverage.points);
  });

  it('summary.geo_coverage agrees with the points in incidents.json', () => {
    const records = incidents as unknown as GeoRecord[];
    const all = records.flatMap((r) => r.geo?.points ?? []);
    const tally = (keys: string[]): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const k of keys) out[k] = (out[k] ?? 0) + 1;
      return out;
    };
    expect(summary.geo_coverage).toEqual({
      records: records.filter((r) => (r.geo?.points ?? []).length > 0).length,
      points: all.length,
      illustrative: all.filter((p) => p.illustrative).length,
      by_role: tally(all.map((p) => p.role)),
      by_basis: tally(all.map((p) => p.basis)),
    });
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
      ['geo_basis', schema.$defs.geoPoint.properties.basis.enum],
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
