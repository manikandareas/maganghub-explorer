import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { CATEGORY_VERSION } from "../src/lib/job-categories";
import type { CatalogInfo } from "../src/lib/server/catalog-repository";
import { ServiceError } from "../src/lib/server/errors";
import { INGEST_BODY_LIMIT, parseIngestInput, prepareIngestRecords } from "../src/lib/server/ingest-input";
import { ingestJobs } from "../src/lib/server/ingest";
import { ingestResponse } from "../src/lib/server/ingest-http";
import type { IngestStore } from "../src/lib/server/ingest-store";
import { readSnapshot } from "../src/lib/snapshot";
import { jobOpportunityScore } from "../src/lib/server/job-record";
import { ingestFixture, fixtureTime } from "./fixtures/ingest";

const catalog: CatalogInfo = { id: "fixture", snapshotDate: "2026-10-31", status: "ready", categoryVersion: CATEGORY_VERSION,
  ingestRevision: 0, lastIngestedAt: null, expectedCount: 1,
  facets: { total: 1, organizations: 1, provinces: [{ value: "0", label: "Sulawesi Selatan" }], cities: [{ value: "0", label: "Kota Makassar", province: "0" }], categories: [] } };

test("ingestion preserves opportunity scores for every original snapshot record", () => {
  for (const row of readSnapshot().rows) assert.equal(jobOpportunityScore(row[6], row[7]), row[15], row[0]);
});

test("ingest validates full records, UTC observation time, enums, duplicates and bounds", () => {
  const job = ingestFixture();
  const body = { observedAt: fixtureTime, jobs: [job] };
  const input = parseIngestInput(body);
  assert.equal(input.jobs[0].payload.category, "dev");
  assert.equal(input.jobs[0].payload.score, 1.5);
  assert.deepEqual(input.jobs[0].payload.education, ["Sarjana"]);
  for (const invalid of [
    { ...body, observedAt: "2026-02-30T00:00:00Z" }, { ...body, observedAt: "2099-01-01T00:00:00Z" },
    { ...body, observedAt: "2026-10-31" }, { ...body, jobs: [] }, { ...body, jobs: [job, job] },
    { ...body, jobs: Array.from({ length: 51 }, () => ingestFixture()) }, { ...body, jobs: [{ id: job.id }] },
    { ...body, jobs: [{ ...job, education: ["S1"] }] }, { ...body, jobs: [{ ...job, quota: "5" }] },
    { ...body, jobs: [{ ...job, disability: 0 }] }, { ...body, jobs: [{ ...job, description: "a".repeat(20001) }] },
    { ...body, jobs: [{ ...job, interview: ["online", "online"] }] }, { ...body, extra: true },
  ]) assert.throws(() => parseIngestInput(invalid), { code: "INVALID_INGEST" });
  const missing = parseIngestInput({ ...body, jobs: [{ ...job, description: null, address: null }] });
  assert.equal(missing.jobs[0].payload.description, "");
});

test("new locations extend stable identifiers and numeric-only changes reuse embedding hashes", () => {
  const job = ingestFixture({ province: "SULAWESI SELATAN", city: "kota makassar", education: ["profesi", "diploma"], interview: ["onsite", "online"] });
  const prepared = prepareIngestRecords(parseIngestInput({ observedAt: fixtureTime, jobs: [job, ingestFixture({ province: "Provinsi Baru", city: "Kota Baru" })] }), catalog.facets);
  assert.equal(prepared.records[0].province_code, 0);
  assert.equal(prepared.records[0].payload.city, "Kota Makassar");
  assert.equal(prepared.records[0].education_mask, 5);
  assert.equal(prepared.records[0].interview_mask, 3);
  assert.equal(prepared.records[1].province_code, 1);
  assert.equal(prepared.records[1].city_code, 1);
  assert.equal(catalog.facets.provinces.length, 1);
  const changed = prepareIngestRecords(parseIngestInput({ observedAt: fixtureTime, jobs: [{ ...job, applicants: 7 }] }), catalog.facets);
  assert.equal(changed.records[0].embedding_hash, prepared.records[0].embedding_hash);
});

