import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { argument, reportError } from "./env";
import { clientIdentity } from "../src/lib/server/limits";
import { query } from "../src/lib/server/db";

async function main() {
  const origin = argument("base-url") ?? "http://localhost:3107";
  const checks: { name: string; status: number; elapsedMs: number }[] = [];
  const get = async (path: string, expected = 200, init?: RequestInit) => {
    const start = Date.now();
    const response = await fetch(`${origin}${path}`, { ...init, signal: AbortSignal.timeout(30000) });
    checks.push({ name: path, status: response.status, elapsedMs: Date.now() - start });
    assert.equal(response.status, expected, path);
    return response;
  };
  const facets = await (await get("/api/v1/facets")).json();
  assert.equal(facets.total, 27667);
  assert.equal(facets.provinces.length, 38);
  assert.equal(facets.cities.length, 460);
  assert.equal(facets.meta.isLive, false);
  assert.equal(facets.meta.categoryVersion, 2);
  assert.equal(facets.meta.categorySource, "inferred_from_position_title");
  assert.equal(facets.categories.length, 22);
  assert.equal(facets.categories.reduce((sum: number, item: { count: number }) => sum + item.count, 0), facets.total);
  for (const category of ["kesehatan", "keuangan", "hukum", "pendidikan", "pertanian", "sdm"]) {
    const field = await (await get(`/api/v1/jobs?category=${category}&mode=keyword&limit=4`)).json();
    assert.equal(field.total, facets.categories.find((item: { value: string }) => item.value === category).count);
    assert.ok(field.jobs.length > 0 && field.jobs.every((job: { category: string }) => job.category === category));
  }
  const result = await (await get("/api/v1/jobs?q=ai%20engineer&mode=keyword&limit=4")).json();
  assert.ok(result.jobs.every((job: { title: string }) => job.title.toLowerCase() === "ai engineer"));
  assert.ok(result.jobs.every((job: Record<string, unknown>) => "opportunityScore" in job && !("score" in job) && "sourceUrl" in job));
  const hybridPath = "/api/v1/jobs?q=mengolah%20angka%20dan%20membuat%20dashboard&limit=5";
  const hybrid = await (await get(hybridPath)).json();
  assert.equal(hybrid.meta.mode, "hybrid");
  assert.equal(hybrid.meta.fallbackReason, undefined);
  assert.ok(hybrid.jobs.some((job: { title: string }) => /data analyst|analis data|business intelligence|data science/i.test(job.title)));
  const cached = await (await get(hybridPath)).json();
  assert.deepEqual(cached.jobs, hybrid.jobs);
  const next = await (await get(`${hybridPath}&page=2`)).json();
  assert.ok(next.jobs.every((job: { id: string }) => !hybrid.jobs.some((previous: { id: string }) => previous.id === job.id)));
  const city = facets.cities.find((item: { label: string }) => /makassar/i.test(item.label));
  const location = await (await get(`/api/v1/jobs?city=${encodeURIComponent(city.value)}&mode=keyword`)).json();
  assert.ok(location.jobs.length > 0 && location.jobs.every((job: { city: string }) => job.city === city.label));
  const detail = await (await get(`/api/v1/jobs/${result.jobs[0].id}`)).json();
  assert.equal(detail.job.id, result.jobs[0].id);
  const missingDescription = await (await get("/api/v1/jobs/01a13d7a-830f-71ab-892b-8c2ca5345a88")).json();
  assert.equal(missingDescription.job.description, null);
  assert.equal(missingDescription.job.descriptionAvailable, false);
  await get("/api/v1/jobs/00000000-0000-0000-0000-000000000000", 404);
  const invalid = await (await get("/api/v1/jobs?limit=51", 400)).json();
  assert.equal(invalid.error.code, "INVALID_PARAMETER");
  const options = await get("/api/v1/jobs", 204, { method: "OPTIONS", headers: { Origin: "https://example.com", "Access-Control-Request-Method": "GET" } });
  assert.equal(options.headers.get("access-control-allow-origin"), "*");
  const spec = await (await get("/openapi.json")).json();
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/api/v1/jobs"]);
  const llms = await get("/llms.txt");
  assert.match(llms.headers.get("content-type") ?? "", /text\/plain/);
  assert.match(await llms.text(), /openapi\.json/);
  const singular = await get("/llm.txt", 308, { redirect: "manual" });
  assert.equal(singular.headers.get("location"), "/llms.txt");
  const sitemap = await (await get("/sitemap.xml")).text();
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(item => item[1]);
  assert.equal(locations.length, 27669);
  assert.equal(new Set(locations).size, locations.length);
  assert.match(await (await get("/robots.txt")).text(), /sitemap\.xml/);
  const legacy = await (await get("/api/jobs?q=ai%20engineer")).json();
  assert.ok(legacy.jobs.length && "score" in legacy.jobs[0]);
  if (process.argv.includes("--check-limits")) {
    assert.equal(process.env.TRUST_PROXY, "true", "Use only with a loopback test server configured to trust test forwarding headers");
    const headers = new Headers({ "x-forwarded-for": "192.0.2.241" });
    const bucket = `request:${clientIdentity(headers)}`;
    try {
      await query("INSERT INTO mh_rate_limits(bucket,window_start,count) VALUES($1,to_timestamp(floor(extract(epoch FROM now())/60)*60),60) ON CONFLICT(bucket,window_start) DO UPDATE SET count=60", [bucket]);
      const limited = await get("/api/v1/jobs?mode=keyword", 429, { headers });
      assert.equal(limited.headers.get("retry-after"), "60");
    } finally { await query("DELETE FROM mh_rate_limits WHERE bucket=$1", [bucket]); }
  }
  const summary = { origin, scope: "Local HTTP verification, not a deployed production test", passed: checks.length, checks };
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync("docs/evidence/api-verification.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify({ passed: checks.length, origin }));
}
main().catch(reportError);
