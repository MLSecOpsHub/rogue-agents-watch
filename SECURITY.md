# Security policy

## Scope

`rogue-agents-dashboard` is a static site: no server, no database, no accounts,
no cookies, no analytics. It is built from a vendored data snapshot and served
from GitHub Pages. The attack surface is therefore the build pipeline, the
client-side rendering of dataset strings, and the GitHub Actions workflows.

Things we consider in scope:

- Cross-site scripting or HTML injection through dataset fields (every string we
  render comes from an external dataset; rendering must stay text-only, see
  `src/util/dom.ts`).
- Supply-chain issues in dependencies or in the GitHub Actions used by the
  workflows under `.github/workflows/`.
- The optional "check upstream for a newer dataset" request leaking anything
  beyond a plain fetch of `summary.json`.
- Any runtime network request for data other than that user-initiated check.

Out of scope here, but in scope upstream:

- Factual errors, sourcing problems, or victim-naming concerns in incident
  records. Report those to the dataset:
  <https://github.com/MLSecOpsHub/agentic-attack-index/issues/new?template=data-correction.yml>.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting on this repository ("Security" tab, "Report a
vulnerability") or contact the maintainers through <https://mlsecopshub.com>.

We aim to acknowledge reports within 7 days. There is no bug bounty.

## Content policy

This project tracks offensive use of AI agents, so it is worth stating plainly:
the dashboard displays lifecycle phases and framework mappings only. It never
adds exploit detail, payloads, prompts, or step-by-step offensive instructions,
and pull requests that introduce such material will be declined regardless of
intent. The same rule applies upstream.
