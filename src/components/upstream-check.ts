// Optional, user-initiated enhancement: compare the vendored snapshot with the
// live upstream summary.json. This is the ONLY code path that leaves the origin,
// and it runs only when the visitor clicks the button. It never changes what the
// site renders.
import { upstreamUrls } from '../config';
import type { Dataset } from '../data/types';

export async function checkForNewerDataset(ds: Dataset, out: HTMLElement): Promise<void> {
  out.textContent = 'Checking…';
  try {
    const res = await fetch(upstreamUrls.summary, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const live = (await res.json()) as { dataset_version?: string; total?: number };
    const same = live.dataset_version === ds.summary.dataset_version && live.total === ds.summary.total;
    out.textContent = same
      ? `Up to date (upstream v${live.dataset_version}, ${live.total} records).`
      : `Newer data upstream: v${live.dataset_version} with ${live.total} records (this site shows v${ds.summary.dataset_version}, ${ds.summary.total}). A sync PR is opened weekly.`;
  } catch (err) {
    out.textContent = `Could not reach upstream (${err instanceof Error ? err.message : 'error'}).`;
  }
}
