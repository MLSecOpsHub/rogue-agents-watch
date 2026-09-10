import { barChart, chartPair, statTile } from '../components/charts';
import { incidentCard } from '../components/badges';
import { UPSTREAM_REPO_URL } from '../config';
import { headlineRecords } from '../data/adapter';
import { href } from '../router';
import { externalLink, h } from '../util/dom';
import { enumBars, rollups, yearBars } from './shared';
import type { ViewContext } from './types';

export function overviewView({ ds, route, root }: ViewContext): void {
  const includeInactive = route.query.get('inactive') === '1';
  const { summary, recomputed, hidden } = rollups(ds, includeInactive);
  const inactiveTotal = ds.incidents.filter((i) => !i.isActiveRecord).length;
  const withGeo = ds.incidents.filter((i) => i.hasGeo).length;

  root.appendChild(
    h(
      'section',
      { class: 'hero' },
      h('h1', null, 'Rogue Agent Watch'),
      h(
        'p',
        { class: 'lede' },
        'A public tracker of real-world cyberattacks executed or orchestrated by AI agents, and of rogue-agent incidents. Every record is source-linked and graded in the ',
        externalLink(UPSTREAM_REPO_URL, 'Agentic Attack Index', 'plain'),
        '. This dashboard renders that dataset and adds no facts of its own.',
      ),
    ),
  );

  const tiles = h(
    'div',
    { class: 'stat-grid' },
    statTile('incidents tracked', summary.total, {
      href: href('table'),
      sub: inactiveTotal ? (includeInactive ? 'including retracted/superseded' : `${hidden} retracted/superseded excluded`) : 'all records active',
    }),
    statTile('confirmed', summary.by_status['confirmed'] ?? 0, { href: href('table', { status: 'confirmed' }), sub: 'first-party or multi-source' }),
    statTile('reported', summary.by_status['reported'] ?? 0, { href: href('table', { status: 'reported' }), sub: 'not independently confirmed' }),
    statTile('test / eval', summary.by_status['test-eval'] ?? 0, { href: href('table', { status: 'test-eval' }), sub: 'controlled setting, not an attack' }),
    statTile('on the map', withGeo, { href: href('map'), sub: `${ds.incidents.length - withGeo} records have no stated geo` }),
    statTile('dataset version', `v${ds.summary.dataset_version}`, { href: href('about'), sub: `${ds.summary.archive_coverage.pct}% sources archived` }),
  );
  root.appendChild(tiles);

  if (inactiveTotal) {
    root.appendChild(
      h(
        'p',
        { class: 'note' },
        recomputed
          ? `Counts on this page exclude ${hidden} retracted or superseded record${hidden === 1 ? '' : 's'} and are recomputed from active records; the upstream summary counts all records. `
          : 'Counts include retracted and superseded records. ',
        h('a', { href: href('overview', includeInactive ? {} : { inactive: '1' }) }, includeInactive ? 'Exclude them' : 'Include them'),
        '.',
      ),
    );
  }

  root.appendChild(
    chartPair(
      'How solid is the evidence, and how central was the AI?',
      'Two independent axes. Status says how well the incident is verified; AI role says how load-bearing the AI actually was. A confirmed incident can still have an incidental AI role, and vice versa. Hover a bar for the definition.',
      barChart('Verification status', enumBars(ds, 'status', summary.by_status, 'status'), { sort: false }),
      barChart('AI role', enumBars(ds, 'ai_role', summary.by_ai_role, 'ai_role'), { sort: false }),
    ),
  );

  root.appendChild(
    h(
      'div',
      { class: 'chart-grid' },
      barChart('By category', enumBars(ds, 'category', summary.by_category, 'category')),
      barChart('By model family', enumBars(ds, 'model_families', summary.by_model_family, 'model_families', false)),
      barChart('By autonomy level', enumBars(ds, 'autonomy_level', summary.by_autonomy_level, 'autonomy_level'), { sort: false }),
      barChart('By year disclosed', yearBars(summary.by_year), { sort: false }),
    ),
  );

  root.appendChild(h('p', { class: 'more' }, h('a', { href: href('stats') }, 'All breakdowns →'), ' · ', h('a', { href: href('timeline') }, 'Timeline →'), ' · ', h('a', { href: href('map') }, 'Map →')));

  const recent = headlineRecords(ds.incidents, includeInactive).slice(0, 6);
  root.appendChild(
    h(
      'section',
      { class: 'recent' },
      h('h2', null, 'Most recently disclosed'),
      h('div', { class: 'card-grid' }, ...recent.map((i) => incidentCard(ds.taxonomy, i))),
      h('p', { class: 'more' }, h('a', { href: href('table') }, 'Browse all records →')),
    ),
  );
}
