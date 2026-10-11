// Actors: every distinct `actor` string in the dataset, with the records,
// techniques, models and stated origin points behind it. Attribution is shown
// exactly as the sources state it (rule 3): nothing is merged across
// spellings, "Unknown" is a group, and no origin is inferred from a name.
import { badge, incidentCard } from '../components/badges';
import { placeName } from '../components/map-canvas';
import { headlineRecords } from '../data/adapter';
import { actorGroups, findActor, tally, type ActorGroup } from '../data/actors';
import { atlasUrl, attackUrl } from '../data/links';
import { label } from '../data/taxonomy';
import type { Dataset, Incident } from '../data/types';
import { actorHref, href } from '../router';
import { externalLink, h } from '../util/dom';
import type { ViewContext } from './types';

function counts(ds: Dataset, key: 'status' | 'ai_role', incs: Incident[]): string {
  return tally(incs, (i) => [i[key]])
    .map(([v, n]) => `${n} ${label(ds.taxonomy, key, v).toLowerCase()}`)
    .join(', ');
}

function dateRange(incs: Incident[]): string {
  const d = incs.map((i) => i.date_disclosed).sort();
  return d.length <= 1 || d[0] === d.at(-1) ? (d[0] ?? '') : `${d[0]} to ${d.at(-1)}`;
}

export function actorsView({ ds, route, root }: ViewContext): void {
  const includeInactive = route.query.get('inactive') === '1';
  const records = headlineRecords(ds.incidents, includeInactive);
  const groups = actorGroups(records);
  const slug = route.view === 'actors' ? route.slug : null;
  if (slug) {
    const g = findActor(groups, slug);
    if (!g) {
      document.title = 'Actor not found — Rogue Agents Watch';
      root.appendChild(h('section', { class: 'not-found' }, h('h1', null, 'Actor not found'), h('p', null, 'No actor in the dataset has the slug ', h('code', null, slug), '.'), h('p', null, h('a', { href: href('actors') }, 'All actors'))));
      return;
    }
    renderActor(ds, g, root);
    return;
  }
  document.title = 'Actors — Rogue Agents Watch';
  root.appendChild(h('h1', null, 'Actors, as stated by sources'));
  root.appendChild(
    h(
      'p',
      { class: 'lede' },
      `${groups.length} distinct actor strings across ${records.length} records. Each is shown exactly as the cited sources state it: nothing is merged across spellings, "Unknown" stays Unknown, and no origin is inferred from a name, a language, or a target. Vendor cluster names (GTG-, APT-) are the vendors' own.`,
    ),
  );
  const rows = groups.map((g) =>
    h(
      'tr',
      null,
      h('td', null, h('a', { href: actorHref(g.slug) }, g.actor)),
      h('td', null, ...g.actorTypes.map((t) => badge(ds.taxonomy, 'actor_type', t, { compact: true, prefix: 'Actor type' }))),
      h('td', { class: 'num' }, String(g.incidents.length)),
      h('td', null, counts(ds, 'status', g.incidents)),
      h('td', null, counts(ds, 'ai_role', g.incidents)),
      h('td', null, dateRange(g.incidents)),
    ),
  );
  root.appendChild(
    h(
      'div',
      { class: 'table-scroll' },
      h(
        'table',
        { class: 'table actors-table' },
        h('thead', null, h('tr', null, ...['Actor (verbatim)', 'Type', 'Records', 'Verification status', 'AI role', 'Disclosed'].map((t) => h('th', { scope: 'col' }, t)))),
        h('tbody', null, ...rows),
      ),
    ),
  );
  root.appendChild(h('p', { class: 'muted small' }, 'Counts are counts of records, not a score. Actor type is the upstream grade for each record; a group can carry more than one when the sources differ.'));
}

