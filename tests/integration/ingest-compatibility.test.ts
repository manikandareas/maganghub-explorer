import "../../scripts/env";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { DEFAULT_FILTERS, type JobDetail } from "../../src/lib/job-types";
import { getCatalogInfo } from "../../src/lib/server/catalog-repository";
import { query, transaction } from "../../src/lib/server/db";
import { parseIngestInput } from "../../src/lib/server/ingest-input";
import { ingestJobs } from "../../src/lib/server/ingest";
import { compareJobTitles } from "../../src/lib/server/job-record";
import { searchCatalog } from "../../src/lib/server/search-engine";
import { createIngestDatabase } from "../fixtures/ingest-database";
import { ingestFixture, fixtureTime } from "../fixtures/ingest";

function sourceInput(job: JobDetail) {
  const education: Record<string, string> = { Diploma: "diploma", Sarjana: "sarjana", Profesi: "profesi" };
  const interview: Record<string, string> = { Daring: "online", "Tatap muka": "onsite" };
  return { id: job.id, title: job.title, organization: job.organization, organizationType: job.organizationType ? "government" : "company",
    province: job.province, city: job.city, quota: job.quota, applicants: job.applicants, education: job.education.map(value => education[value]),
    programs: job.programs, interview: job.interview.map(value => interview[value]), days: job.days, disability: job.disability, description: job.description, address: job.address };
}

test("full catalog preserves legacy ranking, fences old baseline data, and publishes changes atomically", async context => {
  const fixture = await createIngestDatabase(1000000);
  const { execute } = fixture;
  const durations: Record<string, number> = {};
  const operations: Record<string, number[]> = {};
  const timed = async <T>(name: string, action: () => Promise<T>) => {
    const start = performance.now();
    try { return await action(); }
    finally { (operations[name] ??= []).push(Math.round(performance.now() - start)); }
  };
  const store = { ...fixture.store,
    alphabetical: (id: string) => timed("alphabetical", () => fixture.store.alphabetical(id)),
    commit: (...args: Parameters<typeof fixture.store.commit>) => timed("commit", () => fixture.store.commit(...args)),
  };
  const before = await execute<{ id: string; azOrder: number }>("SELECT id::text,az_order AS \"azOrder\" FROM mh_jobs WHERE snapshot_id=$1 ORDER BY az_order,portal_order,id", [fixture.id]);
  const originalEmbeddings = await execute<{ count: number }>("SELECT count(*)::int AS count FROM mh_embeddings");
  const vector = [1, ...new Array(511).fill(0)];
  let generated = 0;
  const embed = async (texts: string[]) => { generated += texts.length; return { vectors: texts.map(() => vector), tokens: texts.length * 10, model: "openai/text-embedding-3-small" }; };
  try {
    assert.equal(before.length, fixture.source.expectedCount);
    const legacyTitles = await fixture.store.alphabetical(fixture.id);
    const legacyOrder = legacyTitles.sort((left, right) => compareJobTitles(left.title, right.title) || left.portalOrder - right.portalOrder || left.id.localeCompare(right.id));
    assert.deepEqual(before.map(job => job.id), legacyOrder.map(job => job.id));
    const [seed] = await execute<{ payload: JobDetail }>("SELECT payload FROM mh_jobs WHERE snapshot_id=$1 ORDER BY portal_order LIMIT 1", [fixture.id]);
    const input = sourceInput(seed.payload);
    let start = performance.now();
    const unchanged = await ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [input] }), store, embed);
    durations.unchangedMs = Math.round(performance.now() - start);
    assert.equal(unchanged.embeddingDocuments, 0);
    const after = await execute<{ id: string; azOrder: number }>("SELECT id::text,az_order AS \"azOrder\" FROM mh_jobs WHERE snapshot_id=$1 ORDER BY az_order,portal_order,id", [fixture.id]);
    assert.deepEqual(after, before);
    const catalog = await store.catalog();
    const page = await searchCatalog({ ...DEFAULT_FILTERS, sort: "az" }, { catalog, mode: "keyword" }, execute);
    assert.deepEqual(page.jobs.map(job => job.id), before.slice(0, 12).map(job => job.id));

    // This record has not received an observation timestamp yet.
    const [untouched] = await execute<{ payload: JobDetail }>("SELECT payload FROM mh_jobs WHERE snapshot_id=$1 AND observed_at IS NULL ORDER BY portal_order LIMIT 1", [fixture.id]);
    const stale = await ingestJobs(parseIngestInput({ observedAt: "2025-01-01T00:00:00Z", jobs: [{ ...sourceInput(untouched.payload), quota: 999, province: "Provinsi Kiriman Lama", city: "Kota Kiriman Lama" }] }), store, embed);
    assert.equal(stale.stale, 1);
    assert.deepEqual((await store.catalog()).facets, catalog.facets);
    const [preserved] = await execute<{ payload: JobDetail; observedAt: string | null }>("SELECT payload,observed_at AS \"observedAt\" FROM mh_jobs WHERE snapshot_id=$1 AND id=$2::uuid", [fixture.id, untouched.payload.id]);
    assert.deepEqual(preserved.payload, untouched.payload);
    assert.equal(preserved.observedAt, null);

    start = performance.now();
    const added = ingestFixture({ title: ".NET Backend Developer", province: "Sulawesi Selatan", city: "Kota Makassar" });
    const inserted = await ingestJobs(parseIngestInput({ observedAt: fixtureTime, jobs: [added] }), store, embed);
    durations.insertMs = Math.round(performance.now() - start);
    assert.equal(inserted.inserted, 1);
    start = performance.now();
    const renamed = await ingestJobs(parseIngestInput({ observedAt: "2026-10-31T00:05:00Z", jobs: [{ ...added, title: "é Backend Developer" }] }), store, embed);
    durations.renameMs = Math.round(performance.now() - start);
    assert.equal(renamed.updated, 1);
    const ranked = await execute<{ id: string; title: string; azOrder: number; portalOrder: number }>("SELECT id::text,payload->>'title' AS title,az_order AS \"azOrder\",portal_order AS \"portalOrder\" FROM mh_jobs WHERE snapshot_id=$1 ORDER BY az_order,portal_order,id", [fixture.id]);
    const expected = [...ranked].sort((left, right) => compareJobTitles(left.title, right.title) || left.portalOrder - right.portalOrder || left.id.localeCompare(right.id));
    assert.deepEqual(ranked.map(job => job.id), expected.map(job => job.id));
    assert.ok(ranked.every((job, index) => job.azOrder === index));
    assert.equal((await store.catalog()).expectedCount, before.length + 1);
    assert.equal(generated, 2);
    assert.equal((await execute<{ count: number }>("SELECT count(*)::int AS count FROM mh_embeddings"))[0].count, originalEmbeddings[0].count + 2);
    const current = await getCatalogInfo();
    assert.equal(current.id, fixture.source.id);
    assert.equal(current.ingestRevision, fixture.source.ingestRevision);
    assert.equal(current.expectedCount, fixture.source.expectedCount);
    context.diagnostic(JSON.stringify({ catalogRows: before.length, ...durations, operations, publicCatalogPreserved: true }));
  } finally { await fixture.cleanup(); }
});

