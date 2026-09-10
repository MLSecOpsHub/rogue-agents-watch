// @vitest-environment jsdom
// Structural accessibility checks with axe-core over every view, rendered with
// the real snapshot inside the site shell (header, main, footer). jsdom has no
// layout engine, so colour-contrast is excluded here; contrast is covered by
// the token design and by the Lighthouse job in CI.
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import { footer, header } from '../src/components/layout';
import { loadDataset } from '../src/data/load';
import { parseRoute } from '../src/router';
import { aboutView } from '../src/views/about';
import { incidentView } from '../src/views/incident';
import { mapView } from '../src/views/map';
import { overviewView } from '../src/views/overview';
import { statsView } from '../src/views/stats';
import { tableView } from '../src/views/table';
import { techniquesView } from '../src/views/techniques';
import { timelineView } from '../src/views/timeline';
import type { View } from '../src/views/types';
import summary from '../data/snapshot/summary.json';

const ds = loadDataset();
const ROUTES: Array<[string, View]> = [
  ['#/', overviewView],
  ['#/map', mapView],
  ['#/timeline', timelineView],
  ['#/table', tableView],
  ['#/techniques', techniquesView],
  ['#/stats', statsView],
  ['#/about', aboutView],
  [`#/incident/${summary.ids[0]}`, incidentView],
  [`#/map?open=${summary.ids[4]}`, mapView],
];

async function renderShell(hash: string, view: View): Promise<HTMLElement> {
  document.body.innerHTML = '';
  const route = parseRoute(hash);
  const app = document.createElement('div');
  app.id = 'app';
  const main = document.createElement('main');
  main.id = 'main';
  main.className = 'main';
  main.tabIndex = -1;
  app.appendChild(header(route));
  app.appendChild(main);
  app.appendChild(footer(ds));
  document.body.appendChild(app);
  await view({ ds, route, root: main });
  return app;
}

describe('accessibility (axe-core, structural rules)', () => {
  it.each(ROUTES)('%s has no axe violations', async (hash, view) => {
    const app = await renderShell(hash, view);
    const result = await axe.run(app, {
      rules: { 'color-contrast': { enabled: false } },
      resultTypes: ['violations'],
    });
    const summaryText = result.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join('\n  ')}`).join('\n');
    expect(result.violations, summaryText).toEqual([]);
  });
});