function renderActor(ds: Dataset, g: ActorGroup, root: HTMLElement): void {
  const tax = ds.taxonomy;
  const incs = g.incidents;
  document.title = `${g.actor} — Rogue Agents Watch`;
  root.appendChild(h('p', { class: 'crumbs' }, h('a', { href: href('actors') }, 'Actors'), ' › ', h('span', null, g.actor)));
  root.appendChild(h('h1', null, g.actor));
  root.appendChild(h('p', { class: 'lede' }, `${incs.length} record${incs.length === 1 ? '' : 's'}, disclosed ${dateRange(incs)}. `, ...g.actorTypes.map((t) => badge(tax, 'actor_type', t, { compact: true, prefix: 'Actor type' })), ' ', h('span', { class: 'muted' }, 'Name as stated by the cited sources; see each record for who stated it.')));

  const publishers = tally(incs, (i) => i.sources.map((s) => s.publisher));
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Who states this attribution'),
      h('p', null, publishers.map(([p, n]) => `${p} (${n})`).join(' · ')),
      h('p', { class: 'muted small' }, 'Publishers cited across the records; the records themselves say which claims each source supports.'),
    ),
  );

  const atlas = tally(incs, (i) => i.mappings.mitre_atlas);
  const attack = tally(incs, (i) => i.mappings.mitre_attack);
  const techniques = h(
    'section',
    { class: 'panel' },
    h('h2', null, 'Techniques across these records'),
    atlas.length ? h('p', null, h('strong', null, 'MITRE ATLAS: '), ...atlas.flatMap(([id, n], i) => [i ? ', ' : '', externalLink(atlasUrl(id), id, 'plain'), ` (${n})`])) : h('p', { class: 'muted' }, 'No ATLAS mapping on these records yet.'),
    attack.length ? h('p', null, h('strong', null, 'MITRE ATT&CK: '), ...attack.flatMap(([id, n], i) => [i ? ', ' : '', externalLink(attackUrl(id), id, 'plain'), ` (${n})`])) : h('p', { class: 'muted' }, 'No ATT&CK mapping on these records yet.'),
    h('p', { class: 'muted small' }, 'Figures are the number of records carrying each id. A gap is a missing mapping upstream, never evidence of absence.'),
  );
  root.appendChild(techniques);

  const families = tally(incs, (i) => i.model_families);
  const models = tally(incs, (i) => i.models);
  const bypass = tally(incs, (i) => i.guardrail_bypass);
  const phases = tally(incs, (i) => i.lifecycle_phases);
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Models, guardrails, lifecycle'),
      h(
        'dl',
        { class: 'def' },
        h('dt', null, 'Model families'),
        h('dd', null, families.length ? families.map(([f, n]) => `${label(tax, 'model_families', f)} (${n})`).join(', ') : 'not stated'),
        h('dt', null, 'Models named'),
        h('dd', null, models.length ? models.map(([m, n]) => `${m} (${n})`).join(', ') : 'not named by sources'),
        h('dt', null, 'Guardrail bypass'),
        h('dd', null, bypass.length ? bypass.map(([b, n]) => `${label(tax, 'guardrail_bypass', b)} (${n})`).join(', ') : 'not stated'),
        h('dt', null, 'Lifecycle phases'),
        h('dd', null, phases.length ? phases.map(([p, n]) => `${label(tax, 'lifecycle_phases', p)} (${n})`).join(', ') : 'not stated'),
      ),
    ),
  );

  const origins = incs.flatMap((i) => (i.geo?.points ?? []).filter((p) => p.role === 'origin').map((p) => ({ inc: i, p })));
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Stated origin points'),
      origins.length
        ? h('ul', null, ...origins.map(({ inc, p }) => h('li', null, placeName(p), ' ', h('span', { class: 'muted' }, `(${p.basis ? label(tax, 'geo_basis', p.basis).toLowerCase() : 'basis not stated'}${p.attributed_by ? `, per ${p.attributed_by}` : ''}; ${p.illustrative ? 'country-level' : 'stated location'})`), ' — ', h('a', { href: `#/incident/${encodeURIComponent(inc.id)}` }, inc.name))))
        : h('p', { class: 'muted' }, 'No cited source states an origin location for these records; nothing is inferred from the actor name.'),
    ),
  );

  root.appendChild(h('h2', null, `Records (${incs.length})`));
  root.appendChild(h('div', { class: 'card-grid' }, ...incs.map((i) => incidentCard(tax, i))));
}
