import { describe, expect, it } from 'vitest';
import { buildDataset } from '../src/data/adapter';
import { dateMs, formatT, parseT, replayBounds } from '../src/components/replay';
import { latestAdditions, latestRevisions } from '../src/components/changes';
import { rawRecord, snapshot, summaryFor, taxonomy } from './fixtures';

const raw = [rawRecord({ id: 'r-a', date_disclosed: '2024-02-14', added: { date: '2026-08-12', by: 'x' } }), rawRecord({ id: 'r-b', date_disclosed: '2025-11-13', added: { date: '2026-08-20', by: 'x' }, revisions: [{ date: '2026-09-01', note: 'Grade revised after vendor update.' }] }), rawRecord({ id: 'r-c', date_disclosed: '2025-06-11' })];
const ds = buildDataset(raw, summaryFor(raw), snapshot, taxonomy);

describe('replay bounds', () => {
  it('derive from the data only, never the wall clock', () => {
    const b = replayBounds(ds.incidents);
    expect(new Date(b.start).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(new Date(b.end).toISOString()).toBe('2025-12-31T00:00:00.000Z');
    expect(new Date(b.latest).toISOString()).toBe('2025-11-13T00:00:00.000Z');
    expect(replayBounds(ds.incidents)).toEqual(b);
  });

  it('parse month and day positions, inclusive of the month, clamped to bounds', () => {
    const b = replayBounds(ds.incidents);
    expect(parseT('2025-06', b)).toBe(Date.UTC(2025, 5, 30));
    expect(parseT('2025-06-11', b)).toBe(Date.UTC(2025, 5, 11));
    expect(parseT('2031-01', b)).toBe(b.end);
    expect(parseT('2001-01', b)).toBe(b.start);
    expect(parseT('nope', b)).toBeNull();
    expect(parseT('2025-13', b)).toBeNull();
    expect(parseT(null, b)).toBeNull();
  });

  it('format round-trips through the URL at month granularity', () => {
    const b = replayBounds(ds.incidents);
    const t = parseT('2025-08', b)!;
    expect(formatT(t)).toBe('2025-08');
    expect(dateMs('2025-06-11') <= t).toBe(true);
    expect(dateMs('2025-11-13') <= t).toBe(false);
  });
});

describe('what changed', () => {
  it('orders additions by added date, falling back to disclosure date', () => {
    expect(latestAdditions(ds.incidents).map((c) => c.id)).toEqual(['r-b', 'r-a', 'r-c']);
    expect(latestAdditions(ds.incidents, 1)).toHaveLength(1);
  });
  it('flattens revisions newest first with the note', () => {
    expect(latestRevisions(ds.incidents)).toEqual([{ id: 'r-b', name: 'Test record alpha', date: '2026-09-01', note: 'Grade revised after vendor update.' }]);
  });
});
