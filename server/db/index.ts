import { env } from "../env.js";

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface Queryable {
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** Executa um script com vários comandos (sem parâmetros). */
  exec(sql: string): Promise<void>;
}

export interface Db extends Queryable {
  readonly driver: "pg" | "pglite";
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// OIDs do Postgres que precisam de conversão específica
const OID_INT8 = 20;
const OID_NUMERIC = 1700;
const OID_DATE = 1082;

let current: Promise<Db> | null = null;

/** Retorna a conexão única do processo (criada sob demanda). */
export function getDb(): Promise<Db> {
  if (!current) {
    current = createDb().catch((err) => {
      current = null;
      throw err;
    });
  }
  return current;
}

/** Usado pelos testes para injetar uma instância própria. */
export function setDb(db: Db | null) {
  current = db ? Promise.resolve(db) : null;
}

async function createDb(): Promise<Db> {
  if (env.databaseUrl) return createPgDb(env.databaseUrl);
  if (env.isProd) throw new Error("DATABASE_URL não configurada.");
  return createPgliteDb(env.pgliteDir);
}

// ---------------------------------------------------------------- PostgreSQL (produção)
async function createPgDb(url: string): Promise<Db> {
  const pg = (await import("pg")).default;
  pg.types.setTypeParser(OID_INT8, (v: string) => Number(v));
  pg.types.setTypeParser(OID_NUMERIC, (v: string) => Number(v));
  pg.types.setTypeParser(OID_DATE, (v: string) => v);

  const u = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(u.hostname);
  u.searchParams.delete("sslmode"); // o SSL é controlado abaixo, de forma explícita
  const pool = new pg.Pool({
    connectionString: u.toString(),
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: local || !env.databaseSsl ? undefined : { rejectUnauthorized: false },
  });

  const wrap = (c: { query: (sql: string, params?: unknown[]) => Promise<any> }): Queryable => ({
    async query(sql, params) {
      const r = await c.query(sql, params as unknown[]);
      return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
    },
    async exec(sql) {
      await c.query(sql);
    },
  });

  return {
    driver: "pg",
    ...wrap(pool),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(wrap(client));
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// ---------------------------------------------------------------- PGlite (desenvolvimento e testes)
// PGlite é o motor real do PostgreSQL compilado para WASM. Só é carregado fora de produção.
export async function createPgliteDb(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dir !== "memory") {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(dir, { recursive: true }); // o PGlite não cria diretórios intermediários
  }
  const opts = {
    parsers: {
      [OID_INT8]: (v: string) => Number(v),
      [OID_NUMERIC]: (v: string) => Number(v),
      [OID_DATE]: (v: string) => v,
    },
  };
  const lite = dir === "memory" ? new PGlite(opts) : new PGlite(dir, opts);
  await lite.waitReady;

  const wrap = (c: {
    query: (sql: string, params?: unknown[]) => Promise<any>;
    exec: (sql: string) => Promise<any>;
  }): Queryable => ({
    async query(sql, params) {
      const r = await c.query(sql, params as unknown[]);
      // PGlite reporta affectedRows = 0 em SELECT; só usamos esse campo quando não há linhas retornadas
      return { rows: r.rows, rowCount: r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0) };
    },
    async exec(sql) {
      await c.exec(sql);
    },
  });

  return {
    driver: "pglite",
    ...wrap(lite),
    tx: (fn) => lite.transaction((t) => fn(wrap(t as never))),
    close: () => lite.close(),
  };
}

// ---------------------------------------------------------------- utilitários
const camelKey = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** snake_case -> camelCase nas chaves de primeiro nível (o conteúdo de colunas jsonb não é alterado). */
export function camel<T = any>(row: Record<string, unknown> | undefined | null): T {
  if (!row) return row as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[camelKey(k)] = v;
  return out as T;
}

export const camelRows = <T = any>(rows: Record<string, unknown>[]): T[] => rows.map((r) => camel<T>(r));

/** Escapa curingas de LIKE. */
export const likeTerm = (s: string) => `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
