import { barChart } from '../components/charts';
import { UPSTREAM_REPO_URL, upstreamUrls } from '../config';
import { countBy } from '../data/adapter';
import { href } from '../router';
import { externalLink, h } from '../util/dom';
import { enumBars, rollups, yearBars } from './shared';
import type { ViewContext } from './types';

export function statsView({ ds, route, root }: ViewContext): void {
  const includeInactive = route.query.get('inactive') === '1';
  const { summary, recomputed, hidden } = rollups(ds, includeInactive);
  const base = includeInactive ? ds.incidents : ds.incidents.filter((i) => i.isActiveRecord);

  root.appendChild(h('h1', null, 'Stats'));
  root.appendChild(
    h(
      'p',
      { class: 'lede' },
      `Rollups for dataset v${ds.summary.dataset_version}. `,
      recomputed
        ? `Excluding ${hidden} retracted or superseded record${hidden === 1 ? '' : 's'} (recomputed client-side; `
        : 'Taken directly from the upstream ',
      externalLink(upstreamUrls.summary, 'summary.json', 'plain'),
      recomputed ? '). ' : '. ',
      'Every bar links to the filtered table. Empty enum values are shown so absences are visible.',
    ),
  );
  if (ds.incidents.some((i) => !i.isActiveRecord)) {
    root.appendChild(
      h('p', { class: 'note' }, h('a', { href: href('stats', includeInactive ? {} : { inactive: '1' }) }, includeInactive ? 'Exclude retracted / superseded records' : 'Include retracted / superseded records')),
    );
  }

  root.appendChild(
    h(
      'div',
      { class: 'chart-grid' },
      barChart('Verification status', enumBars(ds, 'status', summary.by_status, 'status'), { sort: false }),
      barChart('AI role', enumBars(ds, 'ai_role', summary.by_ai_role, 'ai_role'), { sort: false }),
      barChart('Sourcing confidence', enumBars(ds, 'confidence', countBy(base, (i) => i.confidence), 'confidence'), { sort: false, note: 'Computed from records; not in upstream summary.' }),
      barChart('Severity', enumBars(ds, 'severity', summary.by_severity, 'severity'), { sort: false }),
      barChart('Category', enumBars(ds, 'category', summary.by_category, 'category')),
      barChart('Actor type', enumBars(ds, 'actor_type', summary.by_actor_type, 'actor_type')),
      barChart('Model family', enumBars(ds, 'model_families', summary.by_model_family, 'model_families'), { note: 'A record may involve several families.' }),
      barChart('Autonomy level', enumBars(ds, 'autonomy_level', summary.by_autonomy_level, 'autonomy_level'), { sort: false }),
      barChart('Guardrail bypass', enumBars(ds, 'guardrail_bypass', countBy(base, (i) => i.guardrail_bypass), 'guardrail_bypass'), { note: 'Computed from records; a record may list several.' }),
      barChart('Lifecycle phases observed', enumBars(ds, 'lifecycle_phases', countBy(base, (i) => i.lifecycle_phases), 'lifecycle_phases'), { sort: false, note: 'Computed from records; descriptive only.' }),
      barChart('Target sectors', enumBars(ds, 'sectors', countBy(base.flatMap((i) => i.targets.sectors.length ? [i] : []), (i) => i.targets.sectors), 'sectors', false), {
        note: `Computed from records. ${base.filter((i) => i.targets.sectors.length === 0).length} records state no sector.`,
      }),
      barChart('Year disclosed', yearBars(summary.by_year), { sort: false }),
    ),
  );

  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Archive coverage'),
      h(
        'p',
        null,
        `${ds.summary.archive_coverage.archived} of ${ds.summary.archive_coverage.sources} source URLs (${ds.summary.archive_coverage.pct}%) have a Wayback Machine snapshot recorded upstream, so the evidence survives link rot. Help raise it via `,
        externalLink(UPSTREAM_REPO_URL, 'agentic-attack-index', 'plain'),
        '.',
      ),
    ),
  );
}
