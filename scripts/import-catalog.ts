import "./env";
import { argument, integerArgument, reportError } from "./env";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { query } from "../src/lib/server/db";
import { CATEGORY_VERSION } from "../src/lib/job-categories";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION, SNAPSHOT_DATE } from "../src/lib/server/config";

async function main() {
  const catalog = prepareCatalog();
  const batchSize = integerArgument("batch-size", 250, 500);
  console.log(JSON.stringify({ event: "prepared", snapshotId: catalog.id, jobs: catalog.records.length, batchSize, dryRun: process.argv.includes("--dry-run") }));
  if (process.argv.includes("--dry-run")) return;
  const [existing] = await query<{ status: string }>("SELECT status FROM mh_snapshots WHERE id=$1", [catalog.id]);
  if (existing?.status === "ready") {
    console.log(JSON.stringify({ event: "already_imported", snapshotId: catalog.id }));
    return;
  }
  await query(`INSERT INTO mh_snapshots(id,source_hash,snapshot_date,expected_count,facets,embedding_model,embedding_dimensions,embedding_text_version,taxonomy_version)
    VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
  [catalog.id, catalog.sourceHash, argument("date") ?? SNAPSHOT_DATE, catalog.records.length, JSON.stringify(catalog.facets), EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, EMBEDDING_TEXT_VERSION, CATEGORY_VERSION]);
  for (let offset = 0; offset < catalog.records.length; offset += batchSize) {
    const batch = catalog.records.slice(offset, offset + batchSize);
    await query(`INSERT INTO mh_jobs(snapshot_id,id,portal_order,az_order,payload,province_code,city_code,category,organization_type,education_mask,interview_mask,disability,quota,applicants,opportunity_score,search_fields,fts,embedding_text,embedding_hash)
      SELECT $1, r.id,r.portal_order,r.az_order,r.payload,r.province_code,r.city_code,r.category,r.organization_type,r.education_mask,r.interview_mask,r.disability,r.quota,r.applicants,r.opportunity_score,
      ARRAY(SELECT jsonb_array_elements_text(r.search_fields)),
      setweight(to_tsvector('simple',r.fts_fields->>0),'A') || setweight(to_tsvector('simple',r.fts_fields->>1),'B') || setweight(to_tsvector('simple',r.fts_fields->>2),'C') || setweight(to_tsvector('simple',r.fts_fields->>3),'C') || setweight(to_tsvector('simple',r.fts_fields->>4),'D'),
      r.embedding_text,r.embedding_hash
      FROM jsonb_to_recordset($2::jsonb) AS r(id uuid,portal_order integer,az_order integer,payload jsonb,province_code integer,city_code integer,category text,organization_type integer,education_mask integer,interview_mask integer,disability boolean,quota integer,applicants integer,opportunity_score double precision,search_fields jsonb,fts_fields jsonb,embedding_text text,embedding_hash text)
      ON CONFLICT(snapshot_id,id) DO NOTHING`, [catalog.id, JSON.stringify(batch)]);
    console.log(JSON.stringify({ event: "import_batch", completed: Math.min(offset + batchSize, catalog.records.length), total: catalog.records.length }));
  }
  const [check] = await query<{ count: number }>("SELECT count(*)::int AS count FROM mh_jobs WHERE snapshot_id=$1", [catalog.id]);
  if (check.count !== catalog.records.length) throw new Error("Jumlah import tidak cocok");
  console.log(JSON.stringify({ event: "import_complete", snapshotId: catalog.id, jobs: check.count, active: false }));
}
main().catch(reportError);
