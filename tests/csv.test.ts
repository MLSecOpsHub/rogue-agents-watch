import { describe, expect, it } from 'vitest';
import { normalizeIncident } from '../src/data/adapter';
import { toCsv } from '../src/util/csv';
import { rawRecord } from './fixtures';

describe('toCsv', () => {
  it('writes nulls as empty cells, never as 0, and escapes quotes, commas and newlines', () => {
    const inc = normalizeIncident(rawRecord({ name: 'Quote "here", comma', summary: 'Line one\nline two of a synthetic summary.', autonomy_pct: null, targets: { orgs_affected: null } }));
    const csv = toCsv([inc]);
    const [head, row] = csv.split('\r\n');
    expect(head?.split(',')).toContain('autonomy_pct');
    expect(row).toContain('"Quote ""here"", comma"');
    expect(row).toContain('"Line one\nline two of a synthetic summary."');
    const cols = head!.split(',');
    // Parse the row with a minimal RFC 4180 reader to check specific cells.
    const cells = parseRow(row!);
    expect(cells).toHaveLength(cols.length);
    expect(cells[cols.indexOf('autonomy_pct')]).toBe('');
    expect(cells[cols.indexOf('orgs_affected')]).toBe('');
    expect(cells[cols.indexOf('actor')]).toBe('Unknown');
  });

  it('mirrors the upstream geo_points column: role:basis:country per point, "-" for a region centroid, empty without geo', () => {
    const withGeo = normalizeIncident(
      rawRecord({
        actor_type: 'nation-state',
        geo: {
          points: [
            { role: 'origin', basis: 'sponsor-attribution', attributed_by: 'Example', country: 'KP', lat: 40, lng: 127, label: 'Synthetic origin (centroid)', illustrative: true },
            { role: 'target', basis: 'victim-location', attributed_by: 'Example', country: null, lat: 50, lng: 10, label: 'Synthetic region (centroid)', illustrative: true },
          ],
        },
      }),
    );
    const [head, row, row2] = toCsv([withGeo, normalizeIncident(rawRecord({ id: 'test-record-beta' }))]).split('\r\n');
    const cols = head!.split(',');
    expect(cols).toContain('geo_points');
    expect(parseRow(row!)[cols.indexOf('geo_points')]).toBe('origin:sponsor-attribution:KP; target:victim-location:-');
    expect(parseRow(row2!)[cols.indexOf('geo_points')]).toBe('');
  });

  it('keeps a stated zero', () => {
    const inc = normalizeIncident(rawRecord({ autonomy_pct: 0 }));
    const [head, row] = toCsv([inc]).split('\r\n');
    const cols = head!.split(',');
    expect(parseRow(row!)[cols.indexOf('autonomy_pct')]).toBe('0');
  });
});

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
