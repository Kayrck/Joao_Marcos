import { Hono } from "hono";
import { z } from "zod";
import { POST_CATEGORIES } from "../../shared/constants.js";
import { clientIp, readJson, withDb, type AppEnv } from "../middleware/index.js";
import { parseQuery } from "../lib/validate.js";
import { submitPublicLead } from "../services/leads.js";
import { publicGallery, publicPost } from "../services/posts.js";
import { submitReview } from "../services/reviews.js";
import { getPublicSite } from "../services/site.js";

/** Rotas PÚBLICAS: somente conteúdo já publicado/aprovado. Nada de financeiro, clientes ou agenda. */
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.use("*", withDb);

const cache = (c: { header: (k: string, v: string) => void }) =>
  c.header("Cache-Control", "public, max-age=0, must-revalidate, s-maxage=10");

publicRoutes.get("/site", async (c) => {
  cache(c);
  return c.json(await getPublicSite(c.var.db));
});

const postsQuery = z.object({
  category: z.enum(POST_CATEGORIES).optional(),
  cursor: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(24).default(6),
});

publicRoutes.get("/posts", async (c) => {
  const f = parseQuery(postsQuery, c.req.query());
  cache(c);
  return c.json(await publicGallery(c.var.db, { offset: f.cursor, limit: f.limit, category: f.category }));
});

publicRoutes.get("/posts/:slug", async (c) => {
  cache(c);
  return c.json(await publicPost(c.var.db, c.req.param("slug")));
});

publicRoutes.post("/reviews", async (c) => c.json(await submitReview(c.var.db, clientIp(c), await readJson(c)), 201));

publicRoutes.post("/leads", async (c) => c.json(await submitPublicLead(c.var.db, clientIp(c), await readJson(c)), 201));
