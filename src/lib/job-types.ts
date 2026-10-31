import { CATEGORIES, type Category } from "./job-categories";
export { CATEGORIES, type Category } from "./job-categories";

export const SORT_OPTIONS = [
  { value: "portal", label: "Urutan portal" },
  { value: "score", label: "Skor peluang tertinggi" },
  { value: "quota", label: "Kuota terbanyak" },
  { value: "appl", label: "Pelamar tersedikit" },
  { value: "az", label: "Nama posisi A–Z" },
] as const;

export type Sort = (typeof SORT_OPTIONS)[number]["value"] | "relevance";

export type Filters = {
  q: string;
  cat: string;
  prov: string;
  city: string;
  org: string;
  edu: string;
  interview: string;
  minQuota: string;
  disability: boolean;
  saved: boolean;
  sort: Sort;
  page: number;
};

export const DEFAULT_FILTERS: Filters = {
  q: "", cat: "", prov: "", city: "", org: "", edu: "", interview: "",
  minQuota: "", disability: false, saved: false, sort: "relevance", page: 1,
};

export type Job = {
  id: string;
  title: string;
  organization: string;
  organizationType: number;
  city: string;
  province: string;
  quota: number;
  applicants: number;
  education: string[];
  programs: string[];
  interview: string[];
  days: number;
  disability: boolean;
  category: Category;
  score: number;
  url: string;
  observedAt?: string | null;
};

export type JobDetail = Job & { description: string; address: string };
export type Option = { value: string; label: string; count?: number; province?: string; keywords?: readonly string[] };
export type Facets = {
  total: number;
  provinces: Option[];
  cities: Option[];
  categories: Option[];
  organizations: number;
};
export type SearchResult = { jobs: Job[]; total: number; page: number; pages: number; pageSize: number; meta?: { mode: "hybrid" | "keyword"; fallbackReason?: string; lastIngestedAt?: string | null } };

export function parseFilters(params: URLSearchParams): Filters {
  const integer = (key: string, max = 99999) => {
    const value = params.get(key) ?? "";
    return /^\d+$/.test(value) && Number(value) <= max ? String(Number(value)) : "";
  };
  const oneOf = (key: string, values: string[]) => values.includes(params.get(key) ?? "") ? params.get(key)! : "";
  return {
    q: (params.get("q") ?? "").slice(0, 250),
    cat: oneOf("cat", CATEGORIES.map(c => c.value)),
    prov: integer("prov", 2147483647), city: integer("city", 2147483647),
    org: oneOf("org", ["0", "1"]), edu: oneOf("edu", ["1", "2", "4"]),
    interview: oneOf("interview", ["1", "2"]),
    minQuota: integer("minQuota", 1000000),
    disability: params.get("disability") === "1", saved: params.get("saved") === "1",
    sort: (oneOf("sort", ["relevance", ...SORT_OPTIONS.map(s => s.value)]) || "relevance") as Sort,
    page: Math.max(1, Math.min(100000, Number(integer("page", 100000)) || 1)),
  };
}

export function filterParams(filters: Filters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === DEFAULT_FILTERS[key as keyof Filters] || value === "") continue;
    params.set(key, typeof value === "boolean" ? "1" : String(value));
  }
  return params;
}

export const formatNumber = (value: number) => value.toLocaleString("id-ID");
