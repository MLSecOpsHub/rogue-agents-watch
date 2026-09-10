// Replay control for the map: a scrubber over disclosure dates with play/pause.
// Bounds come only from the data (no wall clock), so the same snapshot always
// yields the same default view and the same shareable `t=` links.
import type { Incident } from '../data/types';
import { h } from '../util/dom';

export interface ReplayBounds {
  /** Jan 1 of the earliest disclosure year, ms UTC. */
  start: number;
  /** Dec 31 of the latest disclosure year, ms UTC. */
  end: number;
  /** The latest date_disclosed in the set, ms UTC. */
  latest: number;
}

export function dateMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function replayBounds(incidents: Incident[]): ReplayBounds {
  if (incidents.length === 0) return { start: Date.UTC(2024, 0, 1), end: Date.UTC(2024, 11, 31), latest: Date.UTC(2024, 0, 1) };
  let minY = Infinity;
  let maxY = -Infinity;
  let latest = -Infinity;
  for (const i of incidents) {
    minY = Math.min(minY, i.year);
    maxY = Math.max(maxY, i.year);
    latest = Math.max(latest, dateMs(i.date_disclosed));
  }
  return { start: Date.UTC(minY, 0, 1), end: Date.UTC(maxY, 11, 31), latest };
}

/** YYYY-MM for URLs and labels. */
export function formatT(t: number): string {
  return new Date(t).toISOString().slice(0, 7);
}

/** Parse `t=YYYY-MM` (inclusive of that whole month) or `t=YYYY-MM-DD`, clamped to the bounds. */
export function parseT(raw: string | null, b: ReplayBounds): number | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const t = m[3] ? Date.UTC(y, mo - 1, Number(m[3])) : Date.UTC(y, mo, 0);
  if (Number.isNaN(t)) return null;
  return Math.min(b.end, Math.max(b.start, t));
}

export interface Replay {
  el: HTMLElement;
  readonly t: number;
  readonly playing: boolean;
  set(t: number, final?: boolean): void;
  play(): void;
  pause(): void;
}

/**
 * @param onChange called on every position change; `final` is true when the
 * change should be persisted (pointer released, playback ended, jump).
 */
export function createReplay(bounds: ReplayBounds, initial: number, onChange: (t: number, playing: boolean, final: boolean) => void, reduced = false): Replay {
  let t = Math.min(bounds.end, Math.max(bounds.start, initial));
  let playing = false;
  let raf = 0;
  const span = bounds.end - bounds.start;

  const play = h('button', { type: 'button', class: 'btn btn-small replay-play', 'aria-label': 'Play replay' }, 'Play');
  const range = h('input', { type: 'range', class: 'replay-range', min: 0, max: 1000, value: 0, 'aria-label': 'Replay position by disclosure date', 'aria-valuetext': formatT(t) }) as HTMLInputElement;
  const when = h('span', { class: 'replay-when mono', 'aria-live': 'polite' }, formatT(t));
  const ticks = h('div', { class: 'replay-ticks', 'aria-hidden': 'true' });
  const y0 = new Date(bounds.start).getUTCFullYear();
  const y1 = new Date(bounds.end).getUTCFullYear();
  for (let y = y0; y <= y1; y++) ticks.appendChild(h('span', null, String(y)));
  ticks.appendChild(h('span', null, 'end'));
  const el = h('div', { class: 'replay', role: 'group', 'aria-label': 'Replay by disclosure date' }, h('div', { class: 'replay-row' }, play, range, when), ticks);

  const paint = () => {
    range.value = String(Math.round(((t - bounds.start) / span) * 1000));
    range.setAttribute('aria-valuetext', formatT(t));
    when.textContent = formatT(t);
    play.textContent = playing ? 'Pause' : t >= bounds.end ? 'Replay' : 'Play';
    play.setAttribute('aria-label', playing ? 'Pause replay' : t >= bounds.end ? 'Replay from the start' : 'Play replay');
  };

  const stop = (final: boolean) => {
    playing = false;
    cancelAnimationFrame(raf);
    paint();
    onChange(t, false, final);
  };

  const step = () => {
    t += span / (reduced ? 120 : 420);
    if (t >= bounds.end) {
      t = bounds.end;
      stop(true);
      return;
    }
    paint();
    onChange(t, true, false);
    raf = requestAnimationFrame(step);
  };

  const api: Replay = {
    el,
    get t() {
      return t;
    },
    get playing() {
      return playing;
    },
    set(next, final = true) {
      if (playing) stop(false);
      t = Math.min(bounds.end, Math.max(bounds.start, next));
      paint();
      onChange(t, false, final);
    },
    play() {
      if (playing) return;
      if (t >= bounds.end) t = bounds.start;
      playing = true;
      paint();
      onChange(t, true, false);
      raf = requestAnimationFrame(step);
    },
    pause() {
      if (playing) stop(true);
    },
  };

  play.addEventListener('click', () => (playing ? api.pause() : api.play()));
  range.addEventListener('input', () => {
    if (playing) stop(false);
    t = bounds.start + (Number(range.value) / 1000) * span;
    paint();
    onChange(t, false, false);
  });
  range.addEventListener('change', () => onChange(t, false, true));
  paint();
  return api;
}
