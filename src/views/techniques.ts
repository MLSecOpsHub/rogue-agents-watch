// Techniques, models, and guardrails: the TTP lens (MITRE ATLAS / ATT&CK, OWASP,
// CVE) with the records behind each id, Navigator layer downloads, and the
// model family × guardrail bypass × AI role crosstabs. Every number is a
// count over the records; nothing is scored.
import { SITE_URL, newIncidentIssueUrl, UPSTREAM_REPO_URL } from '../config';
import { matrix, type MatrixAxis } from '../components/matrix';
import { fieldCoverage } from '../data/coverage';
import { aiidUrl, atlasUrl, attackUrl, cveUrl, owaspAsiUrl, owaspLlmUrl } from '../data/links';
import { label, values } from '../data/taxonomy';
import type { Incident } from '../data/types';
import { headlineRecords } from '../data/adapter';
import { href, incidentHref } from '../router';
import { externalLink, h } from '../util/dom';
import type { ViewContext } from './types';

type MappingKey = 'mitre_atlas' | 'mitre_attack' | 'owasp_asi' | 'owasp_llm' | 'cve';

const MAPPINGS: Array<{ key: MappingKey; title: string; url: (id: string) => string; blurb: string }> = [
  { key: 'mitre_atlas', title: 'MITRE ATLAS techniques', url: atlasUrl, blurb: 'Adversarial techniques against AI-enabled systems, as mapped upstream.' },
  { key: 'mitre_attack', title: 'MITRE ATT&CK techniques', url: attackUrl, blurb: 'Enterprise ATT&CK techniques, as mapped upstream.' },
  { key: 'owasp_asi', title: 'OWASP Top 10 for Agentic Applications', url: owaspAsiUrl, blurb: 'ASI01–ASI10, the 2026 agentic risk vocabulary.' },
  { key: 'owasp_llm', title: 'OWASP Top 10 for LLM Applications', url: owaspLlmUrl, blurb: 'LLM01–LLM10.' },
  { key: 'cve', title: 'CVEs', url: cveUrl, blurb: 'Vulnerabilities named by the sources, linked to NVD.' },
];

