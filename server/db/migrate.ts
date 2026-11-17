import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Db } from "./index.js";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

/** Aplica, em ordem, as migrations ainda não registradas em `schema_migrations`. */
export async function migrate(db: Db, log: (msg: string) => void = () => undefined): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), "utf8");
    await db.tx(async (q) => {
      await q.exec(sql);
      await q.query("insert into schema_migrations (name) values ($1)", [file]);
    });
    ran.push(file);
    log(`migration aplicada: ${file}`);
  }
  return ran;
}

export async function migrationsApplied(db: Db): Promise<number> {
  try {
    return (await db.query<{ n: number }>("select count(*)::int as n from schema_migrations")).rows[0].n;
  } catch {
    return 0;
  }
}
