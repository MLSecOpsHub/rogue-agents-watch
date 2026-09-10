// Embed entry: the map view alone, with a wordmark strip and attribution, for
// iframes on other sites. Same bundle rules as the main entry: no runtime data
// request, no cookies, no trackers. Filters and replay state come from the hash.
import './styles.css';
import { applyStoredTheme } from './components/layout';
import { SITE, SITE_URL, UPSTREAM_REPO_URL } from './config';
import { loadDataset } from './data/load';
import { currentRoute, onRouteChange } from './router';
import { clear, externalLink, h } from './util/dom';
import { mapView } from './views/map';

function boot(): void {
  applyStoredTheme();
  const ds = loadDataset();
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');
  clear(app);
  const bar = h(
    'div',
    { class: 'embed-bar' },
    h('a', { href: SITE_URL, target: '_blank', rel: 'noopener noreferrer', class: 'brand-link' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }, '◉'), h('span', { class: 'brand-name' }, SITE.name)),
    h('span', { class: 'muted small' }, `dataset v${ds.summary.dataset_version}`),
    h('a', { href: `${SITE_URL}#/map`, target: '_blank', rel: 'noopener noreferrer', class: 'embed-open' }, 'Open the full site'),
  );
  const main = h('main', { id: 'main', class: 'main embed-main' });
  app.appendChild(bar);
  app.appendChild(main);
  app.appendChild(
    h('p', { class: 'embed-foot muted small' }, 'Data: ', externalLink(UPSTREAM_REPO_URL, 'Agentic Attack Index', 'plain'), ' (MLSecOpsHub), ', externalLink(SITE.dataLicenseUrl, SITE.dataLicense, 'plain'), '. No cookies, no trackers. This embed adds no facts.'),
  );
  const render = async () => {
    clear(main);
    const { query } = currentRoute();
    await mapView({ ds, route: { view: 'map', query }, root: main });
  };
  onRouteChange(() => void render());
  void render();
}

boot();
