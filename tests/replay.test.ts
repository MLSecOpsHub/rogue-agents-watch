import { describe, expect, it } from 'vitest';
import { buildDataset, normalizeIncident } from '../src/data/adapter';
import { createReplay, dateMs, formatT, minusMonths, parseT, replayBounds } from '../src/components/replay';
import { latestAdditions, latestRevisions } from '../src/components/changes';
import { rawRecord, snapshot, summaryFor, taxonomy } from './fixtures';

const raw = [rawRecord({ id: 'r-a', date_disclosed: '2024-02-14', added: { date: '2026-08-12', by: 'x' } }), rawRecord({ id: 'r-b', date_disclosed: '2025-11-13', added: { date: '2026-08-20', by: 'x' }, revisions: [{ date: '2026-09-01', note: 'Grade revised after vendor update.' }] }), rawRecord({ id: 'r-c', date_disclosed: '2025-06-11' })];
const ds = buildDataset(raw, summaryFor(raw), snapshot, taxonomy);

describe('replay bounds', () => {
  it('derive from the data only, never the wall clock', () => {
    const b = replayBounds(ds.incidents);
    // Earliest disclosure is 2024-02-14; the track opens one quarter before it.
    expect(new Date(b.earliest).toISOString()).toBe('2024-02-14T00:00:00.000Z');
    expect(new Date(b.start).toISOString()).toBe('2023-11-14T00:00:00.000Z');
    expect(new Date(b.end).toISOString()).toBe('2025-12-31T00:00:00.000Z');
    expect(new Date(b.latest).toISOString()).toBe('2025-11-13T00:00:00.000Z');
    expect(replayBounds(ds.incidents)).toEqual(b);
  });

  it('open exactly three calendar months before the first attack, clamping to the last day of the month', () => {
    const only = (date: string) => replayBounds([normalizeIncident(rawRecord({ id: 'x-x', date_disclosed: date }))]);
    expect(formatT(only('2025-01-31').start)).toBe('2024-10');
    expect(new Date(only('2025-01-31').start).toISOString()).toBe('2024-10-31T00:00:00.000Z');
    expect(new Date(only('2024-05-31').start).toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(new Date(only('2025-03-01').start).toISOString()).toBe('2024-12-01T00:00:00.000Z');
    expect(new Date(minusMonths(Date.UTC(2026, 0, 15), 3)).toISOString()).toBe('2025-10-15T00:00:00.000Z');
    // The subset the map shows decides the bounds: filtering to later records moves the start.
    const later = replayBounds(ds.incidents.filter((i) => i.year === 2025));
    expect(new Date(later.start).toISOString()).toBe('2025-03-11T00:00:00.000Z');
  });

  it('places year ticks at their true position on the track and labels the start', () => {
    const b = replayBounds(ds.incidents);
    const r = createReplay(b, b.end, () => {});
    const ticks = [...r.el.querySelectorAll<HTMLElement>('.replay-tick')];
    expect(ticks[0]?.textContent).toBe('2023-11');
    expect(ticks[0]?.style.left).toBe('0%');
    const y2025 = ticks.find((t) => t.textContent === '2025')!;
    const expected = ((Date.UTC(2025, 0, 1) - b.start) / (b.end - b.start)) * 100;
    expect(Number.parseFloat(y2025.style.left)).toBeCloseTo(expected, 1);
    // Jan 1 2024 sits about 6% in, too close to the start label, so it is not drawn.
    expect(ticks.some((t) => t.textContent === '2024')).toBe(false);
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
