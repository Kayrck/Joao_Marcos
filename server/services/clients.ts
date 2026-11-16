import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel, likeTerm } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { today } from "../lib/clock.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { dateStr, emailField, parse, phoneField, positiveCents, cents, reqText, text } from "../lib/validate.js";
import { PAYMENT_METHODS, type ClientStatus } from "../../shared/constants.js";
import { addDays, daysBetween, subscriptionEnd } from "../../shared/dates.js";
import { normalizeWhatsapp } from "../../shared/phone.js";
import type {
  AppointmentDto,
  ClientDetail,
  ClientListItem,
  Page,
  ReceivableDto,
  SubscriptionDto,
} from "../../shared/types.js";
import { addPayment, createReceivable, receivablesByClient } from "./finance.js";
import { currentPriceCents } from "./plans.js";
import { getSettings } from "./site.js";

/**
 * Status do cliente (calculado):
 *  arquivado > inativo (manual) > ativo (plano vigente hoje) > vencido (último plano terminou) > pendente (sem plano).
 */
const CLIENT_BASE = `
  select c.*,
         cur.plan_name as current_plan_name, cur.ends_on as current_ends_on,
         last.ends_on as last_ends_on,
         case when c.archived_at is not null then 'archived'
              when not c.is_active then 'inactive'
              when cur.ends_on is not null then 'active'
              when last.ends_on is not null and last.ends_on < $1::date then 'expired'
              else 'pending' end as status
    from clients c
    left join lateral (
      select plan_name, ends_on from client_subscriptions s
       where s.client_id = c.id and s.status = 'active' and s.starts_on <= $1::date and s.ends_on >= $1::date
       order by s.ends_on desc limit 1) cur on true
    left join lateral (
      select ends_on from client_subscriptions s
       where s.client_id = c.id and s.status = 'active' order by s.ends_on desc limit 1) last on true`;

function listItem(row: any, expiringDays: number, t = today()): ClientListItem {
  const r = camel(row);
  const ends: string | null = r.currentEndsOn ?? (r.status === "expired" ? r.lastEndsOn : null);
  const daysToEnd = ends ? daysBetween(t, ends) : null;
  return {
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    whatsapp: r.whatsapp,
    email: r.email,
    isActive: r.isActive,
    archivedAt: r.archivedAt ? new Date(r.archivedAt).toISOString() : null,
    status: r.status as ClientStatus,
    createdAt: new Date(r.createdAt).toISOString(),
    currentPlanName: r.currentPlanName,
    currentEndsOn: ends,
    daysToEnd,
    expiringSoon: r.status === "active" && daysToEnd !== null && daysToEnd <= expiringDays,
  };
}

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "inactive", "pending", "expired", "archived", "expiring", "all"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
});

