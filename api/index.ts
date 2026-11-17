import { createApp } from "../server/app.js";

/**
 * Função serverless da Vercel: toda requisição /api/* (e robots.txt / sitemap.xml) chega aqui
 * por rewrite (ver vercel.json) e é tratada pela aplicação Hono.
 */
const app = createApp();

export default { fetch: app.fetch };
