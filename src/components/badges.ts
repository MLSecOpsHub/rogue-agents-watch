import { describe, label } from '../data/taxonomy';
import type { Incident, Taxonomy } from '../data/types';
import { h } from '../util/dom';

/**
 * A grade badge. The tooltip (title + aria-describedby text) carries the
 * upstream taxonomy definition so the grade is never a bare colour.
 */
export function badge(tax: Taxonomy, key: string, value: string, opts: { prefix?: string; compact?: boolean } = {}): HTMLElement {
  const def = describe(tax, key, value);
  const text = label(tax, key, value);
  const el = h(
    'span',
    {
      class: `badge badge-${key} badge-${key}-${value}${opts.compact ? ' badge-compact' : ''}`,
      title: def ? `${opts.prefix ?? keyTitle(tax, key)}: ${text} — ${def}` : `${opts.prefix ?? keyTitle(tax, key)}: ${text}`,
      dataset: { field: key, value },
    },
    opts.compact ? text : [h('span', { class: 'badge-key' }, `${opts.prefix ?? keyTitle(tax, key)} `), h('span', { class: 'badge-val' }, text)],
  );
  return el;
}

export function keyTitle(tax: Taxonomy, key: string): string {
  return tax[key]?.title ?? key;
}

/** The three honesty grades that must appear on every card, row, and page. */
export function gradeStrip(tax: Taxonomy, inc: Incident, compact = false): HTMLElement {
  return h(
    'div',
    { class: 'grades', role: 'group', 'aria-label': 'Grades' },
    badge(tax, 'status', inc.status, { compact, prefix: 'Status' }),
    badge(tax, 'confidence', inc.confidence, { compact, prefix: 'Confidence' }),
    badge(tax, 'ai_role', inc.ai_role, { compact, prefix: 'AI role' }),
    badge(tax, 'severity', inc.severity, { compact, prefix: 'Severity' }),
  );
}

export function recordStatusBanner(tax: Taxonomy, inc: Incident, supersededName?: string): HTMLElement | null {
  if (inc.record_status === 'active') return null;
  const def = describe(tax, 'record_status', inc.record_status);
  return h(
    'div',
    { class: `record-banner record-banner-${inc.record_status}`, role: 'note' },
    h('strong', null, `Record ${label(tax, 'record_status', inc.record_status).toLowerCase()}. `),
    def,
    inc.superseded_by
      ? [' Superseded by ', h('a', { href: `#/incident/${encodeURIComponent(inc.superseded_by)}` }, supersededName ?? inc.superseded_by), '.']
      : null,
    inc.revisions.length ? ' See the revision history below.' : null,
  );
}

export function recordStatusTag(tax: Taxonomy, inc: Incident): HTMLElement | null {
  if (inc.record_status === 'active') return null;
  return badge(tax, 'record_status', inc.record_status, { compact: true, prefix: 'Record' });
}

/** Incident card used on overview, map list, and search results. */
export function incidentCard(tax: Taxonomy, inc: Incident): HTMLElement {
  return h(
    'article',
    { class: `card${inc.isActiveRecord ? '' : ' card-inactive'}` },
    h(
      'header',
      { class: 'card-head' },
      h('a', { class: 'card-title', href: `#/incident/${encodeURIComponent(inc.id)}` }, inc.name),
      h('span', { class: 'card-date' }, inc.date_disclosed),
    ),
    gradeStrip(tax, inc, true),
    h(
      'div',
      { class: 'card-meta' },
      badge(tax, 'category', inc.category, { compact: true, prefix: 'Category' }),
      h('span', { class: 'meta-actor' }, `Actor: ${inc.actor}`),
      recordStatusTag(tax, inc),
    ),
    h('p', { class: 'card-summary' }, inc.summary),
  );
}
