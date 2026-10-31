import { embeddingHash } from "./embedding-text";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config";
import { query } from "./db";
import { embedTexts } from "./embeddings";
import { consumeLimit } from "./limits";
import { ServiceError } from "./errors";

// Request coalescing is an optimization; durable limits and cache remain in Neon.
const pending = new Map<string, Promise<string>>();

export async function queryEmbedding(text: string, identity: string): Promise<string> {
  const normalized = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  const hash = embeddingHash(normalized);
  const [cached] = await query<{ embedding: string }>("SELECT embedding::text FROM mh_query_cache WHERE hash=$1 AND model=$2 AND dimensions=$3 AND expires_at>now()", [hash, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS]);
  if (cached) return cached.embedding;
  if (pending.has(hash)) return pending.get(hash)!;
  const task = (async () => {
    await consumeLimit(`embedding:${identity}`, 10, 60);
    await consumeLimit("embedding:global", Number(process.env.EMBEDDING_DAILY_LIMIT ?? 10000), 86400);
    if (pending.size > 4) throw new ServiceError("EMBEDDING_BUSY", "Pencarian semantic sedang sibuk");
    const result = await embedTexts([normalized]);
    const vector = JSON.stringify(result.vectors[0]);
    await query(`WITH evicted AS (
      DELETE FROM mh_query_cache WHERE hash IN (SELECT hash FROM mh_query_cache ORDER BY (expires_at<now()) DESC,created_at LIMIT CASE WHEN (SELECT count(*) FROM mh_query_cache)>=10000 THEN 100 ELSE 0 END)
    ) INSERT INTO mh_query_cache(hash,model,dimensions,embedding) VALUES($1,$2,$3,$4::vector)
      ON CONFLICT(hash) DO UPDATE SET embedding=excluded.embedding,expires_at=now()+interval '7 days'`, [hash, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, vector]);
    return vector;
  })();
  pending.set(hash, task);
  try { return await task; } finally { pending.delete(hash); }
}
