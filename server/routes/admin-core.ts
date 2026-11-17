import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "../env.js";
import { migrationsApplied } from "../db/migrate.js";
import { parse } from "../lib/validate.js";
import { clientIp, readJson, type AppEnv } from "../middleware/index.js";
import { SESSION_COOKIE, SESSION_DAYS, changePassword, listSessions, login, logout, revokeOtherSessions } from "../services/auth.js";
import { alerts, anonymizeClient, dashboard, listAudit, report, reportCsv, searchPerson } from "../services/dashboard.js";
import { parsePeriod } from "../services/finance.js";
import * as plans from "../services/plans.js";
import * as site from "../services/site.js";
import { endOfMonth, startOfMonth } from "../../shared/dates.js";
import { today } from "../lib/clock.js";
import { getStorage } from "../storage/index.js";

/** Único endpoint administrativo SEM sessão (é ele que cria a sessão). */
export const adminLoginRoute = new Hono<AppEnv>();
/** Demais rotas administrativas: montadas em app.ts depois do middleware `requireAdmin`. */
export const adminCoreRoutes = new Hono<AppEnv>();

const defaultPeriod = () => ({ from: startOfMonth(today()), to: endOfMonth(today()) });
const periodQuery = (c: { req: { query: () => Record<string, string> } }) => parsePeriod(c.req.query(), defaultPeriod());

// ---------------------------------------------------------------- autenticação (login é a única rota sem sessão)
adminLoginRoute.post("/auth/login", async (c) => {
  const r = await login(c.var.db, await readJson(c), clientIp(c), c.req.header("user-agent") ?? null);
  setCookie(c, SESSION_COOKIE, r.token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  c.header("Cache-Control", "no-store");
  return c.json({ admin: r.admin });
});

adminCoreRoutes.get("/auth/me", (c) => c.json({ admin: c.var.admin }));

adminCoreRoutes.post("/auth/logout", async (c) => {
  await logout(c.var.db, c.var.sessionId);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

adminCoreRoutes.post("/auth/change-password", async (c) => {
  await changePassword(c.var.db, c.var.admin.id, c.var.sessionId, await readJson(c));
  return c.json({ ok: true });
});
adminCoreRoutes.get("/auth/sessions", async (c) => c.json(await listSessions(c.var.db, c.var.admin.id, c.var.sessionId)));
adminCoreRoutes.post("/auth/sessions/revoke-others", async (c) =>
  c.json({ revoked: await revokeOtherSessions(c.var.db, c.var.admin.id, c.var.sessionId) }),
);

// ---------------------------------------------------------------- visão geral
adminCoreRoutes.get("/dashboard", async (c) => c.json(await dashboard(c.var.db, periodQuery(c))));
adminCoreRoutes.get("/alerts", async (c) => c.json(await alerts(c.var.db)));
adminCoreRoutes.get("/reports", async (c) => c.json(await report(c.var.db, periodQuery(c))));
adminCoreRoutes.get("/reports.csv", async (c) => {
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="relatorio-financeiro.csv"');
  return c.body(await reportCsv(c.var.db, periodQuery(c)));
});

// ---------------------------------------------------------------- privacidade e auditoria
adminCoreRoutes.get("/privacy/search", async (c) => c.json(await searchPerson(c.var.db, c.req.query("q") ?? "")));
adminCoreRoutes.post("/privacy/clients/:id/anonymize", async (c) => {
  const id = c.req.param("id");
  await c.var.db.tx((q) => anonymizeClient(q, c.var.admin.id, id));
  return c.json({ ok: true });
});
adminCoreRoutes.get("/audit", async (c) =>
  c.json(await listAudit(c.var.db, { entity: c.req.query("entity"), entityId: c.req.query("entityId"), limit: Number(c.req.query("limit") ?? 100) })),
);

adminCoreRoutes.get("/app-info", async (c) => {
  const storage = await getStorage().catch(() => null);
  return c.json({
    environment: env.nodeEnv,
    database: c.var.db.driver === "pg" ? "PostgreSQL" : "PGlite (desenvolvimento)",
    storage: storage ? storage.name : "não configurado",
    siteUrl: env.siteUrl,
    migrations: await migrationsApplied(c.var.db),
    node: process.version,
  });
});

// ---------------------------------------------------------------- configurações e conteúdo do site
adminCoreRoutes.get("/settings", async (c) => c.json(await site.getSettings(c.var.db)));
adminCoreRoutes.put("/settings", async (c) => {
  const body = await readJson(c);
  return c.json(await c.var.db.tx((q) => site.updateSettings(q, c.var.admin.id, body)));
});

adminCoreRoutes.get("/site/sections", async (c) => c.json(await site.listSections(c.var.db)));
adminCoreRoutes.put("/site/sections/order", async (c) => {
  const body = await readJson(c);
  return c.json(await c.var.db.tx((q) => site.reorderSections(q, c.var.admin.id, body)));
});
adminCoreRoutes.put("/site/sections/:key", async (c) => {
  const body = await readJson(c);
  return c.json(await c.var.db.tx((q) => site.updateSection(q, c.var.admin.id, c.req.param("key"), body)));
});

// ---------------------------------------------------------------- planos e promoções
const tx = <T>(c: { var: AppEnv["Variables"] }, fn: (q: import("../db/index.js").Queryable, adminId: string) => Promise<T>) =>
  c.var.db.tx((q) => fn(q, c.var.admin.id));

adminCoreRoutes.get("/plans", async (c) => c.json(await plans.listPlans(c.var.db, c.req.query("archived") === "1")));
adminCoreRoutes.post("/plans", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => plans.createPlan(q, a, b)), 201);
});
adminCoreRoutes.put("/plans/order", async (c) => {
  const b = await readJson(c);
  await tx(c, (q, a) => plans.reorderPlans(q, a, b));
  return c.json({ ok: true });
});
adminCoreRoutes.put("/plans/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => plans.updatePlan(q, a, c.req.param("id"), b)));
});
adminCoreRoutes.post("/plans/:id/archive", async (c) => c.json(await tx(c, (q, a) => plans.archivePlan(q, a, c.req.param("id"), true))));
adminCoreRoutes.post("/plans/:id/restore", async (c) => c.json(await tx(c, (q, a) => plans.archivePlan(q, a, c.req.param("id"), false))));
adminCoreRoutes.delete("/plans/:id", async (c) => {
  await tx(c, (q, a) => plans.deletePlan(q, a, c.req.param("id")));
  return c.json({ ok: true });
});

adminCoreRoutes.get("/promotions", async (c) => c.json(await plans.listPromotions(c.var.db)));
adminCoreRoutes.post("/promotions", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => plans.createPromotion(q, a, b)), 201);
});
adminCoreRoutes.put("/promotions/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => plans.updatePromotion(q, a, c.req.param("id"), b)));
});
adminCoreRoutes.post("/promotions/:id/active", async (c) => {
  const { active } = parse(z.object({ active: z.boolean() }), await readJson(c));
  return c.json(await tx(c, (q, a) => plans.setPromotionActive(q, a, c.req.param("id"), active)));
});
adminCoreRoutes.delete("/promotions/:id", async (c) => {
  await tx(c, (q, a) => plans.deletePromotion(q, a, c.req.param("id")));
  return c.json({ ok: true });
});