export async function listClients(q: Queryable, query: unknown): Promise<Page<ClientListItem> & { counts: Record<string, number> }> {
  const f = parse(listSchema, query);
  const t = today();
  const { expiringDays } = await getSettings(q);
  const params: unknown[] = [t];
  const where: string[] = [];
  if (f.q) {
    params.push(likeTerm(f.q));
    const n = params.length;
    where.push(`(full_name ilike $${n} or coalesce(phone,'') ilike $${n} or coalesce(whatsapp,'') ilike $${n} or coalesce(email,'') ilike $${n})`);
  }
  const status = f.status ?? "default";
  if (status === "default") where.push("status <> 'archived'");
  else if (status === "expiring") {
    params.push(addDays(t, expiringDays));
    where.push(`status = 'active' and current_ends_on <= $${params.length}::date`);
  } else if (status !== "all") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await q.query<{ n: number }>(`with base as (${CLIENT_BASE}) select count(*)::int as n from base ${w}`, params)).rows[0].n;
  const rows = await q.query(
    `with base as (${CLIENT_BASE}) select * from base ${w} order by lower(full_name) limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  const counts = await q.query<{ status: string; n: number }>(`with base as (${CLIENT_BASE}) select status, count(*)::int as n from base group by status`, [t]);
  const c: Record<string, number> = { active: 0, inactive: 0, pending: 0, expired: 0, archived: 0 };
  for (const r of counts.rows) c[r.status] = r.n;
  return { items: rows.rows.map((r) => listItem(r, expiringDays, t)), total, page: f.page, pageSize: f.pageSize, counts: c };
}

export function subscriptionDto(row: any, t = today()): SubscriptionDto {
  const r = camel(row);
  let phase: SubscriptionDto["phase"] = "current";
  if (r.status === "cancelled") phase = "cancelled";
  else if (r.endsOn < t) phase = "expired";
  else if (r.startsOn > t) phase = "upcoming";
  return {
    id: r.id,
    clientId: r.clientId,
    planId: r.planId,
    planName: r.planName,
    durationMonths: r.durationMonths,
    agreedPriceCents: r.agreedPriceCents,
    startsOn: r.startsOn,
    endsOn: r.endsOn,
    status: r.status,
    phase,
    daysToEnd: daysBetween(t, r.endsOn),
    notes: r.notes,
    cancelledAt: r.cancelledAt ? new Date(r.cancelledAt).toISOString() : null,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

export async function getClient(q: Queryable, id: string): Promise<ClientDetail> {
  const t = today();
  const { expiringDays } = await getSettings(q);
  const row = (await q.query(`with base as (${CLIENT_BASE}) select * from base where id = $2`, [t, id])).rows[0];
  if (!row) throw notFound("Cliente");
  const [subs, receivables, appts] = await Promise.all([
    q.query("select * from client_subscriptions where client_id = $1 order by starts_on desc, created_at desc", [id]),
    receivablesByClient(q, id),
    q.query("select * from appointments where client_id = $1 order by starts_at desc limit 10", [id]),
  ]);
  const totals = receivables.reduce(
    (acc, r) => {
      if (r.status === "cancelled") return acc;
      acc.receivedCents += r.receivedCents;
      if (r.status === "overdue") acc.overdueCents += r.remainingCents;
      if (r.status === "pending") acc.pendingCents += r.remainingCents;
      return acc;
    },
    { receivedCents: 0, pendingCents: 0, overdueCents: 0 },
  );
  return {
    ...listItem(row, expiringDays, t),
    notes: row.notes,
    anonymizedAt: row.anonymized_at ? new Date(row.anonymized_at).toISOString() : null,
    subscriptions: subs.rows.map((s) => subscriptionDto(s, t)),
    receivables: receivables as ReceivableDto[],
    totals,
    appointments: appts.rows.map(appointmentRowDto),
  };
}

function appointmentRowDto(row: any): AppointmentDto {
  const r = camel(row);
  return {
    id: r.id,
    clientId: r.clientId,
    clientName: r.clientName,
    kind: r.kind,
    title: r.title,
    startsAt: new Date(r.startsAt).toISOString(),
    endsAt: new Date(r.endsAt).toISOString(),
    notes: r.notes,
    status: r.status,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

const clientSchema = z.object({
  fullName: reqText(160),
  phone: phoneField,
  whatsapp: phoneField,
  email: emailField,
  notes: text(2000).default(""),
  isActive: z.boolean().default(true),
});

function normalize(d: z.infer<typeof clientSchema>) {
  return { ...d, whatsapp: d.whatsapp ? normalizeWhatsapp(d.whatsapp) : null };
}

export async function createClient(q: Queryable, adminId: string, input: unknown): Promise<ClientDetail> {
  const d = normalize(parse(clientSchema, input));
  const r = await q.query<{ id: string }>(
    "insert into clients (full_name, phone, whatsapp, email, notes, is_active) values ($1,$2,$3,$4,$5,$6) returning id",
    [d.fullName, d.phone, d.whatsapp, d.email, d.notes, d.isActive],
  );
  await audit(q, { adminId, action: "client.create", entity: "client", entityId: r.rows[0].id, summary: d.fullName });
  return getClient(q, r.rows[0].id);
}

export async function updateClient(q: Queryable, adminId: string, id: string, input: unknown): Promise<ClientDetail> {
  const d = normalize(parse(clientSchema, input));
  const cur = (await q.query("select anonymized_at from clients where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Cliente");
  if (cur.anonymized_at) throw conflict("Este cadastro foi anonimizado e não pode mais ser editado.");
  await q.query("update clients set full_name=$2, phone=$3, whatsapp=$4, email=$5, notes=$6, is_active=$7 where id=$1", [
    id, d.fullName, d.phone, d.whatsapp, d.email, d.notes, d.isActive,
  ]);
  await audit(q, { adminId, action: "client.update", entity: "client", entityId: id, summary: d.fullName });
  return getClient(q, id);
}

export async function archiveClient(q: Queryable, adminId: string, id: string, archive: boolean): Promise<ClientDetail> {
  const r = await q.query(`update clients set archived_at = ${archive ? "now()" : "null"} where id = $1 returning full_name`, [id]);
  if (!r.rows[0]) throw notFound("Cliente");
  await audit(q, { adminId, action: archive ? "client.archive" : "client.restore", entity: "client", entityId: id, summary: r.rows[0].full_name });
  return getClient(q, id);
}

/** Exclusão física somente quando não há histórico (contratos, financeiro). Caso contrário: arquivar. */
export async function deleteClient(q: Queryable, adminId: string, id: string): Promise<void> {
  const used = (
    await q.query<{ n: number }>(
      "select ((select count(*) from client_subscriptions where client_id = $1) + (select count(*) from receivables where client_id = $1))::int as n",
      [id],
    )
  ).rows[0].n;
  if (used > 0) throw conflict("Este cliente possui histórico de planos ou financeiro e não pode ser excluído. Arquive o cadastro para preservar o histórico.");
  const r = await q.query("delete from clients where id = $1 returning full_name", [id]);
  if (!r.rows[0]) throw notFound("Cliente");
  await audit(q, { adminId, action: "client.delete", entity: "client", entityId: id, summary: r.rows[0].full_name });
}

// ---------------------------------------------------------------- contratações
const subscriptionSchema = z.object({
  planId: z.string().uuid(),
  startsOn: dateStr,
  /** Padrão: início + duração do plano − 1 dia. */
  endsOn: dateStr.optional(),
  /** Padrão: preço em vigor do plano hoje (promoção ou regular). */
  agreedPriceCents: cents.optional(),
  notes: text(500).default(""),
  /** Gera a cobrança vinculada ao contrato. */
  charge: z
    .object({
      dueDate: dateStr,
      /** Se informado, a cobrança já nasce quitada. */
      paid: z.object({ paidOn: dateStr, method: z.enum(PAYMENT_METHODS) }).optional(),
    })
    .optional(),
});

export async function createSubscription(q: Queryable, adminId: string, clientId: string, input: unknown): Promise<ClientDetail> {
  const d = parse(subscriptionSchema, input);
  const client = (await q.query("select full_name, archived_at from clients where id = $1", [clientId])).rows[0];
  if (!client) throw notFound("Cliente");
  const plan = (await q.query("select * from plans where id = $1", [d.planId])).rows[0];
  if (!plan) throw notFound("Plano");

  const endsOn = d.endsOn ?? subscriptionEnd(d.startsOn, plan.duration_months);
  if (endsOn < d.startsOn) throw badRequest("A data de término não pode ser anterior ao início.", { endsOn: "Anterior ao início." });
  const price = d.agreedPriceCents ?? (await currentPriceCents(q, d.planId));
  if (price === null) {
    throw badRequest("Este plano não tem preço em vigor. Informe o valor combinado com o cliente.", { agreedPriceCents: "Informe o valor." });
  }

  // renovação é manual: impede dois planos ativos sobrepostos para o mesmo cliente
  const overlap = (
    await q.query(
      `select plan_name, starts_on, ends_on from client_subscriptions
        where client_id = $1 and status = 'active' and starts_on <= $3::date and ends_on >= $2::date limit 1`,
      [clientId, d.startsOn, endsOn],
    )
  ).rows[0];
  if (overlap) {
    throw conflict(
      `Já existe o plano ${overlap.plan_name} neste período (${overlap.starts_on} a ${overlap.ends_on}). Para renovar, inicie o novo plano em ${addDays(overlap.ends_on, 1)}.`,
      { suggestedStart: addDays(overlap.ends_on, 1) },
    );
  }

  const sub = await q.query<{ id: string }>(
    `insert into client_subscriptions (client_id, plan_id, plan_name, duration_months, agreed_price_cents, starts_on, ends_on, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
    [clientId, d.planId, plan.name, plan.duration_months, price, d.startsOn, endsOn, d.notes],
  );
  await audit(q, {
    adminId,
    action: "subscription.create",
    entity: "client",
    entityId: clientId,
    summary: `${client.full_name}: plano ${plan.name} (${d.startsOn} a ${endsOn}) por ${price / 100}`,
    after: { subscriptionId: sub.rows[0].id, planId: d.planId, agreedPriceCents: price, startsOn: d.startsOn, endsOn },
  });

  if (d.charge && price > 0) {
    const rec = await createReceivable(q, adminId, {
      description: `Plano ${plan.name} — ${client.full_name}`,
      clientId,
      subscriptionId: sub.rows[0].id,
      amountCents: price,
      dueDate: d.charge.dueDate,
    });
    if (d.charge.paid) await addPayment(q, adminId, rec.id, { paidOn: d.charge.paid.paidOn, method: d.charge.paid.method });
  }
  return getClient(q, clientId);
}

