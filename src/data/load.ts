// Loads the vendored snapshot. These imports are bundled at build time; the site
// makes no network request for data.
import incidentsJson from '../../data/snapshot/incidents.json';
import summaryJson from '../../data/snapshot/summary.json';
import snapshotJson from '../../data/snapshot/SNAPSHOT.json';
import taxonomyJson from '../../data/snapshot/taxonomy.json';
import { buildDataset } from './adapter';
import type { Dataset, RawIncident, Snapshot, Summary, Taxonomy } from './types';

let cached: Dataset | null = null;

export function loadDataset(): Dataset {
  if (!cached) {
    cached = buildDataset(
      incidentsJson as unknown as RawIncident[],
      summaryJson as unknown as Summary,
      snapshotJson as unknown as Snapshot,
      taxonomyJson as unknown as Taxonomy,
    );
  }
  return cached;
}
