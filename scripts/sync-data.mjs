#!/usr/bin/env node
// Refresh data/snapshot/ from the upstream agentic-attack-index dist/ artifacts.
//
// This is the ONLY place this repository touches the network for data. Everything
// the site renders is read from the vendored snapshot written here, so the build
// and the tests stay hermetic.
//
// Usage:
//   node scripts/sync-data.mjs            # fetch from the configured ref (default: main)
//   DATA_REF=v0.3.0 node scripts/sync-data.mjs
//
// The script never edits incident facts. It copies upstream artifacts byte-for-byte
// (re-serialised with stable 2-space JSON so diffs are readable) and records
// provenance in SNAPSHOT.json.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'snapshot');

const UPSTREAM_REPO = 'MLSecOpsHub/agentic-attack-index';
const REF = process.env.DATA_REF ?? 'main';
const RAW = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${REF}`;
const API = `https://api.github.com/repos/${UPSTREAM_REPO}`;

const TAXONOMY_FILES = [
  'actor-type',
  'ai-role',
  'autonomy-level',
  'category',
  'confidence',
  'guardrail-bypass',
  'lifecycle-phase',
  'model-family',
  'record-status',
  'sector',
  'severity',
  'source-type',
  'status',
];

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'rogue-agents-dashboard sync-data' } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

function stable(value) {
  return JSON.stringify(value, null, 2) + '\n';
}

async function resolveCommit() {
  // Best effort: record the exact upstream commit for provenance. Falls back to
  // the ref name if the API is unreachable (rate limit, offline mirror).
  try {
    const headers = { 'user-agent': 'rogue-agents-dashboard sync-data' };
    if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetch(`${API}/commits/${REF}`, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    return { sha: json.sha, date: json.commit?.committer?.date ?? null };
  } catch {
    return null;
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  const [incidents, summary, schema, commit] = await Promise.all([
    fetchJson(`${RAW}/dist/incidents.json`),
    fetchJson(`${RAW}/dist/summary.json`),
    fetchJson(`${RAW}/schema/incident.schema.json`),
    resolveCommit(),
  ]);

  if (!Array.isArray(incidents)) throw new Error('incidents.json is not an array');
  if (typeof summary?.dataset_version !== 'string') throw new Error('summary.json missing dataset_version');

  const taxonomy = {};
  for (const name of TAXONOMY_FILES) {
    const doc = parseYaml(await fetchText(`${RAW}/taxonomy/${name}.yml`));
    taxonomy[doc.key] = {
      title: doc.title,
      values: (doc.values ?? []).map((v) => ({
        id: String(v.id),
        label: v.label,
        description: String(v.description ?? '').trim(),
      })),
    };
  }

  const previous = existsSync(path.join(OUT, 'SNAPSHOT.json'))
    ? JSON.parse(readFileSync(path.join(OUT, 'SNAPSHOT.json'), 'utf8'))
    : null;

  const snapshot = {
    source_repo: `https://github.com/${UPSTREAM_REPO}`,
    source_ref: REF,
    source_commit: commit?.sha ?? null,
    source_commit_date: commit?.date ?? null,
    dataset_version: summary.dataset_version,
    schema_id: schema.$id ?? null,
    total: incidents.length,
    fetched_at: new Date().toISOString().slice(0, 10),
    files: {
      'incidents.json': `${RAW}/dist/incidents.json`,
      'summary.json': `${RAW}/dist/summary.json`,
      'incident.schema.json': `${RAW}/schema/incident.schema.json`,
      'taxonomy.json': `${RAW}/taxonomy/*.yml`,
    },
    data_license: 'CC-BY-SA-4.0',
    attribution: 'Agentic Attack Index (MLSecOpsHub) — https://github.com/MLSecOpsHub/agentic-attack-index',
  };

  const contentChanged =
    !previous ||
    stable(incidents) !== safeRead('incidents.json') ||
    stable(summary) !== safeRead('summary.json') ||
    stable(schema) !== safeRead('incident.schema.json') ||
    stable(taxonomy) !== safeRead('taxonomy.json');

  if (!contentChanged && !process.env.FORCE_SNAPSHOT) {
    // Keep the previous fetch date so an unchanged dataset produces no diff.
    console.warn(`sync-data: snapshot already matches upstream ${REF} (dataset ${summary.dataset_version}); nothing written.`);
    return;
  }

  writeFileSync(path.join(OUT, 'incidents.json'), stable(incidents));
  writeFileSync(path.join(OUT, 'summary.json'), stable(summary));
  writeFileSync(path.join(OUT, 'incident.schema.json'), stable(schema));
  writeFileSync(path.join(OUT, 'taxonomy.json'), stable(taxonomy));
  writeFileSync(path.join(OUT, 'SNAPSHOT.json'), stable(snapshot));
  console.warn(
    `sync-data: wrote ${incidents.length} records, dataset ${summary.dataset_version}, ` +
      `ref ${REF}${commit ? ` @ ${commit.sha.slice(0, 12)}` : ''}`,
  );
}

function safeRead(name) {
  const p = path.join(OUT, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

main().catch((err) => {
  console.error(`sync-data: FAIL — ${err.message}`);
  process.exit(1);
});
