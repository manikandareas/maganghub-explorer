import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { query } from "./db";
import { ServiceError } from "./errors";

export function clientIdentity(headers: Pick<Headers, "get">): string {
  const trustProxy = process.env.TRUST_PROXY === "true" || process.env.VERCEL === "1";
  const address = trustProxy ? (headers.get("x-forwarded-for") ?? "").split(",")[0].trim() : "";
  return createHmac("sha256", process.env.RATE_LIMIT_SALT || process.env.DATABASE_URL || "local").update(isIP(address) ? address : "shared").digest("hex");
}

export async function consumeLimit(bucket: string, limit: number, windowSeconds: number) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new ServiceError("INVALID_LIMIT_CONFIG", "Konfigurasi batas pemakaian tidak valid");
  const rows = await query<{ count: number }>(`INSERT INTO mh_rate_limits(bucket,window_start,count)
    VALUES($1,to_timestamp(floor(extract(epoch FROM now())/$3)*$3),1)
    ON CONFLICT(bucket,window_start) DO UPDATE SET count=mh_rate_limits.count+1 WHERE mh_rate_limits.count<$2 RETURNING count`, [bucket, limit, windowSeconds]);
  if (!rows.length) throw new ServiceError("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar.", 429, windowSeconds);
}

export const admitRequest = (identity: string) => consumeLimit(`request:${identity}`, 60, 60);
