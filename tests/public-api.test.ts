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
  for (const value of ["limit=51", "page=0", "mode=anything", "q=a&q=b", "ids=private", "province=missing", "disability=true", "minQuota=NaN", `q=${"a".repeat(251)}`]) assert.throws(() => parsePublicSearch(new URLSearchParams(value), facets), { code: "INVALID_PARAMETER" }, value);
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
