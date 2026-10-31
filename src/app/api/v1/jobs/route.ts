import { getCatalogInfo } from "@/lib/server/catalog-repository";
import { apiResponse, optionsResponse } from "@/lib/server/http";
import { parsePublicSearch, publicJob } from "@/lib/server/public-api";
import { searchCatalog } from "@/lib/server/search-engine";

export const OPTIONS = optionsResponse;
export async function GET(request: Request) {
  return apiResponse(request, async identity => {
    const catalog = await getCatalogInfo();
    const { filters, ...options } = parsePublicSearch(new URL(request.url).searchParams, catalog.facets);
    const result = await searchCatalog(filters, { ...options, catalog, identity });
    return { ...result, jobs: result.jobs.map(publicJob) };
  });
}
