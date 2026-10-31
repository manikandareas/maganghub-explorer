import "./env";
import { query } from "../src/lib/server/db";
import { reportError } from "./env";

async function main() {
  const snapshots = await query(`SELECT s.id,s.status,to_char(s.snapshot_date,'YYYY-MM-DD') AS snapshot_date,s.expected_count,s.taxonomy_version,
    (a.snapshot_id IS NOT NULL) AS active,count(j.id)::int AS imported,count(e.hash)::int AS embedded
    FROM mh_snapshots s LEFT JOIN mh_active_catalog a ON a.snapshot_id=s.id LEFT JOIN mh_jobs j ON j.snapshot_id=s.id LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash AND e.model=s.embedding_model AND e.dimensions=s.embedding_dimensions
    GROUP BY s.id,a.snapshot_id ORDER BY s.imported_at DESC`);
  const sizes = await query(`SELECT relname AS table_name,pg_total_relation_size(c.oid)::bigint::text AS bytes FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'mh_%' ORDER BY relname`);
  const [database] = await query("SELECT pg_database_size(current_database())::text AS database_bytes");
  const [usage] = await query("SELECT coalesce(sum(documents),0)::text AS embedding_documents,coalesce(sum(tokens),0)::text AS embedding_tokens,coalesce(sum(estimated_cost_usd),0)::text AS estimated_cost_usd FROM mh_embedding_runs");
  console.log(JSON.stringify({ snapshots, sizes, database, usage }, null, 2));
}
main().catch(reportError);
