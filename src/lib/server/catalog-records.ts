import { getFacets, getJob } from "../jobs";
import { readSnapshot } from "../snapshot";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION } from "./config";
import { hashText } from "./embedding-text";
import { compareJobTitles, jobSearchRecord } from "./job-record";

export function prepareCatalog() {
  const snapshot = readSnapshot();
  const alphabetical = [...snapshot.rows].sort((a, b) => compareJobTitles(a[1], b[1]));
  const alphabeticalOrder = new Map(alphabetical.map((row, index) => [row[0], index]));
  const records = snapshot.rows.map((row, portalOrder) => {
    const payload = getJob(row[0]);
    if (!payload || !payload.city || !payload.province || payload.programs.some(value => !value)) throw new Error("Relasi snapshot tidak valid");
    return {
      id: row[0], portal_order: portalOrder, az_order: alphabeticalOrder.get(row[0])!, payload,
      province_code: row[5], city_code: row[4], category: payload.category, organization_type: row[3],
      education_mask: row[8], interview_mask: row[10], disability: Boolean(row[12]), quota: row[6], applicants: row[7], opportunity_score: row[15],
      ...jobSearchRecord(payload),
    };
  });
  return { id: hashText(`${snapshot.hash}:${EMBEDDING_MODEL}:${EMBEDDING_DIMENSIONS}:v${EMBEDDING_TEXT_VERSION}`), sourceHash: snapshot.hash, facets: getFacets(), records };
}
