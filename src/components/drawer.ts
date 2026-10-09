// Incident drawer: the full record summary inside the map, so exploring never
// throws the reader out of the view. Facts and wording come from the record;
// the full page stays one click away.
import { correctionIssueUrl, upstreamUrls } from '../config';
import { datasetStatesAutonomyPct } from '../data/coverage';
import { describe, label } from '../data/taxonomy';
import type { Dataset, Incident } from '../data/types';
import { incidentHref } from '../router';
import { externalLink, h } from '../util/dom';
import { fmtPct } from '../util/format';
import { copyToClipboard, shareCaption } from '../util/share';
import { shareUrl } from '../config';
import { badge, gradeStrip, recordStatusBanner } from './badges';
import { basisText, placeName } from './map-canvas';

function row(dt: string, dd: HTMLElement | string): HTMLElement[] {
  return [h('dt', null, dt), h('dd', null, dd)];
}

export function incidentDrawer(ds: Dataset, inc: Incident, onClose: () => void): HTMLElement {
  const tax = ds.taxonomy;
  const location = inc.geo
    ? h('ul', { class: 'geo-points' }, ...inc.geo.points.map((p) => h('li', null, `${p.role} ${placeName(p)}`, h('span', { class: 'muted' }, ` · ${basisText(ds, p)}${p.illustrative ? ' · country-level' : ''}`))))
    : 'no stated location; listed in the field log only';
  const close = h('button', { type: 'button', class: 'btn btn-small btn-quiet drawer-close', 'aria-label': 'Close incident panel', onClick: onClose }, 'Close');
  const banner = recordStatusBanner(tax, inc, inc.superseded_by ? ds.byId.get(inc.superseded_by)?.name : undefined);
  const copyLink = h('button', { type: 'button', class: 'btn btn-small', onClick: (e: Event) => void copyToClipboard(shareUrl(inc.id), e.currentTarget as HTMLButtonElement, 'Link copied') }, 'Copy share link');
  const copyCap = h('button', { type: 'button', class: 'btn btn-small btn-quiet', onClick: (e: Event) => void copyToClipboard(shareCaption(tax, inc), e.currentTarget as HTMLButtonElement, 'Caption copied') }, 'Copy caption');
  const el = h(
    'div',
    { class: 'drawer-inner', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'drawer-title', tabindex: -1 },
    close,
    h('p', { class: 'crumbs' }, h('code', { class: 'id' }, inc.id), ' · ', h('time', { datetime: inc.date_disclosed }, inc.date_disclosed)),
    h('h2', { id: 'drawer-title' }, inc.name),
    gradeStrip(tax, inc, true),
    banner,
    h(
      'dl',
      { class: 'def drawer-facts' },
      ...row('Actor', h('span', null, h('strong', null, inc.actor), ' (', badge(tax, 'actor_type', inc.actor_type, { compact: true, prefix: 'Actor type' }), ')')),
      ...row('Category', badge(tax, 'category', inc.category, { compact: true, prefix: 'Category' })),
      ...row('Autonomy', datasetStatesAutonomyPct(ds.incidents) || inc.autonomy_pct !== null ? `${label(tax, 'autonomy_level', inc.autonomy_level)} · ${fmtPct(inc.autonomy_pct)}` : label(tax, 'autonomy_level', inc.autonomy_level)),
      ...row('Models', inc.models.length ? inc.models.join(', ') : 'not named by sources'),
      ...row('Location', location),
    ),
    h('p', { class: 'drawer-summary' }, inc.summary),
    h('h3', null, `Sources (${inc.sources.length})`),
    h(
      'ol',
      { class: 'sources compact' },
      ...inc.sources.map((s) =>
        h('li', null, externalLink(s.url, s.title), h('div', { class: 'source-meta' }, s.publisher, ' · ', s.archive_url ? externalLink(s.archive_url, 'archived copy', 'plain') : h('span', { class: 'muted' }, 'no archive recorded'))),
      ),
    ),
    h('pre', { class: 'cite' }, `Agentic Attack Index (MLSecOpsHub), dataset v${ds.summary.dataset_version}, record "${inc.id}". ${upstreamUrls.incident(inc.id)} — CC BY-SA 4.0.`),
    h(
      'div',
      { class: 'drawer-actions' },
      h('a', { class: 'btn btn-small', href: incidentHref(inc.id) }, 'Full record'),
      copyLink,
      copyCap,
      externalLink(correctionIssueUrl(inc.id), 'Report a correction', 'btn btn-small btn-quiet'),
    ),
    h('p', { class: 'muted small' }, describe(tax, 'ai_role', inc.ai_role)),
  );
  return el;
}
