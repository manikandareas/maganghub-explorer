import { siteUrl } from "@/lib/server/config";
export const dynamic = "force-static";
export function GET() {
  const origin = siteUrl();
  return new Response(`# MagangHub Explorer

> Public, read-only internship search for a snapshot of Program Magang Nasional lowongan. Indonesian and English queries are supported by the search design; check returned sources and relevance.

Data snapshot: 2026-10-31. This is not the official Kemnaker website or live vacancy data. The snapshot application deadline is 2026-11-04. Verify availability at the official source before advising someone to apply. Missing descriptions are null; do not invent requirements. Online interview does not imply remote/WFH work.

## API
- [API guide](${origin}/api-docs): Parameters, examples, pagination, and limitations.
- [OpenAPI schema](${origin}/openapi.json): Machine-readable API contract, no authentication required.
- [Search jobs](${origin}/api/v1/jobs?q=data%20analyst): Hybrid keyword and semantic search. Use mode=keyword for keyword-only retrieval.
- [Filter values](${origin}/api/v1/facets): Read valid province/city values before applying location filters.
- [Job details](${origin}/api/v1/jobs/{id}): Replace {id} with a job ID from search results. Includes official sourceUrl.

## Usage
Use q for role, skills, or interests. Use explicit filters for location and eligibility; natural-language text is not a guaranteed filter parser. q is limited to 250 characters, limit to 50 (default 12). Follow page/pages for pagination. In hybrid mode total counts keyword matches plus up to 200 qualified semantic candidates, not every possible semantic match. Results must satisfy all supplied filters. Check meta.mode and meta.fallbackReason: provider outages may return keyword results. Observe HTTP 429 and Retry-After. Rank scores are not acceptance probabilities. Cite sourceUrl and the snapshot date. Fetch detail before stating requirements.

Categories cover 22 fields including healthcare, finance, law, education, HR, agriculture, logistics, and engineering. Read valid category values from facets. Categories are inferred from position titles, not official employer classifications; unrecognized titles use category=lain. Check detail before assuming field or eligibility. meta.categoryVersion identifies the taxonomy version.

## Sources
- [Official MagangHub](${"https://maganghub.kemnaker.go.id/"}): Authority for current vacancy and application information.
`, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" } });
}
