// Editorial copy for the homepage and the site-level metadata, in one place.
// Plain JavaScript so the app (src/views/overview.ts, src/main.ts) and the
// Node prerender (scripts/prerender*.mjs) read the same strings: the live
// hero, the prerendered hero, the <head>, the JSON-LD and llms.txt never
// drift apart. Approved copy: change it here, nowhere else.
//
// Shared copy carries no counts, dates or versions; those come from the
// snapshot where each page renders them. Rogue Agents Watch is the dashboard;
// the Agentic Attack Index is the dataset it renders. Keep the two distinct.

export const SITE_NAME = 'Rogue Agents Watch';
export const DATASET_NAME = 'Agentic Attack Index';
export const DATASET_URL = 'https://github.com/MLSecOpsHub/agentic-attack-index';

export const HOME_COPY = {
  /** The one H1 of the landing page. */
  h1: SITE_NAME,
  /** <title>, og:title and twitter:title of the landing page. */
  title: 'Rogue Agents Watch — Rogue AI Agent Incidents & Cyberattacks',
  tagline: 'Open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks.',
  description:
    'Rogue Agents Watch tracks documented rogue-agent incidents and AI-orchestrated cyberattacks. Each record links to its sources and distinguishes what is confirmed, what is reported, and how central AI was to the event.',
  /** "Powered by the open-source <a>Agentic Attack Index</a>." */
  attribution: { before: 'Powered by the open-source ', link: DATASET_NAME, href: DATASET_URL, after: '.' },
  /** Meta, Open Graph and Twitter description; also the WebSite JSON-LD description. */
  metaDescription:
    'Open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks. Explore source-linked incidents, verification grades, and security mappings.',
  /** For machine readers (llms.txt): what is the site and what is the dataset. */
  machineSummary:
    'Rogue Agents Watch is a public dashboard of open threat intelligence on rogue AI agents and AI-orchestrated cyberattacks. It renders the Agentic Attack Index, an open-source, source-linked dataset of documented cyberattacks executed or orchestrated by AI agents and of rogue-agent incidents, including test and evaluation records; the dashboard adds no facts of its own.',
};

/** Dataset JSON-LD description lead: the dataset itself, not the site. Counts are appended where it is rendered. */
export const DATASET_DESCRIPTION =
  'Open-source, source-linked dataset of documented cyberattacks executed or orchestrated by AI agents and of rogue-agent incidents, including test and evaluation records.';
