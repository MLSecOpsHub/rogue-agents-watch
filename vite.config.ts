import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { resolveBasePath, resolveSiteUrl } from './scripts/site-env.mjs';

// The canonical URL src/config.ts reads via import.meta.env.VITE_SITE_URL.
// Resolved here so a Vercel build (served at "/") and a GitHub Pages build
// (served under /<repo>/) each get matching base path and share links
// without per-host configuration; an explicit VITE_SITE_URL still wins.
process.env.VITE_SITE_URL ??= resolveSiteUrl();

// Deterministic build: Vite's asset hashes are content-derived, and nothing
// here injects a build timestamp. The only date in the output is the one
// already recorded in data/snapshot/SNAPSHOT.json.
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/; Vercel and custom
  // domains serve at "/". See scripts/site-env.mjs; VITE_BASE_PATH overrides.
  base: resolveBasePath(),
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      // Two entries: the site and the iframe-able map embed. Both share the
      // same modules, so the geometry chunk and data are built once.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        embed: fileURLToPath(new URL('./embed.html', import.meta.url)),
      },
      output: {
        manualChunks(id) {
          // Map geometry is large and only needed on #/map; keep it separate
          // so it is excluded from the core bundle budget.
          if (id.includes('data/geo/countries-110m.json')) return 'world-geometry';
          return undefined;
        },
      },
    },
  },
});