const subscriptionUpdateSchema = z.object({
  startsOn: dateStr,
  endsOn: dateStr,
  agreedPriceCents: cents,
  notes: text(500).default(""),
});

export async function updateSubscription(q: Queryable, adminId: string, id: string, input: unknown): Promise<ClientDetail> {
  const d = parse(subscriptionUpdateSchema, input);
  const cur = (await q.query("select * from client_subscriptions where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Contratação");
  if (cur.status === "cancelled") throw conflict("Contratações canceladas não podem ser editadas.");
  if (d.endsOn < d.startsOn) throw badRequest("A data de término não pode ser anterior ao início.", { endsOn: "Anterior ao início." });
  await q.query("update client_subscriptions set starts_on=$2, ends_on=$3, agreed_price_cents=$4, notes=$5 where id=$1", [
    id, d.startsOn, d.endsOn, d.agreedPriceCents, d.notes,
  ]);
  await audit(q, {
    adminId,
    action: "subscription.update",
    entity: "client",
    entityId: cur.client_id,
    summary: `Contratação ${cur.plan_name} alterada`,
    before: { startsOn: cur.starts_on, endsOn: cur.ends_on, agreedPriceCents: cur.agreed_price_cents },
    after: d,
  });
  return getClient(q, cur.client_id);
}

export async function cancelSubscription(q: Queryable, adminId: string, id: string, input: unknown): Promise<ClientDetail> {
  const { cancelOpenCharges } = parse(z.object({ cancelOpenCharges: z.boolean().default(false) }), input ?? {});
  const cur = (await q.query("select * from client_subscriptions where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Contratação");
  if (cur.status === "cancelled") throw conflict("Esta contratação já está cancelada.");
  await q.query("update client_subscriptions set status='cancelled', cancelled_at=now() where id=$1", [id]);
  let cancelled = 0;
  if (cancelOpenCharges) {
    // cancela somente cobranças ainda sem nenhum recebimento
    const r = await q.query(
      `update receivables r set status='cancelled', cancelled_at=now(), cancel_reason='Contratação cancelada'
        where r.subscription_id = $1 and r.status = 'pending'
          and not exists (select 1 from receivable_payments p where p.receivable_id = r.id and p.voided_at is null)`,
      [id],
    );
    cancelled = r.rowCount;
  }
  await audit(q, {
    adminId,
    action: "subscription.cancel",
    entity: "client",
    entityId: cur.client_id,
    summary: `Contratação ${cur.plan_name} cancelada${cancelled ? ` (${cancelled} cobrança(s) cancelada(s))` : ""}`,
  });
  return getClient(q, cur.client_id);
}
