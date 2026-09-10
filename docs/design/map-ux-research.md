# Map UX research and design decisions

*Rogue Agent Watch, map view. Research done 2026-09-10; design implemented in
the same change. A working prototype of this design, built from the real
snapshot, was published as a design brief before implementation.*

## The question

How should a map of AI-agent cyber incidents look and behave so that people
share it and come back to it, without becoming the kind of "cyber attack map"
that practitioners deride, and without breaking the project's non-negotiables
(grades always visible, no fabricated geo, no runtime network, no trackers, no
facts the dataset does not contain).

## What the research says

| Finding | Source | Design consequence |
|---|---|---|
| Norse's 2016 map went viral on animated arcs over a dark globe, then the company collapsed. It showed traffic hitting Norse's own honeypots; "the map was more cinema than science". | CloudTweaks 2026; Krebs on Security | Keep the dark world and the arcs, but every arc joins two points the dataset states and every mark names its record and evidence grade on hover. Cinema with citations. |
| Security practitioners deride "pew-pew" maps as "useless, misleading, or just a ploy to entertain the technically clueless": attackers use distributed cloud infrastructure, and physical geography says little about risk. | Stranded on Pylos, 2020 | Geography is demoted to context. The primary hue encodes how load-bearing the AI was, the ring encodes evidence, and records with no location live in a field log beside the map instead of vanishing. |
| The maps that survived (Check Point ThreatCloud, Digital Attack Map, Bitdefender) are praised for historical playback, granular filters, country drill-down, and separating "active" from "confirmed". | CloudTweaks 2026; CSO Online | A replay scrubber over disclosure dates; filter chips; confirmed / reported / test-eval drawn on the mark itself, never collapsed into one colour. |
| Flightradar24, Windy, and MarineTraffic keep people looking because they "make a hidden system visible", need no onboarding or account, and "reward aimless looking". | Webiano on Flightradar24 | The view opens already populated with a hero count and a play button. Hover tells a one-line story; nothing needs a click to be understood. |
| GitHub's homepage globe only worked once it had "proof of life": clear hover states naming the pull request, repo, and timestamp, with every arc clickable. | GitHub Engineering blog | Every mark and arc is a button. Click opens a drawer with the full record, sources, and archive status, without leaving the map. |
| In 2026 the unit that travels on social feeds is the card: build-time Open Graph images, one per URL, with absolute image URLs, because crawlers do not run client-side JavaScript. | OGMagic; ScreenshotOne; LogRocket | A per-incident share card and a prerendered per-incident HTML page with Open Graph and Twitter tags, generated at build time from the snapshot. |
| SOC-facing dashboards favour dark surfaces, a summary before the detail, and drill-down that pivots across entities without leaving the view. | Aufait UX; Medium case study | Dark map surface in dark theme, hero count above the map, drawer with entity links back into the filters. |
| APTmap, the reference for the product's shape, is static HTML with a map, entity pages, a relationship graph and stats over committed JSON, and states plainly that attribution "may be wrong, outdated, or may change". | APTmap README | Same architecture class as this site; its honesty statement is the tone to match. No server is needed for anything in this design. |

