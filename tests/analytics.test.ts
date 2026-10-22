import { describe, expect, it } from 'vitest';
import { analyticsPath } from '../src/analytics';
import { parseRoute } from '../src/router';
import { analyticsEnabled } from '../scripts/site-env.mjs';

describe('analyticsPath', () => {
  it('reports each view under its canonical hash-free path, without filters', () => {
    expect(analyticsPath(parseRoute('#/'))).toBe('');
    expect(analyticsPath(parseRoute('#/map?status=confirmed'))).toBe('map/');
    expect(analyticsPath(parseRoute('#/incident/some-id?x=1'))).toBe('incident/some-id/');
    expect(analyticsPath(parseRoute('#/actors'))).toBe('actors/');
    expect(analyticsPath(parseRoute('#/actors/some-actor'))).toBe('actors/some-actor/');
    expect(analyticsPath(parseRoute('#/no/such/page'))).toBe('404/');
  });
});

describe('analyticsEnabled', () => {
  it('is on for Vercel builds only', () => {
    expect(analyticsEnabled({ VERCEL: '1' })).toBe(true);
    expect(analyticsEnabled({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' })).toBe(false);
    expect(analyticsEnabled({})).toBe(false);
  });
});
