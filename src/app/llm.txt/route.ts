export function GET() { return new Response(null, { status: 308, headers: { Location: "/llms.txt", "Cache-Control": "public, max-age=86400" } }); }
