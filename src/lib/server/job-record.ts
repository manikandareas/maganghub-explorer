import type { JobDetail } from "../job-types";
import { normalizeSearchText } from "../job-search";
import { embeddingHash, ftsText } from "./embedding-text";

export const compareJobTitles = (left: string, right: string) => left.localeCompare(right, "id");

export function jobOpportunityScore(quota: number, applicants: number) {
  const ratio = (quota - applicants) / Math.max(applicants, 1);
  // The source rounds halves away from zero, including negative scores.
  return Math.sign(ratio) * Math.round(Math.abs(ratio) * 100) / 100 || 0;
}

export function jobSearchRecord(payload: JobDetail) {
  const fields = [payload.title, payload.organization, `${payload.city} ${payload.province}`, payload.programs.join(" "), payload.description];
  const text = [`Posisi: ${payload.title}`, `Penyelenggara: ${payload.organization}`, `Lokasi: ${payload.city}, ${payload.province}`, `Program studi: ${payload.programs.join(", ")}`, `Deskripsi: ${payload.description}`].join("\n");
  return { search_fields: fields.map(normalizeSearchText), fts_fields: fields.map(ftsText), embedding_text: text, embedding_hash: embeddingHash(text) };
}
