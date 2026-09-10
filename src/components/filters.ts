import { FILTER_FIELDS, toggleValue, type FilterField, type FilterState } from '../filters';
import { describe, label, values } from '../data/taxonomy';
import type { Dataset } from '../data/types';
import { h } from '../util/dom';
import { fieldValues } from '../filters';

const FIELD_TITLES: Record<FilterField, string> = {
  status: 'Status',
  confidence: 'Confidence',
  ai_role: 'AI role',
  severity: 'Severity',
  category: 'Category',
  actor_type: 'Actor type',
  model_families: 'Model family',
  autonomy_level: 'Autonomy level',
  guardrail_bypass: 'Guardrail bypass',
  lifecycle_phases: 'Lifecycle phase',
  record_status: 'Record status',
  sectors: 'Target sector',
  year: 'Year disclosed',
};

/** Options for a field: taxonomy order where available, else values present in the data. */
function optionsFor(ds: Dataset, field: FilterField): Array<{ id: string; label: string; description: string; count: number }> {
  const counts = new Map<string, number>();
  for (const inc of ds.incidents) for (const v of fieldValues(inc, field)) counts.set(v, (counts.get(v) ?? 0) + 1);
  const taxKey = field === 'year' ? null : field;
  const ordered = taxKey ? values(ds.taxonomy, taxKey).map((v) => v.id) : [];
  const extra = [...counts.keys()].filter((k) => !ordered.includes(k)).sort();
  const ids = field === 'year' ? extra.sort((a, b) => b.localeCompare(a)) : [...ordered, ...extra];
  return ids
    .filter((id) => field === 'record_status' || (counts.get(id) ?? 0) > 0 || ordered.includes(id))
    .map((id) => ({
      id,
      label: taxKey ? label(ds.taxonomy, taxKey, id) : id,
      description: taxKey ? describe(ds.taxonomy, taxKey, id) : '',
      count: counts.get(id) ?? 0,
    }));
}

export interface FilterPanelOptions {
  fields?: FilterField[];
  showText?: boolean;
  showInactiveToggle?: boolean;
}

/**
 * Renders a filter panel. Calls onChange with the new state on every change; the
 * caller owns the state and re-renders results (the panel itself is rebuilt).
 */
export function filterPanel(ds: Dataset, state: FilterState, onChange: (next: FilterState) => void, opts: FilterPanelOptions = {}): HTMLElement {
  const fields = opts.fields ?? [...FILTER_FIELDS];
  const inactiveCount = ds.incidents.filter((i) => !i.isActiveRecord).length;

  const panel = h('aside', { class: 'filters', 'aria-label': 'Filters' });

  const top = h('div', { class: 'filters-top' });
  if (opts.showText !== false) {
    const input = h('input', {
      type: 'search',
      class: 'filter-text',
      placeholder: 'Search name, summary, actor, model…',
      'aria-label': 'Full-text search',
      value: state.q,
    }) as HTMLInputElement;
    let t: number | undefined;
    input.addEventListener('input', () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => onChange({ ...state, q: input.value }), 150);
    });
    top.appendChild(input);
  }
  const active = countActive(state);
  top.appendChild(
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-quiet',
        disabled: active === 0 && !state.q && !state.includeInactive ? true : null,
        onClick: () => onChange({ values: {}, q: '', includeInactive: false }),
      },
      active ? `Clear ${active} filter${active === 1 ? '' : 's'}` : 'Clear filters',
    ),
  );
  panel.appendChild(top);

  if (opts.showInactiveToggle !== false) {
    const cb = h('input', { type: 'checkbox', id: 'f-inactive', checked: state.includeInactive ? true : null }) as HTMLInputElement;
    cb.addEventListener('change', () => onChange({ ...state, includeInactive: cb.checked }));
    panel.appendChild(
      h(
        'label',
        { class: 'filter-toggle', for: 'f-inactive', title: 'Retracted and superseded records are excluded from counts by default.' },
        cb,
        ` Include retracted / superseded records (${inactiveCount})`,
      ),
    );
  }

  for (const field of fields) {
    const options = optionsFor(ds, field);
    if (options.length === 0) continue;
    const selected = state.values[field] ?? new Set<string>();
    const group = h('details', { class: 'filter-group', open: selected.size > 0 ? true : null });
    group.appendChild(h('summary', null, FIELD_TITLES[field], selected.size ? h('span', { class: 'filter-count' }, ` ${selected.size}`) : null));
    const list = h('div', { class: 'filter-options', role: 'group', 'aria-label': FIELD_TITLES[field] });
    for (const opt of options) {
      const id = `f-${field}-${opt.id}`;
      const cb = h('input', { type: 'checkbox', id, checked: selected.has(opt.id) ? true : null }) as HTMLInputElement;
      cb.addEventListener('change', () => onChange(toggleValue(state, field, opt.id)));
      list.appendChild(
        h(
          'label',
          { class: 'filter-option', for: id, title: opt.description || undefined },
          cb,
          h('span', { class: 'filter-label' }, opt.label),
          h('span', { class: 'filter-n', 'aria-label': `${opt.count} records` }, String(opt.count)),
        ),
      );
    }
    group.appendChild(list);
    panel.appendChild(group);
  }
  return panel;
}

function countActive(state: FilterState): number {
  return FILTER_FIELDS.reduce((n, k) => n + (state.values[k]?.size ?? 0), 0);
}

/** A one-line summary of the active filter, for result headers. */
export function resultSummary(total: number, shown: number, state: FilterState): string {
  const active = countActive(state) + (state.q.trim() ? 1 : 0);
  if (active === 0 && !state.includeInactive) return `${shown} record${shown === 1 ? '' : 's'}`;
  return `${shown} of ${total} record${total === 1 ? '' : 's'} match`;
}

export function excludedInactiveNote(ds: Dataset, state: FilterState): HTMLElement | null {
  if (state.includeInactive) return null;
  const hidden = ds.incidents.filter((i) => !i.isActiveRecord).length;
  if (!hidden) return null;
  return h('p', { class: 'note' }, `${hidden} retracted or superseded record${hidden === 1 ? ' is' : 's are'} hidden. Use the toggle in the filter panel to include ${hidden === 1 ? 'it' : 'them'}.`);
}
