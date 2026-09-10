import { defineConfig } from 'vite';

// Deterministic build: Vite's asset hashes are content-derived, and nothing
// here injects a build timestamp. The only date in the output is the one
// already recorded in data/snapshot/SNAPSHOT.json.
export default defineConfig({
  // GitHub Pages serves project sites under /<repo>/. Override with
  // VITE_BASE_PATH (e.g. "/" for a custom domain).
  base: process.env.VITE_BASE_PATH ?? '/rogue-agents-dashboard/',
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
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
