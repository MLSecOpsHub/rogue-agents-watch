import { describe, expect, it } from 'vitest';
import { buildDataset, countBy, headlineRecords, normalizeIncident } from '../src/data/adapter';
import { rawRecord, snapshot, summaryFor, taxonomy } from './fixtures';

describe('normalizeIncident', () => {
  it('keeps nulls as null and never coerces them to zero', () => {
    const inc = normalizeIncident(rawRecord({ autonomy_pct: null, targets: { orgs_affected: null, records_exfiltrated: null, sectors: [], countries: [] }, impact: null }));
    expect(inc.autonomy_pct).toBeNull();
    expect(inc.targets.orgs_affected).toBeNull();
    expect(inc.targets.records_exfiltrated).toBeNull();
    expect(inc.impact).toBeNull();
  });

  it('keeps a stated zero as zero (zero and null are different facts)', () => {
    const inc = normalizeIncident(rawRecord({ autonomy_pct: 0, targets: { orgs_affected: 0 } }));
    expect(inc.autonomy_pct).toBe(0);
    expect(inc.targets.orgs_affected).toBe(0);
  });

  it('treats missing optional fields as absent, not invented', () => {
    const inc = normalizeIncident(rawRecord());
    expect(inc.autonomy_pct).toBeNull();
    expect(inc.targets).toEqual({ orgs_affected: null, records_exfiltrated: null, sectors: [], countries: [] });
    expect(inc.mappings).toEqual({ mitre_atlas: [], mitre_attack: [], owasp_llm: [], owasp_asi: [], cve: [], aiid: [] });
    expect(inc.related).toEqual([]);
    expect(inc.mitigations).toEqual([]);
    expect(inc.revisions).toEqual([]);
    expect(inc.guardrail_bypass).toEqual([]);
    expect(inc.lifecycle_phases).toEqual([]);
    expect(inc.added).toBeNull();
    expect(inc.last_updated).toBeNull();
  });

  it('defaults a missing record_status to active and flags it as a headline record', () => {
    const inc = normalizeIncident(rawRecord());
    expect(inc.record_status).toBe('active');
    expect(inc.isActiveRecord).toBe(true);
    expect(inc.superseded_by).toBeNull();
  });

  it('marks retracted and superseded records inactive, disputed stays active but flagged', () => {
    expect(normalizeIncident(rawRecord({ record_status: 'retracted' })).isActiveRecord).toBe(false);
    const sup = normalizeIncident(rawRecord({ record_status: 'superseded', superseded_by: 'test-record-beta' }));
    expect(sup.isActiveRecord).toBe(false);
    expect(sup.superseded_by).toBe('test-record-beta');
    const disputed = normalizeIncident(rawRecord({ record_status: 'disputed' }));
    expect(disputed.isActiveRecord).toBe(true);
    expect(disputed.record_status).toBe('disputed');
  });

  it('defaults missing grades to "unknown" rather than a stronger value', () => {
    const inc = normalizeIncident(rawRecord());
    expect(inc.ai_role).toBe('unknown');
    expect(inc.autonomy_level).toBe('unknown');
  });

  it('preserves actor text verbatim, including "Unknown"', () => {
    expect(normalizeIncident(rawRecord({ actor: 'Unknown' })).actor).toBe('Unknown');
    expect(normalizeIncident(rawRecord({ actor: '  GTG-0000 ' })).actor).toBe('  GTG-0000 ');
  });

  it('renders no geo when the record has none (never derives from countries)', () => {
    const inc = normalizeIncident(rawRecord({ targets: { countries: ['US', 'DE'] } }));
    expect(inc.geo).toBeNull();
    expect(inc.hasGeo).toBe(false);
  });

  it('keeps every geo point verbatim, including its basis, attributor, country and illustrative flag', () => {
    const inc = normalizeIncident(
      rawRecord({
        geo: {
          points: [
            { role: 'target', basis: 'victim-location', attributed_by: 'Vendor', country: 'US', lat: 1.5, lng: 2.5, label: 'Somewhere', illustrative: true },
            { role: 'origin', basis: 'sponsor-attribution', attributed_by: 'Vendor', country: 'KP', lat: -3, lng: 4, label: 'Elsewhere', illustrative: true },
            { role: 'origin', basis: 'stated-location', attributed_by: 'Court filing', country: 'GB', lat: 51.5, lng: -0.1, label: 'London', illustrative: false },
          ],
        },
      }),
    );
    expect(inc.hasGeo).toBe(true);
    expect(inc.geo?.points).toHaveLength(3);
    expect(inc.geo?.points[0]).toEqual({ role: 'target', basis: 'victim-location', attributed_by: 'Vendor', country: 'US', lat: 1.5, lng: 2.5, label: 'Somewhere', illustrative: true });
    expect(inc.geo?.points.filter((p) => p.role === 'origin')).toHaveLength(2);
    expect(inc.geo?.points[2]?.illustrative).toBe(false);
  });

  it('leaves basis fields null when a point omits them, and never flags illustrative by default', () => {
    const inc = normalizeIncident(rawRecord({ geo: { points: [{ role: 'origin', lat: 10, lng: 20, label: 'X' } as never] } }));
    expect(inc.geo?.points[0]).toEqual({ role: 'origin', basis: null, attributed_by: null, country: null, lat: 10, lng: 20, label: 'X', illustrative: false });
  });

  it('drops points without coordinates or a known role, and the block when none remain', () => {
    const inc = normalizeIncident(rawRecord({ geo: { points: [{ role: 'origin', label: 'X' }, { role: 'elsewhere', lat: 1, lng: 2, label: 'Y' }] as never } }));
    expect(inc.geo).toBeNull();
    expect(inc.hasGeo).toBe(false);
    expect(normalizeIncident(rawRecord({ geo: { points: [] } })).geo).toBeNull();
  });

  it('derives the disclosure year from date_disclosed', () => {
    expect(normalizeIncident(rawRecord({ date_disclosed: '2024-11-30' })).year).toBe(2024);
  });
});

