import "../../scripts/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { DEFAULT_FILTERS } from "../../src/lib/job-types";
import { dataMetadata, findJob, getCatalogInfo } from "../../src/lib/server/catalog-repository";
import { ServiceError } from "../../src/lib/server/errors";
import { parseIngestInput, prepareIngestRecords } from "../../src/lib/server/ingest-input";
import { ingestJobs } from "../../src/lib/server/ingest";
import { ingestResponse } from "../../src/lib/server/ingest-http";
import { parsePublicSearch, publicFacets } from "../../src/lib/server/public-api";
import { searchCatalog } from "../../src/lib/server/search-engine";
import { ingestFixture, fixtureTime } from "../fixtures/ingest";
import { createIngestDatabase } from "../fixtures/ingest-database";

// All writes, embeddings and the active pointer resolve to disposable tables in
// this schema. The real active catalog is only read as a source for one seed row.
let fixture: Awaited<ReturnType<typeof createIngestDatabase>>;
async function scopedQuery<T>(text: string, parameters: unknown[] = []): Promise<T[]> {
  return fixture.execute<T>(text, parameters);
}
let store: Awaited<ReturnType<typeof createIngestDatabase>>["store"];
const vector = [1, ...new Array(511).fill(0)];
let embeddingCalls = 0;
const embed = async (texts: string[]) => { embeddingCalls++; return { vectors: texts.map(() => vector), tokens: texts.length * 10, model: "openai/text-embedding-3-small" }; };
const job = ingestFixture({ title: "ZZIngest Backend Developer", province: "Provinsi Fixture", city: "Kota Fixture" });

before(async () => {
  fixture = await createIngestDatabase();
  store = fixture.store;
});
after(async () => { if (fixture) await fixture.cleanup(); });

