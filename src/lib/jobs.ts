import { readSnapshot, type SnapshotRow as Row } from "./snapshot";
import { CATEGORIES, type Category, type Facets, type Filters, type Job, type JobDetail, type SearchResult } from "./job-types";
import { createSearchDocument, createSearchQuery, rankSearch } from "./job-search";
import { categoryOf } from "./job-categories";
export { categoryOf } from "./job-categories";

// The existing snapshot format, preserved as the single source of truth.
type IndexedRow = { row: Row; category: Category; search: ReturnType<typeof createSearchDocument> };

const EDUCATION = [[1, "Diploma"], [2, "Sarjana"], [4, "Profesi"]] as const;
const INTERVIEW = [[1, "Daring"], [2, "Tatap muka"]] as const;
const PAGE_SIZE = 12;

function loadCatalog() {
  const snapshot = readSnapshot();
  const cityProvince = new Map<number, number>();
  const provinceCounts = new Map<number, number>();
  const cityCounts = new Map<number, number>();
  const categoryCounts = new Map<string, number>();
  const byId = new Map<string, Row>();
  const index: IndexedRow[] = snapshot.rows.map(row => {
    const category = categoryOf(row[1]);
    cityProvince.set(row[4], row[5]);
    provinceCounts.set(row[5], (provinceCounts.get(row[5]) ?? 0) + 1);
    cityCounts.set(row[4], (cityCounts.get(row[4]) ?? 0) + 1);
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    byId.set(row[0], row);
    const programs = row[9].split(",").filter(Boolean).map(i => snapshot.prodis[Number(i)]).join(" ");
    const search = createSearchDocument({ title: row[1], organization: row[2], location: `${snapshot.cities[row[4]]} ${snapshot.provs[row[5]]}`, programs, description: row[13] });
    return { row, category, search };
  });
  const facets: Facets = {
    total: index.length,
    organizations: new Set(snapshot.rows.map(row => row[2])).size,
    provinces: snapshot.provs.map((label, i) => ({ value: String(i), label, count: provinceCounts.get(i) ?? 0 })).sort((a, b) => a.label.localeCompare(b.label, "id")),
    cities: snapshot.cities.map((label, i) => ({ value: String(i), label, count: cityCounts.get(i) ?? 0, province: String(cityProvince.get(i)) })).sort((a, b) => a.label.localeCompare(b.label, "id")),
    categories: CATEGORIES.map(c => ({ ...c, count: categoryCounts.get(c.value) ?? 0 })),
  };
  return { snapshot, index, facets, byId };
}

let catalog: ReturnType<typeof loadCatalog> | undefined;
function getCatalog() { return catalog ??= loadCatalog(); }

function summarize(row: Row): Job {
  const { snapshot } = getCatalog();
  const slug = row[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    id: row[0], title: row[1], organization: row[2], organizationType: row[3],
    city: snapshot.cities[row[4]], province: snapshot.provs[row[5]],
    quota: row[6], applicants: row[7],
    education: EDUCATION.filter(([bit]) => row[8] & bit).map(([, label]) => label),
    programs: row[9].split(",").filter(Boolean).map(i => snapshot.prodis[Number(i)]),
    interview: INTERVIEW.filter(([bit]) => row[10] & bit).map(([, label]) => label),
    days: row[11], disability: Boolean(row[12]), category: categoryOf(row[1]), score: row[15],
    url: `https://maganghub.kemnaker.go.id/magang-nasional/lowongan/${slug}-${row[0]}`,
  };
}

export function getFacets(): Facets { return getCatalog().facets; }

export function getJob(id: string): JobDetail | null {
  const row = getCatalog().byId.get(id);
  if (!row) return null;
  const description = /^\$[a-z\d]+$/i.test(row[13].trim()) ? "" : row[13];
  return { ...summarize(row), description, address: row[14] };
}

export function searchJobs(filters: Filters, savedIds: string[] = []): SearchResult {
  const query = createSearchQuery(filters.q);
  const saved = new Set(savedIds);
  const results = getCatalog().index.filter(({ row, category }) => {
    if (filters.prov !== "" && row[5] !== Number(filters.prov)) return false;
    if (filters.city !== "" && row[4] !== Number(filters.city)) return false;
    if (filters.cat && category !== filters.cat) return false;
    if (filters.org !== "" && row[3] !== Number(filters.org)) return false;
    if (filters.edu && !(row[8] & Number(filters.edu))) return false;
    if (filters.interview && !(row[10] & Number(filters.interview))) return false;
    if (filters.disability && !row[12]) return false;
    if (filters.minQuota && row[6] < Number(filters.minQuota)) return false;
    if (filters.saved && !saved.has(row[0])) return false;
    return true;
  }).flatMap(indexed => {
    const rank = rankSearch(indexed.search, query);
    return rank ? [{ ...indexed, rank }] : [];
  });
  // Explicit sorting stays authoritative; relevance is the default for searches.
  // Stable sorting retains portal order when relevance ranks are equal.
  if (filters.sort === "relevance" && query.active) results.sort((a, b) => b.rank[0] - a.rank[0] || b.rank[1] - a.rank[1]);
  if (filters.sort === "quota") results.sort((a, b) => b.row[6] - a.row[6]);
  if (filters.sort === "appl") results.sort((a, b) => a.row[7] - b.row[7]);
  if (filters.sort === "score") results.sort((a, b) => b.row[15] - a.row[15]);
  if (filters.sort === "az") results.sort((a, b) => a.row[1].localeCompare(b.row[1], "id"));
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  return { jobs: results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ row }) => summarize(row)), total: results.length, page, pages, pageSize: PAGE_SIZE };
}
