import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let connection: NeonQueryFunction<false, false> | undefined;
export function database() {
  if (typeof window !== "undefined") throw new Error("Database hanya tersedia pada server");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum dikonfigurasi");
  return connection ??= neon(url, { fetchOptions: { cache: "no-store" } });
}

export async function query<T>(text: string, parameters: unknown[] = []): Promise<T[]> {
  // A fresh timeout is required for every request, including long backfills.
  return await database().query(text, parameters, { fetchOptions: { signal: AbortSignal.timeout(20000) } }) as T[];
}
