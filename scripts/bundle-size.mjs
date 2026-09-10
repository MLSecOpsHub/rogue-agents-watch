#!/usr/bin/env node
// Report gzipped sizes of the built assets and enforce the budget from the brief:
// core bundle (JS + CSS, excluding the lazily loaded map geometry chunk) must be
// under 500 KB gzipped. Run after `npm run build`.
//
//   node scripts/bundle-size.mjs [--max-gzip-kb 500]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const argIdx = process.argv.indexOf('--max-gzip-kb');
const MAX_KB = argIdx >= 0 ? Number(process.argv[argIdx + 1]) : 500;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('bundle-size: dist/ not found; run `npm run build` first.');
  process.exit(1);
}

const rows = files
  .filter((f) => /\.(js|css|html)$/.test(f))
  .map((f) => {
    const buf = readFileSync(f);
    return { file: path.relative(DIST, f), raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
  })
  .sort((a, b) => b.gzip - a.gzip);

const isGeometry = (r) => /world-geometry/.test(r.file);
const core = rows.filter((r) => !isGeometry(r));
const coreGzip = core.reduce((n, r) => n + r.gzip, 0);
const geoGzip = rows.filter(isGeometry).reduce((n, r) => n + r.gzip, 0);
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';

console.log('bundle-size (gzip level 9):');
for (const r of rows) console.log(`  ${kb(r.gzip)} gz  ${kb(r.raw)} raw  ${r.file}${isGeometry(r) ? '  (map geometry, lazy, excluded from budget)' : ''}`);
console.log(`  core (JS+CSS+HTML, excl. geometry): ${kb(coreGzip)} gz  — budget ${MAX_KB} KB`);
console.log(`  map geometry chunk:                  ${kb(geoGzip)} gz`);

if (coreGzip > MAX_KB * 1024) {
  console.error(`bundle-size: FAIL — core bundle ${(coreGzip / 1024).toFixed(1)} KB gz exceeds ${MAX_KB} KB`);
  process.exit(1);
}
console.log('bundle-size: OK');
