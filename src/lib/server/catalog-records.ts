import { getFacets, getJob } from "../jobs";
import { normalizeSearchText } from "../job-search";
import { readSnapshot } from "../snapshot";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION } from "./config";
import { hashText, embeddingHash, ftsText } from "./embedding-text";

export function prepareCatalog() {
  const snapshot = readSnapshot();
  const alphabetical = [...snapshot.rows].sort((a, b) => a[1].localeCompare(b[1], "id"));
  const alphabeticalOrder = new Map(alphabetical.map((row, index) => [row[0], index]));
  const records = snapshot.rows.map((row, portalOrder) => {
    const payload = getJob(row[0]);
    if (!payload || !payload.city || !payload.province || payload.programs.some(value => !value)) throw new Error("Relasi snapshot tidak valid");
    const fields = [payload.title, payload.organization, `${payload.city} ${payload.province}`, payload.programs.join(" "), payload.description];
    const text = [`Posisi: ${payload.title}`, `Penyelenggara: ${payload.organization}`, `Lokasi: ${payload.city}, ${payload.province}`, `Program studi: ${payload.programs.join(", ")}`, `Deskripsi: ${payload.description}`].join("\n");
    return {
      id: row[0], portal_order: portalOrder, az_order: alphabeticalOrder.get(row[0])!, payload,
      province_code: row[5], city_code: row[4], category: payload.category, organization_type: row[3],
      education_mask: row[8], interview_mask: row[10], disability: Boolean(row[12]), quota: row[6], applicants: row[7], opportunity_score: row[15],
      search_fields: fields.map(normalizeSearchText), fts_fields: fields.map(ftsText),
      embedding_text: text, embedding_hash: embeddingHash(text),
    };
  });
  return { id: hashText(`${snapshot.hash}:${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:v${EMBEDDING_TEXT_VERSION}`), sourceHash: snapshot.hash, facets: getFacets(), records };
}