describe('buildDataset', () => {
  it('sorts newest first and indexes by id', () => {
    const raw = [rawRecord({ id: 'aaa-old', date_disclosed: '2024-01-01' }), rawRecord({ id: 'bbb-new', date_disclosed: '2025-06-01' }), rawRecord({ id: 'ccc-new', date_disclosed: '2025-06-01' })];
    const ds = buildDataset(raw, summaryFor(raw), snapshot, taxonomy);
    expect(ds.incidents.map((i) => i.id)).toEqual(['bbb-new', 'ccc-new', 'aaa-old']);
    expect(ds.byId.get('aaa-old')?.name).toBe('Test record alpha');
  });
});

describe('headlineRecords / countBy', () => {
  const raw = [rawRecord({ id: 'a-1' }), rawRecord({ id: 'b-2', record_status: 'retracted' }), rawRecord({ id: 'c-3', record_status: 'superseded', superseded_by: 'a-1' }), rawRecord({ id: 'd-4', record_status: 'disputed' })];
  const ds = buildDataset(raw, summaryFor(raw), snapshot, taxonomy);

  it('excludes retracted and superseded by default, includes them on request', () => {
    expect(headlineRecords(ds.incidents, false).map((i) => i.id).sort()).toEqual(['a-1', 'd-4']);
    expect(headlineRecords(ds.incidents, true)).toHaveLength(4);
  });

  it('counts array fields once per value and sorts keys', () => {
    const counts = countBy(ds.incidents, (i) => i.model_families);
    expect(counts).toEqual({ other: 4 });
    expect(countBy(ds.incidents, (i) => i.record_status)).toEqual({ active: 1, disputed: 1, retracted: 1, superseded: 1 });
  });
});
