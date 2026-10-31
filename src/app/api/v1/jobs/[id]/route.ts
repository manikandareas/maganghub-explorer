import { dataMetadata, findJob, getCatalogInfo } from "@/lib/server/catalog-repository";
import { ServiceError } from "@/lib/server/errors";
import { apiResponse, optionsResponse } from "@/lib/server/http";
import { publicJob } from "@/lib/server/public-api";

export const OPTIONS = optionsResponse;
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return apiResponse(request, async () => {
    const catalog = await getCatalogInfo();
    const job = await findJob((await context.params).id, catalog);
    if (!job) throw new ServiceError("JOB_NOT_FOUND", "Lowongan tidak ditemukan", 404);
    return { job: publicJob(job), meta: dataMetadata(catalog) };
  });
}
