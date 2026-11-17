import "./load-env.js";
import { mkdir } from "node:fs/promises";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.js";
import { ensureDefaults } from "./db/defaults.js";
import { getDb } from "./db/index.js";
import { migrate } from "./db/migrate.js";
import { env } from "./env.js";

/** Servidor de desenvolvimento: aplica migrations, cria o conteúdo inicial e serve a API + uploads locais. */
const db = await getDb();
await migrate(db, (m) => console.log(`[db] ${m}`));
if (await ensureDefaults(db)) console.log("[db] conteúdo inicial criado");

await mkdir(env.localUploadDir, { recursive: true });
const app = createApp();
app.use("/uploads/*", serveStatic({ root: env.localUploadDir, rewriteRequestPath: (p) => p.replace(/^\/uploads/, "") }));

const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`[api] http://localhost:${port}  (banco: ${db.driver}${db.driver === "pglite" ? ` em ${env.pgliteDir}` : ""})`);
});
