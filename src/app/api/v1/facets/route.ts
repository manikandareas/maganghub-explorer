import { dataMetadata, getCatalogInfo } from "@/lib/server/catalog-repository";
import { apiResponse, optionsResponse } from "@/lib/server/http";
import { publicFacets } from "@/lib/server/public-api";

export const OPTIONS = optionsResponse;
export async function GET(request: Request) {
  return apiResponse(request, async () => {
    const catalog = await getCatalogInfo();
    return { ...publicFacets(catalog.facets), education: ["diploma", "sarjana", "profesi"], interview: ["online", "onsite"], organizationTypes: ["company", "government"], meta: dataMetadata(catalog) };
  });
}
