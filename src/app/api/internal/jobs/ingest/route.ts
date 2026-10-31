import { ingestResponse } from "@/lib/server/ingest-http";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  return ingestResponse(request);
}
