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
