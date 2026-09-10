#!/usr/bin/env node
// Validate the vendored snapshot against the vendored upstream JSON Schema and
// cross-check internal consistency. Hermetic: reads only data/snapshot/.
//
// Fails loudly on schema drift so the site never renders garbage. Uses the same
// validator stack as upstream (ajv 2020-12 + ajv-formats).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SNAP = path.join(ROOT, 'data', 'snapshot');

const read = (name) => JSON.parse(readFileSync(path.join(SNAP, name), 'utf8'));

const errors = [];
const schema = read('incident.schema.json');
const incidents = read('incidents.json');
const summary = read('summary.json');
const snapshot = read('SNAPSHOT.json');
const taxonomy = read('taxonomy.json');

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

if (!Array.isArray(incidents)) errors.push('incidents.json: not an array');

const ids = new Set();
for (const record of incidents) {
  const label = record?.id ?? '<no id>';
  if (!validate(record)) {
    for (const err of validate.errors ?? []) {
      errors.push(`${label}: ${err.instancePath || '/'} ${err.message}`);
    }
  }
  if (ids.has(record.id)) errors.push(`${label}: duplicate id`);
  ids.add(record.id);
}

// Cross-references must resolve (the dashboard links them without checks).
for (const record of incidents) {
  for (const ref of record.related ?? []) {
    if (!ids.has(ref)) errors.push(`${record.id}: related "${ref}" does not resolve`);
  }
  if (record.superseded_by && !ids.has(record.superseded_by)) {
    errors.push(`${record.id}: superseded_by "${record.superseded_by}" does not resolve`);
  }
  // Never fabricate geo: if present it must be a proper point (schema covers
  // shape; this guards against a target/origin block that is present but null).
  if (record.geo && record.geo.target === null) {
    errors.push(`${record.id}: geo.target is null (omit the key instead)`);
  }
}

// summary.json must agree with incidents.json.
if (summary.total !== incidents.length) {
  errors.push(`summary.total (${summary.total}) != incidents.json length (${incidents.length})`);
}
const summaryIds = new Set(summary.ids ?? []);
for (const id of ids) if (!summaryIds.has(id)) errors.push(`summary.ids missing "${id}"`);
for (const id of summaryIds) if (!ids.has(id)) errors.push(`summary.ids has unknown "${id}"`);

// SNAPSHOT.json provenance must match the artifacts it describes.
if (snapshot.dataset_version !== summary.dataset_version) {
  errors.push(`SNAPSHOT.dataset_version (${snapshot.dataset_version}) != summary.dataset_version (${summary.dataset_version})`);
}
if (snapshot.total !== incidents.length) {
  errors.push(`SNAPSHOT.total (${snapshot.total}) != incidents.json length (${incidents.length})`);
}
if (schema.$id && summary.schema && schema.$id !== summary.schema) {
  errors.push(`schema $id (${schema.$id}) != summary.schema (${summary.schema})`);
}

// Taxonomy must cover every schema enum value the UI labels.
const enumFromSchema = {
  category: schema.properties.category.enum,
  actor_type: schema.properties.actor_type.enum,
  status: schema.properties.status.enum,
  confidence: schema.properties.confidence.enum,
  severity: schema.properties.severity.enum,
  model_families: schema.properties.model_families.items.enum,
  lifecycle_phases: schema.properties.lifecycle_phases.items.enum,
  source_type: schema.properties.sources.items.properties.type.enum,
  autonomy_level: schema.properties.autonomy_level.enum,
  guardrail_bypass: schema.properties.guardrail_bypass.items.enum,
  ai_role: schema.properties.ai_role.enum,
  record_status: schema.properties.record_status.enum,
};
for (const [key, values] of Object.entries(enumFromSchema)) {
  const tax = taxonomy[key];
  if (!tax) {
    errors.push(`taxonomy.json: missing "${key}"`);
    continue;
  }
  const have = new Set(tax.values.map((v) => v.id));
  for (const v of values) if (!have.has(v)) errors.push(`taxonomy.json ${key}: missing "${v}"`);
}

if (errors.length) {
  console.error(`validate-data: FAIL — ${errors.length} error(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
console.log(
  `validate-data: OK — ${incidents.length} record(s) valid against ${path.basename(schema.$id ?? 'schema')}, ` +
    `dataset ${summary.dataset_version}, snapshot ref ${snapshot.source_ref}` +
    (snapshot.source_commit ? ` @ ${String(snapshot.source_commit).slice(0, 12)}` : ''),
);
