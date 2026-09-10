// Landing-page teaser: the map stage with the replay, bound to a hero figure
// and caption that live outside the stage (so the page has exactly one hero
// number). Any click opens the full map view with that record's drawer.
import { headlineRecords } from '../data/adapter';
import type { Dataset } from '../data/types';
import { href, navigate } from '../router';
import { h } from '../util/dom';
import { attachTooltip, createMapCanvas } from './map-canvas';
import { createReplay, dateMs, formatT, replayBounds } from './replay';

export interface TeaserBindings {
  /** Receives the replay count (equals the headline count at rest). */
  count: HTMLElement;
  /** Receives "disclosed by …" and the latest record's name. */
  caption: HTMLElement;
  includeInactive?: boolean;
}

export function mapTeaser(ds: Dataset, bind: TeaserBindings): HTMLElement {
  const incidents = headlineRecords(ds.incidents, bind.includeInactive ?? false);
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = h('div', { class: 'map-stage map-teaser' });
  const canvas = createMapCanvas(ds, {
    incidents,
    ariaLabel: 'World map of incidents with stated coordinates; opens the full map',
    onSelect: (inc) => navigate(href('map', { open: inc.id })),
    onHover: attachTooltip(ds, stage),
  });
  stage.insertBefore(canvas.svg, stage.firstChild);
  void canvas.loadGeometry();

  const bounds = replayBounds(incidents);
  let t = bounds.end;
  let lastShown: Set<string> | null = null;
  const render = () => {
    const shown = new Set(incidents.filter((i) => dateMs(i.date_disclosed) <= t).map((i) => i.id));
    let latest = null as (typeof incidents)[number] | null;
    for (const inc of incidents) if (shown.has(inc.id) && (!latest || inc.date_disclosed > latest.date_disclosed)) latest = inc;
    const pulse = lastShown === null ? new Set(latest ? [latest.id] : []) : new Set([...shown].filter((id) => !lastShown!.has(id)));
    canvas.paint(shown, { pulse, reduced });
    bind.count.textContent = String(shown.size);
    bind.caption.replaceChildren(document.createTextNode(t >= bounds.end ? 'disclosed to date' : `disclosed by ${formatT(t)}`), ...(latest ? [h('br'), h('span', { class: 'hero-latest' }, 'Latest: ', h('a', { href: href('map', { open: latest.id }) }, latest.name))] : []));
    lastShown = shown;
  };
  const replay = createReplay(bounds, t, (next) => {
    t = next;
    render();
  }, reduced);
  stage.appendChild(replay.el);
  stage.appendChild(h('a', { class: 'teaser-open', href: href('map') }, 'Open the map →'));
  render();
  return stage;
}
