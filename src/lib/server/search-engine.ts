import type { Filters, Job, SearchResult } from "../job-types";
import { createSearchQuery, normalizeSearchText } from "../job-search";
import { ftsText } from "./embedding-text";
import { getCatalogInfo, dataMetadata, type CatalogInfo } from "./catalog-repository";
import { query } from "./db";
import { queryEmbedding } from "./query-embedding";
import { ServiceError } from "./errors";
import { SEMANTIC_LIMIT, semanticThreshold } from "./config";

export type SearchMode = "hybrid" | "keyword";
export type EngineResult = SearchResult & { meta: ReturnType<typeof dataMetadata> & { requestedMode: SearchMode; mode: SearchMode; fallbackReason?: string; totalScope: string; semanticCandidateLimit: number } };
export type SearchOptions = { catalog?: CatalogInfo; mode?: SearchMode; limit?: number; savedIds?: string[]; identity?: string; vector?: string; threshold?: number };

export async function searchCatalog(filters: Filters, options: SearchOptions = {}): Promise<EngineResult> {
  const catalog = options.catalog ?? await getCatalogInfo();
  const mode = options.mode ?? "hybrid";
  const limit = Math.max(1, Math.min(50, options.limit ?? 12));
  const normalized = normalizeSearchText(filters.q);
  const terms = createSearchQuery(filters.q).terms;
  let vector: string | undefined;
  let fallbackReason: string | undefined;
  if (normalized && mode === "hybrid") {
    try { vector = options.vector ?? await queryEmbedding(filters.q, options.identity ?? "server"); }
    catch (error) { fallbackReason = error instanceof ServiceError ? error.code : "SEMANTIC_UNAVAILABLE"; }
  }
  const params: unknown[] = [catalog.id];
  const bind = (value: unknown) => `$${params.push(value)}`;
  const conditions = ["j.snapshot_id=$1"];
  for (const [value, column] of [[filters.prov, "province_code"], [filters.city, "city_code"], [filters.org, "organization_type"]]) if (value !== "") conditions.push(`j.${column}=${bind(Number(value))}`);
  if (filters.cat) conditions.push(`j.category=${bind(filters.cat)}`);
  if (filters.edu) conditions.push(`(j.education_mask & ${bind(Number(filters.edu))}::int)<>0`);
  if (filters.interview) conditions.push(`(j.interview_mask & ${bind(Number(filters.interview))}::int)<>0`);
  if (filters.minQuota) conditions.push(`j.quota>=${bind(Number(filters.minQuota))}`);
  if (filters.disability) conditions.push("j.disability=true");
  if (filters.saved) conditions.push(`j.id=ANY(${bind(options.savedIds ?? [])}::uuid[])`);
  const phrase = normalized ? bind(` ${normalized} `) : "''";
  const queryTerms = normalized ? bind(terms) : "ARRAY[]::text[]";
  const lexicalCondition = normalized ? `j.fts @@ plainto_tsquery('simple',${bind(ftsText(filters.q))})` : filters.q.trim() ? "false" : "true";
  const fields = [1, 2, 3, 4, 5].map(index => `(' '||j.search_fields[${index}]||' ')`);
  const titleTier = normalized ? `CASE WHEN ${fields[0]}=${phrase} THEN 4 WHEN strpos(${fields[0]},${phrase})>0 THEN 3 WHEN NOT EXISTS(SELECT 1 FROM unnest(${queryTerms}::text[]) t WHERE strpos(${fields[0]},t)=0) THEN 2 ELSE 1 END` : "0";
  const weights = [16, 8, 4, 2, 1];
  const fieldScore = normalized ? `(SELECT coalesce(sum(CASE ${fields.map((field, index) => `WHEN strpos(${field},t)>0 THEN ${weights[index]}`).join(" ")} ELSE 0 END),0) FROM unnest(${queryTerms}::text[]) t) + ${fields.map((field, index) => `(CASE WHEN strpos(${field},${phrase})>0 THEN ${weights[index]} ELSE 0 END)`).join("+")}` : "0";
  const semantic = vector ? `SELECT j.id, row_number() OVER(ORDER BY e.embedding <=> ${bind(vector)}::vector,j.id) AS semantic_rank
    FROM filtered j JOIN mh_embeddings e ON e.hash=j.embedding_hash
    WHERE (1-(e.embedding <=> ${bind(vector)}::vector))>=${bind(options.threshold ?? semanticThreshold())}
    ORDER BY e.embedding <=> ${bind(vector)}::vector,j.id LIMIT ${SEMANTIC_LIMIT}` : "SELECT NULL::uuid AS id,NULL::bigint AS semantic_rank WHERE false";
  const relevance = vector ? "CASE WHEN c.title_tier=4 THEN 1 ELSE 0 END DESC,c.relevance DESC,c.title_tier DESC,c.field_score DESC" : "c.title_tier DESC,c.field_score DESC";
  const sorting: Record<Filters["sort"], string> = { relevance: normalized ? relevance : "j.portal_order", portal: "j.portal_order", quota: "j.quota DESC", appl: "j.applicants", score: "j.opportunity_score DESC", az: "j.az_order" };
  const pageSize = bind(limit);
  const requestedPage = bind(filters.page);
  const [row] = await query<{ result: SearchResult }>(`WITH
    filtered AS NOT MATERIALIZED (SELECT j.* FROM mh_jobs j WHERE ${conditions.join(" AND ")}),
    lexical_scores AS (SELECT j.id,j.portal_order,${titleTier} AS title_tier,${fieldScore} AS field_score FROM filtered j WHERE ${lexicalCondition}),
    lexical AS (SELECT *,row_number() OVER(ORDER BY title_tier DESC,field_score DESC,portal_order,id) AS keyword_rank FROM lexical_scores),
    semantic AS (${semantic}),
    combined AS (SELECT coalesce(l.id,s.id) AS id,coalesce(l.title_tier,0) AS title_tier,coalesce(l.field_score,0) AS field_score,
      coalesce(1.0/(60+l.keyword_rank),0)+coalesce(0.8/(60+s.semantic_rank),0) AS relevance FROM lexical l FULL JOIN semantic s ON l.id=s.id),
    page_info AS (SELECT count(*)::int AS total,greatest(1,ceil(count(*)::numeric/${pageSize})::int) AS pages,
      least(${requestedPage}::int,greatest(1,ceil(count(*)::numeric/${pageSize})::int)) AS page FROM combined),
    page_rows AS (SELECT (j.payload-'description'-'address') || jsonb_build_object('relevanceScore',c.relevance) AS payload,
      row_number() OVER(ORDER BY ${sorting[filters.sort]},j.portal_order,j.id) AS position
      FROM combined c JOIN filtered j ON j.id=c.id ORDER BY ${sorting[filters.sort]},j.portal_order,j.id
      LIMIT ${pageSize} OFFSET (SELECT (page-1)*${pageSize} FROM page_info))
    SELECT jsonb_build_object('jobs',(SELECT coalesce(jsonb_agg(payload ORDER BY position),'[]'::jsonb) FROM page_rows),
      'total',total,'page',page,'pages',pages,'pageSize',${pageSize}) AS result FROM page_info`, params);
  return { ...row.result, jobs: row.result.jobs as Job[], meta: { ...dataMetadata(catalog), requestedMode: mode, mode: vector ? "hybrid" : "keyword", ...(fallbackReason ? { fallbackReason } : {}), totalScope: vector ? "keyword_plus_semantic_candidates" : "keyword_matches", semanticCandidateLimit: vector ? SEMANTIC_LIMIT : 0 } };
}
