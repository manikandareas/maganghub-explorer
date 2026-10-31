import { CATEGORIES, CATEGORY_VERSION } from "../job-categories";
import type { JobDetail } from "../job-types";
import { getCatalogInfo, type CatalogInfo } from "./catalog-repository";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION } from "./config";
import { query, transaction } from "./db";
import type { IngestRecord, prepareIngestRecords } from "./ingest-input";
import type { AlphabeticalJob } from "./ingest-order";

export type IngestCounts = { inserted: number; updated: number; unchanged: number; stale: number };
export type ExistingJob = { id: string; payload: JobDetail; observedAt: string | null; azOrder: number };
type Commit = {
  runId: string; catalog: CatalogInfo; observedAt: string; counts: IngestCounts;
  prepared: ReturnType<typeof prepareIngestRecords>; records: IngestRecord[];
  ranks: { id: string; az_order: number }[];
  embeddings: { hash: string; embedding: string }[]; embeddingDocuments: number; embeddingTokens: number;
};

export function createIngestStore(execute = query, transact = transaction) {
  return {
    catalog: () => getCatalogInfo(undefined, execute),
    existing: (catalogId: string, ids: string[]) => execute<ExistingJob>("SELECT id::text,payload,observed_at AS \"observedAt\",az_order AS \"azOrder\" FROM mh_jobs WHERE snapshot_id=$1 AND id=ANY($2::uuid[])", [catalogId, ids]),
    alphabetical: (catalogId: string) => execute<AlphabeticalJob>("SELECT id::text,payload->>'title' AS title,portal_order AS \"portalOrder\",az_order AS \"azOrder\" FROM mh_jobs WHERE snapshot_id=$1", [catalogId]),
    embeddings: (hashes: string[]) => execute<{ hash: string }>("SELECT hash FROM mh_embeddings WHERE hash=ANY($1::text[]) AND model=$2 AND dimensions=$3 AND embedding_text_version=$4", [hashes, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION]),
    async commit(batch: Commit) {
      const { runId, catalog, observedAt, counts } = batch;
      const guarded = "EXISTS(SELECT 1 FROM mh_ingest_runs WHERE id=$1::uuid)";
      // Lock the active pointer and catalog before claiming a revision. Every
      // write depends on this claim, so a stale preparation commits no changes.
      const results = await transact([
        { text: `WITH locked AS MATERIALIZED (
            SELECT s.id,s.ingest_revision,s.taxonomy_version FROM mh_active_catalog a JOIN mh_snapshots s ON s.id=a.snapshot_id
            WHERE a.singleton AND s.id=$2 AND s.status='ready' FOR UPDATE OF a,s
          ) INSERT INTO mh_ingest_runs(id,snapshot_id,observed_at)
          SELECT $1::uuid,id,$3::timestamptz FROM locked WHERE ingest_revision=$4 AND taxonomy_version=$5 RETURNING id`, parameters: [runId, catalog.id, observedAt, catalog.ingestRevision, CATEGORY_VERSION] },
        { text: `INSERT INTO mh_embeddings(hash,model,dimensions,embedding,embedding_text_version)
          SELECT r.hash,$3,$4,r.embedding::vector,$5 FROM jsonb_to_recordset($2::jsonb) r(hash text,embedding text)
          WHERE ${guarded} ON CONFLICT(hash) DO NOTHING`, parameters: [runId, JSON.stringify(batch.embeddings), EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION] },
        { text: `WITH written AS (INSERT INTO mh_jobs(snapshot_id,id,portal_order,az_order,payload,province_code,city_code,category,organization_type,education_mask,interview_mask,disability,quota,applicants,opportunity_score,search_fields,fts,embedding_text,embedding_hash,observed_at)
          SELECT $2,r.id,coalesce((SELECT max(portal_order)+1 FROM mh_jobs WHERE snapshot_id=$2),0)+r.ordinality::int-1,r.az_order,
            r.payload,r.province_code,r.city_code,r.category,r.organization_type,r.education_mask,r.interview_mask,r.disability,r.quota,r.applicants,r.opportunity_score,
            ARRAY(SELECT jsonb_array_elements_text(r.search_fields)),
            setweight(to_tsvector('simple',r.fts_fields->>0),'A') || setweight(to_tsvector('simple',r.fts_fields->>1),'B') || setweight(to_tsvector('simple',r.fts_fields->>2),'C') || setweight(to_tsvector('simple',r.fts_fields->>3),'C') || setweight(to_tsvector('simple',r.fts_fields->>4),'D'),
            r.embedding_text,r.embedding_hash,$4::timestamptz
          FROM ROWS FROM(jsonb_to_recordset($3::jsonb) AS (id uuid,payload jsonb,az_order integer,province_code integer,city_code integer,category text,organization_type integer,education_mask integer,interview_mask integer,disability boolean,quota integer,applicants integer,opportunity_score double precision,search_fields jsonb,fts_fields jsonb,embedding_text text,embedding_hash text)) WITH ORDINALITY r
          WHERE ${guarded} AND EXISTS(SELECT 1 FROM mh_embeddings e WHERE e.hash=r.embedding_hash AND e.model=$5 AND e.dimensions=$6 AND e.embedding_text_version=$7)
          ON CONFLICT(snapshot_id,id) DO UPDATE SET payload=excluded.payload,az_order=excluded.az_order,province_code=excluded.province_code,city_code=excluded.city_code,
            category=excluded.category,organization_type=excluded.organization_type,education_mask=excluded.education_mask,interview_mask=excluded.interview_mask,
            disability=excluded.disability,quota=excluded.quota,applicants=excluded.applicants,opportunity_score=excluded.opportunity_score,
            search_fields=excluded.search_fields,fts=excluded.fts,embedding_text=excluded.embedding_text,embedding_hash=excluded.embedding_hash,observed_at=excluded.observed_at
          WHERE mh_jobs.observed_at IS NULL OR mh_jobs.observed_at<excluded.observed_at RETURNING id)
          UPDATE mh_ingest_runs SET expected_writes=jsonb_array_length($3::jsonb),written=(SELECT count(*) FROM written) WHERE id=$1::uuid RETURNING written`, parameters: [runId, catalog.id, JSON.stringify(batch.records), observedAt, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION] },
        { text: `UPDATE mh_jobs j SET az_order=r.az_order FROM jsonb_to_recordset($3::jsonb) r(id uuid,az_order integer)
          WHERE j.snapshot_id=$2 AND j.id=r.id AND j.az_order IS DISTINCT FROM r.az_order AND ${guarded}`, parameters: [runId, catalog.id, JSON.stringify(batch.ranks)] },
        { text: `WITH province_counts AS (SELECT province_code,count(*) AS count FROM mh_jobs WHERE snapshot_id=$2 GROUP BY province_code),
          city_counts AS (SELECT city_code,count(*) AS count FROM mh_jobs WHERE snapshot_id=$2 GROUP BY city_code),
          category_counts AS (SELECT category,count(*) AS count FROM mh_jobs WHERE snapshot_id=$2 GROUP BY category),
          summary AS (SELECT count(*)::int AS total,count(DISTINCT payload->>'organization')::int AS organizations FROM mh_jobs WHERE snapshot_id=$2)
          UPDATE mh_snapshots s SET expected_count=summary.total,
          facets=jsonb_build_object('total',summary.total,'organizations',summary.organizations,
            'provinces',(SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object('count',coalesce(pc.count,0)) ORDER BY p.label) FROM jsonb_to_recordset($3::jsonb) p(value text,label text) LEFT JOIN province_counts pc ON pc.province_code=p.value::int),
            'cities',(SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object('count',coalesce(cc.count,0)) ORDER BY c.label) FROM jsonb_to_recordset($4::jsonb) c(value text,label text,province text) LEFT JOIN city_counts cc ON cc.city_code=c.value::int),
            'categories',(SELECT jsonb_agg(c || jsonb_build_object('count',coalesce(cc.count,0)) ORDER BY ordinal) FROM jsonb_array_elements($5::jsonb) WITH ORDINALITY categories(c,ordinal) LEFT JOIN category_counts cc ON cc.category=c->>'value')),
          ingest_revision=s.ingest_revision+1,last_ingested_at=now()
          FROM summary
          WHERE s.id=$2 AND ${guarded}`, parameters: [runId, catalog.id, JSON.stringify(batch.prepared.provinces), JSON.stringify(batch.prepared.cities), JSON.stringify(CATEGORIES)] },
        { text: `UPDATE mh_ingest_runs SET inserted=$2,updated=$3,unchanged=$4,stale=$5,embedding_documents=$6,embedding_tokens=$7 WHERE id=$1::uuid`, parameters: [runId, counts.inserted, counts.updated, counts.unchanged, counts.stale, batch.embeddingDocuments, batch.embeddingTokens] },
        { text: `INSERT INTO mh_embedding_runs(snapshot_id,documents,tokens,estimated_cost_usd)
          SELECT $2,$3::integer,$4::integer,$4::integer*0.02/1000000 WHERE ${guarded} AND $3::integer>0`, parameters: [runId, catalog.id, batch.embeddingDocuments, batch.embeddingTokens] },
        { text: `SELECT s.ingest_revision AS revision,s.last_ingested_at AS "lastIngestedAt" FROM mh_snapshots s JOIN mh_ingest_runs r ON r.snapshot_id=s.id WHERE r.id=$1::uuid`, parameters: [runId] },
      ]);
      if (!results[0].length) return null;
      // The run's CHECK constraint verifies the write count inside the same
      // transaction, rolling everything back if any document is not ready.
      return results[results.length - 1][0] as { revision: number; lastIngestedAt: string };
    },
  };
}
export type IngestStore = ReturnType<typeof createIngestStore>;
