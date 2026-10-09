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

// Contract: schema 0.3.0 keeps map points in geo.points[]; the pre-0.3.0
// geo.target / geo.origin slots are gone and this dashboard never reads them.
const geoPointProps = schema.$defs?.geoPoint?.properties;
if (!geoPointProps?.basis?.enum || !schema.properties?.geo?.properties?.points) {
  errors.push('schema: expected geo.points[] with $defs.geoPoint.basis enum (upstream schema 0.3.0)');
}
if (schema.properties?.geo?.properties?.target || schema.properties?.geo?.properties?.origin) {
  errors.push('schema: legacy geo.target / geo.origin slots present; this dashboard reads geo.points[] only');
}
// Which basis a role may carry (taxonomy/geo-basis.yml upstream).
const GEO_BASIS_BY_ROLE = {
  origin: ['sponsor-attribution', 'operator-location', 'actor-location', 'infrastructure', 'stated-location'],
  target: ['victim-location', 'stated-location'],
};
// Bases that claim who or where the actor is; impossible when the actor is unknown.
const ACTOR_CLAIMING_BASES = ['sponsor-attribution', 'operator-location', 'actor-location'];

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
  // Never fabricate geo: the schema covers shape; these mirror the upstream
  // editorial rules (scripts/rules.mjs + test/geo.test.mjs upstream) so a drift
  // upstream fails the build here instead of rendering a wrong point.
  if (record.geo) {
    if ('target' in record.geo || 'origin' in record.geo) {
      errors.push(`${record.id}: legacy geo.target / geo.origin slot; expected geo.points[]`);
    }
    if (!Array.isArray(record.geo.points) || record.geo.points.length === 0) {
      errors.push(`${record.id}: geo.points is empty (omit geo instead)`);
    }
    const publishers = new Set((record.sources ?? []).map((s) => s.publisher));
    for (const p of record.geo.points ?? []) {
      const where = `point "${p.label}"`;
      if (!(GEO_BASIS_BY_ROLE[p.role] ?? []).includes(p.basis)) {
        errors.push(`${record.id}: basis "${p.basis}" is not allowed with role "${p.role}" (${where})`);
      }
      if (!publishers.has(p.attributed_by)) {
        errors.push(`${record.id}: ${where} attributed_by "${p.attributed_by}" does not match any sources[].publisher`);
      }
      if (p.basis === 'stated-location' && p.illustrative !== false) {
        errors.push(`${record.id}: stated-location ${where} requires illustrative: false`);
      }
      if (p.basis !== 'stated-location' && p.illustrative !== true) {
        errors.push(`${record.id}: ${p.basis} ${where} requires illustrative: true (a centroid)`);
      }
      if (p.country === null && p.illustrative !== true) {
        errors.push(`${record.id}: ${where} country may be null only on an illustrative region centroid`);
      }
      if ((record.actor_type === 'researcher' || record.actor_type === 'lab-test-eval') && p.role !== 'target') {
        errors.push(`${record.id}: actor_type "${record.actor_type}" records carry target points only (${where})`);
      }
      if (record.actor_type === 'unknown' && ACTOR_CLAIMING_BASES.includes(p.basis)) {
        errors.push(`${record.id}: ${where} claims ${p.basis} but actor_type is "unknown"`);
      }
    }
  }
}

// summary.json must agree with incidents.json.
if (summary.total !== incidents.length) {
  errors.push(`summary.total (${summary.total}) != incidents.json length (${incidents.length})`);
}
// summary.geo_coverage (counts only) must agree with the points in incidents.json.
const sortKeys = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const tally = (keys) => keys.reduce((acc, k) => ((acc[k] = (acc[k] ?? 0) + 1), acc), {});
const allPoints = incidents.flatMap((r) => r.geo?.points ?? []);
const expectedGeo = {
  records: incidents.filter((r) => (r.geo?.points ?? []).length > 0).length,
  points: allPoints.length,
  illustrative: allPoints.filter((p) => p.illustrative).length,
  by_role: tally(allPoints.map((p) => p.role)),
  by_basis: tally(allPoints.map((p) => p.basis)),
};
if (!summary.geo_coverage) {
  errors.push('summary.json: missing geo_coverage (upstream dataset 0.3.0)');
} else if (JSON.stringify(sortKeys(summary.geo_coverage)) !== JSON.stringify(sortKeys(expectedGeo))) {
  errors.push(`summary.geo_coverage ${JSON.stringify(summary.geo_coverage)} != computed from incidents.json ${JSON.stringify(expectedGeo)}`);
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
  geo_basis: geoPointProps?.basis?.enum ?? [],
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
