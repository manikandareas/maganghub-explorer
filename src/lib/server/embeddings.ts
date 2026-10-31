import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config";
import { ServiceError } from "./errors";

type EmbeddingResponse = { data?: { index: number; embedding: number[] }[]; usage?: { total_tokens?: number }; model?: string };

export function validateEmbeddings(value: unknown, count: number, dimensions: number): number[][] {
  if (!value || typeof value !== "object" || !("data" in value)) throw new ServiceError("EMBEDDING_INVALID_RESPONSE", "Respons embedding tidak valid");
  const body = value as EmbeddingResponse;
  if (!Array.isArray(body.data) || body.data.length !== count) throw new ServiceError("EMBEDDING_INVALID_RESPONSE", "Jumlah embedding tidak sesuai");
  const ordered: number[][] = new Array(count);
  for (const item of body.data) {
    if (!item || typeof item !== "object" || !Number.isInteger(item.index) || item.index < 0 || item.index >= count || ordered[item.index] || !Array.isArray(item.embedding) || item.embedding.length !== dimensions || item.embedding.some(value => typeof value !== "number" || !Number.isFinite(value)) || !item.embedding.some(value => value !== 0)) {
      throw new ServiceError("EMBEDDING_INVALID_RESPONSE", "Format embedding tidak sesuai");
    }
    ordered[item.index] = item.embedding;
  }
  return ordered;
}

export async function embedTexts(inputs: string[], options: { dimensions?: number; retries?: number; timeoutMs?: number; fetcher?: typeof fetch } = {}) {
  if (typeof window !== "undefined") throw new Error("Embedding hanya tersedia pada server");
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new ServiceError("EMBEDDING_NOT_CONFIGURED", "Pencarian semantic belum dikonfigurasi");
  if (!inputs.length || inputs.length > 128 || inputs.some(input => !input.trim() || input.length > 24000)) throw new ServiceError("EMBEDDING_INVALID_INPUT", "Batch embedding tidak valid", 400);
  const dimensions = options.dimensions ?? EMBEDDING_DIMENSIONS;
  const retries = options.retries ?? 0;
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await (options.fetcher ?? fetch)("https://openrouter.ai/api/v1/embeddings", {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(options.timeoutMs ?? 6000),
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Title": "MagangHub Explorer" },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs, dimensions, encoding_format: "float" }),
      });
      if (!response.ok) throw new ServiceError(`EMBEDDING_HTTP_${response.status}`, "Layanan embedding tidak tersedia", response.status);
      const body = await response.json() as EmbeddingResponse;
      const vectors = validateEmbeddings(body, inputs.length, dimensions);
      if (body.model && body.model.split("/").pop() !== EMBEDDING_MODEL.split("/").pop()) throw new ServiceError("EMBEDDING_MODEL_MISMATCH", "Model embedding respons tidak sesuai");
      const tokens = body.usage?.total_tokens;
      if (!Number.isInteger(tokens) || tokens! < 0) throw new ServiceError("EMBEDDING_INVALID_USAGE", "Informasi pemakaian embedding tidak valid");
      return { vectors, tokens: tokens!, model: body.model ?? EMBEDDING_MODEL };
    } catch (error) {
      const retryable = !(error instanceof ServiceError) || error.status === 429 || error.status >= 500;
      if (!retryable || attempt >= retries) throw error instanceof ServiceError ? error : new ServiceError("EMBEDDING_NETWORK", "Layanan embedding tidak dapat dijangkau");
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 8000)));
    }
  }
}
