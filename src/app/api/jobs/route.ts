import { NextRequest } from "next/server";
import { parseFilters } from "@/lib/job-types";
import { searchCatalog } from "@/lib/server/search-engine";
import { apiResponse, optionsResponse } from "@/lib/server/http";

export const OPTIONS = optionsResponse;
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const savedIds = (params.get("ids") ?? "").split(",").filter(id => /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)).slice(0, 200);
  return apiResponse(request, identity => searchCatalog(parseFilters(params), { savedIds, identity }), false);
}
