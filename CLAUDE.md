# CLAUDE.md — rogue-agents-dashboard

Static, client-side dashboard ("Rogue Agent Watch") that renders the
[Agentic Attack Index](https://github.com/MLSecOpsHub/agentic-attack-index)
dataset of AI-agent-executed cyberattacks and rogue-agent incidents. This repo
is the **presentation layer only**. The dataset is the product; trust is the
product. Read the non-negotiables before changing anything.

## Non-negotiables (inherited from the data layer)

1. **Never edit, enrich, annotate, or infer incident facts.** Corrections go
   upstream as issues or PRs to `agentic-attack-index`. Every incident page has
   a "Report a correction" link that opens an upstream issue pre-filled with
   the record `id` (`correctionIssueUrl` in `src/config.ts`).
2. **Render grades honestly.** `status`, `confidence`, and `ai_role` are shown
   on every card, row, and detail page with the upstream taxonomy definition as
   tooltip. Never collapse `reported` and `confirmed` into one visual. Never
   compute or display a score the dataset does not contain.
3. **Attribution as stated.** Show `actor` verbatim; `Unknown` stays `Unknown`.
   No inferred country of origin from actor names.
4. **Defensive framing only.** Display lifecycle phases and framework mappings.
   Never add exploit detail, payloads, or prompts to any page text.
5. **Victim respect.** Only names present in the dataset appear.
6. **No runtime network dependency for data.** The site builds and runs from
   `data/snapshot/`. The only fetch that leaves the origin is the optional,
   user-initiated "check upstream for a newer dataset" button.
7. **Privacy.** No analytics, trackers, cookies, or external fonts.
8. **`null` means "not stated", never `0`.** `autonomy_pct`, `orgs_affected`,
   `records_exfiltrated` render as "not stated" when null.
9. **Geo is never fabricated.** Markers come only from a record's
   `geo.points[]` (upstream schema 0.3.0; the old `geo.target` / `geo.origin`
   slots are gone). Every point is shown with its `role`, its `basis` (why it
   exists, from the `geo_basis` taxonomy) and `attributed_by` (the cited
   publisher that stated it); a state sponsor is never presented as an
   operator location. `illustrative: true` points render as soft discs and say
   "illustrative, country-level centroid" in tooltips; `stated-location`
   points render as pins; records without `geo` are listed under the map,
   never plotted.
10. **Retracted and superseded records** are flagged and excluded from headline
    counts by default, with a toggle to include them. Missing `record_status`
    means `active`.

## Architecture decisions (settled, do not relitigate)

- Vite + TypeScript, vanilla DOM (`src/util/dom.ts` `h()` helper). No UI
  framework. Text is inserted as text nodes, never `innerHTML`, because every
  string comes from an external dataset.
- Charts and map: d3 modules (`d3-geo`, `d3-scale`, `d3-array`, `d3-shape`)
  plus `topojson-client` with vendored Natural Earth 110m geometry in
  `data/geo/`. No Chart.js, no Leaflet, no tile servers.
- Hash routing (`#/`, `#/map`, `#/timeline`, `#/table`, `#/stats`, `#/about`,
  `#/incident/<id>`). Incident URLs carry the upstream `id` unchanged.
- Data: `data/snapshot/` holds vendored `incidents.json`, `summary.json`,
  `incident.schema.json`, `taxonomy.json` (upstream taxonomy YAML flattened),
  and `SNAPSHOT.json` (source URL, ref, commit, dataset_version, fetch date).
  Only `scripts/sync-data.mjs` writes there. `scripts/validate-data.mjs`
  validates with ajv + ajv-formats (same stack as upstream) and fails the build
  on drift.
- Stats use `summary.json` rollups verbatim. Only when a retracted/superseded
  record exists are headline counts recomputed client-side, with a visible note.
- Deterministic build: same snapshot, same bytes. No build-time timestamps.
  CI builds twice and diffs.
- Dark by default for every visitor (the bare `:root` is the dark token set;
  the OS preference is not consulted), light via the header toggle stored in
  `localStorage`; responsive to 400 px, keyboard-navigable, WCAG AA.
- Bundle budget: core JS+CSS under 500 KB gzipped, map geometry chunk excluded
  (`npm run size`).
- Deployed to GitHub Pages by `.github/workflows/pages.yml` (Source = GitHub
  Actions). Served under `/rogue-agents-dashboard/`; override with
  `VITE_BASE_PATH`, and `VITE_SITE_URL` for share links and Open Graph tags.
- The landing page keeps exactly one hero figure, bound to the map teaser's
  replay, with the status / AI-role split in the first viewport.
- Map encoding is fixed: hue = `ai_role`
  (one validated ordinal ramp), ring = `status`, size = `severity`, soft disc =
  illustrative centroid, pin = stated location. Category is never a map hue
  (it fails all-pairs colour-blind separation). Records without `geo` go in
  the field log.
- Every route and every record is also a real, hash-free page, prerendered at
  build time by `scripts/prerender.mjs` + `scripts/prerender-pages.mjs`:
  `/`, `/map/`, `/timeline/`, `/table/`, `/techniques/`, `/stats/`, `/about/`,
  `/incident/<id>/`. Each is the Vite-built shell with its own head (title,
  description, canonical, hreflang, Open Graph, JSON-LD) and the view's
  content as static HTML inside `#app`, so crawlers that do not run
  JavaScript (AI crawlers in particular) read the content; the app then boots
  in place (`src/router.ts` reads the path when there is no hash). Never add
  a meta refresh or a script redirect to these pages: search engines treat
  an instant redirect as a redirect and drop the page. Static content is
  generated from the snapshot only, escaped, with grades shown next to their
  upstream definitions; the hash-free URL is the canonical one.
- The rest of the prerender output: PNG cards via resvg with the vendored OFL
  fonts in `assets/fonts/`, `feed.atom`, `changes.json`, `sitemap.xml` (every
  page, with card images), `robots.txt` (AI crawlers allowed by name),
  `llms.txt` and `llms-full.txt`, one schema.org graph on the landing page
  (`WebSite`, `Organization`, `Dataset` with `hasPart`, `ItemList`),
  `Article` + `BreadcrumbList` per record, `DefinedTermSet` for the grading
  vocabularies on `/about/`, ATT&CK and ATLAS Navigator layers, a static MISP
  feed with v5 UUIDs. Fonts are build-time only; the site still uses the
  system font stack. Every "modified" date is derived from the data, never
  the clock.
- Every number on the Techniques and Stats pages is a count over records.
  Coverage tables state how many records carry a field; a gap is a missing
  value upstream, never zero.
- `npm test` runs axe-core structural checks over every view (jsdom, contrast
  excluded); CI runs Lighthouse with score thresholds on the built site.

## Repo map

```
index.html                 Shell; mounts src/main.ts
src/main.ts                Boot: theme, dataset, router, view dispatch
src/router.ts              Hash route parsing and href builders
src/config.ts              Upstream URLs, correction-issue URL, site constants
src/filters.ts             Filter state, URL (de)serialisation, sorting
src/data/types.ts          Raw (schema) and normalised record types
src/data/adapter.ts        normalizeIncident / buildDataset / countBy
src/data/load.ts           Imports the vendored snapshot (bundled at build)
src/data/taxonomy.ts       Label and definition lookups
src/data/links.ts          Official URLs for ATLAS, ATT&CK, OWASP, NVD, AIID
src/components/            badges (grade strip, cards), charts (d3 bars),
                           filters panel, layout (header/footer/theme),
                           map-canvas (shared map drawing + encoding),
                           map-teaser (landing hero map bound to the figure),
                           replay (map scrubber), drawer (incident panel),
                           changes (what-changed strip),
                           upstream-check (the one optional fetch)
src/util/share.ts          Share URL, caption, clipboard helper
src/embed.ts, embed.html   Second Vite entry: map-only iframe embed
src/views/                 overview, map, timeline, table, techniques, stats,
                           incident, about, not-found, shared rollups
src/components/matrix.ts   Crosstab table (counts, totals, filtered-table links)
src/data/coverage.ts       Field coverage, evidence summary (counts, no scores)
src/styles.css             Theme tokens and all styling
data/snapshot/             Vendored dataset (sync-data only)
data/geo/                  Vendored world-atlas 110m topojson
scripts/sync-data.mjs      Fetch upstream artifacts, write snapshot
scripts/validate-data.mjs  Schema + consistency validation (hermetic)
scripts/bundle-size.mjs    Gzip report and budget gate
scripts/prerender.mjs      Post-build: share pages, OG cards, feed, changes.json
assets/fonts/              OFL fonts for card rendering (build-time only)
tests/                     vitest: adapter, schema, router, filters, csv, smoke
.github/workflows/         ci.yml, pages.yml, sync-data.yml
```

## Commands

```sh
npm ci
npm run dev            # dev server
npm test               # typecheck + lint + validate:data + vitest (hermetic)
npm run build          # validate:data + vite build + prerender -> dist/
npm run prerender      # share pages, cards, feed (needs an existing dist/)
npm run preview        # serve dist/
npm run size           # bundle report and budget
npm run sync:data      # refresh data/snapshot from upstream (network)
npm run validate:data  # schema validation only
```

## Working rules for agents

- Do not touch `data/snapshot/` by hand. Run `npm run sync:data`.
- When upstream schema or taxonomy changes, update `src/data/types.ts`, the
  adapter, `scripts/sync-data.mjs` (taxonomy file list), and the tests; never
  patch the snapshot to fit the code.
- Every new view or component must show the three grades and pass
  `tests/smoke.test.ts` for every id in `summary.json`.
- Keep `npm test` hermetic. Anything that needs the network goes in a script
  or a scheduled workflow, not in tests.
- Use Conventional Commits.
