import "./env";
import { query } from "../src/lib/server/db";
import { reportError } from "./env";

async function main() {
  await query("DELETE FROM mh_query_cache WHERE hash IN (SELECT hash FROM mh_query_cache WHERE expires_at<now() LIMIT 2000)");
  await query("DELETE FROM mh_rate_limits WHERE (bucket,window_start) IN (SELECT bucket,window_start FROM mh_rate_limits WHERE window_start<now()-interval '2 days' LIMIT 2000)");
  console.log(JSON.stringify({ event: "maintenance_complete" }));
}
main().catch(reportError);
