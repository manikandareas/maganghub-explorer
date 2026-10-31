import "./env";
import { mkdirSync, writeFileSync } from "node:fs";
import { prepareCatalog } from "../src/lib/server/catalog-records";
import { embedTexts } from "../src/lib/server/embeddings";
import { relevanceCases } from "../tests/fixtures/search-cases";
import { reportError } from "./env";

async function main() {
  const catalog = prepareCatalog();
  const selected = new Map<string, (typeof catalog.records)[number]>();
  for (const item of relevanceCases.filter(item => item.split === "calibration")) {
    const matches = catalog.records.filter(record => new RegExp(item.title, "i").test(record.payload.title));
    if (!matches.length) throw new Error("Tidak ada dokumen pilot untuk kategori evaluasi");
    matches.slice(0, 3).forEach(record => selected.set(record.id, record));
  }
  for (let index = 0; index < catalog.records.length && selected.size < 80; index += 389) selected.set(catalog.records[index].id, catalog.records[index]);
  const documents = [...selected.values()];
  const inputs = [...documents.map(record => record.embedding_text), ...relevanceCases.map(item => item.query)];
  const reports = [];
  for (const dimensions of [512, 1536]) {
    const start = Date.now();
    const embedded = await embedTexts(inputs, { dimensions, retries: 2, timeoutMs: 45000 });
    const vectors = embedded.vectors.slice(0, documents.length);
    const results = relevanceCases.map((item, index) => {
      const vector = embedded.vectors[documents.length + index];
      const ranked = documents.map((record, row) => ({ title: record.payload.title, similarity: vectors[row].reduce((sum, value, i) => sum + value * vector[i], 0) })).sort((a, b) => b.similarity - a.similarity);
      return { ...item, hitAt5: ranked.slice(0, 5).some(record => new RegExp(item.title, "i").test(record.title)), top5: ranked.slice(0, 5) };
    });
    const evaluation = results.filter(item => item.split === "evaluation");
    const report = { dimensions, documents: documents.length, tokens: embedded.tokens, elapsedMs: Date.now() - start, evaluationHits: evaluation.filter(item => item.hitAt5).length, evaluationTotal: evaluation.length, results };
    reports.push(report);
    console.log(JSON.stringify({ event: "pilot", dimensions, documents: documents.length, tokens: embedded.tokens, evaluationHits: report.evaluationHits, evaluationTotal: evaluation.length }));
  }
  mkdirSync("docs/evidence", { recursive: true });
  writeFileSync("docs/evidence/embedding-pilot.json", JSON.stringify({ scope: "Small labelled candidate subset; not full-catalog acceptance", reports }, null, 2) + "\n");
  if (reports[0].evaluationHits / reports[0].evaluationTotal < 0.8 || reports[0].evaluationHits < reports[1].evaluationHits - 2) throw new Error("Pilot 512 dimensi belum memenuhi gate");
}
main().catch(reportError);
