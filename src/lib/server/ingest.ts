import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { CATEGORY_VERSION } from "../job-categories";
import { embedTexts } from "./embeddings";
import { ServiceError } from "./errors";
import { prepareIngestRecords, type IngestInput } from "./ingest-input";
import { createIngestStore, type IngestCounts } from "./ingest-store";
import { orderIngestRecords } from "./ingest-order";

export async function ingestJobs(input: IngestInput, store = createIngestStore(), embed = embedTexts) {
  const generated = new Map<string, string>();
  let tokens = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    const catalog = await store.catalog();
    if (catalog.categoryVersion !== CATEGORY_VERSION) throw new ServiceError("CATALOG_VERSION_MISMATCH", "Perbarui klasifikasi katalog sebelum ingest.", 409);
    const existing = new Map((await store.existing(catalog.id, input.jobs.map(job => job.payload.id))).map(job => [job.id, job]));
    const counts: IngestCounts = { inserted: 0, updated: 0, unchanged: 0, stale: 0 };
    const incoming = Date.parse(input.observedAt);
    const jobs = input.jobs.filter(job => {
      const previous = existing.get(job.payload.id);
      const floor = previous?.observedAt ? Date.parse(previous.observedAt) : Date.parse(`${catalog.snapshotDate}T00:00:00Z`);
      if (previous && incoming < floor) { counts.stale++; return false; }
      return true;
    });
    // Ignore stale content before allocating locations or preparing vectors.
    const prepared = prepareIngestRecords({ ...input, jobs }, catalog.facets);
    const records = prepared.records.filter(record => {
      const previous = existing.get(record.id);
      const time = previous?.observedAt ? Date.parse(previous.observedAt) : -Infinity;
      const same = previous && isDeepStrictEqual(previous.payload, record.payload);
      if (time === incoming) {
        if (!same) throw new ServiceError("OBSERVATION_CONFLICT", "ID dan observedAt yang sama memiliki isi berbeda. Kirim ulang payload asli atau ambil data terbaru.", 409);
        counts.unchanged++;
        return false;
      }
      if (!previous) counts.inserted++;
      else if (same) counts.unchanged++;
      else counts.updated++;
      // Even unchanged content advances observed_at to fence older deliveries.
      return true;
    });
    const reordered = records.some(record => !existing.has(record.id) || existing.get(record.id)!.payload.title !== record.payload.title);
    const ordered = reordered ? orderIngestRecords(await store.alphabetical(catalog.id), records) : {
      records: records.map(record => ({ ...record, az_order: existing.get(record.id)!.azOrder })), ranks: [],
    };
    const documents = new Map(records.map(record => [record.embedding_hash, record.embedding_text]));
    const available = new Set((await store.embeddings([...documents.keys()])).map(row => row.hash));
    const missing = [...documents].filter(([hash]) => !available.has(hash) && !generated.has(hash));
    if (missing.length) {
      const result = await embed(missing.map(([, text]) => text), { retries: 1, timeoutMs: 30000 });
      missing.forEach(([hash], index) => generated.set(hash, JSON.stringify(result.vectors[index])));
      tokens += result.tokens;
    }
    const runId = randomUUID();
    const committed = await store.commit({ runId, catalog, observedAt: input.observedAt, counts, prepared, ...ordered,
      embeddings: [...generated].map(([hash, embedding]) => ({ hash, embedding })), embeddingDocuments: generated.size, embeddingTokens: tokens });
    if (committed) return { runId, snapshotId: catalog.id, observedAt: input.observedAt, ...counts, embeddingDocuments: generated.size, embeddingTokens: tokens, ready: true, ...committed };
  }
  throw new ServiceError("CONCURRENT_INGEST", "Katalog berubah saat ingest. Kirim ulang batch yang sama.", 409);
}
