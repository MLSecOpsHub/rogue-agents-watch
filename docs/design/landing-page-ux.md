# Landing page UX: should the map be the front door?

*Rogue Agent Watch. Analysis and decision, 2026-09-10, following the map
redesign in [map-ux-research.md](map-ux-research.md). Implemented in the same
change; see "What was implemented" below.*

## The question

Should the map be on the landing page (`#/`), and which components of the site
do the most to catch a new visitor's attention and to bring them back?

## Verdict

Put the map on the landing page, but as half of the hero, not as the whole
page. Keep `#/` as the overview and `#/map` as the deep view. The landing
version is a compact stage: the count, the "Latest" caption, the replay, and
the markers. Clicking anything opens the full map with that record's drawer.
The field log, filter chips, and legend stay on the map page.

### Why not a full-bleed map hero

- The original brief makes the status versus AI-role split "the first thing
  seen". That is still right: it is the one thing no attack map has, and it is
  what turns a skeptical researcher or journalist into a reader. A full-bleed
  map would push it below the fold.
- A map hero opens on a view that shows 4 of 11 records, all as country-level
  centroids. The practitioner research says geography is the weakest lens on
  these incidents. The map should be the hook, not the frame.
- A dashboard surfaces the summary before the detail. The count and the
  honesty split are the summary; the map is a detail view.

### Why the map belongs in the first frame anyway

- Visitors arriving from a shared link were promised a map by the card.
- The previous landing page had no motion and no image in its first viewport,
  and "Most recently disclosed" sat about 1.3 screens down at 1280×900.
  Recency and motion are the two strongest first-five-second hooks, and both
  lived on a different page.
- Ambient live maps retain viewers because they make a hidden system visible
  with zero onboarding and reward aimless looking. Ten seconds of the replay
  is what people record and post.

### Recommended first viewport

Title and a one-sentence lede across the top. Then two columns. Left: one hero
figure (incidents tracked), the small numbers (confirmed, reported, test /
eval, on the map, dataset version and archive coverage) as links, the honesty
split as two compact bar charts, and the actions (explore the map, browse the
records, share). Right: the map stage with the replay and the latest marker
pulsing. On phones the map comes first, then the figure and the split.

The six equal stat tiles go. One hero figure, and it is the same number the
replay drives, so the page never shows two competing big numbers.

## Components ranked for new visitors

| Component | Catches attention | Retains | Note |
|---|---|---|---|
| Share card (off-site) | highest | n/a | The acquisition surface. "Every dot has a footnote" is the hook. The overview needs a visible share button. |
| Hero count with "Latest" caption | high | medium | Number plus recency is what news readers scan for. |
| Replay with pulse | high | medium | Purposeful motion. The loop people record and post. |
| Honesty split (status vs AI role) | medium | high | Credibility signal. Converts skeptics; keep it above the fold. |
| Drawer loop (map → record → related → filters) | low | high | Depth without leaving the view. |
| Field log | medium | high | Makes a sparse map dense and honest; rewards scrolling. |
| What-changed strip and Atom feed | low | highest | The only genuine return trigger without accounts. Belongs on the overview too. |
| Timeline lanes | medium | medium | Carries the acceleration story. |
| Table with CSV/JSON export | low | high | Why researchers come back. |
| Cite box and correction link | low | high | Journalists re-check what they cited. |

## Frictions found

1. Overview first frame: text, six tiles, no motion. Recency buried.
2. Mobile nav: at 400 px the header took three lines plus the theme button
   before any content.
3. No share affordance on the overview, although the site card exists.

## What was implemented

- **Split hero** on `#/`: title and lede, then figure + small numbers +
  honesty split + actions beside a live map teaser. The teaser reuses the
  map canvas (`src/components/map-canvas.ts`), loads country outlines lazily
  after first paint, and binds its replay to the hero figure and caption, so
  the view has exactly one hero number. Any marker opens `#/map?open=<id>`.
- **Stat tiles removed** from the overview in favour of one figure and a line
  of small linked numbers. The tile styles remain available for reuse.
- **Latest moved up**: the three most recent disclosures and the what-changed
  strip sit directly under the hero, above the breakdown charts, with an
  Atom feed link.
- **Share button** in the hero actions: uses the Web Share API where
  available, otherwise copies the site caption and canonical URL. No
  tracking parameters.
- **Mobile nav**: brand and theme toggle on one row, the six links in a
  single horizontally scrolling row beneath, no wrapping.

Not changed: the map page keeps the full HUD, field log, chips, legend, and
what-changed strip; the honesty split's long explanation stays on the About
page; no typeface change (see the map research document).

## Measuring

There are no analytics by design. The landing change can still be judged:
share-link unfurls checked with the platforms' validators, GitHub Pages
referrer counts in the repository's traffic view, and Atom subscriptions in
CDN logs if the site ever sits behind one.