test("ingest retries revision conflicts without paying for the same embeddings again", async () => {
  let calls = 0, commits = 0;
  const store: IngestStore = {
    catalog: async () => ({ ...catalog, ingestRevision: commits }), existing: async () => [], alphabetical: async () => [], embeddings: async () => [],
    commit: async batch => {
      commits++;
      assert.equal(batch.counts.inserted, 1);
      assert.equal(batch.embeddings.length, 1);
      return commits === 1 ? null : { revision: commits, lastIngestedAt: fixtureTime };
    },
  };
  const result = await ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [ingestFixture()] }), store, async texts => {
    calls++;
    return { vectors: texts.map(() => [1, ...new Array(511).fill(0)]), tokens: 10, model: "openai/text-embedding-3-small" };
  });
  assert.equal(calls, 1);
  assert.equal(commits, 2);
  assert.equal(result.embeddingTokens, 10);
  assert.equal(result.ready, true);
});

test("provider failure never calls the publishing transaction", async () => {
  let commits = 0;
  const store: IngestStore = { catalog: async () => catalog, existing: async () => [], alphabetical: async () => [], embeddings: async () => [], commit: async () => { commits++; return null; } };
  await assert.rejects(ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [ingestFixture()] }), store, async () => { throw new ServiceError("EMBEDDING_HTTP_429", "Provider unavailable", 429); }), { code: "EMBEDDING_HTTP_429" });
  assert.equal(commits, 0);
});

test("HTTP authentication runs before body, database admission or embedding, with private responses", async () => {
  const previous = process.env.INGEST_API_KEY;
  process.env.INGEST_API_KEY = "x".repeat(64);
  let admitted = 0, ingested = 0;
  const admit = async () => { admitted++; };
  const ingest: typeof ingestJobs = async input => {
    ingested++;
    return { runId: randomUUID(), snapshotId: "fixture", observedAt: input.observedAt, inserted: input.jobs.length, updated: 0, unchanged: 0, stale: 0, embeddingDocuments: 1, embeddingTokens: 10, ready: true, revision: 1, lastIngestedAt: fixtureTime };
  };
  const request = (body: string, key = process.env.INGEST_API_KEY, contentType = "application/json") => new Request("https://example.test/api/internal/jobs/ingest", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType }, body,
  });
  try {
    const denied = await ingestResponse(request("not json", "wrong"), ingest, admit);
    assert.equal(denied.status, 401);
    assert.equal(admitted, 0);
    assert.equal(denied.headers.get("cache-control"), "no-store");
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
    delete process.env.INGEST_API_KEY;
    assert.equal((await ingestResponse(request("{}"), ingest, admit)).status, 503);
    process.env.INGEST_API_KEY = "x".repeat(64);
    assert.equal((await ingestResponse(request("not json"), ingest, admit)).status, 400);
    assert.equal((await ingestResponse(request("{}", undefined, "text/plain"), ingest, admit)).status, 415);
    assert.equal((await ingestResponse(request(" ".repeat(INGEST_BODY_LIMIT + 1)), ingest, admit)).status, 413);
    const body = JSON.stringify({ observedAt: fixtureTime, jobs: [ingestFixture()] });
    const success = await ingestResponse(request(body), ingest, admit);
    assert.equal(success.status, 200);
    assert.equal((await success.json()).ready, true);
    assert.equal(ingested, 1);
    const rate = await ingestResponse(request(body), ingest, async () => { throw new ServiceError("RATE_LIMITED", "Slow down", 429, 23); });
    assert.equal(rate.status, 429);
    assert.equal(rate.headers.get("retry-after"), "23");
    const provider = await ingestResponse(request(body), async () => { throw new ServiceError("EMBEDDING_HTTP_401", "Upstream unavailable", 401); }, admit);
    assert.equal(provider.status, 503);
    for (const code of ["EMBEDDING_INVALID_INPUT", "EMBEDDING_HTTP_400", "EMBEDDING_HTTP_413", "EMBEDDING_HTTP_422"]) {
      const rejected = await ingestResponse(request(body), async () => { throw new ServiceError(code, "Permanent input error", 400); }, admit);
      assert.equal(rejected.status, 422);
      assert.equal((await rejected.json()).error.code, "EMBEDDING_INPUT_REJECTED");
      assert.equal(rejected.headers.get("retry-after"), null);
    }
  } finally { if (previous === undefined) delete process.env.INGEST_API_KEY; else process.env.INGEST_API_KEY = previous; }
});
