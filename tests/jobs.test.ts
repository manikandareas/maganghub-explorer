import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { getFacets, getJob, searchJobs } from "../src/lib/jobs";
import { DEFAULT_FILTERS, filterParams, parseFilters, type Filters } from "../src/lib/job-types";

// Keep legacy comparison for structured filters and explicit sort modes only.
// Search relevance is specified by the regression tests below.
// The original IT-only taxonomy is replaced; job-categories.test.ts covers the new fields.
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
  {}, { prov: "1" }, { city: "0" },
  { org: "0" }, { org: "1" }, { edu: "1" }, { edu: "2" }, { edu: "4" },
  { interview: "1" }, { interview: "2" }, { disability: true }, { minQuota: "20" },
  { sort: "score" }, { sort: "quota" }, { sort: "appl" }, { sort: "az" },
  { edu: "2", interview: "1", disability: true, minQuota: "2", sort: "quota" },
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

test("AI engineer excludes the four substring false positives from the audit", () => {
  const ids = [
    "01a0e55b-dc88-7164-bf6e-fbe370e54c00", // Assisten Produksi
    "01a152d4-8dc7-735c-856e-a1e57662dd97", // Engineering Maintenance
    "01a1635a-33f5-721a-b9ce-732085322378", // Workshop Engineering Site Intern
    "01a13f19-f331-70ac-9a09-7b70de7b8a93", // Engineer Project
  ];
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, q: "ai engineer", saved: true }, ids).total, 0);
});

test("exact AI Engineer titles come first, followed by phrase and title matches", () => {
  const first = searchJobs({ ...DEFAULT_FILTERS, q: "ai engineer" });
  assert.equal(first.jobs.slice(0, 4).filter(job => job.title.toLowerCase() === "ai engineer").length, 4);
  assert.ok(first.jobs.every(job => /\bai\b/i.test(job.title) && /engineer/i.test(job.title)));
  const all = Array.from({ length: first.pages }, (_, i) => searchJobs({ ...DEFAULT_FILTERS, q: "ai engineer", page: i + 1 }).jobs).flat();
  assert.ok(all.some(job => job.title === "AI/ML Engineer Intern"));
  assert.ok(all.some(job => job.title === "AI Engineer_RSB Witel Sumalut"));
});

test("search normalizes case, spacing, quotes, and frontend separators", () => {
  const ids = (q: string) => searchJobs({ ...DEFAULT_FILTERS, q }).jobs.map(job => job.id);
  assert.deepEqual(ids("  AI   ENGINEER  "), ids("ai engineer"));
  assert.deepEqual(ids('"ai engineer"'), ids("ai engineer"));
  assert.deepEqual(ids("front-end"), ids("frontend"));
  assert.deepEqual(ids("front end"), ids("frontend"));
});

test("search still covers descriptions, programs, organizations, and locations with AND semantics", () => {
  const id = "01a167a9-c96f-730b-9053-1b29f6c5eaff";
  for (const q of ["pelayanan pasien", "ilmu keperawatan", "awal bros", "pekanbaru riau"])
    assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true, q }, [id]).total, 1, q);
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, saved: true, q: "perawat software" }, [id]).total, 0);
  assert.equal(searchJobs({ ...DEFAULT_FILTERS, q: "???" }).total, 0);
});

test("relevance search retains filters, page boundaries, and explicit sorting", () => {
  const filters = { ...DEFAULT_FILTERS, q: "ai engineer", edu: "2", interview: "1", sort: "quota" as const };
  const result = searchJobs(filters);
  assert.ok(result.total > 0);
  assert.ok(result.jobs.every(job => job.education.includes("Sarjana") && job.interview.includes("Daring")));
  assert.ok(result.jobs.every((job, i) => i === 0 || result.jobs[i - 1].quota >= job.quota));
  const first = searchJobs({ ...DEFAULT_FILTERS, q: "ai engineer" });
  const next = searchJobs({ ...DEFAULT_FILTERS, q: "ai engineer", page: 2 });
  assert.ok(next.jobs.every(job => !first.jobs.some(previous => previous.id === job.id)));
});

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
  const parsed = parseFilters(new URLSearchParams("prov=2147483648&city=-1&edu=3&org=8&interview=x&minQuota=Infinity&page=NaN&sort=random&cat=unknown"));
  assert.deepEqual(parsed, DEFAULT_FILTERS);
  const extended = parseFilters(new URLSearchParams("prov=38&city=460"));
  assert.equal(extended.prov, "38");
  assert.equal(extended.city, "460");
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
