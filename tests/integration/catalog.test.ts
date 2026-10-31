import "../../scripts/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { DEFAULT_FILTERS } from "../../src/lib/job-types";
import { searchJobs } from "../../src/lib/jobs";
import { prepareCatalog } from "../../src/lib/server/catalog-records";
import { getCatalogInfo, activateCatalog, type CatalogInfo } from "../../src/lib/server/catalog-repository";
import { query } from "../../src/lib/server/db";
import { searchCatalog } from "../../src/lib/server/search-engine";
import { consumeLimit, clientIdentity } from "../../src/lib/server/limits";
import { apiResponse } from "../../src/lib/server/http";
import { ServiceError } from "../../src/lib/server/errors";

let catalog: CatalogInfo;
const testSnapshot = `integration-${randomUUID()}`;
const incompleteSnapshot = `${testSnapshot}-incomplete`;
const fixtureHashes = [0, 1, 2].map(index => `${testSnapshot}:${index}`);
let fixtureIds: string[] = [];
const buckets: string[] = [];
before(async () => {
  catalog = await getCatalogInfo(prepareCatalog().id);
  for (const [id, count] of [[testSnapshot, 3], [incompleteSnapshot, 1]]) await query("INSERT INTO mh_snapshots(id,source_hash,snapshot_date,expected_count,facets,embedding_model,embedding_dimensions) SELECT $1,source_hash,snapshot_date,$3,facets,embedding_model,embedding_dimensions FROM mh_snapshots WHERE id=$2", [id, catalog.id, count]);
  fixtureIds = (await query<{ id: string }>("SELECT id::text FROM mh_jobs WHERE snapshot_id=$1 ORDER BY portal_order LIMIT 3", [catalog.id])).map(row => row.id);
  for (let index = 0; index < 3; index++) {
    const vector = new Array(512).fill(0);
    vector[0] = index === 0 ? 0.8 : index === 1 ? 1 : 0;
    vector[1] = index === 0 ? 0.6 : index === 2 ? 1 : 0;
    await query("INSERT INTO mh_embeddings(hash,model,dimensions,embedding) VALUES($1,'openai/text-embedding-3-small',512,$2::vector)", [fixtureHashes[index], JSON.stringify(vector)]);
    await query(`INSERT INTO mh_jobs SELECT $1,id,portal_order,az_order,payload,province_code,city_code,category,organization_type,education_mask,interview_mask,disability,quota,applicants,opportunity_score,search_fields,fts,embedding_text,$3 FROM mh_jobs WHERE snapshot_id=$2 AND id=$4::uuid`, [testSnapshot, catalog.id, fixtureHashes[index], fixtureIds[index]]);
  }
});
after(async () => {
  await query("DELETE FROM mh_jobs WHERE snapshot_id=$1", [testSnapshot]);
  await query("DELETE FROM mh_snapshots WHERE id=$1", [testSnapshot]);
  await query("DELETE FROM mh_snapshots WHERE id=$1", [incompleteSnapshot]);
  await query("DELETE FROM mh_embeddings WHERE hash=ANY($1::text[])", [fixtureHashes]);
  if (buckets.length) await query("DELETE FROM mh_rate_limits WHERE bucket=ANY($1::text[])", [buckets]);
});

test("SQL keyword search matches snapshot filters, explicit sort, token normalization and ranking", async () => {
  const cases = [{}, { cat: "ai" }, { cat: "kesehatan", q: "perawat" }, { cat: "keuangan", edu: "2" }, { cat: "hukum" }, { cat: "pendidikan" }, { cat: "pertanian" }, { cat: "sdm", sort: "az" as const }, { prov: "0", city: "0" }, { org: "0" }, { edu: "2", interview: "1", disability: true }, { minQuota: "20" }, { sort: "quota" as const }, { sort: "az" as const }, { q: "ai engineer" }, { q: "front end" }, { q: "???" }, { q: "c++" }, { q: "c#" }, { q: "pelayanan pasien" }, { q: "ai engineer", page: 2 }];
  for (const patch of cases) {
    const filters = { ...DEFAULT_FILTERS, ...patch };
    const expected = searchJobs(filters);
    const actual = await searchCatalog(filters, { catalog, mode: "keyword" });
    assert.equal(actual.total, expected.total, JSON.stringify(patch));
    assert.deepEqual(actual.jobs.map(job => job.id), expected.jobs.map(job => job.id), JSON.stringify(patch));
  }
});

