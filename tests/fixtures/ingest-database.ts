import { randomUUID } from "node:crypto";
import { getCatalogInfo } from "../../src/lib/server/catalog-repository";
import { query, transaction, type Statement } from "../../src/lib/server/db";
import { createIngestStore } from "../../src/lib/server/ingest-store";

export async function createIngestDatabase(seedLimit = 1) {
  const source = await getCatalogInfo();
  const schema = `mh_ingest_test_${randomUUID().replace(/-/g, "")}`;
  const id = `ingest-${randomUUID()}`;
  await query(`CREATE SCHEMA "${schema}"`);
  const cleanup = () => query(`DROP SCHEMA "${schema}" CASCADE`);
  const transact = async (statements: Statement[]) => (await transaction([{ text: `SET LOCAL search_path TO "${schema}",public`, parameters: [] }, ...statements])).slice(1);
  async function execute<T>(text: string, parameters: unknown[] = []): Promise<T[]> {
    return (await transact([{ text, parameters }]))[0] as T[];
  }
  try {
    await transaction(["mh_snapshots", "mh_jobs", "mh_embeddings", "mh_active_catalog", "mh_embedding_runs", "mh_ingest_runs"].map(table => ({ text: `CREATE TABLE "${schema}".${table} (LIKE public.${table} INCLUDING ALL)`, parameters: [] })));
    await execute(`INSERT INTO mh_snapshots(id,source_hash,snapshot_date,expected_count,facets,status,embedding_model,embedding_dimensions,embedding_text_version,taxonomy_version)
      SELECT $1,source_hash,snapshot_date,$3,facets,'ready',embedding_model,embedding_dimensions,embedding_text_version,taxonomy_version FROM public.mh_snapshots WHERE id=$2`, [id, source.id, Math.min(seedLimit, source.expectedCount)]);
    await execute(`INSERT INTO mh_jobs SELECT $1,id,portal_order,az_order,payload,province_code,city_code,category,organization_type,education_mask,interview_mask,disability,quota,applicants,opportunity_score,search_fields,fts,embedding_text,embedding_hash,observed_at FROM public.mh_jobs WHERE snapshot_id=$2 ORDER BY portal_order LIMIT $3`, [id, source.id, seedLimit]);
    await execute("INSERT INTO mh_embeddings SELECT e.* FROM public.mh_embeddings e JOIN mh_jobs j ON j.embedding_hash=e.hash WHERE j.snapshot_id=$1 ON CONFLICT(hash) DO NOTHING", [id]);
    await execute("INSERT INTO mh_active_catalog(singleton,snapshot_id) VALUES(true,$1)", [id]);
    return { source, id, execute, transact, store: createIngestStore(execute, transact), cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
