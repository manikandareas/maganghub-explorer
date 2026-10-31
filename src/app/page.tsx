import { Explorer } from "@/components/explorer";
import { getFacets, searchJobs } from "@/lib/jobs";
import { parseFilters } from "@/lib/job-types";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (typeof value === "string") params.set(key, value);
  const filters = parseFilters(params);
  return <Explorer facets={getFacets()} initialFilters={filters} initialResult={searchJobs(filters)} />;
}
