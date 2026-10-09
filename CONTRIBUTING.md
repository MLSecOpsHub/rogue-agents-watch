# Contributing to rogue-agents-dashboard

Thanks for helping. Before anything else, know which repository you are in:

- **This repo is the presentation layer.** It renders the Agentic Attack Index
  and adds no facts. If you want to fix an incident's name, grade, date,
  source, mapping, or coordinates, that change belongs in
  [agentic-attack-index](https://github.com/MLSecOpsHub/agentic-attack-index).
  Use the "Report a correction" link on any record page; it opens an upstream
  issue pre-filled with the record id.
- **Rendering, accessibility, performance, charts, map, routing, workflows, and
  docs** belong here.

## Non-negotiables

These come from the data layer and hold here too. Pull requests that break one
will not be merged.

1. Never edit, enrich, annotate, or infer incident data. `data/snapshot/` is
   written only by `scripts/sync-data.mjs`; CI fails if it is hand-edited.
2. Render grades honestly. `status`, `confidence`, and `ai_role` appear on every
   card, row, and detail page, with the upstream definition as tooltip. Do not
   merge `reported` into `confirmed` visually. Do not compute or display any
   score the dataset does not contain.
3. Attribution as stated. `actor` is shown verbatim; `Unknown` stays `Unknown`.
   No inferred country of origin.
4. Defensive framing only. Lifecycle phases and mappings, never exploit detail,
   payloads, or prompts.
5. Victim respect. Only names present in the dataset appear.
6. No runtime network dependency for data. The site builds and runs from the
   vendored snapshot. The footer's "check upstream" button is the only code
   path that leaves the origin, and only when clicked.
7. Privacy. No analytics, trackers, cookies, or external fonts.
8. `null` means "not stated". Never render it as `0`.
9. Geo comes only from a record's `geo` block. Illustrative points render
   visibly differently; records without `geo` are listed, never plotted.

## Development

```sh
nvm use            # Node 20.19 (see .nvmrc)
npm ci
npm run dev        # http://localhost:5173/
npm test           # typecheck + lint + snapshot validation + unit tests (no network)
npm run build      # validates the snapshot, then builds dist/
npm run preview    # serves dist/
npm run size       # gzipped bundle report + 500 KB budget check
```

Refreshing the dataset snapshot (the only step that uses the network):

```sh
npm run sync:data                 # from upstream main
DATA_REF=v0.3.0 npm run sync:data # from a tag
npm test
```

A scheduled workflow does this weekly and opens a PR on `chore/sync-data`.

## Pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore(data):`, `ci:`).
- Keep `npm test` green and the build reproducible (CI builds twice and diffs).
- Any new view must render every incident with its three grades and must work
  at 400 px wide, with a keyboard, and in both themes.
- No new runtime dependencies without a reason in the PR description. The core
  bundle must stay under 500 KB gzipped, map geometry excluded.
- Do not add screenshots or exports that contain dataset content without the
  CC BY-SA 4.0 attribution.

## Repo map

See [CLAUDE.md](CLAUDE.md) for a directory-by-directory map and the data flow.
