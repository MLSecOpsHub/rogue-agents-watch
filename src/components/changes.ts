// "What changed" strip: latest additions and revisions, derived only from the
// snapshot (added.date, revisions[]) so the same snapshot renders the same strip.
import { UPSTREAM_REPO_URL } from '../config';
import { label } from '../data/taxonomy';
import type { Dataset, Incident } from '../data/types';
import { incidentHref } from '../router';
import { externalLink, h } from '../util/dom';

export interface ChangeItem {
  id: string;
  name: string;
  date: string;
  note?: string;
}

const byDateDescThenId = (a: ChangeItem, b: ChangeItem) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.id.localeCompare(b.id));

export function latestAdditions(incidents: Incident[], n = 3): ChangeItem[] {
  return incidents
    .map((i) => ({ id: i.id, name: i.name, date: i.added?.date ?? i.date_disclosed }))
    .sort(byDateDescThenId)
    .slice(0, n);
}

export function latestRevisions(incidents: Incident[], n = 3): ChangeItem[] {
  const out: ChangeItem[] = [];
  for (const i of incidents) for (const r of i.revisions) out.push({ id: i.id, name: i.name, date: r.date, note: r.note });
  return out.sort(byDateDescThenId).slice(0, n);
}

export function whatChanged(ds: Dataset): HTMLElement {
  const adds = latestAdditions(ds.incidents);
  const revs = latestRevisions(ds.incidents);
  const inactive = ds.incidents.filter((i) => !i.isActiveRecord);
  const list = (items: ChangeItem[], empty: string) =>
    items.length
      ? h(
          'ul',
          { class: 'changes-list' },
          ...items.map((c) =>
            h('li', null, h('time', { class: 'mono', datetime: c.date }, c.date), ' ', h('a', { href: incidentHref(c.id) }, c.name), c.note ? h('span', { class: 'muted' }, ` — ${c.note}`) : null),
          ),
        )
      : h('p', { class: 'muted small' }, empty);
  return h(
    'section',
    { class: 'changes', 'aria-label': 'What changed in the dataset' },
    h('div', { class: 'changes-col' }, h('h3', null, 'Latest additions'), list(adds, 'No additions recorded.')),
    h('div', { class: 'changes-col' }, h('h3', null, 'Latest revisions'), list(revs, 'No revisions recorded yet; the record history starts with dataset 0.2.0.')),
    h(
      'div',
      { class: 'changes-col' },
      h('h3', null, 'Record status'),
      inactive.length
        ? h('ul', { class: 'changes-list' }, ...inactive.map((i) => h('li', null, h('a', { href: incidentHref(i.id) }, i.name), ' ', h('span', { class: 'muted' }, label(ds.taxonomy, 'record_status', i.record_status).toLowerCase()))))
        : h('p', { class: 'muted small' }, 'All records active. Retracted or superseded records would be listed here.'),
      h('p', { class: 'muted small' }, 'Snapshot ', ds.snapshot.source_commit ? externalLink(`${UPSTREAM_REPO_URL}/commit/${ds.snapshot.source_commit}`, ds.snapshot.source_commit.slice(0, 7), 'plain mono') : ds.snapshot.source_ref, ` fetched ${ds.snapshot.fetched_at}. `, externalLink(`${UPSTREAM_REPO_URL}/pulls`, 'Weekly sync PRs', 'plain'), '.'),
    ),
  );
}