export function techniquesView({ ds, route, root }: ViewContext): void {
  const includeInactive = route.query.get('inactive') === '1';
  const records = headlineRecords(ds.incidents, includeInactive);
  const tax = ds.taxonomy;
  const cov = Object.fromEntries(fieldCoverage(records).map((r) => [r.key, r]));

  root.appendChild(h('h1', null, 'Techniques, models, and guardrails'));
  root.appendChild(
    h(
      'p',
      { class: 'lede' },
      'The technique lens: which adversarial techniques recur, which models were involved, and how guardrails were bypassed. Every figure is a count over the records in the dataset; a record may carry several ids. Mapping coverage is stated next to each table because an absent mapping is a gap upstream, not evidence of absence.',
    ),
  );

  // ---- Navigator layers ------------------------------------------------------
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'Navigator layers'),
      h('p', null, 'Static layer files built from this snapshot, with the record count as each technique\'s score and the record ids in its comment. Open the Navigator, choose "Open existing layer", and paste the URL or upload the file.'),
      h(
        'ul',
        { class: 'inline-list' },
        h('li', null, h('a', { class: 'btn btn-small', href: `${SITE_URL}navigator/attack-layer.json`, download: 'rogue-agents-watch-attack-layer.json' }, 'ATT&CK layer (JSON)'), ' ', externalLink('https://mitre-attack.github.io/attack-navigator/', 'ATT&CK Navigator', 'plain')),
        h('li', null, h('a', { class: 'btn btn-small', href: `${SITE_URL}navigator/atlas-layer.json`, download: 'rogue-agents-watch-atlas-layer.json' }, 'ATLAS layer (JSON)'), ' ', externalLink('https://mitre-atlas.github.io/atlas-navigator/', 'ATLAS Navigator', 'plain')),
      ),
      h('p', { class: 'muted small' }, 'Also available: the upstream ', externalLink(`${UPSTREAM_REPO_URL}/blob/main/dist/stix/bundle.json`, 'STIX 2.1 bundle', 'plain'), ' for OpenCTI, and a ', h('a', { href: `${SITE_URL}misp/manifest.json` }, 'MISP feed'), ' (point MISP at ', h('code', null, `${SITE_URL}misp/`), ').'),
    ),
  );

  // ---- mapping tables --------------------------------------------------------
  for (const m of MAPPINGS) {
    const byId = new Map<string, Incident[]>();
    for (const inc of records) for (const id of inc.mappings[m.key]) byId.set(id, [...(byId.get(id) ?? []), inc]);
    const ids = [...byId.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const c = cov[m.key];
    const section = h('section', { class: 'panel' }, h('h2', null, m.title), h('p', { class: 'muted small' }, `${m.blurb} Mapped in ${c?.have ?? 0} of ${c?.total ?? records.length} records.`));
    if (ids.length === 0) {
      section.appendChild(h('p', { class: 'note' }, 'No record carries this mapping yet. Mappings are added upstream with sources; ', externalLink(`${UPSTREAM_REPO_URL}/issues/new?template=data-correction.yml`, 'propose one', 'plain'), '.'));
    } else {
      const max = ids[0]?.[1].length ?? 1;
      section.appendChild(
        h(
          'div',
          { class: 'tbl-wrap' },
          h(
            'table',
            { class: 'data-table technique-table' },
            h('caption', { class: 'sr-only' }, m.title),
            h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Id'), h('th', { scope: 'col' }, 'Records'), h('th', { scope: 'col' }, 'Incidents'))),
            h(
              'tbody',
              null,
              ...ids.map(([id, incs]) =>
                h(
                  'tr',
                  null,
                  h('th', { scope: 'row' }, externalLink(m.url(id), id, 'mono ext')),
                  h('td', { class: 'num' }, h('span', { class: 'count-bar', style: `--w: ${((incs.length / max) * 100).toFixed(0)}%`, 'aria-hidden': 'true' }), String(incs.length)),
                  h('td', null, h('ul', { class: 'chips-inline' }, ...incs.map((i) => h('li', null, h('a', { class: 'chip chip-link', href: incidentHref(i.id) }, i.name))))),
                ),
              ),
            ),
          ),
        ),
      );
    }
    root.appendChild(section);
  }

  // ---- AI Incident Database cross-links -------------------------------------
  const aiid = records.flatMap((i) => i.mappings.aiid.map((n) => ({ n, i })));
  root.appendChild(
    h(
      'section',
      { class: 'panel' },
      h('h2', null, 'AI Incident Database cross-links'),
      aiid.length
        ? h('ul', { class: 'inline-list' }, ...aiid.map(({ n, i }) => h('li', null, externalLink(aiidUrl(n), `AIID ${n}`, 'mono ext'), ' ', h('a', { href: incidentHref(i.id) }, i.name))))
        : h('p', { class: 'muted small' }, `No record is cross-linked to the AI Incident Database yet (0 of ${records.length}). Cross-links are added upstream.`),
    ),
  );

  // ---- crosstabs ------------------------------------------------------------
  const axis = (key: string, present: (id: string) => boolean): MatrixAxis[] => values(tax, key).filter((v) => present(v.id)).map((v) => ({ id: v.id, label: v.label, description: v.description }));
  const families = axis('model_families', (id) => records.some((i) => i.model_families.includes(id as never)));
  const bypass = axis('guardrail_bypass', () => true);
  const roles = axis('ai_role', () => true);
  const phases = axis('lifecycle_phases', () => true);
  const categories = axis('category', () => true);
  const tableLink = (params: Record<string, string>) => href('table', params);

  root.appendChild(h('h2', null, 'Models and guardrails'));
  root.appendChild(
    matrix({
      caption: 'Model family by guardrail bypass: records where sources name a model of that family and describe that bypass',
      rowHeader: 'Model family',
      rows: families,
      cols: bypass,
      count: (r, c) => records.filter((i) => i.model_families.includes(r.id as never) && i.guardrail_bypass.includes(c.id as never)).length,
      link: (r, c) => tableLink({ model_families: r.id, guardrail_bypass: c.id }),
      rowLink: (r) => tableLink({ model_families: r.id }),
      note: 'A record may name several families and several bypasses; cells count records, so rows and columns do not sum to the record total. "Legitimate tool abuse" means the agent was used as designed, against its terms.',
    }),
  );
  root.appendChild(
    matrix({
      caption: 'Model family by AI role: how load-bearing the AI was in records naming that family',
      rowHeader: 'Model family',
      rows: families,
      cols: roles,
      count: (r, c) => records.filter((i) => i.model_families.includes(r.id as never) && i.ai_role === c.id).length,
      link: (r, c) => tableLink({ model_families: r.id, ai_role: c.id }),
      rowLink: (r) => tableLink({ model_families: r.id }),
    }),
  );

  // sourcing per family: is the vendor on the record?
  root.appendChild(
    h(
      'div',
      { class: 'tbl-wrap' },
      h(
        'table',
        { class: 'data-table' },
        h('caption', null, 'Sourcing per model family: records with a first-party, vendor, or government source, and records where every source is archived'),
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Model family'), h('th', { scope: 'col' }, 'Records'), h('th', { scope: 'col' }, 'First-party / vendor / government source'), h('th', { scope: 'col' }, 'Every source archived'))),
        h(
          'tbody',
          null,
          ...families.map((f) => {
            const rs = records.filter((i) => i.model_families.includes(f.id as never));
            const fp = rs.filter((i) => i.sources.some((s) => s.type === 'first-party-disclosure' || s.type === 'vendor-report' || s.type === 'government-advisory')).length;
            const ar = rs.filter((i) => i.sources.length > 0 && i.sources.every((s) => Boolean(s.archive_url))).length;
            return h('tr', null, h('th', { scope: 'row' }, h('a', { href: tableLink({ model_families: f.id }) }, f.label)), h('td', { class: 'num' }, String(rs.length)), h('td', { class: 'num' }, `${fp} of ${rs.length}`), h('td', { class: 'num' }, `${ar} of ${rs.length}`));
          }),
        ),
      ),
      h('p', { class: 'chart-note' }, 'Source types are as recorded upstream. A first-party source is the affected organisation or the model vendor describing the incident themselves.'),
    ),
  );

  root.appendChild(h('h2', null, 'Lifecycle phases by category'));
  root.appendChild(
    matrix({
      caption: 'Lifecycle phases observed, by incident category',
      rowHeader: 'Phase',
      rows: phases,
      cols: categories,
      count: (r, c) => records.filter((i) => i.lifecycle_phases.includes(r.id as never) && i.category === c.id).length,
      link: (r, c) => tableLink({ lifecycle_phases: r.id, category: c.id }),
      rowLink: (r) => tableLink({ lifecycle_phases: r.id }),
      note: 'Descriptive, lifecycle-level only. The dataset and this dashboard never carry operational detail.',
    }),
  );

  root.appendChild(
    h(
      'p',
      { class: 'note' },
      `Counts cover ${records.length} record${records.length === 1 ? '' : 's'}${includeInactive ? ', including retracted and superseded ones' : ''}. Gaps are listed on the `,
      h('a', { href: href('stats') }, 'Stats page'),
      '; new incidents and mappings go upstream via ',
      externalLink(newIncidentIssueUrl(), 'the new-incident template', 'plain'),
      '.',
    ),
  );
  void label;
}
