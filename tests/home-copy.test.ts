// Approved homepage positioning (src/site-copy.mjs). The strings are pinned
// here literally so an accidental edit to the shared copy fails the suite,
// and the live hero, the prerendered page, the <head>, JSON-LD and llms.txt
// are checked against the same text.
import { describe, expect, it } from 'vitest';
import summary from '../data/snapshot/summary.json';
import { FALLBACK_SHELL, incidentHtml, loadContext, routeHtml, siteJsonLd, siteOgTags } from '../scripts/prerender.mjs';
import { llmsFullTxt, llmsTxt } from '../scripts/prerender-pages.mjs';
import { esc } from '../scripts/prerender-util.mjs';
import { loadDataset } from '../src/data/load';
import { parseRoute } from '../src/router';
import { overviewView } from '../src/views/overview';

const TITLE = 'Rogue Agents Watch — Rogue AI Agent Incidents & Cyberattacks';
const TAGLINE = 'Open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks.';
const DESCRIPTION =
  'Rogue Agents Watch tracks documented rogue-agent incidents and AI-orchestrated cyberattacks. Each record links to its sources and distinguishes what is confirmed, what is reported, and how central AI was to the event.';
const META = 'Open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks. Explore source-linked incidents, verification grades, and security mappings.';
const UPSTREAM = 'https://github.com/MLSecOpsHub/agentic-attack-index';

const ctx = loadContext('https://example.test/site/', { shell: FALLBACK_SHELL });
const byId = new Map(ctx.incidents.map((r) => [r.id, r]));
const meta = (html: string, attr: 'name' | 'property', key: string) => new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`).exec(html)?.[1];

describe('homepage copy', () => {
  it('the live hero shows the H1, tagline, description and linked attribution', () => {
    const root = document.createElement('main');
    document.body.appendChild(root);
    overviewView({ ds: loadDataset(), route: parseRoute('#/'), root });
    const head = root.querySelector('.hero-head')!;
    expect(root.querySelectorAll('h1')).toHaveLength(1);
    expect(head.querySelector('h1')?.textContent).toBe('Rogue Agents Watch');
    expect(head.querySelector('.lede')?.textContent).toBe(TAGLINE);
    expect(head.querySelector('.hero-description')?.textContent).toBe(DESCRIPTION);
    const attribution = head.querySelector('.hero-attribution')!;
    expect(attribution.textContent).toBe('Powered by the open-source Agentic Attack Index.');
    expect(attribution.querySelector('a')?.getAttribute('href')).toBe(UPSTREAM);
    expect(attribution.querySelector('a')?.textContent).toBe('Agentic Attack Index');
    root.remove();
  });

  it('the prerendered homepage carries the same copy without JavaScript, one H1 and one description', () => {
    const html = routeHtml('overview', ctx);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<h1>Rogue Agents Watch</h1>');
    expect(html).toContain(`<p class="lede">${esc(TAGLINE)}</p>`);
    expect(html).toContain(`<p class="hero-description">${esc(DESCRIPTION)}</p>`);
    expect(html).toContain(`Powered by the open-source <a href="${UPSTREAM}">Agentic Attack Index</a>.`);
    // Counts and version come from the snapshot, next to the copy, not inside it.
    expect(html).toContain(`<p>${summary.total} records, disclosed between`);
    expect(html).toContain(`dataset v${summary.dataset_version}.</p>`);
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html.match(/<title>/g)).toHaveLength(1);
  });

  it('title, meta, Open Graph and Twitter tags use the approved strings; canonical is unchanged', () => {
    const html = routeHtml('overview', ctx);
    expect(html).toContain(`<title>${esc(TITLE)}</title>`);
    expect(meta(html, 'name', 'description')).toBe(esc(META));
    expect(meta(html, 'property', 'og:description')).toBe(esc(META));
    expect(meta(html, 'name', 'twitter:description')).toBe(esc(META));
    expect(meta(html, 'property', 'og:title')).toBe(esc(TITLE));
    expect(meta(html, 'name', 'twitter:title')).toBe(esc(TITLE));
    expect(html).toContain('<link rel="canonical" href="https://example.test/site/">');
    const tags = siteOgTags(ctx);
    expect(tags).toContain(`og:description" content="${esc(META)}"`);
    expect(tags).toContain(`og:title" content="${esc(TITLE)}"`);
  });

  it('JSON-LD tells the website from the dataset and keeps provenance and licence', () => {
    const graph = siteJsonLd(ctx)['@graph'] as Array<Record<string, unknown>>;
    const site = graph.find((n) => n['@type'] === 'WebSite')!;
    const dataset = graph.find((n) => n['@type'] === 'Dataset')!;
    expect(site['name']).toBe('Rogue Agents Watch');
    expect(site['description']).toBe(META);
    expect(dataset['name']).toBe('Agentic Attack Index');
    expect(dataset).not.toHaveProperty('alternateName');
    expect(dataset['@id']).not.toBe(site['@id']);
    expect(dataset['sameAs']).toEqual([UPSTREAM]);
    expect(dataset['license']).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(dataset['version']).toBe(summary.dataset_version);
    expect(dataset['creator']).toEqual({ '@id': 'https://mlsecopshub.com/#organization' });
    expect(String(dataset['description'])).toContain(`${summary.total} records, dataset v${summary.dataset_version}`);
    expect(String(dataset['description'])).toContain('test and evaluation records');
  });

  it('llms.txt and llms-full.txt name the dashboard and the dataset it renders', () => {
    for (const txt of [llmsTxt(ctx), llmsFullTxt(ctx)]) {
      expect(txt).toContain('Rogue Agents Watch is a public dashboard of open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks.');
      expect(txt).toContain('It renders the Agentic Attack Index, an open-source, source-linked dataset');
    }
    expect(llmsTxt(ctx)).toContain(`- [Overview](https://example.test/site/): ${META}`);
  });

  it('incident pages keep their own title, description and canonical URL', () => {
    const id = summary.ids[0]!;
    const html = incidentHtml(byId.get(id)!, ctx);
    expect(html).toContain(`<link rel="canonical" href="https://example.test/site/incident/${id}/">`);
    expect(html).not.toContain(esc(TITLE));
    expect(meta(html, 'name', 'description')).not.toBe(esc(META));
    expect(html).toContain(`<title>${esc(byId.get(id)!.name)}`);
  });
});
