import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { getFacets, getJob, searchJobs } from "../src/lib/jobs";
import { DEFAULT_FILTERS, filterParams, parseFilters, type Filters } from "../src/lib/job-types";

// Use the previous working explorer as an independent behavioral oracle.
const context = vm.createContext({ window: {}, document: { getElementById: () => ({ addEventListener() {} }) } });
for (let part = 1; part <= 4; part++) vm.runInContext(readFileSync(`data-${part}.js`, "utf8"), context);
const original = readFileSync("app.js", "utf8");
vm.runInContext(original.slice(0, original.lastIndexOf("\nbuildOptions();")) + `
globalThis.reference = (input) => {
  Object.assign(state, { q: input.q, prov: input.prov === '' ? -1 : +input.prov, city: input.city === '' ? -1 : +input.city,
    cat: input.cat, org: input.org === '' ? -1 : +input.org, edu: +input.edu, int: +input.interview,
    dis: +input.disability, minQ: +input.minQuota, sort: input.sort });
  return applySort(MH.rows.filter(matches)).map(row => row[0]);
};`, context);

const cases: Partial<Filters>[] = [
  {}, { q: "Data analyst" }, { q: "frontend" }, { q: "rumah sakit" },
  { q: "samarinda" }, { q: "teknik informatika" }, { q: "pelayanan pasien" },
  { q: "  DATA   ANALYST  " }, { cat: "ai" }, { cat: "data" }, { cat: "dev" },
  { cat: "it" }, { cat: "lain" }, { prov: "1" }, { city: "0" },
  { org: "0" }, { org: "1" }, { edu: "1" }, { edu: "2" }, { edu: "4" },
  { interview: "1" }, { interview: "2" }, { disability: true }, { minQuota: "20" },
  { sort: "score" }, { sort: "quota" }, { sort: "appl" }, { sort: "az" },
  { cat: "dev", edu: "2", interview: "1", disability: true, minQuota: "2", sort: "quota" },
  { prov: "1", city: "1", org: "0", edu: "2" },
  { q: "tidak-ada-lowongan-xyz987" },
];

for (const patch of cases) {
  test(`matches existing HTML behavior: ${JSON.stringify(patch)}`, () => {
    const filters = { ...DEFAULT_FILTERS, ...patch };
    const expected = Array.from(context.reference(filters)) as string[];
    const actual = searchJobs(filters);
    assert.equal(actual.total, expected.length);
    assert.deepEqual(actual.jobs.map(job => job.id), expected.slice(0, actual.pageSize));
  });
}

test("snapshot has complete, consistent location and category counts", () => {
  const facets = getFacets();
  assert.equal(facets.total, 27667);
  assert.equal(facets.provinces.length, 38);
  assert.equal(facets.cities.length, 460);
  for (const collection of [facets.provinces, facets.cities, facets.categories])
    assert.equal(collection.reduce((sum, item) => sum + (item.count ?? 0), 0), facets.total);
  assert.ok(facets.cities.every(city => facets.provinces.some(province => province.value === city.province)));
});

test("pagination has no gaps, clamps invalid pages, and sorting preserves portal order", () => {
  const first = searchJobs(DEFAULT_FILTERS);
  const next = searchJobs({ ...DEFAULT_FILTERS, page: 2 });
  const expected = Array.from(context.reference(DEFAULT_FILTERS)) as string[];
  assert.deepEqual([...first.jobs, ...next.jobs].map(job => job.id), expected.slice(0, 24));
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, page: 999999 }).page, first.pages);
  searchJobs({ ...DEFAULT_FILTERS, sort: "score" });
  assert.deepEqual(searchJobs(DEFAULT_FILTERS).jobs.map(job => job.id), first.jobs.map(job => job.id));
});

test("education and interview bitmasks include combined eligibility", () => {
  const id = "01a18091-0823-7158-a298-09b3fbfdc735";
  for (const edu of ["1", "2"]) for (const interview of ["1", "2"])
    assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true, edu, interview }, [id]).total, 1);
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true, edu: "4" }, [id]).total, 0);
});

test("bookmarks only return saved IDs and still respect active filters", () => {
  const id = searchJobs(DEFAULT_FILTERS).jobs[0].id;
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true }).total, 0);
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true }, [id, id, "missing"]).total, 1);
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true, q: "software engineer" }, [id]).total, 0);
});

test("URL state roundtrips, preserves index zero, and rejects malformed parameters", () => {
  const filters = { ...DEFAULT_FILTERS, q: "data analyst", org: "0", prov: "0", city: "0", minQuota: "3", disability: true, sort: "quota" as const, page: 2 };
  assert.deepEqual(parseFilters(filterParams(filters)), filters);
  const parsed = parseFilters(new URLSearchParams("prov=999&city=-1&edu=3&org=8&interview=x&minQuota=Infinity&page=NaN&sort=random&cat=unknown"));
  assert.deepEqual(parsed, DEFAULT_FILTERS);
});

test("details preserve original content, hide unresolved snapshot references, and link to the official portal", () => {
  const job = getJob("01a167a9-c96f-730b-9053-1b29f6c5eaff")!;
  assert.match(job.description, /Membantu perawat/);
  assert.equal(job.title, "Perawat");
  assert.equal(new URL(job.url).hostname, "maganghub.kemnaker.go.id");
  assert.ok(job.programs.length > 0);
  assert.equal(getJob("01a13d7a-830f-71ab-892b-8c2ca5345a88")?.description, "");
  assert.equal(getJob("missing"), null);
});
