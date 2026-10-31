import type { Facets, JobDetail } from "../job-types";
import { query } from "./db";
import { ServiceError } from "./errors";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION, SOURCE_URL } from "./config";

export type CatalogInfo = { id: string; snapshotDate: string; facets: Facets; expectedCount: number; status: string; categoryVersion: number; ingestRevision: number; lastIngestedAt: string | null };

export async function getCatalogInfo(id?: string, execute = query): Promise<CatalogInfo> {
  const [row] = await execute<CatalogInfo>(`SELECT s.id,to_char(s.snapshot_date,'YYYY-MM-DD') AS "snapshotDate",s.facets,s.expected_count AS "expectedCount",s.status,s.taxonomy_version AS "categoryVersion",s.ingest_revision AS "ingestRevision",s.last_ingested_at AS "lastIngestedAt"
    FROM mh_snapshots s ${id ? "" : "JOIN mh_active_catalog a ON a.snapshot_id=s.id"}
    WHERE ${id ? "s.id=$1" : "a.singleton=true AND s.status='ready'"} AND s.embedding_model=$${id ? 2 : 1} AND s.embedding_dimensions=$${id ? 3 : 2} AND s.embedding_text_version=$${id ? 4 : 3}`, id ? [id, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION] : [EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION]);
  if (!row) throw new ServiceError("CATALOG_NOT_READY", "Katalog belum siap. Jalankan import dan backfill terlebih dahulu.");
  return row;
}

export async function findJob(id: string, catalog?: CatalogInfo, execute = query): Promise<JobDetail | null> {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) return null;
  const info = catalog ?? await getCatalogInfo(undefined, execute);
  const [row] = await execute<{ payload: JobDetail }>("SELECT payload || jsonb_build_object('observedAt',observed_at) AS payload FROM mh_jobs WHERE snapshot_id=$1 AND id=$2::uuid", [info.id, id]);
  return row?.payload ?? null;
}

export function dataMetadata(info: CatalogInfo) {
  return { snapshotId: info.id, snapshotDate: info.snapshotDate, isLive: false, dataMode: info.lastIngestedAt ? "incremental" as const : "snapshot" as const, lastIngestedAt: info.lastIngestedAt, revision: info.ingestRevision, sourceUrl: SOURCE_URL, categoryVersion: info.categoryVersion, categorySource: "inferred_from_position_title" as const };
}

export async function activateCatalog(id: string) {
  // One conditional pointer swap; an incomplete snapshot can never replace the active catalog.
  const rows = await query<{ snapshot_id: string }>(`WITH ready AS (
    UPDATE mh_snapshots s SET status='ready' WHERE s.id=$1
      AND s.embedding_model=$2 AND s.embedding_dimensions=$3 AND s.embedding_text_version=$4
      AND s.expected_count=(SELECT count(*) FROM mh_jobs j WHERE j.snapshot_id=s.id)
      AND NOT EXISTS(SELECT 1 FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash AND e.model=$2 AND e.dimensions=$3 AND e.embedding_text_version=$4 WHERE j.snapshot_id=s.id AND e.hash IS NULL)
    RETURNING s.id
  ) INSERT INTO mh_active_catalog(singleton,snapshot_id) SELECT true,id FROM ready
    ON CONFLICT(singleton) DO UPDATE SET snapshot_id=excluded.snapshot_id,activated_at=now() RETURNING snapshot_id`, [id, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION]);
  if (!rows.length) throw new ServiceError("CATALOG_INCOMPLETE", "Aktivasi ditolak: data atau embedding belum lengkap");
  return rows[0];
}
