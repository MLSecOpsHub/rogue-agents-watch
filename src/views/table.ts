import { badge, recordStatusTag } from '../components/badges';
import { excludedInactiveNote, filterPanel, resultSummary } from '../components/filters';
import { label } from '../data/taxonomy';
import type { Incident } from '../data/types';
import { applyFilters, fromQuery, sortIncidents, toQuery, type FilterState, type SortKey } from '../filters';
import { incidentHref, replaceQuery } from '../router';
import { downloadText, toCsv } from '../util/csv';
import { clear, h } from '../util/dom';
import type { ViewContext } from './types';

const COLUMNS: Array<{ key: SortKey; title: string }> = [
  { key: 'date_disclosed', title: 'Disclosed' },
  { key: 'name', title: 'Incident' },
  { key: 'status', title: 'Status' },
  { key: 'confidence', title: 'Confidence' },
  { key: 'ai_role', title: 'AI role' },
  { key: 'severity', title: 'Severity' },
  { key: 'category', title: 'Category' },
  { key: 'actor', title: 'Actor' },
  { key: 'autonomy_level', title: 'Autonomy' },
];

export function tableView({ ds, route, root }: ViewContext): void {
  let state: FilterState = fromQuery(route.query);
  let sortKey: SortKey = (route.query.get('sort') as SortKey | null) ?? 'date_disclosed';
  let sortDir: 'asc' | 'desc' = route.query.get('dir') === 'asc' ? 'asc' : 'desc';
  if (!COLUMNS.some((c) => c.key === sortKey)) sortKey = 'date_disclosed';

  root.appendChild(h('h1', null, 'Table'));
  root.appendChild(h('p', { class: 'lede' }, 'Every record with its grades. Sort by any column, filter by any field, search names and summaries, and download exactly what you see. Downloads are built in your browser from the vendored snapshot.'));

  const layout = h('div', { class: 'with-filters' });
  const side = h('div', { class: 'filters-col' });
  const main = h('div', { class: 'results-col' });
  layout.appendChild(side);
  layout.appendChild(main);
  root.appendChild(layout);

  const sync = () => {
    const q = toQuery(state);
    if (sortKey !== 'date_disclosed') q.set('sort', sortKey);
    if (sortDir !== 'desc') q.set('dir', sortDir);
    replaceQuery(q);
  };

  const rerender = () => {
    clear(side);
    clear(main);
    side.appendChild(
      filterPanel(ds, state, (next) => {
        state = next;
        sync();
        rerender();
      }),
    );
    const list = sortIncidents(applyFilters(ds.incidents, state), sortKey, sortDir);

    const bar = h(
      'div',
      { class: 'table-bar' },
      h('p', { class: 'result-summary' }, resultSummary(ds.incidents.length, list.length, state)),
      h(
        'div',
        { class: 'downloads' },
        h('button', { type: 'button', class: 'btn', onClick: () => downloadText(fileName('csv'), toCsv(list), 'text/csv;charset=utf-8') }, `Download CSV (${list.length})`),
        h('button', { type: 'button', class: 'btn', onClick: () => downloadText(fileName('json'), JSON.stringify(list.map(stripDerived), null, 2), 'application/json') }, `Download JSON (${list.length})`),
      ),
    );
    main.appendChild(bar);
    const note = excludedInactiveNote(ds, state);
    if (note) main.appendChild(note);
    main.appendChild(h('div', { class: 'table-scroll' }, buildTable(list)));
  };

  const fileName = (ext: string) => `rogue-agents-watch-v${ds.summary.dataset_version}-filtered.${ext}`;

  const buildTable = (list: Incident[]) => {
    const thead = h(
      'thead',
      null,
      h(
        'tr',
        null,
        ...COLUMNS.map((c) => {
          const active = c.key === sortKey;
          return h(
            'th',
            { scope: 'col', 'aria-sort': active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none' },
            h(
              'button',
              {
                type: 'button',
                class: `sort-btn${active ? ' active' : ''}`,
                onClick: () => {
                  if (active) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
                  else {
                    sortKey = c.key;
                    sortDir = c.key === 'date_disclosed' ? 'desc' : 'asc';
                  }
                  sync();
                  rerender();
                },
              },
              c.title,
              h('span', { class: 'sort-ind', 'aria-hidden': 'true' }, active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ◇'),
            ),
          );
        }),
      ),
    );
    const tbody = h(
      'tbody',
      null,
      ...list.map((i) =>
        h(
          'tr',
          { class: i.isActiveRecord ? '' : 'row-inactive' },
          h('td', { class: 'mono' }, i.date_disclosed),
          h('th', { scope: 'row' }, h('a', { href: incidentHref(i.id) }, i.name), ' ', recordStatusTag(ds.taxonomy, i)),
          h('td', null, badge(ds.taxonomy, 'status', i.status, { compact: true, prefix: 'Status' })),
          h('td', null, badge(ds.taxonomy, 'confidence', i.confidence, { compact: true, prefix: 'Confidence' })),
          h('td', null, badge(ds.taxonomy, 'ai_role', i.ai_role, { compact: true, prefix: 'AI role' })),
          h('td', null, badge(ds.taxonomy, 'severity', i.severity, { compact: true, prefix: 'Severity' })),
          h('td', null, label(ds.taxonomy, 'category', i.category)),
          h('td', null, i.actor),
          h('td', null, label(ds.taxonomy, 'autonomy_level', i.autonomy_level)),
        ),
      ),
    );
    if (list.length === 0) tbody.appendChild(h('tr', null, h('td', { colspan: String(COLUMNS.length), class: 'empty' }, 'No records match the current filters.')));
    return h('table', { class: 'data-table' }, h('caption', { class: 'sr-only' }, 'Incident records'), thead, tbody);
  };

  rerender();
}

/** JSON download: the normalised record minus dashboard-only derived fields. */
function stripDerived(i: Incident): Omit<Incident, 'year' | 'hasGeo' | 'isActiveRecord'> {
  const { year: _y, hasGeo: _g, isActiveRecord: _a, ...rest } = i;
  return rest;
}
