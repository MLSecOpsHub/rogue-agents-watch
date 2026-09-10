// Official reference pages for each mapping id. Ids are rendered exactly as
// published upstream; these only build the href.

export function atlasUrl(id: string): string {
  // AML.T0051 -> https://atlas.mitre.org/techniques/AML.T0051 ; AML.TA0001 -> /tactics/ ; AML.M0001 -> /mitigations/ ; AML.CS0001 -> /studies/
  const m = /^AML\.(T|TA|M|CS)\d{4}/.exec(id);
  const kind = m?.[1];
  const path = kind === 'TA' ? 'tactics' : kind === 'M' ? 'mitigations' : kind === 'CS' ? 'studies' : 'techniques';
  return `https://atlas.mitre.org/${path}/${encodeURIComponent(id)}`;
}

export function attackUrl(id: string): string {
  // T1567.001 -> /techniques/T1567/001 ; TA0010 -> /tactics/TA0010 ; S0001 -> /software ; G0001 -> /groups ; M1001 -> /mitigations
  const m = /^(TA|T|S|G|M)(\d{4})(?:\.(\d{3}))?$/.exec(id);
  if (!m) return `https://attack.mitre.org/`;
  const [, kind, num, sub] = m;
  const base = kind === 'TA' ? 'tactics' : kind === 'S' ? 'software' : kind === 'G' ? 'groups' : kind === 'M' ? 'mitigations' : 'techniques';
  return `https://attack.mitre.org/${base}/${kind}${num}${sub ? `/${sub}` : ''}/`;
}

export function owaspLlmUrl(id: string): string {
  // LLM01 -> https://genai.owasp.org/llmrisk/llm01/
  return `https://genai.owasp.org/llmrisk/${id.toLowerCase()}/`;
}

export function owaspAsiUrl(_id: string): string {
  return 'https://genai.owasp.org/initiatives/#agenticinitiative';
}

export function cveUrl(id: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`;
}

export function aiidUrl(n: number): string {
  return `https://incidentdatabase.ai/cite/${n}/`;
}

export function countryFlagLabel(code: string): string {
  // Display ISO 3166-1 alpha-2 codes as given; a name lookup would be data the
  // dataset does not contain, so we rely on Intl where available.
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}
