import { createHash, timingSafeEqual } from "node:crypto";
import { ServiceError } from "./errors";
import { INGEST_BODY_LIMIT, parseIngestInput } from "./ingest-input";
import { ingestJobs } from "./ingest";
import { consumeLimit } from "./limits";

function authenticate(request: Request) {
  const key = process.env.INGEST_API_KEY;
  if (!key || key.length < 32) throw new ServiceError("INGEST_NOT_CONFIGURED", "INGEST_API_KEY belum dikonfigurasi dengan benar.");
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = /^Bearer ([^\s]{1,4096})$/i.exec(authorization)?.[1] ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(digest(key), digest(supplied))) throw new ServiceError("UNAUTHORIZED", "API key ingest tidak valid.", 401);
}

async function readBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ServiceError("UNSUPPORTED_MEDIA_TYPE", "Gunakan Content-Type: application/json.", 415);
  if (Number(request.headers.get("content-length")) > INGEST_BODY_LIMIT) throw new ServiceError("PAYLOAD_TOO_LARGE", "Payload maksimal 2 MiB.", 413);
  if (!request.body) throw new ServiceError("INVALID_JSON", "Body JSON diperlukan.", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > INGEST_BODY_LIMIT) {
        await reader.cancel();
        throw new ServiceError("PAYLOAD_TOO_LARGE", "Payload maksimal 2 MiB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new ServiceError("INVALID_JSON", "Body JSON tidak valid.", 400); }
}

export async function ingestResponse(request: Request, ingest = ingestJobs, admit = () => consumeLimit("ingest:requests", 60, 60)) {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  try {
    authenticate(request);
    await admit();
    const input = parseIngestInput(await readBody(request));
    return Response.json(await ingest(input), { headers });
  } catch (error) {
    const known = error instanceof ServiceError;
    // Provider statuses describe the upstream service, not the bot's credentials.
    const upstream = known && error.code.startsWith("EMBEDDING_");
    const rejectedInput = known && ["EMBEDDING_INVALID_INPUT", "EMBEDDING_HTTP_400", "EMBEDDING_HTTP_413", "EMBEDDING_HTTP_422"].includes(error.code);
    const status = rejectedInput ? 422 : known && !upstream ? error.status : 503;
    return Response.json({ error: { code: rejectedInput ? "EMBEDDING_INPUT_REJECTED" : known ? error.code : "INGEST_UNAVAILABLE", message: rejectedInput ? "Teks ditolak provider embedding. Periksa isi atau pendekkan deskripsi/program studi sebelum mengirim ulang." : known ? error.message : "Ingest sementara tidak tersedia. Kirim ulang batch yang sama." } }, {
      status, headers: { ...headers, ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}), ...([429, 503].includes(status) ? { "Retry-After": String(known ? error.retryAfter : 60) } : {}) },
    });
  }
}
