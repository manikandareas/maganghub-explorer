import "./env";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { database, query } from "../src/lib/server/db";

async function main() {
  await query("CREATE TABLE IF NOT EXISTS mh_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of readdirSync("migrations").filter(name => name.endsWith(".sql")).sort()) {
    const source = readFileSync(`migrations/${name}`, "utf8");
    const hash = createHash("sha256").update(source).digest("hex");
    const [applied] = await query<{ hash: string }>("SELECT hash FROM mh_migrations WHERE name=$1", [name]);
    if (applied) {
      if (applied.hash !== hash) throw new Error("Migration yang sudah diterapkan berubah");
      console.log(JSON.stringify({ migration: name, status: "already_applied" }));
      continue;
    }
    const sql = database();
    const statements = source.split(/;\s*(?:\n|$)/).map(value => value.trim()).filter(Boolean);
    await sql.transaction([...statements.map(statement => sql.query(statement)), sql.query("INSERT INTO mh_migrations(name,hash) VALUES($1,$2)", [name, hash])]);
    console.log(JSON.stringify({ migration: name, status: "applied" }));
  }
}
main().catch(async error => (await import("./env")).reportError(error));
