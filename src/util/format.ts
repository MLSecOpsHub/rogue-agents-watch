/** Integers from the dataset: null means "not stated", never zero. */
export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'not stated';
  return n.toLocaleString('en-US');
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'not stated';
  return `${n}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return 'not stated';
  return iso; // ISO dates are unambiguous and sortable; do not localise.
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}
