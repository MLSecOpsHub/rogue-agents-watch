// Booting the app on the root shell with the hash the brand link produces
// ("#/") must leave the canonical URL ("/") in the address bar, with no
// reload, and must leave a filtered overview or another view untouched.
import { describe, expect, it } from 'vitest';

describe('boot URL normalisation', () => {
  it('rewrites "/#/" to "/" on the unfiltered overview, keeps other hashes', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    window.location.hash = '#/';
    await import('../src/main');
    await new Promise((r) => setTimeout(r, 0));
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
    expect(document.title).toBe('Rogue Agents Watch');

    window.location.hash = '#/map';
    await new Promise((r) => setTimeout(r, 0));
    expect(window.location.hash).toBe('#/map');
    expect(document.title).toBe('Map — Rogue Agents Watch');

    window.location.hash = '#/?status=confirmed';
    await new Promise((r) => setTimeout(r, 0));
    expect(window.location.hash).toBe('#/?status=confirmed');

    window.location.hash = '#/';
    await new Promise((r) => setTimeout(r, 0));
    expect(window.location.hash).toBe('');
  });
});
