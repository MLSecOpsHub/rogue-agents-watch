// ATT&CK / ATLAS Navigator layers built in the browser from any record list,
// so a filtered table view can be exported as a layer. Same shape as the
// static layers scripts/prerender.mjs writes for the whole snapshot (a test
// pins the two together); score = number of records carrying the technique.
import type { Incident } from '../data/types';
import { SITE } from '../config';

const GRADIENT = ['#fde8d7', '#e07a2f', '#7f2a06'];
const UPSTREAM = 'https://github.com/MLSecOpsHub/agentic-attack-index';

function techniqueCounts(records: Incident[], key: 'mitre_attack' | 'mitre_atlas'): Array<[string, string[]]> {
  const m = new Map<string, string[]>();
  for (const r of records.slice().sort((a, b) => a.id.localeCompare(b.id))) for (const id of r.mappings[key]) m.set(id, [...(m.get(id) ?? []), r.id]);
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export interface LayerOptions {
  version: string;
  siteUrl: string;
  /** Appended to the layer name, e.g. ", filtered: 12 of 34 records". */
  suffix?: string;
}

export function attackLayer(records: Incident[], o: LayerOptions): Record<string, unknown> {
  const entries = techniqueCounts(records, 'mitre_attack');
  const max = Math.max(1, ...entries.map(([, ids]) => ids.length));
  return {
    name: `${SITE.name} — ATT&CK techniques (dataset v${o.version}${o.suffix ?? ''})`,
    versions: { layer: '4.5', navigator: '4.9.0' },
    domain: 'enterprise-attack',
    description: `Enterprise ATT&CK techniques mapped upstream in the Agentic Attack Index, dataset v${o.version}. Score = number of records carrying the technique; the comment lists the record ids. Mapped in ${records.filter((r) => r.mappings.mitre_attack.length).length} of ${records.length} records. CC BY-SA 4.0.`,
    techniques: entries.map(([id, ids]) => ({ techniqueID: id, score: ids.length, comment: ids.join(', '), enabled: true, showSubtechniques: true, links: ids.map((rid) => ({ label: rid, url: `${o.siteUrl}incident/${encodeURIComponent(rid)}/` })) })),
    gradient: { colors: GRADIENT, minValue: 0, maxValue: max },
    legendItems: [{ label: 'records carrying the technique', color: GRADIENT[1] }],
    metadata: [{ name: 'dataset', value: `agentic-attack-index v${o.version}` }, { name: 'license', value: 'CC BY-SA 4.0' }],
    links: [{ label: SITE.name, url: o.siteUrl }, { label: 'Agentic Attack Index', url: UPSTREAM }],
    layout: { layout: 'side', showID: true, showName: true },
    hideDisabled: false,
    sorting: 3,
  };
}

// A Navigator layer holds techniques only; ATLAS case studies (AML.CS…) and tactics stay on record pages.
const ATLAS_TECHNIQUE = /^AML\.T\d{4}/;

export function atlasLayer(records: Incident[], o: LayerOptions): Record<string, unknown> {
  const entries = techniqueCounts(records, 'mitre_atlas').filter(([id]) => ATLAS_TECHNIQUE.test(id));
  const max = Math.max(1, ...entries.map(([, ids]) => ids.length));
  return {
    name: `${SITE.name} — ATLAS techniques (dataset v${o.version}${o.suffix ?? ''})`,
    versions: { layer: '4.3', navigator: '4.6.4' },
    domain: 'atlas-atlas',
    description: `MITRE ATLAS techniques mapped upstream in the Agentic Attack Index, dataset v${o.version}. Score = number of records carrying the technique; the comment lists the record ids. Mapped in ${records.filter((r) => r.mappings.mitre_atlas.some((id) => ATLAS_TECHNIQUE.test(id))).length} of ${records.length} records. ATLAS case studies mapped upstream are linked from record pages, not included here. CC BY-SA 4.0.`,
    techniques: entries.map(([id, ids]) => ({ techniqueID: id, score: ids.length, comment: ids.join(', '), enabled: true, showSubtechniques: true })),
    gradient: { colors: GRADIENT, minValue: 0, maxValue: max },
    legendItems: [{ label: 'records carrying the technique', color: GRADIENT[1] }],
    metadata: [{ name: 'dataset', value: `agentic-attack-index v${o.version}` }, { name: 'url', value: o.siteUrl }, { name: 'license', value: 'CC BY-SA 4.0' }],
    hideDisabled: false,
    sorting: 3,
  };
}
