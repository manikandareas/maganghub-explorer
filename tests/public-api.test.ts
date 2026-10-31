import assert from "node:assert/strict";
import test from "node:test";
import { getFacets } from "../src/lib/jobs";
import { parsePublicSearch, publicFacets, publicJob } from "../src/lib/server/public-api";
import { openApiDocument } from "../src/lib/server/openapi";

test("public filters accept stable location values, keep zero-valued legacy codes, and reject invalid input", () => {
  const facets = getFacets();
  const exposed = publicFacets(facets);
  const zeroCity = facets.cities.findIndex(item => item.value === "0");
  const params = new URLSearchParams({ city: exposed.cities[zeroCity].value, organizationType: "company", education: "sarjana", mode: "keyword", limit: "50" });
  const parsed = parsePublicSearch(params, facets);
  assert.equal(parsed.filters.city, "0");
  assert.equal(parsed.filters.org, "0");
  assert.equal(parsed.filters.edu, "2");
  assert.equal(parsed.limit, 50);
  for (const value of ["limit=51", "page=0", "mode=anything", "q=a&q=b", "province=missing", "disability=true", "minQuota=NaN", `q=${"a".repeat(251)}`]) assert.throws(() => parsePublicSearch(new URLSearchParams(value), facets), { code: "INVALID_PARAMETER" }, value);
});

test("all unknown parameters are ignored without changing search, including repeated values", () => {
  const facets = getFacets();
  const params = new URLSearchParams({ q: "perawat", category: "kesehatan", education: "sarjana", mode: "keyword", sort: "quota", page: "2", limit: "4" });
  const expected = parsePublicSearch(params, facets);
  const extras = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "utm_source_platform", "utm_custom", "UTM_SOURCE", "gclid", "dclid", "fbclid", "msclkid", "ref", "source", "ai_client", "future_ai_parameter", "ids", "saved", "limti", "utm_", "__proto__"];
  for (const key of extras) {
    const tagged = new URLSearchParams(params);
    tagged.append(key, "chatgpt.com");
    tagged.append(key, "another-source");
    assert.deepEqual(parsePublicSearch(tagged, facets), expected, key);
  }
  assert.deepEqual(parsePublicSearch(new URLSearchParams("utm_source=chatgpt.com&future_ai_parameter=example"), facets), parsePublicSearch(new URLSearchParams(), facets));
});

test("unknown parameters cannot bypass validation of recognized search parameters", () => {
  const facets = getFacets();
  for (const value of ["utm_source=chatgpt.com&limit=51", "future_ai_parameter=value&q=a&q=b", "source=claude&category=missing", "ref=gemini&page=0", "extra=1&limit=4&limit=8", "extra=1&mode=anything", `source=ai&q=${"a".repeat(251)}`]) {
    assert.throws(() => parsePublicSearch(new URLSearchParams(value), facets), { code: "INVALID_PARAMETER" }, value);
  }
});

test("OpenAPI documents the implemented parameters and JSON response fields", () => {
  const document = openApiDocument();
  assert.equal(document.openapi, "3.1.0");
  assert.deepEqual(document.security, []);
  assert.ok(document.paths["/api/v1/jobs"].get.parameters.some(parameter => parameter.name === "mode"));
  assert.ok(document.components.schemas.Metadata.properties.fallbackReason);
  assert.ok(document.components.schemas.Job.properties.opportunityScore);
  assert.equal(typeof publicJob, "function");
});
