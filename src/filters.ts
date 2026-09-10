import type { Incident } from './data/types';

/** Enum-like fields that can be filtered by value. Arrays match when any value hits. */
export const FILTER_FIELDS = [
  'status',
  'confidence',
  'ai_role',
  'severity',
  'category',
  'actor_type',
  'model_families',
  'autonomy_level',
  'guardrail_bypass',
  'lifecycle_phases',
  'record_status',
  'sectors',
  'year',
] as const;

export type FilterField = (typeof FILTER_FIELDS)[number];

export interface FilterState {
  /** field -> set of accepted values (empty set = no constraint). */
  values: Partial<Record<FilterField, Set<string>>>;
  /** Full-text query over name and summary (case-insensitive). */
  q: string;
  /** Include retracted/superseded records (default false). */
  includeInactive: boolean;
}

export function emptyFilters(): FilterState {
  return { values: {}, q: '', includeInactive: false };
}

export function fieldValues(inc: Incident, field: FilterField): string[] {
  switch (field) {
    case 'sectors':
      return inc.targets.sectors;
    case 'year':
      return [String(inc.year)];
    case 'model_families':
    case 'guardrail_bypass':
    case 'lifecycle_phases':
      return inc[field];
    default:
      return [String(inc[field])];
  }
}

export function matches(inc: Incident, f: FilterState): boolean {
  if (!f.includeInactive && !inc.isActiveRecord) return false;
  for (const field of FILTER_FIELDS) {
    const wanted = f.values[field];
    if (!wanted || wanted.size === 0) continue;
    const have = fieldValues(inc, field);
    if (!have.some((v) => wanted.has(v))) return false;
  }
  if (f.q.trim()) {
    const needle = f.q.trim().toLowerCase();
    const hay = `${inc.id} ${inc.name} ${inc.summary} ${inc.actor} ${inc.models.join(' ')}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function applyFilters(incidents: Incident[], f: FilterState): Incident[] {
  return incidents.filter((i) => matches(i, f));
}

export function isEmpty(f: FilterState): boolean {
  return !f.q.trim() && !f.includeInactive && FILTER_FIELDS.every((k) => !(f.values[k]?.size ?? 0));
}

/** Serialise to URL query params (stable ordering so links are shareable). */
export function toQuery(f: FilterState): URLSearchParams {
  const q = new URLSearchParams();
  for (const field of FILTER_FIELDS) {
    const set = f.values[field];
    if (set && set.size) q.set(field, [...set].sort().join(','));
  }
  if (f.q.trim()) q.set('q', f.q.trim());
  if (f.includeInactive) q.set('inactive', '1');
  return q;
}

export function fromQuery(q: URLSearchParams): FilterState {
  const f = emptyFilters();
  for (const field of FILTER_FIELDS) {
    const raw = q.get(field);
    if (raw) f.values[field] = new Set(raw.split(',').filter(Boolean));
  }
  f.q = q.get('q') ?? '';
  f.includeInactive = q.get('inactive') === '1';
  return f;
}

export function toggleValue(f: FilterState, field: FilterField, value: string): FilterState {
  const next: FilterState = { ...f, values: { ...f.values } };
  const set = new Set(next.values[field] ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  next.values[field] = set;
  return next;
}

export type SortKey = 'date_disclosed' | 'name' | 'status' | 'confidence' | 'ai_role' | 'severity' | 'category' | 'actor' | 'autonomy_level';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS_ORDER: Record<string, number> = { confirmed: 0, reported: 1, 'test-eval': 2 };
const CONFIDENCE_ORDER: Record<string, number> = { primary: 0, secondary: 1, unverified: 2 };
const AI_ROLE_ORDER: Record<string, number> = { 'load-bearing': 0, significant: 1, incidental: 2, disputed: 3, unknown: 4 };

export function sortIncidents(list: Incident[], key: SortKey, dir: 'asc' | 'desc'): Incident[] {
  const rank = (i: Incident): string | number => {
    switch (key) {
      case 'severity':
        return SEVERITY_ORDER[i.severity] ?? 99;
      case 'status':
        return STATUS_ORDER[i.status] ?? 99;
      case 'confidence':
        return CONFIDENCE_ORDER[i.confidence] ?? 99;
      case 'ai_role':
        return AI_ROLE_ORDER[i.ai_role] ?? 99;
      default:
        return String(i[key]).toLowerCase();
    }
  };
  const sign = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra < rb) return -1 * sign;
    if (ra > rb) return 1 * sign;
    return a.id.localeCompare(b.id);
  });
}
