import "./env";
import { argument, reportError } from "./env";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { CATEGORY_VERSION } from "../src/lib/job-categories";
import { database, query } from "../src/lib/server/db";

async function main() {
  const catalog = prepareCatalog();
  const id = argument("snapshot") ?? catalog.id;
  if (id !== catalog.id) throw new Error("Berkas sumber harus sesuai snapshot yang diklasifikasikan");
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
    sql.query(`UPDATE mh_jobs j SET category=r.category,payload=jsonb_set(j.payload,'{category}',to_jsonb(r.category))
      FROM jsonb_to_recordset($2::jsonb) r(id uuid,category text)
      WHERE j.snapshot_id=$1 AND j.id=r.id AND j.category IS DISTINCT FROM r.category RETURNING j.id`, [id, JSON.stringify(assignments)]),
    sql.query("UPDATE mh_snapshots SET facets=$2::jsonb,taxonomy_version=$3 WHERE id=$1", [id, JSON.stringify(catalog.facets), CATEGORY_VERSION]),
  ], { fetchOptions: { signal: AbortSignal.timeout(45000) } });
  const distribution = await query<{ category: string; count: number }>("SELECT category,count(*)::int AS count FROM mh_jobs WHERE snapshot_id=$1 GROUP BY category ORDER BY category", [id]);
  for (const category of catalog.facets.categories) if ((distribution.find(item => item.category === category.value)?.count ?? 0) !== category.count) throw new Error("Hitungan kategori tidak sesuai sumber");
  const [after] = await query<{ embedded: number; tokens: string }>(`SELECT count(e.hash)::int AS embedded,
    (SELECT coalesce(sum(tokens),0)::text FROM mh_embedding_runs WHERE snapshot_id=$1) AS tokens
    FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash WHERE j.snapshot_id=$1`, [id]);
  if (before.embedded !== after.embedded || before.tokens !== after.tokens) throw new Error("Metadata embedding berubah saat klasifikasi");
  console.log(JSON.stringify({ event: "classification_complete", snapshotId: id, categoryVersion: CATEGORY_VERSION, jobs: before.jobs, changed: results[1].length, embedded: after.embedded, embeddingTokensUnchanged: true, categories: catalog.facets.categories }, null, 2));
}
main().catch(reportError);
