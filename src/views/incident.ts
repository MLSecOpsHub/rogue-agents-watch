import { badge, gradeStrip, incidentCard, recordStatusBanner } from '../components/badges';
import { correctionIssueUrl, shareUrl, UPSTREAM_REPO_URL, upstreamUrls } from '../config';
import { aiidUrl, atlasUrl, attackUrl, countryFlagLabel, cveUrl, owaspAsiUrl, owaspLlmUrl } from '../data/links';
import { datasetStatesAutonomyPct, evidenceSummary } from '../data/coverage';
import { describe, label, values } from '../data/taxonomy';
import type { Dataset, Incident } from '../data/types';
import { href, incidentHref } from '../router';
import { externalLink, h } from '../util/dom';
import { fmtDate, fmtInt, fmtPct } from '../util/format';
import { copyToClipboard, shareCaption } from '../util/share';
import { relatedIncidents } from './shared';
import type { ViewContext } from './types';

export function incidentView({ ds, route, root }: ViewContext): void {
  if (route.view !== 'incident') return;
  const inc = ds.byId.get(route.id);
  if (!inc) {
    document.title = `Record not found — Rogue Agent Watch`;
    root.appendChild(
      h(
        'section',
        { class: 'not-found' },
        h('h1', null, 'Record not found'),
        h('p', null, 'No record with id ', h('code', null, route.id), ` exists in dataset v${ds.summary.dataset_version}. Ids are permanent upstream, so this is either a typo or a record newer than this snapshot.`),
        h('p', null, h('a', { href: href('table') }, 'Browse all records'), ' · ', externalLink(`${UPSTREAM_REPO_URL}/tree/main/data/incidents`, 'Check upstream', 'plain')),
      ),
    );
    return;
  }
  document.title = `${inc.name} — Rogue Agent Watch`;
  const tax = ds.taxonomy;

  const banner = recordStatusBanner(tax, inc, inc.superseded_by ? ds.byId.get(inc.superseded_by)?.name : undefined);
  if (banner) root.appendChild(banner);

  root.appendChild(
    h(
      'header',
      { class: 'incident-head' },
      h('p', { class: 'crumbs' }, h('a', { href: href('table') }, 'Records'), ' / ', h('code', { class: 'id' }, inc.id)),
      h('h1', null, inc.name),
      gradeStrip(tax, inc),
      h(
        'p',
        { class: 'incident-meta' },
        h('span', null, 'Disclosed ', h('time', { datetime: inc.date_disclosed }, inc.date_disclosed)),
        ' · ',
        badge(tax, 'category', inc.category, { compact: true, prefix: 'Category' }),
        ' · ',
        h('span', null, 'Actor: ', h('strong', null, inc.actor), ' (', badge(tax, 'actor_type', inc.actor_type, { compact: true, prefix: 'Actor type' }), ')'),
      ),
    ),
  );

  const grid = h('div', { class: 'incident-grid' });
  const mainCol = h('div', { class: 'incident-main' });
  const sideCol = h('aside', { class: 'incident-side' });
  grid.appendChild(mainCol);
  grid.appendChild(sideCol);
  root.appendChild(grid);

  mainCol.appendChild(section('Summary', h('p', null, inc.summary)));
  mainCol.appendChild(section('Impact', h('p', null, inc.impact ?? h('span', { class: 'muted' }, 'Not stated by sources.'))));

  mainCol.appendChild(
    section(
      'Grading',
      h('p', { class: 'muted small' }, 'Definitions are the upstream taxonomy text, verbatim.'),
      defList([
        ['Status', gradeWithDef(ds, 'status', inc.status)],
        ['Confidence', gradeWithDef(ds, 'confidence', inc.confidence)],
        ['AI role', gradeWithDef(ds, 'ai_role', inc.ai_role)],
        ['Severity', gradeWithDef(ds, 'severity', inc.severity)],
      ]),
    ),
  );

  mainCol.appendChild(
    section(
      'AI involvement',
      defList([
        ['Models (as named by sources)', inc.models.length ? h('ul', { class: 'inline-list' }, ...inc.models.map((m) => h('li', null, h('code', null, m)))) : muted('No model named by sources.')],
        ['Model families', inc.model_families.length ? h('div', { class: 'badges' }, ...inc.model_families.map((f) => badge(tax, 'model_families', f, { compact: true, prefix: 'Model family' }))) : muted('None recorded.')],
        ['Autonomy level', gradeWithDef(ds, 'autonomy_level', inc.autonomy_level)],
        // Shown only when at least one record in the dataset states a percentage; a row that is null everywhere says nothing.
        ...(datasetStatesAutonomyPct(ds.incidents) || inc.autonomy_pct !== null ? [['Autonomy (source-stated %)', h('span', null, fmtPct(inc.autonomy_pct))] as [string, HTMLElement]] : []),
        ['Guardrail bypass', inc.guardrail_bypass.length ? h('div', { class: 'badges' }, ...inc.guardrail_bypass.map((g) => badge(tax, 'guardrail_bypass', g, { compact: true, prefix: 'Guardrail bypass' }))) : muted('Not recorded.')],
      ]),
    ),
  );

  mainCol.appendChild(section('Lifecycle phases observed', lifecycleStrip(ds, inc), h('p', { class: 'muted small' }, 'Descriptive, lifecycle-level only. The dataset and this dashboard never carry operational detail.')));

  mainCol.appendChild(
    section(
      'Targets',
      defList([
        ['Organisations affected', h('span', null, fmtInt(inc.targets.orgs_affected))],
        ['Records exfiltrated', h('span', null, fmtInt(inc.targets.records_exfiltrated))],
        ['Sectors', inc.targets.sectors.length ? h('div', { class: 'badges' }, ...inc.targets.sectors.map((s) => h('a', { class: 'badge badge-compact badge-sector', href: href('table', { sectors: s }), title: describe(tax, 'sectors', s) || undefined }, label(tax, 'sectors', s)))) : muted('Not stated.')],
        ['Countries (ISO 3166-1)', inc.targets.countries.length ? h('span', null, inc.targets.countries.map((c) => `${countryFlagLabel(c)} (${c})`).join(', ')) : muted('Not stated.')],
      ]),
      h('p', { class: 'muted small' }, '"Not stated" means the sources gave no figure. It never means zero.'),
    ),
  );

  mainCol.appendChild(
    section(
      'Framework mappings',
      defList([
        ['MITRE ATLAS', linkList(inc.mappings.mitre_atlas, atlasUrl)],
        ['MITRE ATT&CK', linkList(inc.mappings.mitre_attack, attackUrl)],
        ['OWASP Top 10 for LLM Apps', linkList(inc.mappings.owasp_llm, owaspLlmUrl)],
        ['OWASP Agentic Security Initiative', linkList(inc.mappings.owasp_asi, owaspAsiUrl)],
        ['CVE', linkList(inc.mappings.cve, cveUrl)],
        ['AI Incident Database', linkList(inc.mappings.aiid.map(String), (n) => aiidUrl(Number(n)))],
      ]),
      h('p', { class: 'muted small' }, 'Ids exactly as published upstream; an empty row means no mapping has been recorded, which is common and honest.'),
    ),
  );

  mainCol.appendChild(
    section(
      'Mitigations (as described by sources)',
      inc.mitigations.length ? h('ul', null, ...inc.mitigations.map((m) => h('li', null, m))) : muted('None recorded.'),
    ),
  );

  mainCol.appendChild(
    section(
      `Sources (${inc.sources.length})`,
      h(
        'ol',
        { class: 'sources' },
        ...inc.sources.map((s) =>
          h(
            'li',
            null,
            externalLink(s.url, s.title),
            h('div', { class: 'source-meta' }, h('span', null, s.publisher), ' · ', badge(tax, 'source_type', s.type, { compact: true, prefix: 'Source type' }), s.date ? [' · ', h('time', { datetime: s.date }, s.date)] : null, s.archive_url ? [' · ', externalLink(s.archive_url, 'archived copy', 'plain')] : [' · ', h('span', { class: 'muted' }, 'no archive recorded')]),
          ),
        ),
      ),
    ),
  );

  const related = relatedIncidents(ds, inc);
  if (related.length) mainCol.appendChild(section('Related records', h('div', { class: 'card-grid' }, ...related.map((r) => incidentCard(tax, r)))));

  if (inc.revisions.length) {
    mainCol.appendChild(section('Revision history', h('ul', { class: 'revisions' }, ...inc.revisions.map((r) => h('li', null, h('time', { datetime: r.date, class: 'mono' }, r.date), ' — ', r.note)))));
  }

  // Sidebar: record metadata, citation, correction.
  sideCol.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Record'),
      defList([
        ['Id', h('code', { class: 'id' }, inc.id)],
        ['Record status', gradeWithDef(ds, 'record_status', inc.record_status)],
        ['Added', h('span', null, inc.added ? `${inc.added.date} by ${inc.added.by}` : 'not stated')],
        ['Last updated', h('span', null, fmtDate(inc.last_updated))],
        ['Dataset', h('span', null, `v${ds.summary.dataset_version}`)],
      ]),
      h('p', null, externalLink(upstreamUrls.incident(inc.id), 'Upstream JSON permalink', 'plain'), ' · ', externalLink(upstreamUrls.incidentSource(inc.id), 'Source YAML', 'plain')),
    ),
  );

  const ev = evidenceSummary(inc);
  const mapCount = inc.mappings.mitre_atlas.length + inc.mappings.mitre_attack.length + inc.mappings.owasp_asi.length + inc.mappings.owasp_llm.length + inc.mappings.cve.length + inc.mappings.aiid.length;
  sideCol.appendChild(
    h(
      'section',
      { class: 'panel panel-evidence' },
      h('h2', null, 'Evidence'),
      defList([
        ['Sources', h('span', null, String(ev.sources))],
        ['First-party, vendor, or government', h('span', null, `${ev.firstParty} of ${ev.sources}`)],
        ['Archived copies', h('span', null, `${ev.archived} of ${ev.sources}`)],
        ['Source dates', h('span', null, ev.earliest ? (ev.earliest === ev.latest ? ev.earliest : `${ev.earliest} to ${ev.latest}`) : 'not stated')],
        ['Framework ids', h('span', null, mapCount ? `${mapCount} (ATLAS ${inc.mappings.mitre_atlas.length}, ATT&CK ${inc.mappings.mitre_attack.length}, ASI ${inc.mappings.owasp_asi.length}, LLM ${inc.mappings.owasp_llm.length}, CVE ${inc.mappings.cve.length}, AIID ${inc.mappings.aiid.length})` : 'none recorded')],
        ['Location', h('span', null, inc.geo ? `${inc.geo.points.length} point${inc.geo.points.length === 1 ? '' : 's'}, ${inc.geo.points.every((p) => p.illustrative) ? 'country-level only' : 'stated'}` : 'none')],
        ['Figures stated', h('span', null, [inc.targets.orgs_affected !== null && 'organisations affected', inc.targets.records_exfiltrated !== null && 'records exfiltrated', inc.autonomy_pct !== null && 'autonomy %'].filter(Boolean).join(', ') || 'none')],
      ]),
      h('p', { class: 'muted small' }, 'Counts of what the record carries, not a score. Gaps are filled upstream with sources.'),
    ),
  );

  const citation = `Agentic Attack Index (MLSecOpsHub), dataset v${ds.summary.dataset_version}, record "${inc.id}". ${upstreamUrls.incident(inc.id)} — CC BY-SA 4.0.`;
  const citeBox = h('pre', { class: 'cite' }, citation);
  sideCol.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Cite this record'),
      citeBox,
      h(
        'p',
        null,
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-small',
            onClick: async (e: Event) => {
              const b = e.currentTarget as HTMLButtonElement;
              try {
                await navigator.clipboard.writeText(citation);
                b.textContent = 'Copied';
              } catch {
                b.textContent = 'Select the text to copy';
              }
            },
          },
          'Copy citation',
        ),
        ' ',
        h('a', { class: 'btn btn-small btn-quiet', href: incidentHref(inc.id) }, 'Permalink'),
      ),
    ),
  );

  sideCol.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Share'),
      h('p', { class: 'muted small' }, 'The share link is a prerendered page that unfurls with a card showing the grades, then opens this record. No tracking parameters.'),
      h('pre', { class: 'cite' }, shareUrl(inc.id)),
      h(
        'p',
        null,
        h('button', { type: 'button', class: 'btn btn-small', onClick: (e: Event) => void copyToClipboard(shareUrl(inc.id), e.currentTarget as HTMLButtonElement, 'Link copied') }, 'Copy share link'),
        ' ',
        h('button', { type: 'button', class: 'btn btn-small btn-quiet', onClick: (e: Event) => void copyToClipboard(shareCaption(tax, inc), e.currentTarget as HTMLButtonElement, 'Caption copied') }, 'Copy caption'),
        ' ',
        h('a', { class: 'btn btn-small btn-quiet', href: href('map', { open: inc.id }) }, 'Show on map'),
      ),
    ),
  );

  sideCol.appendChild(
    h(
      'section',
      { class: 'panel panel-correct' },
      h('h2', null, 'Something wrong?'),
      h('p', null, 'This dashboard never edits incident facts. Corrections are made upstream, with sources, and flow here on the next sync.'),
      h('p', null, externalLink(correctionIssueUrl(inc.id), 'Report a correction for this record', 'btn')),
    ),
  );
}

