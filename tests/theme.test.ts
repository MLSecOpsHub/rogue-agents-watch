import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { applyStoredTheme, currentTheme } from '../src/components/layout';

const css = readFileSync(path.join(process.cwd(), 'src', 'styles.css'), 'utf8');

describe('theme', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.theme;
    try {
      localStorage.clear();
    } catch {
      /* no storage */
    }
  });

  it('is dark by default without consulting the OS preference', () => {
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(currentTheme()).toBe('dark');
    // The bare :root carries the dark set; light is an explicit stamp; no OS media query decides the palette.
    const root = /:root \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
    expect(root).toContain('color-scheme: dark;');
    expect(css).toMatch(/:root\[data-theme='light'\] \{[\s\S]*?color-scheme: light;/);
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('honours a stored light preference', () => {
    localStorage.setItem('raw-theme', 'light');
    applyStoredTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(currentTheme()).toBe('light');
  });
});
