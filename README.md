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
| `#/` | Overview: headline count, verification status next to AI role, category, model family, autonomy level, year, most recent records |
| `#/map` | World map of records that carry stated coordinates, replayed by disclosure date, with a field log of every record beside it; colour is AI role, ring is evidence, size is severity, a soft disc marks a country-level centroid; click opens the record in a drawer; "what changed" strip below |
| `#/timeline` | Records by disclosure date, lane per category, outline by status, filterable |
| `#/table` | Sortable, filterable by every enum field, full-text search, CSV/JSON download of the filtered view |
| `#/incident/<id>` | Every field, grade badges with upstream definitions, lifecycle strip, mappings linked to MITRE ATLAS / ATT&CK / OWASP / NVD / AIID, every source with archive link, related records, record-status banner, citation box, "report a correction" |
| `#/stats` | All rollups from the upstream `summary.json` |
| `#/about` | What counts as an incident, the grading scales, the illustrative-geo rule, corrections, licences |

Every card, row, and page shows `status`, `confidence`, and `ai_role`. Nulls
render as "not stated", never as zero. Retracted and superseded records are
flagged and excluded from headline counts by default, with a toggle.

## Sharing, embedding, subscribing

Built at build time from the snapshot, no server involved:

- `incident/<id>/` — a prerendered page per record with Open Graph and Twitter
  tags and a 1200×630 card (`og/<id>.png`), so links unfurl with the grades,
  then redirect to `#/incident/<id>`. Every record page and the map drawer have
  "Copy share link" and "Copy caption".
- `embed.html#/map` — the map and field log alone, for iframes. Filters and
  replay position travel in the hash: `embed.html#/map?ai_role=load-bearing&t=2025-08`.
- `feed.atom` — Atom feed of records, newest additions first.
- `changes.json` — latest additions, revisions, and record-status changes.

The map's design rationale and research are in
[docs/design/map-ux-research.md](docs/design/map-ux-research.md).

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
- A scheduled workflow (`sync-data.yml`) refreshes the snapshot weekly and
  opens (or updates) a single PR on `chore/sync-data` when it changed. If the
  new snapshot fails validation it opens one tracked issue instead.

## Running it

```sh
nvm use            # Node 20.19
npm ci
npm run dev        # http://localhost:5173/rogue-agents-dashboard/
npm test           # typecheck + lint + snapshot validation + unit tests (hermetic)
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

The site is served under `/rogue-agents-dashboard/`. For a custom domain set
`VITE_BASE_PATH=/` and `VITE_SITE_URL=https://your.domain/` in the build step;
the latter is what share links and Open Graph tags use.

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
