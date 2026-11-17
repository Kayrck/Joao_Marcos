import { createApp } from "../server/app.js";
import { ensureDefaults } from "../server/db/defaults.js";
import { createPgliteDb, setDb, type Db } from "../server/db/index.js";
import { migrate } from "../server/db/migrate.js";
import { setClockForTests } from "../server/lib/clock.js";
import { createAdmin } from "../server/services/auth.js";

export const ADMIN = { email: "admin@teste.com", name: "Admin Teste", password: "senhaSegura123" };

export interface Harness {
  db: Db;
  app: ReturnType<typeof createApp>;
  cookie: string;
  /** Requisição autenticada (com Origin do mesmo host, como um navegador). */
  api: (method: string, path: string, body?: unknown, opts?: { auth?: boolean; headers?: Record<string, string> }) => Promise<{ status: number; json: any; res: Response }>;
}

/** Sobe a aplicação inteira sobre um PostgreSQL real (PGlite em memória) com migrations e conteúdo inicial. */
export async function setup(): Promise<Harness> {
  setClockForTests("2026-11-16T12:00:00-03:00");
  const db = await createPgliteDb("memory");
  setDb(db);
  await migrate(db);
  await ensureDefaults(db);
  await createAdmin(db, ADMIN);
  const app = createApp();

  const h: Harness = {
    db,
    app,
    cookie: "",
    async api(method, path, body, opts = {}) {
      const headers: Record<string, string> = { Origin: "http://localhost", Host: "localhost", ...opts.headers };
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (opts.auth !== false && h.cookie) headers.Cookie = h.cookie;
      const res = await app.request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json, res };
    },
  };
  return h;
}

export async function loginAs(h: Harness) {
  const r = await h.api("POST", "/api/admin/auth/login", { email: ADMIN.email, password: ADMIN.password }, { auth: false });
  const setCookie = r.res.headers.get("set-cookie") ?? "";
  h.cookie = setCookie.split(";")[0];
  return r;
}

export async function teardown(h: Harness) {
  setClockForTests(null);
  setDb(null);
  await h.db.close();
}
