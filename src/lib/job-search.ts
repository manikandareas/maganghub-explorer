// Keep field boundaries: matching a title is stronger than mentioning a skill.
type SearchDocument = { fields: readonly [string, string, string, string, string] };
type SearchQuery = { phrase: string; terms: string[]; active: boolean };
export type SearchRank = readonly [titleTier: number, fieldScore: number];
const FIELD_WEIGHTS = [16, 8, 4, 2, 1] as const;

export function normalizeSearchText(text: string): string {
  return (text.normalize("NFKC").toLowerCase()
    .replace(/\bfront[\s/_-]*end\b/g, "frontend")
    .replace(/\bback[\s/_-]*end\b/g, "backend")
    .replace(/\bfull[\s/_-]*stack\b/g, "fullstack")
    .match(/[\p{L}\p{N}]+(?:\+\+|#)?/gu) ?? []).join(" ");
}

export function createSearchDocument(fields: {
  title: string; organization: string; location: string; programs: string; description: string;
}): SearchDocument {
  const normalized = (value: string) => ` ${normalizeSearchText(value)} `;
  return { fields: [normalized(fields.title), normalized(fields.organization), normalized(fields.location), normalized(fields.programs), normalized(fields.description)] };
}

export function createSearchQuery(text: string): SearchQuery {
  const normalized = normalizeSearchText(text);
  return { phrase: ` ${normalized} `, terms: [...new Set(normalized.split(" ").filter(Boolean))].map(term => ` ${term} `), active: text.trim().length > 0 };
}

export function rankSearch(document: SearchDocument, query: SearchQuery): SearchRank | null {
  if (!query.active) return [0, 0];
  if (!query.terms.length) return null;
  let score = 0;
  let titleMatches = 0;
  for (const term of query.terms) {
    const field = document.fields.findIndex(value => value.includes(term));
    if (field === -1) return null; // AND semantics; every term must be a whole token.
    score += FIELD_WEIGHTS[field];
    if (field === 0) titleMatches++;
  }
  document.fields.forEach((field, i) => { if (field.includes(query.phrase)) score += FIELD_WEIGHTS[i]; });
  const title = document.fields[0];
  const tier = title === query.phrase ? 4 : title.includes(query.phrase) ? 3 : titleMatches === query.terms.length ? 2 : 1;
  return [tier, score];
}
