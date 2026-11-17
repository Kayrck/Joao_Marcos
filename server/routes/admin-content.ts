import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { badRequest, forbidden } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { readJson, type AppEnv } from "../middleware/index.js";
import * as media from "../services/media.js";
import * as posts from "../services/posts.js";
import * as reviews from "../services/reviews.js";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "../../shared/constants.js";
import { getStorage } from "../storage/index.js";

/** Avaliações, publicações e mídias — somente administradores. */
export const adminContentRoutes = new Hono<AppEnv>();

const tx = <T>(c: Context<AppEnv>, fn: (q: Queryable, adminId: string) => Promise<T>) => c.var.db.tx((q) => fn(q, c.var.admin.id));
const id = (c: Context<AppEnv>) => c.req.param("id") as string;
const ok = (c: Context<AppEnv>) => c.json({ ok: true });

// ---------------------------------------------------------------- avaliações (moderação)
adminContentRoutes.get("/reviews", async (c) => c.json(await reviews.listReviews(c.var.db, c.req.query())));
adminContentRoutes.get("/reviews/pending-count", async (c) => c.json({ count: await reviews.pendingReviewsCount(c.var.db) }));
adminContentRoutes.put("/reviews/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => reviews.editReview(q, a, id(c), b)));
});
adminContentRoutes.post("/reviews/:id/moderate", async (c) => {
  const b = parse(
    z.object({ status: z.enum(["approved", "rejected", "pending"]), note: z.string().trim().max(300).nullish() }),
    await readJson(c),
  );
  return c.json(await tx(c, (q, a) => reviews.moderateReview(q, a, id(c), b.status, b.note)));
});
adminContentRoutes.get("/reviews/:id/history", async (c) => c.json(await reviews.reviewHistory(c.var.db, id(c))));
adminContentRoutes.delete("/reviews/:id", async (c) => {
  await tx(c, (q, a) => reviews.deleteReview(q, a, id(c)));
  return ok(c);
});

// ---------------------------------------------------------------- publicações
adminContentRoutes.get("/posts", async (c) => c.json(await posts.listPosts(c.var.db, c.req.query())));
adminContentRoutes.post("/posts", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => posts.createPost(q, a, b)), 201);
});
adminContentRoutes.get("/posts/:id", async (c) => c.json(await posts.getPost(c.var.db, id(c))));
adminContentRoutes.get("/posts/:id/preview", async (c) => c.json(await posts.previewPost(c.var.db, id(c))));
adminContentRoutes.put("/posts/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => posts.updatePost(q, a, id(c), b)));
});
adminContentRoutes.post("/posts/:id/publish", async (c) => {
  const b = parse(z.object({ publishedAt: z.string().datetime({ offset: true }).nullish() }), await c.req.json().catch(() => ({})));
  return c.json(await tx(c, (q, a) => posts.setPublished(q, a, id(c), true, b.publishedAt ?? undefined)));
});
adminContentRoutes.post("/posts/:id/unpublish", async (c) => c.json(await tx(c, (q, a) => posts.setPublished(q, a, id(c), false))));
adminContentRoutes.delete("/posts/:id", async (c) => {
  await tx(c, (q, a) => posts.deletePost(q, a, id(c)));
  return ok(c);
});

// ---------------------------------------------------------------- mídias
adminContentRoutes.get("/media", async (c) => c.json(await media.listMedia(c.var.db, c.req.query())));
adminContentRoutes.post("/media/upload-init", async (c) => c.json(await media.initUpload(await readJson(c))));
adminContentRoutes.post("/media/upload-confirm", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => media.confirmUpload(q, a, b)), 201);
});
adminContentRoutes.post("/media/external", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => media.addExternalVideo(q, a, b)), 201);
});
adminContentRoutes.put("/media/:id{[0-9a-fA-F-]{36}}", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => media.updateMedia(q, a, id(c), b)));
});
adminContentRoutes.delete("/media/:id{[0-9a-fA-F-]{36}}", async (c) => {
  await tx(c, (q, a) => media.deleteMedia(q, a, id(c)));
  return ok(c);
});

/** Upload local (somente desenvolvimento): o navegador envia o arquivo à própria API, que grava em disco. */
adminContentRoutes.put("/media/local-upload", async (c) => {
  const storage = (await getStorage()) as Awaited<ReturnType<typeof import("../storage/local.js").createLocalStorage>>;
  if (storage.name !== "local") throw forbidden("Upload local indisponível: use o armazenamento configurado.");
  const key = c.req.query("key") ?? "";
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(key)) throw badRequest("Chave inválida.");
  const len = Number(c.req.header("content-length") ?? 0);
  if (len > MAX_VIDEO_BYTES || (len > MAX_IMAGE_BYTES && (c.req.header("content-type") ?? "").startsWith("image/"))) {
    throw badRequest("Arquivo grande demais.");
  }
  await storage.write(key, Buffer.from(await c.req.arrayBuffer()));
  return ok(c);
});
