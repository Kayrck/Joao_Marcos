import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { now } from "../lib/clock.js";
import { conflict, notFound } from "../lib/errors.js";
import { cents, parse, reqText, text } from "../lib/validate.js";
import { isoToLocalParts, localToIso } from "../../shared/dates.js";
import type { AdminPlan, AdminPromotion, PromotionStatus, PublicPlan, PublicPrice } from "../../shared/types.js";

// ---------------------------------------------------------------- preço em vigor
interface PromoHit {
  planId: string;
  cents: number;
  promotionId: string;
  promotionName: string;
  endsAt: Date;
}

/** Última data (inclusiva, fuso de Fortaleza) de validade de uma promoção cujo `ends_at` é exclusivo. */
export function validUntilOf(endsAt: Date | string): { date: string; time: string } {
  return isoToLocalParts(new Date(new Date(endsAt).getTime() - 60_000));
}

/**
 * Promoções vigentes no instante `at`. Para cada plano vale o MENOR preço promocional entre
 * as promoções ativas (em empate, a que começou por último).
 */
export async function activePromoPrices(q: Queryable, at: Date = now()): Promise<Map<string, PromoHit>> {
  const r = await q.query(
    `select pp.plan_id, pp.promo_price_cents, p.id as promotion_id, p.name, p.ends_at
       from promotions p
       join promotion_plans pp on pp.promotion_id = p.id
      where p.is_active and p.starts_at <= $1 and p.ends_at > $1
      order by pp.promo_price_cents asc, p.starts_at desc`,
    [at.toISOString()],
  );
  const out = new Map<string, PromoHit>();
  for (const row of r.rows) {
    if (out.has(row.plan_id)) continue;
    out.set(row.plan_id, {
      planId: row.plan_id,
      cents: row.promo_price_cents,
      promotionId: row.promotion_id,
      promotionName: row.name,
      endsAt: new Date(row.ends_at),
    });
  }
  return out;
}

export function priceFor(regular: number | null, promo: PromoHit | undefined): PublicPrice {
  if (promo) {
    return {
      kind: "promo",
      cents: promo.cents,
      promotionName: promo.promotionName,
      validUntilDate: validUntilOf(promo.endsAt).date,
    };
  }
  if (regular !== null) return { kind: "regular", cents: regular, promotionName: null, validUntilDate: null };
  return { kind: "consult", cents: null, promotionName: null, validUntilDate: null };
}

/** Preço que vale hoje para um plano (usado como sugestão ao registrar uma contratação). */
export async function currentPriceCents(q: Queryable, planId: string): Promise<number | null> {
  const promos = await activePromoPrices(q);
  const plan = (await q.query("select regular_price_cents from plans where id = $1", [planId])).rows[0];
  if (!plan) return null;
  return priceFor(plan.regular_price_cents, promos.get(planId)).cents;
}

// ---------------------------------------------------------------- site público
export async function publicPlans(q: Queryable): Promise<{ plans: PublicPlan[]; activePromotion: { name: string; validUntilDate: string } | null }> {
  const [rows, promos] = await Promise.all([
    q.query("select * from plans where is_active and archived_at is null order by sort_order, duration_months"),
    activePromoPrices(q),
  ]);
  const plans = rows.rows.map((r): PublicPlan => {
    const price = priceFor(r.regular_price_cents, promos.get(r.id));
    return {
      id: r.id,
      name: r.name,
      durationMonths: r.duration_months,
      description: r.description,
      features: Array.isArray(r.features) ? r.features : [],
      conditions: r.conditions,
      badge: r.badge,
      isFeatured: r.is_featured,
      price,
      perMonthCents: price.cents === null ? null : Math.round(price.cents / r.duration_months),
    };
  });
  const promoPlan = plans.find((p) => p.price.kind === "promo");
  return {
    plans,
    activePromotion: promoPlan
      ? { name: promoPlan.price.promotionName!, validUntilDate: promoPlan.price.validUntilDate! }
      : null,
  };
}