Sources: [The Unbearable Frequency of PewPew Maps](https://pylos.co/2020/06/16/the-unbearable-frequency-of-pewpew-maps/) · [What Cyber Threat Maps Really Show](https://cloudtweaks.com/2026/04/cyber-threat-maps-show/) · [8 top cyber attack maps](https://www.csoonline.com/article/562681/8-top-cyber-attack-maps-and-how-to-use-them-2.html) · [RedTorch Formed from Ashes of Norse Corp](https://krebsonsecurity.com/2021/03/redtorch-formed-from-ashes-of-norse-corp/) · [How we built the GitHub globe](https://github.blog/engineering/engineering-principles/how-we-built-the-github-globe/) · [Flightradar24 is the web's window into the sky](https://webiano.digital/flightradar24-is-the-webs-window-into-the-sky/) · [The Complete Guide to Open Graph Images in 2026](https://ogmagic.dev/blog/complete-guide-open-graph-images) · [APTmap](https://github.com/andreacristaldi/APTmap) · [Cybersecurity Dashboard UI/UX Design](https://www.aufaitux.com/blog/cybersecurity-dashboard-ui-ux-design/)

## Critique of the previous map

Everything it said was true, and nothing about it asked to be shared.

- No story and no time: five rings appeared at once; the dataset's strongest narrative (disclosures accelerating through 2025) lived only on the timeline page.
- The wrong variable in colour: hue encoded target versus origin, the least interesting fact in a record, while the grades sat in a card list below the fold.
- Dashed rings read as "selected", not "approximate". A soft disc is the conventional glyph for positional uncertainty.
- Seven of eleven records were invisible until the reader scrolled to a plain list.
- Clicking navigated away, so every curiosity threw the reader out of the map.
- No shareable unit: no card, no embed, no per-incident preview. A link to `#/map` unfurled as the site's generic description.

## Encoding

The map is an all-pairs form: any two marks can sit side by side, so the palette
has to pass colour-blindness separation for every pair, not only neighbours. It
was validated with the dataviz palette validator (OKLab, Machado 2009 CVD
simulation), not by eye.

| Channel | Variable | Why |
|---|---|---|
| Hue, one ordinal ramp | `ai_role`: incidental → significant → load-bearing; disputed and unknown in neutral grey | Ordinal, so one hue with monotone lightness is the correct form. It is also the dataset's headline question. |
| Ring style | `status`: solid confirmed, dashed reported, dotted test-eval | Matches the timeline view. Evidence drawn on the mark, never folded into colour. |
| Shape | Soft disc = illustrative centroid; pin with a white ring = stated location | Uncertainty looks uncertain. The disc's size is fixed and carries no meaning. |
| Size | `severity`, four steps | Ordinal; radius is the cheapest honest channel left. |
| Arc | origin → target when both are stated | Animated dash gives "proof of life"; direction reads from dash travel. Disabled under `prefers-reduced-motion`. |
| Label | kind (origin / target) in small caps under the mark | Removes the target-versus-origin legend entirely. |

Validator results (surfaces: light map `#e4ecf2`, dark map `#0e1720`):

- **FAIL** — the previous five category colours as map hues: worst pair ΔE 3.1 under deuteranopia and 7.7 in normal vision against floors of 8 and 15; one colour below the chroma floor. Category therefore stays off the map's colour channel (it remains in badges, filters, and the timeline lanes).
- **PASS** — AI-role ramp, ordinal checks in both modes: monotone lightness, every step gap above 0.06, single hue, pale end 2.5:1 (light) and 3.3:1 (dark) on the map surface.

Tokens (`src/styles.css`): `--role-load-bearing`, `--role-significant`,
`--role-incidental`, `--role-none` for both themes; map surfaces
`--map-sphere`, `--map-land`, `--map-land-stroke`, `--map-graticule`. The site
accent stays reserved for controls and the "latest" pulse; it is not a data
colour.

## What was implemented

| # | Change | Where |
|---|---|---|
| 1 | Encoding and marks: role ramp, status rings, severity radius, halo versus pin, kind labels, animated arcs, new legend with inline-SVG swatches | `src/views/map.ts`, `src/styles.css` |
| 2 | Field log beside the map (every record, date-ordered, with grades and an on-map / no-geo tag), replay scrubber with play and a "latest" pulse, filter chips for AI role and evidence, all state in the hash query (`ai_role`, `status`, `inactive`, `t=YYYY-MM`, `open=<id>`) | `src/views/map.ts`, `src/components/replay.ts` |
| 3 | Drawer instead of navigation: grades, actor verbatim, summary, sources with archive status, citation, permalink, correction link, copy share link and caption | `src/components/drawer.ts` |
| 4 | Prerender at build: per-incident HTML with Open Graph and Twitter tags that redirects to the hash route, a 1200×630 PNG card per incident and one for the site, site-level tags injected into `index.html`. Rendered with resvg from vendored OFL fonts, system fonts disabled, so builds stay byte-identical | `scripts/prerender.mjs`, `assets/fonts/` |
| 5 | Share (link and caption on the record page and in the drawer), `embed.html` entry for iframes, static Atom feed and `changes.json` | `src/util/share.ts`, `src/embed.ts`, `embed.html`, `scripts/prerender.mjs` |
| 6 | "What changed" strip under the map: latest additions, revisions, and non-active records, from `added.date`, `revisions[]`, and `record_status` | `src/components/changes.ts` |

Not changed, deliberately:

- **No WebGL globe.** It hides half the world, costs hundreds of kilobytes, and for five points buys nothing but the Norse silhouette this project argues against.
- **No tile map or zoom.** Every coordinate in the dataset is a country-level centroid flagged illustrative; street-level zoom would advertise precision the data does not have.
- **No typeface change on the site.** The brief proposed Barlow Condensed for headlines. Rule 7 forbids external fonts at runtime, so adopting it would mean vendoring woff2 files and a site-wide identity change; the vendored TTFs are used only for the share cards. This is a maintainer decision, recorded here rather than made quietly.
- **No live feed, accounts, or analytics.** Retention comes from the data changing and the page saying so.

## Retention without accounts, feeds, or dark patterns

- Open on the newest thing: the map loads at the end of the replay with the latest disclosure pulsing.
- The "what changed" strip shows the last additions and revisions with dates.
- From the drawer, the full record page's entity links carry the reader back into filtered views; every filtered view is a URL.
- Replay is the ritual: a few seconds of watching the year fill in is the moment people record and post.
- Machine readers are viewers too: `feed.atom` and `changes.json` are static files from the build.
- Say what is not on the map. The "N records have no geo block" sentence stays.

## Measuring without trackers

There are no session or retention numbers, by design. What can be observed:
GitHub Pages referrer counts in the repository's traffic view; link previews
checked with the platforms' validators before merging a sync PR; feed and
share-link requests in CDN logs if the site ever sits behind one. Report those
in the sync PR body so the number sits beside the data change that caused it.

## Accessibility notes

Marks and arcs are keyboard-focusable buttons with the same tooltip on focus as
on hover; the drawer is a labelled dialog closed by Escape; the field log is the
table twin of the map so no value is colour-only; the replay control is an
`input[type=range]` with `aria-valuetext`; arc travel and pulses are disabled
under `prefers-reduced-motion`; the role ramp and text inks were checked for
contrast in both themes.
