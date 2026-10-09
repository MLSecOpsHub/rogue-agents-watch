import { barChart } from '../components/charts';
import { incidentCard } from '../components/badges';
import { whatChanged } from '../components/changes';
import { mapTeaser } from '../components/map-teaser';
import { newIncidentIssueUrl, SITE, SITE_URL, UPSTREAM_REPO_URL } from '../config';
import { headlineRecords } from '../data/adapter';
import { href } from '../router';
import { externalLink, h } from '../util/dom';
import { copyToClipboard, siteCaption } from '../util/share';
import { enumBars, rollups, yearBars } from './shared';
import type { ViewContext } from './types';

export function overviewView({ ds, route, root }: ViewContext): void {
  const includeInactive = route.query.get('inactive') === '1';
  const { summary, recomputed, hidden } = rollups(ds, includeInactive);
  const inactiveTotal = ds.incidents.filter((i) => !i.isActiveRecord).length;
  const headline = headlineRecords(ds.incidents, includeInactive);
  const withGeo = headline.filter((i) => i.hasGeo).length;

  // ---- hero: title + one-sentence lede, then [figure + honesty split] | [live map] ----
  root.appendChild(
    h(
      'section',
      { class: 'hero-head' },
      h('h1', null, 'Rogue Agents Watch'),
      h('p', { class: 'lede' }, 'A public, source-linked tracker of cyberattacks executed or orchestrated by AI agents, graded for evidence and for how much the AI actually did, rendered from the ', externalLink(UPSTREAM_REPO_URL, 'Agentic Attack Index', 'plain'), '.'),
    ),
  );

  const count = h('span', { class: 'hero-number' }, String(summary.total));
  const caption = h('span', { class: 'hero-caption', 'aria-live': 'polite' });
  const figure = h('div', { class: 'hero-figure' }, count, h('span', { class: 'hero-label' }, 'incidents tracked'), caption);

  const small = (n: number | string, text: string, to: string) => h('a', { href: to }, h('strong', null, String(n)), ` ${text}`);
  const smalls = h(
    'p',
    { class: 'hero-smalls' },
    small(summary.by_status['confirmed'] ?? 0, 'confirmed', href('table', { status: 'confirmed' })),
    small(summary.by_status['reported'] ?? 0, 'reported', href('table', { status: 'reported' })),
    small(summary.by_status['test-eval'] ?? 0, 'test / eval', href('table', { status: 'test-eval' })),
    small(withGeo, 'on the map', href('map')),
    small(`v${ds.summary.dataset_version}`, `dataset · ${ds.summary.archive_coverage.pct}% of sources archived`, href('about')),
  );

  const honesty = h(
    'div',
    { class: 'honesty' },
    h('h2', { class: 'sr-only' }, 'How solid is the evidence, and how central was the AI?'),
    h('p', { class: 'honesty-intro' }, 'Two independent axes: how well an incident is verified, and how load-bearing the AI actually was. A confirmed incident can still have an incidental AI role. ', h('a', { href: href('about') }, 'Grading scales')),
    h('div', { class: 'honesty-grid' }, barChart('Verification status', enumBars(ds, 'status', summary.by_status, 'status'), { sort: false }), barChart('AI role', enumBars(ds, 'ai_role', summary.by_ai_role, 'ai_role'), { sort: false })),
  );

  const shareBtn = h(
    'button',
    {
      type: 'button',
      class: 'btn btn-quiet hero-share',
      onClick: async (e: Event) => {
        const btn = e.currentTarget as HTMLButtonElement;
        const text = siteCaption(ds);
        const nav = navigator as Navigator & { share?: (data: { title: string; text: string; url: string }) => Promise<void> };
        if (typeof nav.share === 'function') {
          try {
            await nav.share({ title: SITE.name, text, url: SITE_URL });
            return;
          } catch {
            /* user cancelled or unsupported payload: fall back to copy */
          }
        }
        await copyToClipboard(`${text} ${SITE_URL}`, btn, 'Link copied');
      },
    },
    'Share',
  );
  const actions = h('div', { class: 'hero-actions' }, h('a', { class: 'btn', href: href('map') }, 'Explore the map'), h('a', { class: 'btn btn-quiet', href: href('table') }, 'Browse the records'), shareBtn, externalLink(newIncidentIssueUrl(), 'Propose an incident', 'btn btn-quiet hero-propose'));

  root.appendChild(
    h(
      'section',
      { class: 'hero-split' },
      h('div', { class: 'hero-copy' }, figure, smalls, honesty, actions),
      h('div', { class: 'hero-map' }, mapTeaser(ds, { count, caption, includeInactive })),
    ),
  );

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

  // ---- latest: most recent disclosures and what changed in the dataset ----
  const recent = headline.slice(0, 3);
  root.appendChild(
    h(
      'section',
      { class: 'recent' },
      h('h2', null, 'Latest'),
      h('div', { class: 'card-grid' }, ...recent.map((i) => incidentCard(ds.taxonomy, i))),
      whatChanged(ds),
      h('p', { class: 'more' }, h('a', { href: href('table') }, 'Browse all records →'), ' · ', h('a', { href: href('timeline') }, 'Timeline →'), ' · ', h('a', { href: `${SITE_URL}feed.atom` }, 'Atom feed')),
    ),
  );

  // ---- breakdowns ----
  root.appendChild(h('h2', null, 'Breakdowns'));
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
  root.appendChild(h('p', { class: 'more' }, h('a', { href: href('stats') }, 'All breakdowns →')));
}
