import { NextRequest, NextResponse } from "next/server";
import { parseFilters } from "@/lib/job-types";
import { searchJobs } from "@/lib/jobs";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const savedIds = (params.get("ids") ?? "").split(",").filter(id => /^[\da-f-]{36}$/i.test(id)).slice(0, 200);
  return NextResponse.json(searchJobs(parseFilters(params), savedIds), {
    headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
  });
}