test("ingest publishes jobs, embeddings, FTS, new location filters and metadata together", async () => {
  const previousKey = process.env.INGEST_API_KEY;
  process.env.INGEST_API_KEY = "integration-key-".repeat(4);
  const request = new Request("https://example.test/api/internal/jobs/ingest", { method: "POST",
    headers: { Authorization: `Bearer ${process.env.INGEST_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ observedAt: fixtureTime, jobs: [job] }),
  });
  let response: Response;
  try { response = await ingestResponse(request, input => ingestJobs(input, store, embed), async () => {}); }
  finally { if (previousKey === undefined) delete process.env.INGEST_API_KEY; else process.env.INGEST_API_KEY = previousKey; }
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.inserted, 1);
  assert.equal(result.embeddingDocuments, 1);
  assert.equal(result.ready, true);
  const catalog = await store.catalog();
  assert.equal(catalog.expectedCount, 2);
  assert.equal(catalog.facets.total, 2);
  assert.equal(dataMetadata(catalog).dataMode, "incremental");
  assert.equal((await findJob(job.id, catalog, scopedQuery))?.observedAt !== null, true);
  const facets = publicFacets(catalog.facets);
  const city = facets.cities.find(option => option.label === job.city)!;
  assert.equal(city.count, 1);
  const parsed = parsePublicSearch(new URLSearchParams({ city: city.value, q: "zzingest", mode: "keyword" }), catalog.facets);
  const keyword = await searchCatalog(parsed.filters, { catalog, mode: "keyword" }, scopedQuery);
  assert.deepEqual(keyword.jobs.map(value => value.id), [job.id]);
  const semantic = await searchCatalog({ ...DEFAULT_FILTERS, q: "unmatchedsemanticquery" }, { catalog, vector: JSON.stringify(vector), threshold: 0.999 }, scopedQuery);
  assert.ok(semantic.jobs.some(value => value.id === job.id));
});

test("duplicate delivery and counter updates reuse vectors; changed text creates a new one", async () => {
  const duplicate = await ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [job] }), store, embed);
  assert.equal(duplicate.unchanged, 1);
  assert.equal(duplicate.embeddingDocuments, 0);
  const changed = { ...job, quota: 20, applicants: 10 };
  const numeric = await ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:01:00Z", jobs: [changed] }), store, embed);
  assert.equal(numeric.updated, 1);
  assert.equal(numeric.embeddingDocuments, 0);
  const description = { ...changed, description: "Deskripsi baru PostgreSQL untuk posisi backend." };
  const text = await ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:02:00Z", jobs: [description] }), store, embed);
  assert.equal(text.updated, 1);
  assert.equal(text.embeddingDocuments, 1);
  const newer = await ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:04:00Z", jobs: [description] }), store, embed);
  assert.equal(newer.unchanged, 1);
  const old = await ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:03:00Z", jobs: [job] }), store, embed);
  assert.equal(old.stale, 1);
  const stored = await findJob(job.id, await store.catalog(), scopedQuery);
  assert.equal(stored?.quota, 20);
  assert.equal(stored?.description, description.description);
  assert.equal(Date.parse(stored!.observedAt!), Date.parse("2026-10-31T00:04:00Z"));
  assert.equal(embeddingCalls, 2);
});

test("overlapping batches retry safely and allocate distinct stable locations", async () => {
  const inputs = ["A", "B"].map(suffix => ingestFixture({ province: `Provinsi Concurrent ${suffix}`, city: `Kota Concurrent ${suffix}` }));
  const results = await Promise.all(inputs.map(value => ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [value] }), store, embed)));
  assert.ok(results.every(result => result.inserted === 1 && result.ready));
  const catalog = await store.catalog();
  assert.equal(catalog.expectedCount, 4);
  const provinces = catalog.facets.provinces.filter(value => value.label.startsWith("Provinsi Concurrent"));
  assert.equal(new Set(provinces.map(value => value.value)).size, 2);
  assert.ok(provinces.every(value => value.count === 1));
});

test("provider errors, missing vectors and equal-timestamp conflicts publish no partial batch", async () => {
  const before = await store.catalog();
  const input = parseIngestInput({ observedAt: fixtureTime, jobs: [ingestFixture({ title: "Unpublished unique fixture" })] });
  await assert.rejects(ingestJobs(input, store, async () => { throw new ServiceError("EMBEDDING_HTTP_429", "Provider busy", 429); }), { code: "EMBEDDING_HTTP_429" });
  const prepared = prepareIngestRecords(input, before.facets);
  await assert.rejects(store.commit({ runId: randomUUID(), catalog: before, observedAt: fixtureTime, counts: { inserted: 1, updated: 0, unchanged: 0, stale: 0 }, prepared, records: prepared.records, ranks: [], embeddings: [], embeddingDocuments: 0, embeddingTokens: 0 }));
  await assert.rejects(ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:04:00Z", jobs: [{ ...job, title: "Conflicting fixture" }] }), store, embed), { code: "OBSERVATION_CONFLICT" });
  const after = await store.catalog();
  assert.equal(after.ingestRevision, before.ingestRevision);
  assert.equal(after.expectedCount, before.expectedCount);
  assert.equal(await findJob(input.jobs[0].payload.id, after, scopedQuery), null);
});

test("real provider embedding is stored and immediately consumable by hybrid search", { skip: !process.env.OPENROUTER_API_KEY }, async () => {
  const live = ingestFixture({ title: "Live Embedding Backend Fixture", description: "Build backend services with TypeScript, PostgreSQL and automated tests." });
  const result = await ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [live] }), store);
  assert.equal(result.embeddingDocuments, 1);
  const catalog = await store.catalog();
  const [embedding] = await scopedQuery<{ vector: string }>("SELECT e.embedding::text AS vector FROM mh_embeddings e JOIN mh_jobs j ON j.embedding_hash=e.hash WHERE j.snapshot_id=$1 AND j.id=$2::uuid", [catalog.id, live.id]);
  assert.equal(JSON.parse(embedding.vector).length, 512);
  const semantic = await searchCatalog({ ...DEFAULT_FILTERS, q: "unmatchedlivefixture" }, { catalog, vector: embedding.vector, threshold: 0.999 }, scopedQuery);
  assert.ok(semantic.jobs.some(value => value.id === live.id));
});

test("ingestion tests preserve the actual active catalog and counts", async () => {
  const current = await getCatalogInfo();
  assert.equal(current.id, fixture.source.id);
  assert.equal(current.ingestRevision, fixture.source.ingestRevision);
  assert.equal(current.expectedCount, fixture.source.expectedCount);
});