// --- helpers -----------------------------------------------------------------

function section(title: string, ...children: Array<HTMLElement | null>): HTMLElement {
  return h('section', { class: 'panel' }, h('h2', null, title), ...children);
}

function defList(rows: Array<[string, HTMLElement]>): HTMLElement {
  return h('dl', { class: 'def' }, ...rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}

function muted(text: string): HTMLElement {
  return h('span', { class: 'muted' }, text);
}

function gradeWithDef(ds: Dataset, key: string, value: string): HTMLElement {
  return h('span', { class: 'grade-def' }, badge(ds.taxonomy, key, value, { compact: true, prefix: ds.taxonomy[key]?.title ?? key }), ' ', h('span', { class: 'muted small' }, describe(ds.taxonomy, key, value)));
}

function linkList(ids: string[], toUrl: (id: string) => string): HTMLElement {
  if (!ids.length) return muted('None recorded.');
  return h('ul', { class: 'inline-list' }, ...ids.map((id) => h('li', null, externalLink(toUrl(id), id, 'mono ext'))));
}

function lifecycleStrip(ds: Dataset, inc: Incident): HTMLElement {
  const all = values(ds.taxonomy, 'lifecycle_phases');
  const have = new Set<string>(inc.lifecycle_phases);
  return h(
    'ol',
    { class: 'lifecycle', 'aria-label': 'Attack lifecycle phases' },
    ...all.map((p) => h('li', { class: have.has(p.id) ? 'phase on' : 'phase', title: p.description, 'aria-current': have.has(p.id) ? 'step' : null }, p.label)),
  );
}
