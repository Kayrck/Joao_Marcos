import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN, loginAs, setup, teardown, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await setup();
});
afterAll(() => teardown(h));

const ADMIN_ROUTES = [
  ["GET", "/api/admin/dashboard"],
  ["GET", "/api/admin/clients"],
  ["GET", "/api/admin/receivables"],
  ["GET", "/api/admin/payables"],
  ["GET", "/api/admin/appointments?from=2026-11-01&to=2026-11-30"],
  ["GET", "/api/admin/reviews"],
  ["GET", "/api/admin/posts"],
  ["GET", "/api/admin/media"],
  ["GET", "/api/admin/settings"],
  ["GET", "/api/admin/privacy/search?q=maria"],
  ["GET", "/api/admin/finance/summary"],
] as const;

describe("proteção de rotas administrativas", () => {
  it("bloqueia TODAS as rotas administrativas sem sessão (401)", async () => {
    for (const [method, path] of ADMIN_ROUTES) {
      const r = await h.api(method, path, undefined, { auth: false });
      expect(r.status, `${method} ${path}`).toBe(401);
    }
  });

  it("não expõe agenda, financeiro nem clientes em rotas públicas", async () => {
    for (const path of ["/api/public/appointments", "/api/public/clients", "/api/public/receivables", "/api/public/finance", "/api/public/leads"]) {
      const r = await h.api("GET", path, undefined, { auth: false });
      expect(r.status, path).toBe(404);
    }
    const site = await h.api("GET", "/api/public/site", undefined, { auth: false });
    expect(site.status).toBe(200);
    const raw = JSON.stringify(site.json);
    expect(raw).not.toMatch(/appointment|receivable|payable|password|client_name/i);
  });

  it("rejeita login inválido e não revela se o e-mail existe", async () => {
    const a = await h.api("POST", "/api/admin/auth/login", { email: ADMIN.email, password: "errada12345" }, { auth: false });
    const b = await h.api("POST", "/api/admin/auth/login", { email: "naoexiste@x.com", password: "errada12345" }, { auth: false });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.json.error.message).toBe(b.json.error.message);
  });

  it("login cria sessão com cookie HttpOnly + SameSite=Lax e /me funciona; logout invalida", async () => {
    const r = await loginAs(h);
    expect(r.status).toBe(200);
    const setCookie = r.res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const me = await h.api("GET", "/api/admin/auth/me");
    expect(me.status).toBe(200);
    expect(me.json.admin.email).toBe(ADMIN.email);
    expect(JSON.stringify(me.json)).not.toMatch(/hash|password/i);

    const out = await h.api("POST", "/api/admin/auth/logout", {});
    expect(out.status).toBe(200);
    const after = await h.api("GET", "/api/admin/auth/me");
    expect(after.status).toBe(401);
  });

  it("guarda a senha apenas como hash scrypt", async () => {
    const row = (await h.db.query("select password_hash from administrators")).rows[0];
    expect(row.password_hash.startsWith("scrypt$")).toBe(true);
    expect(row.password_hash).not.toContain(ADMIN.password);
  });

  it("bloqueia requisições de outra origem (CSRF)", async () => {
    await loginAs(h);
    const r = await h.api("POST", "/api/admin/clients", { fullName: "X" }, { headers: { Origin: "https://evil.example" } });
    expect(r.status).toBe(403);
    const form = await h.api("POST", "/api/admin/auth/logout", undefined, { headers: { Origin: "", "Content-Type": "text/plain" } });
    expect([403, 400]).toContain(form.status);
  });

  it("aplica proteção contra força bruta (bloqueio após várias falhas)", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const r = await h.api("POST", "/api/admin/auth/login", { email: "brute@force.com", password: "x" + i }, { auth: false });
      last = r.status;
    }
    expect(last).toBe(429);
    // o administrador real continua entrando (bloqueio é por e-mail/IP desconhecido)
    const ok = await h.api("POST", "/api/admin/auth/login", { email: ADMIN.email, password: ADMIN.password }, { auth: false, headers: { "x-real-ip": "10.9.9.9" } });
    expect(ok.status).toBe(200);
  });

  it("troca de senha exige a senha atual e aplica a política", async () => {
    await loginAs(h);
    const wrong = await h.api("POST", "/api/admin/auth/change-password", { currentPassword: "errada", newPassword: "NovaSenha12345" });
    expect(wrong.status).toBe(400);
    const weak = await h.api("POST", "/api/admin/auth/change-password", { currentPassword: ADMIN.password, newPassword: "curta" });
    expect(weak.status).toBe(400);
    const ok = await h.api("POST", "/api/admin/auth/change-password", { currentPassword: ADMIN.password, newPassword: "NovaSenha12345" });
    expect(ok.status).toBe(200);
    // volta à senha original para não afetar outros testes
    const back = await h.api("POST", "/api/admin/auth/change-password", { currentPassword: "NovaSenha12345", newPassword: ADMIN.password });
    expect(back.status).toBe(200);
  });

  it("habilita RLS em todas as tabelas de dados", async () => {
    const r = await h.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname <> 'schema_migrations'`,
    );
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });
});
