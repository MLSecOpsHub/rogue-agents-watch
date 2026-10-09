import { describe, expect, it } from 'vitest';
import { normalizeIncident } from '../src/data/adapter';
import { datasetStatesAutonomyPct, evidenceSummary, fieldCoverage } from '../src/data/coverage';
import { rawRecord } from './fixtures';

describe('coverage', () => {
  const a = normalizeIncident(rawRecord({ id: 'a-a', autonomy_pct: null, mappings: { mitre_atlas: ['AML.T0051'] }, sources: [{ title: 't', url: 'https://x.invalid/1', archive_url: 'https://web.archive.org/x', publisher: 'p', type: 'vendor-report', date: '2025-01-02' }, { title: 't2', url: 'https://x.invalid/2', publisher: 'p', type: 'news', date: '2025-01-05' }] }));
  const b = normalizeIncident(rawRecord({ id: 'b-b', autonomy_pct: 40, geo: { points: [{ role: 'origin', basis: 'actor-location', attributed_by: 'p', country: 'XX', lat: 1, lng: 2, label: 'X', illustrative: true }] } }));

  it('counts records carrying each optional field, never treating null as zero', () => {
    const rows = Object.fromEntries(fieldCoverage([a, b]).map((r) => [r.key, r.have]));
    expect(rows['autonomy_pct']).toBe(1);
    expect(rows['mitre_atlas']).toBe(1);
    expect(rows['geo']).toBe(1);
    expect(rows['archived']).toBe(0);
    expect(fieldCoverage([a, b]).every((r) => r.total === 2)).toBe(true);
  });

  it('knows whether any record states an autonomy percentage', () => {
    expect(datasetStatesAutonomyPct([a])).toBe(false);
    expect(datasetStatesAutonomyPct([a, b])).toBe(true);
  });

  it('summarises evidence as counts and a date span', () => {
    expect(evidenceSummary(a)).toEqual({ sources: 2, firstParty: 1, archived: 1, earliest: '2025-01-02', latest: '2025-01-05' });
  });
});
