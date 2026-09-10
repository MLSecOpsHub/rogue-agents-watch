import { describe, expect, it } from 'vitest';
import { normalizeIncident } from '../src/data/adapter';
import { shareUrl, SITE_URL } from '../src/config';
import { shareCaption } from '../src/util/share';
import { rawRecord, taxonomy } from './fixtures';

describe('share', () => {
  it('links to the prerendered per-incident page under the canonical site URL', () => {
    expect(SITE_URL.endsWith('/')).toBe(true);
    expect(shareUrl('echoleak-m365-copilot')).toBe(`${SITE_URL}incident/echoleak-m365-copilot/`);
  });
  it('captions carry the grades verbatim and no tracking parameters', () => {
    const inc = normalizeIncident(rawRecord({ status: 'confirmed', ai_role: 'load-bearing', severity: 'high' }));
    const c = shareCaption(taxonomy, inc);
    expect(c).toContain('Confirmed');
    expect(c).toContain('AI load-bearing');
    expect(c).toContain('high severity');
    expect(c).toContain('1 source,');
    expect(c).toContain(shareUrl(inc.id));
    expect(c).not.toMatch(/utm_|ref=/);
  });
});
