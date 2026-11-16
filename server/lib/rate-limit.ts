import type { Queryable } from "../db/index.js";
import { tooMany } from "./errors.js";

/**
 * Rate limit em janela fixa, persistido no banco (funciona em ambiente serverless,
 * onde a memória não é compartilhada entre instâncias).
 * Lança 429 quando `limit` é excedido dentro de `windowSec`.
 */
export async function rateLimit(
  q: Queryable,
  key: string,
  limit: number,
  windowSec: number,
  message?: string,
): Promise<void> {
  const r = await q.query<{ hits: number }>(
    `insert into rate_limits (key, window_start, hits)
     values ($1, to_timestamp(floor(extract(epoch from now()) / $2::int) * $2::int), 1)
     on conflict (key, window_start) do update set hits = rate_limits.hits + 1
     returning hits`,
    [key, windowSec],
  );
  if (Math.random() < 0.02) {
    // limpeza oportunista de janelas antigas
    await q.query("delete from rate_limits where window_start < now() - interval '2 days'");
  }
  if (r.rows[0].hits > limit) throw tooMany(message);
}
