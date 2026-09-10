# Vendored fonts (build-time only)

These TrueType files are used by `scripts/prerender.mjs` to rasterise the
Open Graph share cards (`dist/og/*.png`) with resvg, with system fonts disabled
so the output is identical on every machine. They are **never** loaded at
runtime: the site itself uses the system font stack (privacy rule 7 in
CLAUDE.md).

| File | Family | Licence |
|---|---|---|
| `BarlowCondensed-Bold.ttf` | Barlow Condensed (Jeremy Tribby) | SIL OFL 1.1, `OFL-Barlow.txt` |
| `Barlow-Regular.ttf`, `Barlow-SemiBold.ttf` | Barlow (Jeremy Tribby) | SIL OFL 1.1, `OFL-Barlow.txt` |
| `IBMPlexMono-Regular.ttf` | IBM Plex Mono (IBM) | SIL OFL 1.1, `OFL-IBMPlexMono.txt` |

Source: the Google Fonts repository (`ofl/barlow`, `ofl/barlowcondensed`,
`ofl/ibmplexmono`). Replacing a file changes every card, which the CI
reproducibility check will surface as a changed build.