test("incremental migration is additive, repeatable, and keeps legacy readers/writers working", async () => {
  const schema = `mh_migration_test_${randomUUID().replace(/-/g, "")}`;
  await query(`CREATE SCHEMA "${schema}"`);
  const execute = async (text: string, parameters: unknown[] = []) => (await transaction([{ text: `SET LOCAL search_path TO "${schema}",public`, parameters: [] }, { text, parameters }]))[1];
  const statements = (name: string) => readFileSync(`migrations/${name}`, "utf8").split(/;\s*(?:\n|$)/).map(text => text.trim()).filter(Boolean).map(text => ({ text, parameters: [] }));
  try {
    await transaction([{ text: `SET LOCAL search_path TO "${schema}",public`, parameters: [] }, ...["001_catalog.sql", "002_embedding_text_version.sql", "003_category_version.sql"].flatMap(statements)]);
    await execute("INSERT INTO mh_snapshots(id,source_hash,snapshot_date,expected_count,facets,status,embedding_model,embedding_dimensions) VALUES('legacy','legacy','2026-10-31',1,'{}','ready','openai/text-embedding-3-small',512)");
    await execute("INSERT INTO mh_active_catalog(singleton,snapshot_id) VALUES(true,'legacy')");
    for (let attempt = 0; attempt < 2; attempt++) await transaction([{ text: `SET LOCAL search_path TO "${schema}",public`, parameters: [] }, ...statements("004_incremental_ingest.sql")]);
    const legacy = await execute("SELECT s.id,s.expected_count FROM mh_snapshots s JOIN mh_active_catalog a ON a.snapshot_id=s.id WHERE a.singleton AND s.status='ready'");
    assert.deepEqual(legacy, [{ id: "legacy", expected_count: 1 }]);
    const metadata = await execute("SELECT ingest_revision,last_ingested_at FROM mh_snapshots WHERE id='legacy'");
    assert.deepEqual(metadata, [{ ingest_revision: 0, last_ingested_at: null }]);
    await execute("INSERT INTO mh_snapshots(id,source_hash,snapshot_date,expected_count,facets,embedding_model,embedding_dimensions) VALUES('legacy-import','legacy','2026-10-31',1,'{}','openai/text-embedding-3-small',512)");
  } finally { await query(`DROP SCHEMA "${schema}" CASCADE`); }
});
