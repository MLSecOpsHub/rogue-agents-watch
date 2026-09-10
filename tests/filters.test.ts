import { describe, expect, it } from 'vitest';
import { buildDataset } from '../src/data/adapter';
import { applyFilters, emptyFilters, fromQuery, isEmpty, sortIncidents, toQuery, toggleValue } from '../src/filters';
import { rawRecord, snapshot, summaryFor, taxonomy } from './fixtures';

const raw = [
  rawRecord({ id: 'r-one', name: 'Copilot leak', summary: 'Prompt injection in an assistant.', status: 'confirmed', ai_role: 'load-bearing', severity: 'high', category: 'agent-hijack-prompt-injection', model_families: ['openai-gpt'], lifecycle_phases: ['exfiltration'], targets: { sectors: ['technology'] }, date_disclosed: '2025-06-11' }),
  rawRecord({ id: 'r-two', name: 'Espionage campaign', summary: 'Agent-orchestrated intrusion set.', status: 'confirmed', ai_role: 'significant', severity: 'critical', category: 'ai-orchestrated-campaign', model_families: ['claude', 'other'], lifecycle_phases: ['recon', 'exfiltration'], targets: { sectors: ['financial-services', 'government'] }, date_disclosed: '2025-11-13' }),
  rawRecord({ id: 'r-three', name: 'Lab evaluation', summary: 'Controlled test of an autonomous agent.', status: 'test-eval', ai_role: 'load-bearing', severity: 'low', category: 'lab-escape-eval', model_families: ['other'], date_disclosed: '2024-02-02' }),
  rawRecord({ id: 'r-four', name: 'Withdrawn report', summary: 'A record that was later retracted.', status: 'reported', record_status: 'retracted', date_disclosed: '2025-01-15' }),
];
const ds = buildDataset(raw, summaryFor(raw), snapshot, taxonomy);
const ids = (list: { id: string }[]) => list.map((i) => i.id).sort();

describe('applyFilters', () => {
  it('hides retracted records by default and shows them with the toggle', () => {
    expect(ids(applyFilters(ds.incidents, emptyFilters()))).toEqual(['r-one', 'r-three', 'r-two']);
    expect(ids(applyFilters(ds.incidents, { ...emptyFilters(), includeInactive: true }))).toEqual(['r-four', 'r-one', 'r-three', 'r-two']);
  });

  it('filters scalar enum fields with OR within a field and AND across fields', () => {
    const f = toggleValue(toggleValue(emptyFilters(), 'status', 'confirmed'), 'status', 'test-eval');
    expect(ids(applyFilters(ds.incidents, f))).toEqual(['r-one', 'r-three', 'r-two']);
    const g = toggleValue(f, 'ai_role', 'significant');
    expect(ids(applyFilters(ds.incidents, g))).toEqual(['r-two']);
  });

  it('matches array fields when any value hits', () => {
    expect(ids(applyFilters(ds.incidents, toggleValue(emptyFilters(), 'model_families', 'other')))).toEqual(['r-three', 'r-two']);
    expect(ids(applyFilters(ds.incidents, toggleValue(emptyFilters(), 'lifecycle_phases', 'recon')))).toEqual(['r-two']);
    expect(ids(applyFilters(ds.incidents, toggleValue(emptyFilters(), 'sectors', 'government')))).toEqual(['r-two']);
  });

  it('filters by disclosure year', () => {
    expect(ids(applyFilters(ds.incidents, toggleValue(emptyFilters(), 'year', '2024')))).toEqual(['r-three']);
  });

  it('searches name and summary case-insensitively', () => {
    expect(ids(applyFilters(ds.incidents, { ...emptyFilters(), q: 'COPILOT' }))).toEqual(['r-one']);
    expect(ids(applyFilters(ds.incidents, { ...emptyFilters(), q: 'intrusion set' }))).toEqual(['r-two']);
    expect(ids(applyFilters(ds.incidents, { ...emptyFilters(), q: 'nothing matches this' }))).toEqual([]);
  });

  it('toggling a value twice removes it', () => {
    const f = toggleValue(toggleValue(emptyFilters(), 'severity', 'high'), 'severity', 'high');
    expect(isEmpty(f)).toBe(true);
  });
});

describe('query serialisation', () => {
  it('round-trips through the URL with stable ordering', () => {
    const f = toggleValue(toggleValue(toggleValue({ ...emptyFilters(), q: 'leak', includeInactive: true }, 'status', 'reported'), 'status', 'confirmed'), 'sectors', 'government');
    const q = toQuery(f);
    expect(q.toString()).toBe('status=confirmed%2Creported&sectors=government&q=leak&inactive=1');
    const back = fromQuery(q);
    expect([...(back.values.status ?? [])].sort()).toEqual(['confirmed', 'reported']);
    expect([...(back.values.sectors ?? [])]).toEqual(['government']);
    expect(back.q).toBe('leak');
    expect(back.includeInactive).toBe(true);
  });

  it('produces an empty query for empty filters', () => {
    expect(toQuery(emptyFilters()).toString()).toBe('');
    expect(isEmpty(fromQuery(new URLSearchParams('')))).toBe(true);
  });
});

describe('sortIncidents', () => {
  it('sorts by grade rank rather than alphabetically', () => {
    const list = ds.incidents;
    expect(sortIncidents(list, 'severity', 'asc').map((i) => i.severity)).toEqual(['critical', 'high', 'medium', 'low']);
    expect(sortIncidents(list, 'status', 'asc').map((i) => i.status)).toEqual(['confirmed', 'confirmed', 'reported', 'test-eval']);
  });

  it('sorts by date and name in both directions and does not mutate its input', () => {
    const before = ds.incidents.map((i) => i.id);
    expect(sortIncidents(ds.incidents, 'date_disclosed', 'asc').map((i) => i.id)).toEqual(['r-three', 'r-four', 'r-one', 'r-two']);
    expect(sortIncidents(ds.incidents, 'name', 'desc')[0]?.name).toBe('Withdrawn report');
    expect(ds.incidents.map((i) => i.id)).toEqual(before);
  });
});

describe('wrapLabel', () => {
  it('leaves short labels alone and splits long ones at a slash or space', async () => {
    const { wrapLabel } = await import('../src/components/charts');
    expect(wrapLabel('Confirmed')).toEqual(['Confirmed']);
    expect(wrapLabel('Infrastructure abuse / supply chain')).toEqual(['Infrastructure abuse /', 'supply chain']);
    expect(wrapLabel('Agent hijack / prompt injection')).toEqual(['Agent hijack /', 'prompt injection']);
    expect(wrapLabel('Supervised-autonomous')).toEqual(['Supervised-autonomous']);
    expect(wrapLabel('averyveryverylongsinglewordlabelwithoutspaces')).toEqual(['averyveryverylongsinglewordlabelwithoutspaces']);
  });
});