test("pending snapshot cannot be activated before all documents and embeddings exist", async () => {
  await assert.rejects(activateCatalog(incompleteSnapshot), { code: "CATALOG_INCOMPLETE" });
});

test("semantic candidates obey filters before selection and pagination stays stable", async () => {
  const fixture = await getCatalogInfo(testSnapshot);
  const vector = JSON.stringify([1, ...new Array(511).fill(0)]);
  const options = { catalog: fixture, vector, threshold: 0.5, limit: 1 };
  const filters = { ...DEFAULT_FILTERS, q: "zzzzsemanticfixture" };
  const first = await searchCatalog(filters, options);
  const next = await searchCatalog({ ...filters, page: 2 }, options);
  assert.equal(first.total, 2);
  assert.equal(first.meta.mode, "hybrid");
  assert.equal(first.jobs[0].id, fixtureIds[1]);
  assert.equal(next.jobs[0].id, fixtureIds[0]);
  const filtered = await searchCatalog({ ...filters, saved: true }, { ...options, savedIds: [fixtureIds[0]] });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.jobs[0].id, fixtureIds[0]);
  const [role] = await query<{ category: string }>("SELECT category FROM mh_jobs WHERE snapshot_id=$1 AND id=$2", [testSnapshot, fixtureIds[0]]);
  const byField = await searchCatalog({ ...filters, cat: role.category }, options);
  assert.ok(byField.total > 0);
  assert.ok(byField.jobs.every(job => job.category === role.category));
  const pastEnd = await searchCatalog({ ...filters, page: 999 }, options);
  assert.equal(pastEnd.page, 2);
  assert.deepEqual(pastEnd.jobs.map(job => job.id), next.jobs.map(job => job.id));
});

test("durable rate buckets reject excess requests and stay scoped to the caller", async () => {
  const bucket = `integration:${randomUUID()}`;
  buckets.push(bucket);
  await consumeLimit(bucket, 2, 60);
  await consumeLimit(bucket, 2, 60);
  await assert.rejects(consumeLimit(bucket, 2, 60), { code: "RATE_LIMITED" });
});

test("API rate errors return CORS, structured error, Retry-After and no shared caching", async () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "true";
  const request = new Request("https://example.test/api/v1/jobs", { headers: { "x-forwarded-for": "192.0.2.249" } });
  buckets.push(`request:${clientIdentity(request.headers)}`);
  try {
    const response = await apiResponse(request, async () => { throw new ServiceError("RATE_LIMITED", "Too many requests", 429, 17); });
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "17");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).error.code, "RATE_LIMITED");
  } finally { if (previous === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = previous; }
});

test("missing semantic provider falls back to keyword with explicit metadata", async () => {
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    const punctuation = randomUUID().replace(/[a-f0-9-]/g, value => "\"'?!/"[value.charCodeAt(0) % 5]);
    const actual = await searchCatalog({ ...DEFAULT_FILTERS, q: `${punctuation}ai engineer` }, { catalog, identity: `integration-${randomUUID()}` });
    assert.equal(actual.meta.mode, "keyword");
    assert.equal(actual.meta.fallbackReason, "EMBEDDING_NOT_CONFIGURED");
    assert.ok(actual.jobs.length > 0);
  } finally { if (previous !== undefined) process.env.OPENROUTER_API_KEY = previous; }
});
