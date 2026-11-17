import { createApp } from "../server/app.js";

/**
 * Função serverless da Vercel: toda requisição /api/* (e robots.txt / sitemap.xml) chega aqui
 * por rewrite (ver vercel.json) e é tratada pela aplicação Hono.
 *
 * Se a configuração estiver incompleta (ex.: variáveis de ambiente não cadastradas), a função NÃO cai ao
 * carregar: responde 503 com a lista dos NOMES das variáveis que faltam (nunca os valores), para o erro
 * aparecer em /api/health em vez de um genérico FUNCTION_INVOCATION_FAILED.
 */
let handler: (request: Request) => Response | Promise<Response>;

try {
  handler = createApp().fetch;
} catch (err) {
  console.error("[api] falha ao iniciar a aplicação:", err);
  const detail = err instanceof Error ? err.message : "erro desconhecido";
  handler = () =>
    new Response(
      JSON.stringify({
        error: {
          code: "misconfigured",
          message: "O servidor não está configurado corretamente.",
          details: detail,
        },
      }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } },
    );
}

export default { fetch: (request: Request) => handler(request) };
