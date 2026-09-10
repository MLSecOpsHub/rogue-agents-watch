import { describe, expect, it } from 'vitest';
import { href, incidentHref, parseRoute } from '../src/router';

describe('parseRoute', () => {
  it('maps the six top-level routes', () => {
    expect(parseRoute('#/').view).toBe('overview');
    expect(parseRoute('').view).toBe('overview');
    expect(parseRoute('#').view).toBe('overview');
    expect(parseRoute('#/map').view).toBe('map');
    expect(parseRoute('#/timeline').view).toBe('timeline');
    expect(parseRoute('#/table').view).toBe('table');
    expect(parseRoute('#/stats').view).toBe('stats');
    expect(parseRoute('#/about').view).toBe('about');
  });

  it('tolerates trailing slashes and a missing leading hash', () => {
    expect(parseRoute('#/map/').view).toBe('map');
    expect(parseRoute('/table').view).toBe('table');
  });

  it('parses incident routes and carries the upstream id unchanged', () => {
    const r = parseRoute('#/incident/gtg-1002-ai-espionage');
    expect(r).toMatchObject({ view: 'incident', id: 'gtg-1002-ai-espionage' });
  });

  it('rejects ids that do not match the upstream slug pattern', () => {
    expect(parseRoute('#/incident/').view).toBe('not-found');
    expect(parseRoute('#/incident/Not-A-Slug').view).toBe('not-found');
    expect(parseRoute('#/incident/a/b').view).toBe('not-found');
    expect(parseRoute('#/incident/%3Cscript%3E').view).toBe('not-found');
  });

  it('returns not-found for unknown paths without throwing', () => {
    expect(parseRoute('#/nope')).toMatchObject({ view: 'not-found', path: 'nope' });
    expect(parseRoute('#/map/extra').view).toBe('not-found');
  });

  it('parses query strings on any route', () => {
    const r = parseRoute('#/table?status=confirmed,reported&q=copilot&inactive=1');
    expect(r.view).toBe('table');
    expect(r.query.get('status')).toBe('confirmed,reported');
    expect(r.query.get('q')).toBe('copilot');
    expect(r.query.get('inactive')).toBe('1');
    expect(parseRoute('#/?inactive=1').view).toBe('overview');
  });
});

describe('href builders', () => {
  it('round-trip through parseRoute', () => {
    expect(parseRoute(href('overview')).view).toBe('overview');
    expect(parseRoute(href('stats', { category: 'lab-escape-eval' })).query.get('category')).toBe('lab-escape-eval');
    expect(parseRoute(incidentHref('echoleak-m365-copilot'))).toMatchObject({ view: 'incident', id: 'echoleak-m365-copilot' });
  });

  it('omit the query separator when there are no parameters', () => {
    expect(href('map')).toBe('#/map');
    expect(href('overview')).toBe('#/');
    expect(href('map', new URLSearchParams())).toBe('#/map');
  });
});