// ---------------------------------------------------------------- planos (admin)
const planSchema = z.object({
  name: reqText(80),
  durationMonths: z.number().int().min(1).max(36),
  regularPriceCents: cents.nullable().default(null),
  description: text(400).default(""),
  features: z.array(reqText(120)).max(12).default([]),
  conditions: text(600).default(""),
  badge: text(40).default(""),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

function planDto(row: any, promos: Map<string, PromoHit>): AdminPlan {
  const r = camel(row);
  return {
    id: r.id,
    name: r.name,
    durationMonths: r.durationMonths,
    regularPriceCents: r.regularPriceCents,
    description: r.description,
    features: Array.isArray(r.features) ? r.features : [],
    conditions: r.conditions,
    badge: r.badge,
    isFeatured: r.isFeatured,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
    archivedAt: r.archivedAt ? new Date(r.archivedAt).toISOString() : null,
    currentPrice: priceFor(r.regularPriceCents, promos.get(r.id)),
  };
}

export async function listPlans(q: Queryable, includeArchived = false): Promise<AdminPlan[]> {
  const [rows, promos] = await Promise.all([
    q.query(
      `select * from plans ${includeArchived ? "" : "where archived_at is null"} order by archived_at nulls first, sort_order, duration_months`,
    ),
    activePromoPrices(q),
  ]);
  return rows.rows.map((r) => planDto(r, promos));
}

export async function getPlan(q: Queryable, id: string): Promise<AdminPlan> {
  const r = await q.query("select * from plans where id = $1", [id]);
  if (!r.rows[0]) throw notFound("Plano");
  return planDto(r.rows[0], await activePromoPrices(q));
}

export async function createPlan(q: Queryable, adminId: string, input: unknown): Promise<AdminPlan> {
  const d = parse(planSchema, input);
  const next = d.sortOrder ?? ((await q.query<{ m: number }>("select coalesce(max(sort_order), 0)::int + 10 as m from plans")).rows[0].m);
  const r = await q.query(
    `insert into plans (name, duration_months, regular_price_cents, description, features, conditions, badge, is_featured, is_active, sort_order)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) returning *`,
    [d.name, d.durationMonths, d.regularPriceCents, d.description, JSON.stringify(d.features), d.conditions, d.badge, d.isFeatured, d.isActive, next],
  );
  await audit(q, { adminId, action: "plan.create", entity: "plan", entityId: r.rows[0].id, summary: d.name, after: d });
  return planDto(r.rows[0], await activePromoPrices(q));
}

export async function updatePlan(q: Queryable, adminId: string, id: string, input: unknown): Promise<AdminPlan> {
  const d = parse(planSchema, input);
  const before = await getPlan(q, id);
  const r = await q.query(
    `update plans set name=$2, duration_months=$3, regular_price_cents=$4, description=$5, features=$6::jsonb,
            conditions=$7, badge=$8, is_featured=$9, is_active=$10, sort_order=coalesce($11, sort_order)
      where id=$1 returning *`,
    [id, d.name, d.durationMonths, d.regularPriceCents, d.description, JSON.stringify(d.features), d.conditions, d.badge, d.isFeatured, d.isActive, d.sortOrder ?? null],
  );
  await audit(q, { adminId, action: "plan.update", entity: "plan", entityId: id, summary: d.name, before, after: d });
  return planDto(r.rows[0], await activePromoPrices(q));
}

export async function archivePlan(q: Queryable, adminId: string, id: string, archive: boolean): Promise<AdminPlan> {
  const r = await q.query(
    `update plans set archived_at = ${archive ? "now()" : "null"}, is_active = ${archive ? "false" : "is_active"} where id = $1 returning *`,
    [id],
  );
  if (!r.rows[0]) throw notFound("Plano");
  await audit(q, { adminId, action: archive ? "plan.archive" : "plan.restore", entity: "plan", entityId: id, summary: r.rows[0].name });
  return planDto(r.rows[0], await activePromoPrices(q));
}

/** Exclusão física só é permitida para planos sem contratações nem promoções. */
export async function deletePlan(q: Queryable, adminId: string, id: string): Promise<void> {
  const used = (
    await q.query<{ n: number }>(
      `select ((select count(*) from client_subscriptions where plan_id = $1) + (select count(*) from promotion_plans where plan_id = $1))::int as n`,
      [id],
    )
  ).rows[0].n;
  if (used > 0) throw conflict("Este plano possui contratações ou promoções vinculadas. Arquive-o em vez de excluir.");
  const r = await q.query("delete from plans where id = $1 returning name", [id]);
  if (!r.rows[0]) throw notFound("Plano");
  await audit(q, { adminId, action: "plan.delete", entity: "plan", entityId: id, summary: r.rows[0].name });
}

export async function reorderPlans(q: Queryable, adminId: string, input: unknown): Promise<void> {
  const { ids } = parse(z.object({ ids: z.array(z.string().uuid()).min(1).max(50) }), input);
  for (const [i, id] of ids.entries()) await q.query("update plans set sort_order = $2 where id = $1", [id, (i + 1) * 10]);
  await audit(q, { adminId, action: "plan.reorder", entity: "plan", summary: "Ordem dos planos alterada" });
}

// ---------------------------------------------------------------- promoções
const promoSchema = z
  .object({
    name: reqText(120),
    description: text(500).default(""),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    isActive: z.boolean().default(true),
    plans: z
      .array(z.object({ planId: z.string().uuid(), promoPriceCents: cents }))
      .min(1, "Selecione ao menos um plano.")
      .max(50),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: "O fim deve ser depois do início.", path: ["endsAt"] })
  .refine((v) => new Set(v.plans.map((p) => p.planId)).size === v.plans.length, {
    message: "Plano repetido.",
    path: ["plans"],
  });

function promoStatus(row: { is_active: boolean; starts_at: Date; ends_at: Date }, at: Date): PromotionStatus {
  if (!row.is_active) return "disabled";
  if (new Date(row.starts_at) > at) return "scheduled";
  if (new Date(row.ends_at) <= at) return "expired";
  return "active";
}

async function promoDtos(q: Queryable, where = "", params: unknown[] = []): Promise<AdminPromotion[]> {
  const at = now();
  const [promos, links] = await Promise.all([
    q.query(`select * from promotions ${where} order by starts_at desc, created_at desc`, params),
    q.query(
      `select pp.promotion_id, pp.plan_id, pp.promo_price_cents, pl.name as plan_name
         from promotion_plans pp join plans pl on pl.id = pp.plan_id order by pl.sort_order, pl.duration_months`,
    ),
  ]);
  return promos.rows.map((p): AdminPromotion => {
    const until = validUntilOf(p.ends_at);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      startsAt: new Date(p.starts_at).toISOString(),
      endsAt: new Date(p.ends_at).toISOString(),
      validUntilDate: until.date,
      validUntilTime: until.time,
      isActive: p.is_active,
      status: promoStatus(p, at),
      plans: links.rows
        .filter((l) => l.promotion_id === p.id)
        .map((l) => ({ planId: l.plan_id, planName: l.plan_name, promoPriceCents: l.promo_price_cents })),
      createdAt: new Date(p.created_at).toISOString(),
    };
  });
}

export const listPromotions = (q: Queryable) => promoDtos(q);

export async function getPromotion(q: Queryable, id: string): Promise<AdminPromotion> {
  const r = await promoDtos(q, "where id = $1", [id]);
  if (!r[0]) throw notFound("Promoção");
  return r[0];
}

async function writePromotionPlans(q: Queryable, promotionId: string, plans: { planId: string; promoPriceCents: number }[]) {
  await q.query("delete from promotion_plans where promotion_id = $1", [promotionId]);
  for (const p of plans) {
    const exists = await q.query("select 1 from plans where id = $1", [p.planId]);
    if (!exists.rowCount) throw notFound("Plano");
    await q.query("insert into promotion_plans (promotion_id, plan_id, promo_price_cents) values ($1,$2,$3)", [
      promotionId,
      p.planId,
      p.promoPriceCents,
    ]);
  }
}

export async function createPromotion(q: Queryable, adminId: string, input: unknown): Promise<AdminPromotion> {
  const d = parse(promoSchema, input);
  const r = await q.query<{ id: string }>(
    "insert into promotions (name, description, starts_at, ends_at, is_active) values ($1,$2,$3,$4,$5) returning id",
    [d.name, d.description, d.startsAt, d.endsAt, d.isActive],
  );
  const id = r.rows[0].id;
  await writePromotionPlans(q, id, d.plans);
  await audit(q, { adminId, action: "promotion.create", entity: "promotion", entityId: id, summary: d.name, after: d });
  return getPromotion(q, id);
}

export async function updatePromotion(q: Queryable, adminId: string, id: string, input: unknown): Promise<AdminPromotion> {
  const d = parse(promoSchema, input);
  const before = await getPromotion(q, id);
  await q.query(
    "update promotions set name=$2, description=$3, starts_at=$4, ends_at=$5, is_active=$6 where id=$1",
    [id, d.name, d.description, d.startsAt, d.endsAt, d.isActive],
  );
  await writePromotionPlans(q, id, d.plans);
  await audit(q, { adminId, action: "promotion.update", entity: "promotion", entityId: id, summary: d.name, before, after: d });
  return getPromotion(q, id);
}

export async function setPromotionActive(q: Queryable, adminId: string, id: string, active: boolean): Promise<AdminPromotion> {
  const r = await q.query("update promotions set is_active = $2 where id = $1 returning name", [id, active]);
  if (!r.rows[0]) throw notFound("Promoção");
  await audit(q, { adminId, action: active ? "promotion.activate" : "promotion.deactivate", entity: "promotion", entityId: id, summary: r.rows[0].name });
  return getPromotion(q, id);
}

export async function deletePromotion(q: Queryable, adminId: string, id: string): Promise<void> {
  const r = await q.query("delete from promotions where id = $1 returning name", [id]);
  if (!r.rows[0]) throw notFound("Promoção");
  await audit(q, { adminId, action: "promotion.delete", entity: "promotion", entityId: id, summary: r.rows[0].name });
}

/** Helper para o formulário: converte data/hora locais em instantes (usado em testes e scripts). */
export const promoInstant = localToIso;
