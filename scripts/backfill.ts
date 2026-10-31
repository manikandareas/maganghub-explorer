import "./env";
import { argument, integerArgument, reportError } from "./env";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { getCatalogInfo } from "../src/lib/server/catalog-repository";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION } from "../src/lib/server/config";
import { database, query } from "../src/lib/server/db";
import { embedTexts } from "../src/lib/server/embeddings";

async function main() {
  const id = argument("snapshot") ?? prepareCatalog().id;
  const info = await getCatalogInfo(id);
  const batchSize = integerArgument("batch-size", 128, 128);
  const maximum = argument("limit") ? integerArgument("limit", 128, 100000) : Infinity;
  let documents = 0, tokens = 0;
  const started = Date.now();
  for (;;) {
    const batch = await query<{ hash: string; text: string }>(`SELECT DISTINCT ON (j.embedding_hash) j.embedding_hash AS hash,j.embedding_text AS text
      FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash AND e.model=$2 AND e.dimensions=$3
      WHERE j.snapshot_id=$1 AND e.hash IS NULL ORDER BY j.embedding_hash LIMIT $4`, [id, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, Math.min(batchSize, maximum - documents)]);
    if (!batch.length) break;
    const result = await embedTexts(batch.map(item => item.text), { retries: 3, timeoutMs: 45000 });
    const values = batch.map((item, index) => ({ hash: item.hash, embedding: JSON.stringify(result.vectors[index]) }));
    const sql = database();
    await sql.transaction([
      sql.query(`INSERT INTO mh_embeddings(hash,model,dimensions,embedding,embedding_text_version)
        SELECT r.hash,$2,$3,r.embedding::vector,$5 FROM jsonb_to_recordset($1::jsonb) r(hash text,embedding text)
        WHERE EXISTS(SELECT 1 FROM mh_jobs j WHERE j.snapshot_id=$4 AND j.embedding_hash=r.hash)
        ON CONFLICT(hash) DO NOTHING`, [JSON.stringify(values), EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, id, EMBEDDING_TEXT_VERSION]),
      sql.query("INSERT INTO mh_embedding_runs(snapshot_id,documents,tokens,estimated_cost_usd) VALUES($1,$2,$3,$4)", [id, batch.length, result.tokens, result.tokens * 0.02 / 1000000]),
    ], { fetchOptions: { signal: AbortSignal.timeout(30000) } });
    documents += batch.length;
    tokens += result.tokens;
    console.log(JSON.stringify({ event: "embedding_batch", documentsThisRun: documents, tokensThisRun: tokens, estimatedCostUsd: tokens * 0.02 / 1000000, elapsedSeconds: Math.round((Date.now() - started) / 1000), lastBatch: batch.length }));
    if (documents >= maximum) break;
  }
  const [coverage] = await query<{ jobs: number; embedded: number }>(`SELECT count(*)::int AS jobs,count(e.hash)::int AS embedded FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash AND e.model=$2 AND e.dimensions=$3 WHERE j.snapshot_id=$1`, [id, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS]);
  console.log(JSON.stringify({ event: "backfill_complete", snapshotId: info.id, ...coverage, documentsThisRun: documents, tokensThisRun: tokens, activated: false }));
}
main().catch(reportError);
