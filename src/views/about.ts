import { SITE, UPSTREAM_REPO_URL, upstreamUrls } from '../config';
import { values } from '../data/taxonomy';
import { externalLink, h } from '../util/dom';
import type { ViewContext } from './types';

export function aboutView({ ds, root }: ViewContext): void {
  const tax = ds.taxonomy;
  const snap = ds.snapshot;

  root.appendChild(h('h1', null, 'About and methodology'));
  root.appendChild(
    h(
      'p',
      { class: 'lede' },
      `${SITE.name} is the presentation layer for the `,
      externalLink(UPSTREAM_REPO_URL, 'Agentic Attack Index', 'plain'),
      ', a curated, source-linked dataset of real-world cyberattacks executed or orchestrated by AI agents and of rogue-agent incidents. The dataset is the product; this site only renders it.',
    ),
  );

  root.appendChild(
    panel(
      'This dashboard adds no facts',
      h('p', null, 'Every name, grade, date, mapping, and coordinate on this site comes from the dataset. The dashboard never edits, enriches, annotates, or infers incident data. It does not compute any score the dataset does not contain, it shows actors exactly as the sources state them (an "Unknown" actor stays "Unknown"), and it names only the victims the dataset names.'),
      h('p', null, 'If something is wrong, the fix happens upstream: every record page has a "Report a correction" link that opens a pre-filled issue in the dataset repository. Corrections reach this site on the next data sync.'),
    ),
  );

  root.appendChild(
    panel(
      'What counts as an incident',
      h('p', null, 'The dataset records incidents in which an AI system executed or orchestrated part of a cyberattack, or in which a deployed AI agent was subverted to act against its operator or users. Controlled evaluations that show offensive capability are included but graded as test/eval so they are never mistaken for real-world attacks. Every record needs at least one resolvable source; the dataset adds no exploit detail, payloads, or prompts, and neither does this site.'),
      h('p', null, 'Categories:'),
      taxList('category'),
    ),
  );

  root.appendChild(
    panel(
      'The grading scales',
      h('p', null, 'Grades are shown on every card, row, and record page, with the upstream definitions as tooltips. They are deliberately independent axes: an incident can be confirmed yet have an incidental AI role.'),
      h('h3', null, tax['status']?.title ?? 'Status'),
      taxList('status'),
      h('h3', null, tax['confidence']?.title ?? 'Confidence'),
      taxList('confidence'),
      h('h3', null, tax['ai_role']?.title ?? 'AI role'),
      taxList('ai_role'),
      h('h3', null, tax['severity']?.title ?? 'Severity'),
      taxList('severity'),
      h('h3', null, tax['autonomy_level']?.title ?? 'Autonomy level'),
      h('p', null, 'The numeric autonomy percentage is shown only when a source states one; a missing number is displayed as "not stated", never as zero.'),
      taxList('autonomy_level'),
      h('h3', null, tax['guardrail_bypass']?.title ?? 'Guardrail bypass'),
      taxList('guardrail_bypass'),
      h('h3', null, tax['actor_type']?.title ?? 'Actor type'),
      taxList('actor_type'),
    ),
  );

  root.appendChild(
    panel(
      'Record lifecycle',
      h('p', null, 'Record ids are permanent citation keys, so records are never deleted. A record that no longer holds up is retracted or superseded and stays resolvable. Retracted and superseded records are visibly flagged and excluded from headline counts by default; every list has a toggle to include them.'),
      taxList('record_status'),
    ),
  );

  root.appendChild(
    panel(
      'The map and the illustrative-geo rule',
      h('p', null, 'A record appears on the map only if the dataset carries a geo block with coordinates for a target or an origin. Points flagged illustrative are country-level centroids, not real locations; they are drawn as soft discs of fixed size and labelled as country-level in tooltips. Stated locations are drawn as pins. Colour on the map encodes the AI role, the ring encodes the evidence status, and size encodes severity. The dashboard never geocodes a country list, an actor name, or a sector into a point, and records without geo are listed in the field log beside the map rather than placed on it.'),
      h('p', null, 'Country outlines are Natural Earth 1:110m (public domain) via the world-atlas package, vendored so the site loads no external tiles.'),
    ),
  );

  root.appendChild(
    panel(
      'Data flow and provenance',
      h('p', null, 'The dataset publishes build artifacts; this site vendors a snapshot of them, validates it against the upstream JSON Schema at build time, and bundles it. The site makes no network request for data at runtime. A scheduled job refreshes the snapshot weekly and opens a pull request when it changed; the footer button that checks for a newer dataset is the only thing that contacts upstream, and only when you click it.'),
      h(
        'dl',
        { class: 'def' },
        h('dt', null, 'Dataset version'),
        h('dd', null, `v${ds.summary.dataset_version} (${ds.summary.total} records)`),
        h('dt', null, 'Upstream ref'),
        h('dd', null, snap.source_ref, snap.source_commit ? [' @ ', externalLink(`${UPSTREAM_REPO_URL}/commit/${snap.source_commit}`, snap.source_commit.slice(0, 12), 'plain mono')] : null),
        h('dt', null, 'Snapshot fetched'),
        h('dd', null, snap.fetched_at),
        h('dt', null, 'Schema'),
        h('dd', null, externalLink(upstreamUrls.schema, 'incident.schema.json', 'plain')),
        h('dt', null, 'Archive coverage'),
        h('dd', null, `${ds.summary.archive_coverage.archived} of ${ds.summary.archive_coverage.sources} source URLs (${ds.summary.archive_coverage.pct}%) have a recorded Wayback Machine snapshot`),
        h('dt', null, 'Machine-readable'),
        h('dd', null, externalLink(upstreamUrls.incidents, 'JSON', 'plain'), ' · ', externalLink(upstreamUrls.ndjson, 'NDJSON', 'plain'), ' · ', externalLink(upstreamUrls.csv, 'CSV', 'plain'), ' · ', externalLink(upstreamUrls.stix, 'STIX 2.1 bundle', 'plain')),
      ),
    ),
  );

  root.appendChild(
    panel(
      'Corrections and contributions',
      h('ol', null, h('li', null, 'Open the record page and use "Report a correction". The issue is pre-filled with the record id; add the affected field, why it is wrong, and supporting sources. Corrections without sources can only remove claims, not change them.'), h('li', null, 'To propose a new incident, use the ', externalLink(`${UPSTREAM_REPO_URL}/issues/new?template=new-incident.yml`, 'new-incident template', 'plain'), ' upstream.'), h('li', null, 'Dashboard bugs (rendering, accessibility, broken links) belong in the ', externalLink(`${SITE.repoUrl}/issues`, 'dashboard repository', 'plain'), '.')),
    ),
  );

  root.appendChild(
    panel(
      'Licenses and privacy',
      h('p', null, 'The data is © the Agentic Attack Index contributors, licensed ', externalLink(SITE.dataLicenseUrl, 'CC BY-SA 4.0', 'plain'), '. Reuse it with attribution to "Agentic Attack Index (MLSecOpsHub)" and a link to the repository. The dashboard code is ', externalLink(SITE.repoUrl, 'MIT', 'plain'), '.'),
      h('p', null, 'This is a static site: no server, no accounts, no analytics, no cookies, no third-party fonts or scripts. The site is dark by default; if you switch to the light theme, that preference is stored locally in your browser only.'),
    ),
  );

  function taxList(key: string): HTMLElement {
    return h('dl', { class: 'def tax' }, ...values(tax, key).flatMap((v) => [h('dt', null, h('span', { class: `badge badge-compact badge-${key} badge-${key}-${v.id}` }, v.label)), h('dd', null, v.description)]));
  }
}

function panel(title: string, ...children: Array<HTMLElement | null>): HTMLElement {
  return h('section', { class: 'panel' }, h('h2', null, title), ...children);
}
