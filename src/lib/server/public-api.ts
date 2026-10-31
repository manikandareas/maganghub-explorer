import { CATEGORIES, DEFAULT_FILTERS, SORT_OPTIONS, type Facets, type Filters, type Job, type JobDetail } from "../job-types";
import { siteUrl } from "./config";
import { ServiceError } from "./errors";
import type { SearchMode } from "./search-engine";

const slug = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const EDUCATION = { diploma: "1", sarjana: "2", profesi: "4" };
const INTERVIEW = { online: "1", onsite: "2" };
const ORGANIZATION = { company: "0", government: "1" };
export const PUBLIC_PARAMETERS = [
  { name: "q", type: "string", description: "Kata kunci atau deskripsi minat/keahlian, maksimal 250 karakter." },
  { name: "mode", type: "string", values: ["hybrid", "keyword"], description: "Default hybrid; keyword tidak memanggil embedding provider." },
  { name: "category", type: "string", values: CATEGORIES.map(item => item.value), description: "Kategori posisi." },
  { name: "province", type: "string", description: "value provinsi dari /api/v1/facets." },
  { name: "city", type: "string", description: "value kota dari facets, termasuk prefix provinsi." },
  { name: "organizationType", type: "string", values: Object.keys(ORGANIZATION), description: "Jenis penyelenggara." },
  { name: "education", type: "string", values: Object.keys(EDUCATION), description: "Jenjang pendidikan." },
  { name: "interview", type: "string", values: Object.keys(INTERVIEW), description: "Tipe wawancara; online tidak berarti pekerjaan remote." },
  { name: "minQuota", type: "integer", description: "Kuota minimal, 0 sampai 1000000." },
  { name: "disability", type: "string", values: ["0", "1"], description: "1 untuk posisi ramah disabilitas." },
  { name: "sort", type: "string", values: ["relevance", ...SORT_OPTIONS.map(item => item.value)], description: "Urutan hasil; score adalah skor peluang, bukan relevansi." },
  { name: "page", type: "integer", description: "Halaman mulai dari 1, maksimal 100000." },
  { name: "limit", type: "integer", description: "Hasil per halaman, 1-50; default 12." },
] as const;

export function publicFacets(facets: Facets) {
  const provinces = facets.provinces.map(item => ({ ...item, value: slug(item.label) }));
  const provinceValues = new Map(facets.provinces.map(item => [item.value, slug(item.label)]));
  return { ...facets, provinces, cities: facets.cities.map(item => ({ ...item, value: `${provinceValues.get(item.province ?? "")}/${slug(item.label)}`, province: provinceValues.get(item.province ?? "") })) };
}

export function parsePublicSearch(params: URLSearchParams, facets: Facets): { filters: Filters; mode: SearchMode; limit: number } {
  const invalid = (name: string): never => { throw new ServiceError("INVALID_PARAMETER", `Parameter ${name} tidak valid. Lihat /api-docs.`, 400); };
  for (const key of params.keys()) {
    // Extra parameters added by AI clients and shared links never participate in search.
    if (!PUBLIC_PARAMETERS.some(item => item.name === key)) continue;
    if (params.getAll(key).length !== 1) invalid(key);
  }
  for (const rule of PUBLIC_PARAMETERS) {
    const value = params.get(rule.name);
    if (value !== null && "values" in rule && !(rule.values as readonly string[]).includes(value)) invalid(rule.name);
  }
  const integer = (name: string, min: number, max: number, fallback: number) => {
    if (!params.has(name)) return fallback;
    const value = params.get(name)!;
    if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) return invalid(name);
    return Number(value);
  };
  const q = params.get("q") ?? "";
  if (q.length > 250) invalid("q");
  const filters: Filters = { ...DEFAULT_FILTERS, q };
  const exposed = publicFacets(facets);
  if (params.has("province")) {
    const index = exposed.provinces.findIndex(item => item.value === params.get("province"));
    if (index < 0) invalid("province");
    filters.prov = facets.provinces[index].value;
  }
  if (params.has("city")) {
    const index = exposed.cities.findIndex(item => item.value === params.get("city"));
    if (index < 0) invalid("city");
    const city = facets.cities[index];
    if (filters.prov !== "" && filters.prov !== city.province) invalid("city");
    filters.city = city.value;
    filters.prov = city.province ?? "";
  }
  filters.cat = params.get("category") ?? "";
  filters.org = ORGANIZATION[params.get("organizationType") as keyof typeof ORGANIZATION] ?? "";
  filters.edu = EDUCATION[params.get("education") as keyof typeof EDUCATION] ?? "";
  filters.interview = INTERVIEW[params.get("interview") as keyof typeof INTERVIEW] ?? "";
  filters.disability = params.get("disability") === "1";
  filters.minQuota = params.has("minQuota") ? String(integer("minQuota", 0, 1000000, 0)) : "";
  filters.sort = (params.get("sort") ?? "relevance") as Filters["sort"];
  filters.page = integer("page", 1, 100000, 1);
  return { filters, mode: (params.get("mode") ?? "hybrid") as SearchMode, limit: integer("limit", 1, 50, 12) };
}

export function publicJob(job: Job | JobDetail) {
  const { score, url, ...rest } = job;
  return { ...rest, opportunityScore: score, sourceUrl: url, detailUrl: `${siteUrl()}/lowongan/${job.id}`, ...("description" in job ? { description: job.description || null, descriptionAvailable: Boolean(job.description) } : {}) };
}
