import "./env";
import { argument, reportError } from "./env";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { CATEGORY_VERSION } from "../src/lib/job-categories";
import { database, query } from "../src/lib/server/db";
import { ServiceError } from "../src/lib/server/errors";

async function main() {
  const catalog = prepareCatalog();
  const id = argument("snapshot") ?? catalog.id;
  if (id !== catalog.id) throw new Error("Berkas sumber harus sesuai snapshot yang diklasifikasikan");
  const [metadata] = await query<{ revision: number }>("SELECT ingest_revision AS revision FROM mh_snapshots WHERE id=$1", [id]);
  if (metadata?.revision) throw new ServiceError("CATALOG_INCREMENTAL", "Katalog sudah menerima pembaruan bot; klasifikasi dari snapshot lokal ditolak.", 409);
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify({ event: "classification_preview", jobs: catalog.records.length, categories: catalog.facets.categories, categoryVersion: CATEGORY_VERSION }, null, 2));
    return;
  }
  const [before] = await query<{ jobs: number; embedded: number; tokens: string }>(`SELECT count(j.id)::int AS jobs,count(e.hash)::int AS embedded,
    (SELECT coalesce(sum(tokens),0)::text FROM mh_embedding_runs WHERE snapshot_id=$1) AS tokens
    FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash WHERE j.snapshot_id=$1`, [id]);
  if (before.jobs !== catalog.records.length) throw new Error("Import snapshot belum lengkap");
  const assignments = catalog.records.map(record => ({ id: record.id, category: record.category }));
  const sql = database();
  const results = await sql.transaction([
    sql.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mh-categories:${id}`]),
    sql.query("SELECT id FROM mh_snapshots WHERE id=$1 AND ingest_revision=0 FOR UPDATE", [id]),
    sql.query(`UPDATE mh_jobs j SET category=r.category,payload=jsonb_set(j.payload,'{category}',to_jsonb(r.category))
      FROM jsonb_to_recordset($2::jsonb) r(id uuid,category text)
      WHERE j.snapshot_id=$1 AND j.id=r.id AND j.category IS DISTINCT FROM r.category
        AND EXISTS(SELECT 1 FROM mh_snapshots s WHERE s.id=$1 AND s.ingest_revision=0) RETURNING j.id`, [id, JSON.stringify(assignments)]),
    sql.query("UPDATE mh_snapshots SET facets=$2::jsonb,taxonomy_version=$3 WHERE id=$1 AND ingest_revision=0", [id, JSON.stringify(catalog.facets), CATEGORY_VERSION]),
  ], { fetchOptions: { signal: AbortSignal.timeout(45000) } });
  if (!results[1].length) throw new ServiceError("CATALOG_INCREMENTAL", "Katalog berubah selama klasifikasi; operasi dari snapshot lokal dibatalkan.", 409);
  const distribution = await query<{ category: string; count: number }>("SELECT category,count(*)::int AS count FROM mh_jobs WHERE snapshot_id=$1 GROUP BY category ORDER BY category", [id]);
  for (const category of catalog.facets.categories) if ((distribution.find(item => item.category === category.value)?.count ?? 0) !== category.count) throw new Error("Hitungan kategori tidak sesuai sumber");
  const [after] = await query<{ embedded: number; tokens: string }>(`SELECT count(e.hash)::int AS embedded,
    (SELECT coalesce(sum(tokens),0)::text FROM mh_embedding_runs WHERE snapshot_id=$1) AS tokens
    FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash WHERE j.snapshot_id=$1`, [id]);
  if (before.embedded !== after.embedded || before.tokens !== after.tokens) throw new Error("Metadata embedding berubah saat klasifikasi");
  console.log(JSON.stringify({ event: "classification_complete", snapshotId: id, categoryVersion: CATEGORY_VERSION, jobs: before.jobs, changed: results[2].length, embedded: after.embedded, embeddingTokensUnchanged: true, categories: catalog.facets.categories }, null, 2));
}
main().catch(reportError);
