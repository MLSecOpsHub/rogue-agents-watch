import { describe, expect, it } from 'vitest';
import { analyticsPath, downloadFormat, linkEvent, utmQuery } from '../src/analytics';
import { correctionIssueUrl, upstreamUrls } from '../src/config';
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

describe('utmQuery', () => {
  it('keeps utm_* from the page or hash query and drops everything else', () => {
    expect(utmQuery('?utm_source=x&foo=1', '#/map?status=confirmed&utm_medium=y')).toBe('?utm_source=x&utm_medium=y');
    expect(utmQuery('?utm_source=page', '#/?utm_source=hash')).toBe('?utm_source=page');
    expect(utmQuery('', '#/table?q=agent')).toBe('');
  });
});

describe('custom event classification', () => {
  it('names download formats from the file name', () => {
    expect(downloadFormat('rogue-agents-watch-attack-layer.json')).toBe('attack-layer');
    expect(downloadFormat('rogue-agents-watch-atlas-layer.json')).toBe('atlas-layer');
    expect(downloadFormat('records.csv')).toBe('csv');
    expect(downloadFormat('records.json')).toBe('json');
  });

  it('classifies correction, download and upstream data links', () => {
    expect(linkEvent({ href: correctionIssueUrl('some-id'), download: '' })).toEqual({ name: 'Correction link', props: { id: 'some-id' } });
    expect(linkEvent({ href: 'blob:https://x/1', download: 'records.csv' })).toEqual({ name: 'Data download', props: { format: 'csv', source: 'filtered' } });
    expect(linkEvent({ href: 'https://x/navigator/attack-layer.json', download: 'rogue-agents-watch-attack-layer.json' })).toEqual({ name: 'Data download', props: { format: 'attack-layer', source: 'site' } });
    expect(linkEvent({ href: upstreamUrls.stix, download: '' })).toEqual({ name: 'Data download', props: { format: 'stix', source: 'upstream' } });
    expect(linkEvent({ href: upstreamUrls.incident('some-id'), download: '' })).toEqual({ name: 'Data download', props: { format: 'record-json', source: 'upstream' } });
    expect(linkEvent({ href: 'https://example.com/source', download: '' })).toBeNull();
  });
});
