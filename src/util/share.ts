// Share helpers. The share URL points at the prerendered per-incident page
// (built by scripts/prerender.mjs) so links unfurl with a card and the grades;
// that page redirects to the hash route. Captions carry the grades verbatim and
// no tracking parameters.
import { SITE, shareUrl } from '../config';
import { label } from '../data/taxonomy';
import type { Dataset, Incident, Taxonomy } from '../data/types';

export function shareCaption(tax: Taxonomy, inc: Incident): string {
  const n = inc.sources.length;
  return (
    `${inc.name} — ${label(tax, 'status', inc.status)}, AI ${label(tax, 'ai_role', inc.ai_role).toLowerCase()}, ` +
    `${label(tax, 'severity', inc.severity).toLowerCase()} severity. ${n} source${n === 1 ? '' : 's'}, CC BY-SA 4.0. ${shareUrl(inc.id)}`
  );
}

/** Site-level caption for the overview share button. */
export function siteCaption(ds: Dataset): string {
  const confirmed = ds.summary.by_status['confirmed'] ?? 0;
  return `${SITE.name}: ${ds.summary.total} source-linked, graded records of cyberattacks executed or orchestrated by AI agents (${confirmed} confirmed). Every dot has a footnote. CC BY-SA 4.0.`;
}

/** Copy text to the clipboard and reflect the outcome on the button that triggered it. */
export async function copyToClipboard(text: string, btn: HTMLButtonElement, done = 'Copied'): Promise<void> {
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = done;
  } catch {
    btn.textContent = 'Clipboard blocked';
  }
  window.setTimeout(() => {
    btn.textContent = original;
  }, 1800);
}
