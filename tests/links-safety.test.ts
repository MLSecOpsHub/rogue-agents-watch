// Defense in depth: dataset URLs only ever become links when they are http(s).
import { describe, expect, it } from 'vitest';
import { externalLink, isHttpUrl } from '../src/util/dom';
// @ts-expect-error plain .mjs module without type declarations
import { safeHref } from '../scripts/prerender-util.mjs';

const bad = ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', 'vbscript:x', '//evil.example/x', '/relative', '', 'https://'];
const WAYBACK = 'https://web.archive.org/web/20261015120000/https://example.com/a';
const good = [WAYBACK, 'http://example.com/'];

describe('link scheme guard', () => {
  it('isHttpUrl and safeHref accept only absolute http(s) URLs', () => {
    for (const u of good) {
      expect(isHttpUrl(u), u).toBe(true);
      expect(safeHref(u), u).toBe(u);
    }
    for (const u of bad) {
      expect(isHttpUrl(u), u).toBe(false);
      expect(safeHref(u), u).toBeNull();
    }
  });

  it('externalLink renders non-http(s) URLs as inert text with no href', () => {
    for (const u of bad.filter(Boolean)) {
      const el = externalLink(u, 'label');
      expect(el.tagName, u).toBe('SPAN');
      expect(el.getAttribute('href'), u).toBeNull();
    }
    const a = externalLink(WAYBACK, 'archived copy');
    expect(a.tagName).toBe('A');
    expect(a.getAttribute('href')).toBe(WAYBACK);
    expect(a.getAttribute('rel')).toContain('noopener');
  });
});
