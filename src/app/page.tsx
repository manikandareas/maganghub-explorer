import { Explorer } from "@/components/explorer";
import { pageCatalog, pageIdentity } from "@/lib/server/page-data";
import { searchCatalog } from "@/lib/server/search-engine";
import { parseFilters } from "@/lib/job-types";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") params.set(key, value);
  const filters = parseFilters(params);
  const [catalog, identity] = await Promise.all([pageCatalog(), pageIdentity()]);
  const result = await searchCatalog(filters, { catalog, identity });
  return <Explorer facets={catalog.facets} initialFilters={filters} initialResult={result} />;
}
