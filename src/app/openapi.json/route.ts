import { openApiDocument } from "@/lib/server/openapi";
import { corsHeaders, optionsResponse } from "@/lib/server/http";
export const dynamic = "force-static";
export const OPTIONS = optionsResponse;
export function GET() { return Response.json(openApiDocument(), { headers: { ...corsHeaders, "Cache-Control": "public, max-age=3600" } }); }
