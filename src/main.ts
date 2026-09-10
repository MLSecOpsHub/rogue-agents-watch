import './styles.css';
import { applyStoredTheme, footer, header } from './components/layout';
import { loadDataset } from './data/load';
import { currentRoute, onRouteChange, type Route } from './router';
import { clear, h } from './util/dom';
import { aboutView } from './views/about';
import { incidentView } from './views/incident';
import { mapView } from './views/map';
import { notFoundView } from './views/not-found';
import { overviewView } from './views/overview';
import { statsView } from './views/stats';
import { tableView } from './views/table';
import { techniquesView } from './views/techniques';
import { timelineView } from './views/timeline';
import type { View } from './views/types';

const VIEWS: Record<Route['view'], View> = {
  overview: overviewView,
  map: mapView,
  timeline: timelineView,
  table: tableView,
  techniques: techniquesView,
  stats: statsView,
  about: aboutView,
  incident: incidentView,
  'not-found': notFoundView,
};

const TITLES: Record<Route['view'], string> = {
  overview: 'Overview',
  map: 'Map',
  timeline: 'Timeline',
  table: 'Table',
  techniques: 'Techniques',
  stats: 'Stats',
  about: 'About',
  incident: 'Incident',
  'not-found': 'Not found',
};

function boot(): void {
  applyStoredTheme();
  const ds = loadDataset();
  const app = document.getElementById('app');
  if (!app) throw new Error('#app missing');
  clear(app);

  const headerSlot = h('div', { class: 'header-slot' });
  const main = h('main', { id: 'main', class: 'main', tabindex: -1 });
  app.appendChild(headerSlot);
  app.appendChild(main);
  app.appendChild(footer(ds));

  let lastPath = '';
  const render = async (route: Route) => {
    clear(headerSlot);
    headerSlot.appendChild(header(route));
    clear(main);
    main.dataset.view = route.view;
    document.title = route.view === 'overview' ? 'Rogue Agent Watch' : `${TITLES[route.view]} — Rogue Agent Watch`;
    await VIEWS[route.view]({ ds, route, root: main });
    // Scroll to top on path change (not on filter-only query changes).
    const path = (window.location.hash || '#/').split('?')[0] ?? '';
    if (path !== lastPath) {
      window.scrollTo({ top: 0 });
      lastPath = path;
    }
  };

  onRouteChange((r) => void render(r));
  void render(currentRoute());
}

boot();
