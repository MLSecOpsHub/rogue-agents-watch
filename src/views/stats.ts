import { barChart, type BarDatum } from '../components/charts';
import { newIncidentIssueUrl, UPSTREAM_REPO_URL, upstreamUrls } from '../config';
import { fieldCoverage } from '../data/coverage';
import { countBy } from '../data/adapter';
import { values } from '../data/taxonomy';
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

  root.appendChild(h('h2', null, 'Breakdowns'));
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

  const gaps = fieldCoverage(base);
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Dataset gaps'),
      h('p', null, `How many of the ${base.length} records carry each optional field. A gap is a missing value upstream, never a claim that the value is zero. Filling one needs a source that states it.`),
      h(
        'div',
        { class: 'tbl-wrap' },
        h(
          'table',
          { class: 'data-table gaps-table' },
          h('caption', { class: 'sr-only' }, 'Field coverage across records'),
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Field'), h('th', { scope: 'col' }, 'Records with a value'), h('th', { scope: 'col' }, 'Coverage'))),
          h(
            'tbody',
            null,
            ...gaps.map((g) =>
              h('tr', { class: g.have === 0 ? 'gap-none' : g.have === g.total ? 'gap-full' : '' }, h('th', { scope: 'row' }, g.label), h('td', { class: 'num' }, `${g.have} of ${g.total}`), h('td', null, h('span', { class: 'count-bar', style: `--w: ${g.total ? ((g.have / g.total) * 100).toFixed(0) : 0}%`, 'aria-hidden': 'true' }), h('span', { class: 'sr-only' }, `${g.total ? Math.round((g.have / g.total) * 100) : 0}%`))),
            ),
          ),
        ),
      ),
      h('p', { class: 'muted small' }, 'Help close a gap: ', externalLink(`${UPSTREAM_REPO_URL}/issues/new?template=data-correction.yml`, 'propose a correction', 'plain'), ' with a source, or ', externalLink(newIncidentIssueUrl(), 'propose a new incident', 'plain'), '.'),
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

  // Map coverage: the upstream geo_coverage counts (schema 0.3.0), recomputed
  // only when inactive records are hidden. Counts of points, never positions.
  const geo = summary.geo_coverage;
  const stated = geo.points - geo.illustrative;
  const basisBars: BarDatum[] = values(ds.taxonomy, 'geo_basis').map((v) => ({ key: v.id, label: v.label, value: geo.by_basis[v.id] ?? 0, description: v.description }));
  for (const [k, v] of Object.entries(geo.by_basis)) if (!basisBars.some((b) => b.key === k)) basisBars.push({ key: k, label: k, value: v });
  const roleBars: BarDatum[] = [
    { key: 'origin', label: 'Origin', value: geo.by_role['origin'] ?? 0, description: 'Where the attack came from, by the stated basis.' },
    { key: 'target', label: 'Target', value: geo.by_role['target'] ?? 0, description: 'Where the attack was aimed, as a source states it.' },
  ];
  root.appendChild(
    h(
      'section',
      { class: 'panel panel-geo' },
      h('h2', null, 'Map coverage'),
      h(
        'p',
        null,
        `${geo.records} of ${summary.total} records carry at least one map point: ${geo.points} point${geo.points === 1 ? '' : 's'} in all, ${geo.illustrative} illustrative (country-level centroid${geo.illustrative === 1 ? '' : 's'}) and ${stated} stated location${stated === 1 ? '' : 's'}. `,
        'A point exists only where a cited source states a location and on what basis, so these counts describe sourcing, not risk. ',
        h('a', { href: href('map') }, 'Open the map'),
        '.',
      ),
      h(
        'div',
        { class: 'chart-grid' },
        barChart('Points by role', roleBars, { sort: false, note: 'Origin = where the attack came from, by the stated basis; target = where it was aimed.' }),
        barChart('Points by basis', basisBars, { sort: false, note: 'Why each point exists, as the cited source states it. A state sponsor is not an operator location.' }),
      ),
    ),
  );
}
