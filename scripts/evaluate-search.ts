import "./env";
import { mkdirSync, writeFileSync } from "node:fs";
import { argument, reportError } from "./env";
import { DEFAULT_FILTERS } from "../src/lib/job-types";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { getCatalogInfo } from "../src/lib/server/catalog-repository";
import { embedTexts } from "../src/lib/server/embeddings";
import { searchCatalog } from "../src/lib/server/search-engine";
import { relevanceCases, negativeQueries } from "../tests/fixtures/search-cases";
import { semanticThreshold } from "../src/lib/server/config";
import { query } from "../src/lib/server/db";

async function main() {
  const catalog = await getCatalogInfo(argument("snapshot") ?? prepareCatalog().id);
  const [coverage] = await query<{ jobs: number; embedded: number }>("SELECT count(j.id)::int AS jobs,count(e.hash)::int AS embedded FROM mh_jobs j LEFT JOIN mh_embeddings e ON e.hash=j.embedding_hash AND e.model='openai/text-embedding-3-small' AND e.dimensions=512 WHERE j.snapshot_id=$1", [catalog.id]);
  if (coverage.jobs !== catalog.expectedCount || coverage.embedded !== coverage.jobs) throw new Error("Evaluasi katalog penuh memerlukan import dan embedding lengkap");
  const embedded = await embedTexts([...relevanceCases.map(item => item.query), ...negativeQueries], { retries: 2, timeoutMs: 45000 });
  const results = [];
  for (let index = 0; index < relevanceCases.length; index++) {
    const item = relevanceCases[index];
    const started = Date.now();
    const result = await searchCatalog({ ...DEFAULT_FILTERS, q: item.query }, { catalog, vector: JSON.stringify(embedded.vectors[index]), limit: 5 });
    const keyword = await searchCatalog({ ...DEFAULT_FILTERS, q: item.query }, { catalog, mode: "keyword", limit: 5 });
    const accepted = (jobs: typeof result.jobs) => jobs.some(job => new RegExp(item.title, "i").test(job.title));
    results.push({ ...item, hitAt5: accepted(result.jobs), keywordHitAt5: accepted(keyword.jobs), elapsedMs: Date.now() - started, total: result.total, titles: result.jobs.map(job => job.title) });
    if ((index + 1) % 10 === 0) console.log(JSON.stringify({ event: "evaluation_progress", queries: index + 1, total: relevanceCases.length }));
  }
  const negatives = [];
  for (let index = 0; index < negativeQueries.length; index++) {
    const result = await searchCatalog({ ...DEFAULT_FILTERS, q: negativeQueries[index] }, { catalog, vector: JSON.stringify(embedded.vectors[relevanceCases.length + index]), limit: 5 });
    negatives.push({ query: negativeQueries[index], total: result.total, titles: result.jobs.map(job => job.title) });
  }
  const evaluation = results.filter(item => item.split === "evaluation");
  const sorted = results.map(item => item.elapsedMs).sort((a, b) => a - b);
  const summary = { snapshotId: catalog.id, threshold: semanticThreshold(), scope: "Full-catalog manually labelled title relevance; not production SLO proof", evaluationHits: evaluation.filter(item => item.hitAt5).length, keywordEvaluationHits: evaluation.filter(item => item.keywordHitAt5).length, evaluationTotal: evaluation.length, p50SqlPairMs: sorted[Math.floor(sorted.length * 0.5)], p95SqlPairMs: sorted[Math.floor(sorted.length * 0.95)], queryEmbeddingTokens: embedded.tokens };
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync("docs/evidence/search-evaluation.json", JSON.stringify({ summary, results, negatives }, null, 2) + "\n");
  writeFileSync(`docs/evidence/search-evaluation-${String(summary.threshold).replace(".", "-")}.json`, JSON.stringify({ summary, results, negatives }, null, 2) + "\n");
  console.log(JSON.stringify(summary));
  if (summary.evaluationHits / summary.evaluationTotal < 0.8 || negatives.some(item => item.total > 0)) throw new Error("Evaluasi relevansi belum memenuhi gate");
}
main().catch(reportError);
