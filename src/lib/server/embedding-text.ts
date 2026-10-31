import { createHash } from "node:crypto";
import { normalizeSearchText } from "../job-search";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TEXT_VERSION } from "./config";

export const hashText = (text: string) => createHash("sha256").update(text).digest("hex");
export const embeddingHash = (text: string, dimensions = EMBEDDING_DIMENSIONS) => hashText(`${EMBEDDING_MODEL}:${dimensions}:v${EMBEDDING_TEXT_VERSION}:${text}`);

export function ftsText(text: string): string {
  return normalizeSearchText(text).split(" ").map(token => token === "c++" ? "cpluspluslang" : token === "c#" ? "csharplang" : token).join(" ");
}
