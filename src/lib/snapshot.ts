import { readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export type SnapshotRow = [string, string, string, number, number, number, number, number, number, string, number, number, number, string, string, number];
export type Snapshot = { cities: string[]; provs: string[]; prodis: string[]; rows: SnapshotRow[] };

export function readSnapshot(directory = process.cwd()): Snapshot & { hash: string } {
  const snapshot: Snapshot = { cities: [], provs: [], prodis: [], rows: [] };
  const hash = createHash("sha256");
  for (let part = 1; part <= 4; part++) {
    const source = readFileSync(path.join(directory, `data-${part}.js`), "utf8");
    hash.update(source);
    const start = source.indexOf("var _p=") + "var _p=".length;
    const end = source.lastIndexOf(";if(_p.cities)");
    if (start < "var _p=".length || end < start) throw new Error(`Format snapshot data-${part}.js tidak valid`);
    const chunk = JSON.parse(source.slice(start, end)) as Partial<Snapshot>;
    if (chunk.cities) snapshot.cities = chunk.cities;
    if (chunk.provs) snapshot.provs = chunk.provs;
    if (chunk.prodis) snapshot.prodis = chunk.prodis;
    if (chunk.rows) snapshot.rows.push(...chunk.rows);
  }
  if (new Set(snapshot.rows.map(row => row[0])).size !== snapshot.rows.length) throw new Error("ID snapshot duplikat");
  return { ...snapshot, hash: hash.digest("hex") };
}
