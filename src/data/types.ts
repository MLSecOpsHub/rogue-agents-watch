// Types mirror schema/incident.schema.json (vendored in data/snapshot/). The
// raw type is what the snapshot contains; the normalised type is what views use.

export type Status = 'confirmed' | 'reported' | 'test-eval';
export type Confidence = 'primary' | 'secondary' | 'unverified';
export type AiRole = 'load-bearing' | 'significant' | 'incidental' | 'disputed' | 'unknown';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Category =
  | 'ai-orchestrated-campaign'
  | 'autonomous-attack'
  | 'lab-escape-eval'
  | 'agent-hijack-prompt-injection'
  | 'infrastructure-abuse-supply-chain';
export type ActorType = 'nation-state' | 'cybercriminal' | 'single-operator' | 'lab-test-eval' | 'researcher' | 'unknown';
export type ModelFamily =
  | 'claude'
  | 'openai-gpt'
  | 'openai-codex'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'llama'
  | 'mistral'
  | 'hermes'
  | 'other';
export type AutonomyLevel =
  | 'tool-assisted'
  | 'human-in-the-loop'
  | 'supervised-autonomous'
  | 'fully-autonomous'
  | 'not-applicable'
  | 'unknown';
export type GuardrailBypass =
  | 'jailbreak'
  | 'open-weight-model'
  | 'legitimate-tool-abuse'
  | 'indirect-prompt-injection'
  | 'none-observed'
  | 'unknown';
export type LifecyclePhase =
  | 'recon'
  | 'resource-dev'
  | 'initial-access'
  | 'execution'
  | 'credential-access'
  | 'privilege-escalation'
  | 'persistence'
  | 'exfiltration'
  | 'deception-social-eng'
  | 'impact';
export type RecordStatus = 'active' | 'disputed' | 'retracted' | 'superseded';
export type SourceType =
  | 'first-party-disclosure'
  | 'vendor-report'
  | 'government-advisory'
  | 'research-paper'
  | 'news'
  | 'blog'
  | 'other';

export type GeoRole = 'origin' | 'target';

/** Why a map point exists, as a cited source states it (taxonomy geo_basis). */
export type GeoBasis =
  | 'sponsor-attribution'
  | 'operator-location'
  | 'actor-location'
  | 'infrastructure'
  | 'victim-location'
  | 'stated-location';

/** A map point exactly as it appears in geo.points[] (schema 0.3.0). */
export interface RawGeoPoint {
  role: GeoRole;
  basis: GeoBasis;
  /** The publisher that stated this location. */
  attributed_by: string;
  /** ISO 3166-1 alpha-2, or null only for a non-country region centroid (illustrative: true). */
  country: string | null;
  lat: number;
  lng: number;
  label: string;
  /** true = country-level centroid, not a source-stated precise location. */
  illustrative: boolean;
}

/** Normalised point: the stated fields verbatim, null where the record omits one. */
export interface GeoPoint {
  role: GeoRole;
  basis: GeoBasis | null;
  attributed_by: string | null;
  country: string | null;
  lat: number;
  lng: number;
  label: string;
  illustrative: boolean;
}

export interface Source {
  title: string;
  url: string;
  archive_url?: string;
  publisher: string;
  type: SourceType;
  date?: string;
}

export interface Mappings {
  mitre_atlas?: string[];
  mitre_attack?: string[];
  owasp_llm?: string[];
  owasp_asi?: string[];
  cve?: string[];
  aiid?: number[];
}

export interface Targets {
  orgs_affected?: number | null;
  records_exfiltrated?: number | null;
  sectors?: string[];
  countries?: string[];
}

export interface Revision {
  date: string;
  note: string;
}

/** A record exactly as it appears in dist/incidents.json. */
export interface RawIncident {
  id: string;
  name: string;
  summary: string;
  date_disclosed: string;
  status: Status;
  confidence: Confidence;
  category: Category;
  severity: Severity;
  models: string[];
  model_families: ModelFamily[];
  actor: string;
  actor_type: ActorType;
  autonomy_pct?: number | null;
  autonomy_level?: AutonomyLevel;
  guardrail_bypass?: GuardrailBypass[];
  ai_role?: AiRole;
  related?: string[];
  mitigations?: string[];
  record_status?: RecordStatus;
  superseded_by?: string;
  revisions?: Revision[];
  targets?: Targets;
  /** Omitted entirely when no cited source states a location. */
  geo?: { points: RawGeoPoint[] };
  lifecycle_phases?: LifecyclePhase[];
  mappings?: Mappings;
  impact?: string | null;
  sources: Source[];
  added?: { date: string; by: string };
  last_updated?: string;
}

/** Normalised for rendering: optional arrays are present, defaults applied, nulls preserved. */
export interface Incident {
  id: string;
  name: string;
  summary: string;
  impact: string | null;
  date_disclosed: string;
  year: number;
  added: { date: string; by: string } | null;
  last_updated: string | null;

  status: Status;
  confidence: Confidence;
  ai_role: AiRole;
  severity: Severity;

  category: Category;
  actor: string;
  actor_type: ActorType;
  models: string[];
  model_families: ModelFamily[];
  autonomy_level: AutonomyLevel;
  /** null = source gave no number. Never render as 0. */
  autonomy_pct: number | null;
  guardrail_bypass: GuardrailBypass[];
  lifecycle_phases: LifecyclePhase[];

  targets: {
    orgs_affected: number | null;
    records_exfiltrated: number | null;
    sectors: string[];
    countries: string[];
  };

  /** Only present when the dataset states coordinates. Never derived. Several points per role are allowed. */
  geo: { points: GeoPoint[] } | null;
  hasGeo: boolean;

  mappings: {
    mitre_atlas: string[];
    mitre_attack: string[];
    owasp_llm: string[];
    owasp_asi: string[];
    cve: string[];
    aiid: number[];
  };

  sources: Source[];
  related: string[];
  mitigations: string[];

  record_status: RecordStatus;
  superseded_by: string | null;
  revisions: Revision[];
  /** false for retracted/superseded — excluded from headline counts by default. */
  isActiveRecord: boolean;
}

/** summary.json geo_coverage (schema 0.3.0): counts of map points, never positions. */
export interface GeoCoverage {
  /** Records carrying at least one point. */
  records: number;
  points: number;
  /** Points that are country/region centroids rather than stated places. */
  illustrative: number;
  by_role: Record<string, number>;
  by_basis: Record<string, number>;
}

export interface Summary {
  dataset_version: string;
  schema: string;
  total: number;
  archive_coverage: { sources: number; archived: number; pct: number };
  /** How many records carry map points and on which basis (upstream counts). */
  geo_coverage: GeoCoverage;
  by_category: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  by_actor_type: Record<string, number>;
  by_autonomy_level: Record<string, number>;
  by_ai_role: Record<string, number>;
  by_model_family: Record<string, number>;
  by_year: Record<string, number>;
  ids: string[];
}

export interface Snapshot {
  source_repo: string;
  source_ref: string;
  source_commit: string | null;
  source_commit_date: string | null;
  dataset_version: string;
  schema_id: string | null;
  total: number;
  fetched_at: string;
  files: Record<string, string>;
  data_license: string;
  attribution: string;
}

export interface TaxonomyValue {
  id: string;
  label: string;
  description: string;
}

export type Taxonomy = Record<string, { title: string; values: TaxonomyValue[] }>;

export interface Dataset {
  incidents: Incident[];
  byId: Map<string, Incident>;
  summary: Summary;
  snapshot: Snapshot;
  taxonomy: Taxonomy;
}
