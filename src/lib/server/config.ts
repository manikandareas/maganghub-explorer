export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 512;
export const EMBEDDING_TEXT_VERSION = 1;
export const SNAPSHOT_DATE = "2026-10-31";
export const SOURCE_URL = "https://maganghub.kemnaker.go.id/";
export const SEMANTIC_LIMIT = 200;

export function semanticThreshold(): number {
  const value = Number(process.env.SEMANTIC_MIN_SIMILARITY || "0.5");
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("SEMANTIC_MIN_SIMILARITY harus 0 sampai 1");
  return value;
}

export function siteUrl(): string {
  const url = new URL(process.env.SITE_URL || "http://localhost:3000");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("SITE_URL harus URL HTTP(S)");
  return url.origin;
}
