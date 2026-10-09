# rogue-agents-dashboard

**Rogue Agent Watch**: a static, client-side dashboard for the
[Agentic Attack Index](https://github.com/MLSecOpsHub/agentic-attack-index),
MLSecOpsHub's source-linked dataset of real-world cyberattacks executed or
orchestrated by AI agents, and of rogue-agent incidents (an agent wiping a
production database, an agent hijacked through indirect prompt injection,
AI-orchestrated espionage, agentic supply-chain compromise).

This repository is the **presentation layer**. It renders the dataset and adds
no facts of its own. The dataset, its grading, its sources, and its governance
live upstream.

> Screenshot placeholder: `docs/screenshot.png` (overview with the
> status / AI-role honesty split, the map, and a record page).

## What you get

| Route | View |
|---|---|
| `#/` | Overview: one hero figure bound to a live map teaser with replay, the verification-status / AI-role honesty split, latest disclosures and what changed, then category, model family, autonomy level, and year |
| `#/map` | World map of records that carry stated coordinates, replayed by disclosure date, with a field log of every record beside it; colour is AI role, ring is evidence, size is severity, a soft disc marks a country-level centroid and a pin a stated location; every point carries the basis it rests on and the publisher that stated it (upstream `geo.points[]`), shown in the tooltip and the drawer; click opens the record in a drawer; "what changed" strip below |
| `#/timeline` | Records by disclosure date, lane per category, outline by status, filterable |
| `#/table` | Sortable, filterable by every enum field, full-text search, CSV/JSON download of the filtered view (the CSV carries the upstream `geo_points` column: `role:basis:country` per map point) |
| `#/incident/<id>` | Every field, grade badges with upstream definitions, lifecycle strip, map points with their basis and the publisher that stated them, mappings linked to MITRE ATLAS / ATT&CK / OWASP / NVD / AIID, every source with archive link, related records, record-status banner, citation box, "report a correction" |
| `#/techniques` | The technique lens: MITRE ATLAS and ATT&CK ids with the records behind each, OWASP and CVE tables, Navigator layer downloads, model family × guardrail bypass and × AI role crosstabs, sourcing per family, lifecycle × category |
| `#/stats` | All rollups from the upstream `summary.json`, plus a dataset-gaps table (field coverage), archive coverage, and map coverage (`geo_coverage`: points by role and by basis) |
| `#/about` | What counts as an incident, the grading scales, the illustrative-geo rule, corrections, licences |

Every card, row, and page shows `status`, `confidence`, and `ai_role`. Nulls
render as "not stated", never as zero. Retracted and superseded records are
flagged and excluded from headline counts by default, with a toggle.

## Sharing, embedding, subscribing

Built at build time from the snapshot, no server involved:

- `incident/<id>/` — a real page per record: the full record (grades with
  their upstream definitions, summary, facts as stated, mappings, map points,
  every source) in static HTML, Open Graph and Twitter tags, a 1200×630 card
  (`og/<id>.png`), `Article` and `BreadcrumbList` JSON-LD, and the app booting
  in place (no redirect, so search engines index the page itself). Every
  record page and the map drawer have "Copy share link" and "Copy caption".
- `map/`, `timeline/`, `table/`, `techniques/`, `stats/`, `about/` — the same
  for every view: a hash-free canonical URL whose static HTML carries the
  view's content for crawlers that do not run JavaScript, then the live view.
  `about/` also carries the grading vocabularies as `DefinedTermSet` JSON-LD.
- `llms.txt` and `llms-full.txt` — an index of the site and the full text of
  every record in Markdown, for AI assistants and agents.
- `embed.html#/map` — the map and field log alone, for iframes. Filters and
  replay position travel in the hash: `embed.html#/map?ai_role=load-bearing&t=2025-08`.
- `feed.atom` — Atom feed of records, newest additions first.
- `changes.json` — latest additions, revisions, and record-status changes.
- `navigator/attack-layer.json`, `navigator/atlas-layer.json` — MITRE ATT&CK
  (layer format 4.5) and ATLAS (4.3) Navigator layers; score = number of
  records carrying the technique, comment = record ids.
- `misp/` — a static MISP feed (`manifest.json`, one event per record,
  `hashes.csv`). In MISP add a feed with the URL `…/misp/` (the directory).
  Tags carry the grades and technique ids; attributes carry the record links,
  summary, actor as stated, source URLs, and CVEs.
- `sitemap.xml` (every page, with the card images), `robots.txt` (crawling
  allowed, the AI crawlers named explicitly), and on the landing page one
  schema.org graph: `WebSite`, `Organization`, `Dataset` (with every record as
  `hasPart`) and the ordered `ItemList`, for search engines, AI answer engines
  and Google Dataset Search.
- The upstream `dist/stix/bundle.json` (STIX 2.1) imports into OpenCTI.

Design and product research notes are kept outside the repository.

## How data flows

```
agentic-attack-index (upstream, CC BY-SA 4.0)
  data/incidents/*.yml  ─ build ─▶  dist/incidents.json, dist/summary.json,
                                    schema/incident.schema.json, taxonomy/*.yml
                                              │
                        scripts/sync-data.mjs │  (weekly workflow or `npm run sync:data`)
                                              ▼
rogue-agents-dashboard   data/snapshot/{incidents,summary,incident.schema,taxonomy,SNAPSHOT}.json
                                              │
                   scripts/validate-data.mjs  │  ajv 2020-12 + ajv-formats; build fails on drift
                                              ▼
                         vite build  ─▶  dist/  ─▶  GitHub Pages
```

- The site makes **no runtime network request for data**. Everything is
  bundled from the vendored snapshot. The footer's "check upstream for a newer
  dataset" button is the only fetch that leaves the origin, and only when you
  click it.
- `SNAPSHOT.json` records the upstream ref, commit, dataset version, and fetch
  date; the footer shows the dataset version and archive coverage as a trust
  signal.
- The data contract is upstream schema 0.3.0: map points live in
  `geo.points[]`, each with `role`, `basis` (`taxonomy/geo-basis.yml`),
  `attributed_by`, `country`, `lat`, `lng`, `label`, and `illustrative`; the
  old `geo.target` / `geo.origin` slots are gone. `scripts/validate-data.mjs`
  mirrors the upstream point rules (basis allowed for the role, `attributed_by`
  is a cited publisher, centroids are illustrative) and checks
  `summary.geo_coverage` against the records, so a contract change fails the
  sync instead of rendering a wrong point.
- A scheduled workflow (`sync-data.yml`) refreshes the snapshot weekly and
  opens (or updates) a single PR on `chore/sync-data` when it changed. If the
  new snapshot fails validation it opens one tracked issue instead.

## Running it

```sh
nvm use            # Node 20.19
npm ci
npm run dev        # http://localhost:5173/
npm test           # typecheck + lint + snapshot validation + unit tests incl. axe-core checks (hermetic)
npm run build      # validates, then builds dist/ (reproducible)
npm run preview    # serves dist/
npm run size       # gzipped bundle report; core must stay under 500 KB
npm run sync:data  # refresh data/snapshot from upstream main (network)
```

## Reporting a data correction

Open the record page and use **Report a correction**. It opens an issue in the
upstream repository pre-filled with the record id, using the
[data-correction template](https://github.com/MLSecOpsHub/agentic-attack-index/issues/new?template=data-correction.yml).
Add the affected field, why it is wrong, and supporting sources. Corrections
without sources can only remove claims, not change them. Fixes reach this site
on the next snapshot sync. Rendering bugs belong in this repository's issues.

## Deploying

The `pages.yml` workflow builds and deploys `dist/` on every push to `main`.
One-time setup in the GitHub repository:

1. Settings → Pages → Build and deployment → **Source: GitHub Actions**.
2. Settings → Actions → General → Workflow permissions → enable
   **Allow GitHub Actions to create and approve pull requests** (needed by the
   weekly `sync-data` workflow).

The asset base path and the canonical URL (share links, Open Graph tags,
feed, sitemap) are resolved together in `scripts/site-env.mjs`:

- **Local** (`npm run dev`, a plain `npm run build`): served at `/`, and the
  canonical URL is the preview address `http://localhost:4173/`. A build with
  no deploy environment is a local one, so its share links say so rather
  than pointing at a host it was not built for.
- **GitHub Pages**: no configuration. The workflow build derives
  `/<repo>/` and `https://<owner>.github.io/<repo>/` from
  `GITHUB_REPOSITORY`, so renaming the repository needs no code change.
- **Vercel**: no configuration. The build detects Vercel's environment,
  serves at `/`, and uses the production host (or the preview deployment's
  host) as the canonical URL. `vercel.json` adds the CORS header the
  Navigator layers and MISP feed need, and long-lived caching for hashed
  assets.
- **Custom domain anywhere**: set `VITE_BASE_PATH=/` and
  `VITE_SITE_URL=https://your.domain/` in the build step; explicit values
  always win.

## Licences

- **Code** in this repository: [MIT](LICENSE).
- **Data** displayed by this dashboard and vendored under `data/snapshot/`:
  the [Agentic Attack Index](https://github.com/MLSecOpsHub/agentic-attack-index)
  by MLSecOpsHub, licensed
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Reuse,
  including screenshots and exports, must attribute "Agentic Attack Index
  (MLSecOpsHub)" with a link and be shared alike.
- **Map geometry** under `data/geo/`: Natural Earth (public domain) via
  [world-atlas](https://github.com/topojson/world-atlas) (ISC).
- **Fonts** under `assets/fonts/`: Barlow, Barlow Condensed, IBM Plex Mono,
  SIL Open Font License 1.1, used only at build time to render share cards.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the non-negotiables and
[SECURITY.md](SECURITY.md) for the security and content policy.
