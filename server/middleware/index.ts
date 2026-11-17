import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { Db } from "../db/index.js";
import { getDb } from "../db/index.js";
import { env } from "../env.js";
import { badRequest, forbidden, unauthorized } from "../lib/errors.js";
import { SESSION_COOKIE, getSession } from "../services/auth.js";
import type { AdminMe } from "../../shared/types.js";

export type AppEnv = {
  Variables: { db: Db; admin: AdminMe; sessionId: string };
};

/** Disponibiliza a conexão do banco no contexto. */
export const withDb: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("db", await getDb());
  await next();
};

export const securityHeaders: MiddlewareHandler = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Frame-Options", "DENY");
  if (env.isProd) c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
};

/**
 * Proteção CSRF para requisições que alteram estado:
 *  - cookie de sessão é SameSite=Lax (não vai em POST cross-site);
 *  - se o navegador envia Origin, ele precisa ser o mesmo host da API;
 *  - sem Origin, POST precisa ser application/json (formulários cross-site não conseguem).
 */
export const csrfGuard: MiddlewareHandler = async (c, next) => {
  const m = c.req.method;
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();
  const origin = c.req.header("origin");
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? new URL(c.req.url).host;
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw forbidden("Origem inválida.");
    }
    if (originHost !== host) throw forbidden("Origem não permitida.");
  } else {
    const site = c.req.header("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") throw forbidden("Origem não permitida.");
    const ct = c.req.header("content-type") ?? "";
    if (m === "POST" && !ct.startsWith("application/json")) throw forbidden("Requisição não permitida.");
  }
  return next();
};

/** IP do cliente (a Vercel preenche x-forwarded-for / x-real-ip). */
export function clientIp(c: Context): string {
  const xff = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  return c.req.header("x-real-ip") ?? xff ?? "unknown";
}

/** Exige sessão de administrador válida. Toda checagem de permissão acontece AQUI, no backend. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await getSession(c.var.db, getCookie(c, SESSION_COOKIE));
  if (!session) throw unauthorized();
  c.set("admin", session.admin);
  c.set("sessionId", session.sessionId);
  c.header("Cache-Control", "no-store");
  await next();
};

export async function readJson<T = unknown>(c: Context): Promise<T> {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw badRequest("Corpo da requisição inválido (JSON esperado).");
  }
}
