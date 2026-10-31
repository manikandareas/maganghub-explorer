import { ServiceError } from "./errors";
import { admitRequest, clientIdentity } from "./limits";

export const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Expose-Headers": "Retry-After, ETag", "X-Content-Type-Options": "nosniff" };
export const optionsResponse = () => new Response(null, { status: 204, headers: corsHeaders });

export async function apiResponse(request: Request, action: (identity: string) => Promise<unknown>, cache = true) {
  try {
    const identity = clientIdentity(request.headers);
    await admitRequest(identity);
    const data = await action(identity);
    return Response.json(data, { headers: { ...corsHeaders, "Cache-Control": cache ? "public, max-age=30, s-maxage=60, stale-while-revalidate=60" : "private, no-store" } });
  } catch (error) {
    const known = error instanceof ServiceError;
    return Response.json({ error: { code: known ? error.code : "SERVICE_UNAVAILABLE", message: known ? error.message : "Layanan sementara tidak tersedia. Coba lagi sebentar." } }, {
      status: known && error.status >= 400 && error.status <= 599 ? error.status : 503,
      headers: { ...corsHeaders, "Cache-Control": "no-store", ...(known && error.status === 429 ? { "Retry-After": String(error.retryAfter) } : {}) },
    });
  }
}
