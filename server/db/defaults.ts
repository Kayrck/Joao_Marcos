import type { Db } from "./index.js";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_PLANS,
  DEFAULT_PLAN_FEATURES,
  DEFAULT_SECTIONS,
  DEFAULT_SETTINGS,
} from "../../shared/site-content.js";

const MARKER = "_defaults_v1";

/**
 * Conteúdo inicial da instalação: configurações, seções do site, planos, campanha de 2026 e
 * categorias de despesa. Executa uma única vez (marcador em site_settings), portanto nunca
 * sobrescreve o que o administrador já editou.
 */
export async function ensureDefaults(db: Db): Promise<boolean> {
  const done = await db.query("select 1 from site_settings where key = $1", [MARKER]);
  if (done.rowCount > 0) return false;

  await db.tx(async (q) => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await q.query(
        "insert into site_settings (key, value) values ($1, $2::jsonb) on conflict (key) do nothing",
        [key, JSON.stringify(value)],
      );
    }
    for (const [i, s] of DEFAULT_SECTIONS.entries()) {
      await q.query(
        "insert into site_sections (key, enabled, sort_order, content) values ($1, $2, $3, $4::jsonb) on conflict (key) do nothing",
        [s.key, s.enabled, (i + 1) * 10, JSON.stringify(s.content)],
      );
    }
    for (const name of DEFAULT_EXPENSE_CATEGORIES) {
      await q.query("insert into expense_categories (name) values ($1) on conflict do nothing", [name]);
    }

    const plansCount = (await q.query<{ n: number }>("select count(*)::int as n from plans")).rows[0].n;
    if (plansCount === 0) {
      const ids: { id: string; promo: number }[] = [];
      for (const [i, p] of DEFAULT_PLANS.entries()) {
        const r = await q.query<{ id: string }>(
          `insert into plans (name, duration_months, regular_price_cents, description, features, badge, is_featured, sort_order)
           values ($1, $2, null, $3, $4::jsonb, $5, $6, $7) returning id`,
          [
            p.name,
            p.months,
            `Consultoria online por ${p.months} ${p.months === 1 ? "mês" : "meses"}.`,
            JSON.stringify(DEFAULT_PLAN_FEATURES),
            p.badge,
            p.featured,
            (i + 1) * 10,
          ],
        );
        ids.push({ id: r.rows[0].id, promo: p.promo });
      }
      // Campanha de 2026: valores promocionais válidos até 31/12/2026 (fuso America/Fortaleza).
      const promo = await q.query<{ id: string }>(
        `insert into promotions (name, description, starts_at, ends_at)
         values ('Promoção 2026', 'Valores promocionais da consultoria online, válidos até 31/12/2026.',
                 '2026-01-01T00:00:00-03:00', '2027-01-01T00:00:00-03:00') returning id`,
      );
      for (const p of ids) {
        await q.query(
          "insert into promotion_plans (promotion_id, plan_id, promo_price_cents) values ($1, $2, $3)",
          [promo.rows[0].id, p.id, p.promo],
        );
      }
    }

    await q.query("insert into site_settings (key, value) values ($1, 'true'::jsonb)", [MARKER]);
  });
  return true;
}
