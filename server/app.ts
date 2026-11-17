import { Hono } from "hono";
import { assertProductionEnv, env } from "./env.js";
import { AppError } from "./lib/errors.js";
import { csrfGuard, requireAdmin, securityHeaders, withDb, type AppEnv } from "./middleware/index.js";
import { adminContentRoutes } from "./routes/admin-content.js";
import { adminCoreRoutes, adminLoginRoute } from "./routes/admin-core.js";
import { adminCrmRoutes } from "./routes/admin-crm.js";
import { publicRoutes } from "./routes/public.js";

/** Monta a aplicação HTTP (usada pela função da Vercel, pelo servidor de desenvolvimento e pelos testes). */
export function createApp() {
  assertProductionEnv();
  const app = new Hono<AppEnv>();

  app.use("*", securityHeaders);
  app.use("/api/*", csrfGuard);

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, fields: err.fields, details: err.details } }, err.status as 400);
    }
    console.error("[api] erro inesperado:", err);
    return c.json({ error: { code: "internal_error", message: "Erro interno. Tente novamente em instantes." } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "not_found", message: "Rota não encontrada." } }, 404));

  app.get("/api/health", withDb, async (c) => {
    await c.var.db.query("select 1");
    return c.json({ ok: true });
  });

  app.route("/api/public", publicRoutes);

  // Área administrativa: o login é a única rota sem sessão; o middleware `requireAdmin` protege
  // TUDO o que for registrado depois dele (a ordem de registro é o que garante isso).
  const admin = new Hono<AppEnv>();
  admin.use("*", withDb);
  admin.route("/", adminLoginRoute);
  admin.use("*", requireAdmin);
  admin.route("/", adminCoreRoutes);
  admin.route("/", adminCrmRoutes);
  admin.route("/", adminContentRoutes);
  app.route("/api/admin", admin);

  app.get("/robots.txt", (c) =>
    c.text(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${env.siteUrl}/sitemap.xml\n`),
  );
  app.get("/sitemap.xml", (c) => {
    c.header("Content-Type", "application/xml; charset=utf-8");
    return c.body(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${env.siteUrl}/</loc></url>\n  <url><loc>${env.siteUrl}/privacidade</loc></url>\n</urlset>\n`,
    );
  });

  return app;
}
