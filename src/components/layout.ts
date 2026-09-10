import { SITE, UPSTREAM_REPO_URL, upstreamUrls } from '../config';
import type { Dataset } from '../data/types';
import type { Route } from '../router';
import { href } from '../router';
import { externalLink, h } from '../util/dom';
import { checkForNewerDataset } from './upstream-check';

const NAV: Array<{ view: Exclude<Route['view'], 'incident' | 'not-found'>; text: string }> = [
  { view: 'overview', text: 'Overview' },
  { view: 'map', text: 'Map' },
  { view: 'timeline', text: 'Timeline' },
  { view: 'table', text: 'Table' },
  { view: 'stats', text: 'Stats' },
  { view: 'about', text: 'About' },
];

export function header(route: Route): HTMLElement {
  const nav = h('nav', { class: 'nav', 'aria-label': 'Primary' });
  for (const item of NAV) {
    const current = route.view === item.view || (route.view === 'incident' && item.view === 'table');
    nav.appendChild(h('a', { href: href(item.view), class: current ? 'nav-link current' : 'nav-link', 'aria-current': current ? 'page' : null }, item.text));
  }
  return h(
    'header',
    { class: 'site-header' },
    h('a', { class: 'skip-link', href: '#main' }, 'Skip to content'),
    h(
      'div',
      { class: 'brand' },
      h('a', { href: '#/', class: 'brand-link' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '◉'), h('span', { class: 'brand-name' }, SITE.name)),
      h('span', { class: 'brand-by' }, 'by ', externalLink(SITE.publisherUrl, SITE.publisher, 'plain')),
    ),
    nav,
    themeToggle(),
  );
}

export function footer(ds: Dataset): HTMLElement {
  const { summary, snapshot } = ds;
  const cov = summary.archive_coverage;
  const status = h('span', { class: 'upstream-status', 'aria-live': 'polite' });
  return h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'trust' },
      h('span', { class: 'trust-item' }, 'Dataset ', h('strong', null, `v${summary.dataset_version}`)),
      h('span', { class: 'trust-item' }, h('strong', null, String(summary.total)), ' records'),
      h(
        'span',
        { class: 'trust-item', title: `${cov.archived} of ${cov.sources} source URLs have a Wayback Machine archive.` },
        'Archive coverage ',
        h('strong', null, `${cov.pct}%`),
        ` (${cov.archived}/${cov.sources} sources)`,
      ),
      h(
        'span',
        { class: 'trust-item' },
        'Snapshot ',
        snapshot.source_commit
          ? externalLink(`${UPSTREAM_REPO_URL}/commit/${snapshot.source_commit}`, snapshot.source_commit.slice(0, 7), 'plain mono')
          : snapshot.source_ref,
        ` fetched ${snapshot.fetched_at}`,
      ),
      h(
        'span',
        { class: 'trust-item' },
        h('button', { type: 'button', class: 'btn btn-quiet btn-small', onClick: () => checkForNewerDataset(ds, status) }, 'Check upstream for a newer dataset'),
        ' ',
        status,
      ),
    ),
    h(
      'p',
      { class: 'attribution' },
      'Data: ',
      externalLink(UPSTREAM_REPO_URL, 'Agentic Attack Index', 'plain'),
      ' (MLSecOpsHub), licensed ',
      externalLink(SITE.dataLicenseUrl, SITE.dataLicense, 'plain'),
      '. This dashboard adds no facts; corrections go ',
      externalLink(`${UPSTREAM_REPO_URL}/issues/new?template=data-correction.yml`, 'upstream', 'plain'),
      '. Dashboard code: ',
      externalLink(SITE.repoUrl, 'MIT', 'plain'),
      '. Downloads: ',
      externalLink(upstreamUrls.incidents, 'JSON', 'plain'),
      ' · ',
      externalLink(upstreamUrls.csv, 'CSV', 'plain'),
      ' · ',
      externalLink(upstreamUrls.ndjson, 'NDJSON', 'plain'),
      ' · ',
      externalLink(upstreamUrls.stix, 'STIX 2.1', 'plain'),
      '. No analytics, no cookies, no trackers.',
    ),
  );
}

// --- theme -------------------------------------------------------------------

const THEME_KEY = 'raw-theme';

export function applyStoredTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    /* storage unavailable */
  }
  if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
  else delete document.documentElement.dataset.theme;
}

/** Dark is the default: an un-stamped document renders the dark token set regardless of the OS preference. */
export function currentTheme(): 'light' | 'dark' {
  const explicit = document.documentElement.dataset.theme;
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return 'dark';
}

function themeToggle(): HTMLElement {
  const btn = h('button', { type: 'button', class: 'btn btn-quiet theme-toggle', 'aria-label': 'Toggle colour theme' });
  const refresh = () => {
    const t = currentTheme();
    btn.textContent = t === 'dark' ? '☀ Light' : '☾ Dark';
    btn.setAttribute('aria-pressed', String(t === 'dark'));
  };
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore */
    }
    refresh();
  });
  refresh();
  return btn;
}
