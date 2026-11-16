import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel, likeTerm } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { today } from "../lib/clock.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { dateStr, parse, positiveCents, reqText, text } from "../lib/validate.js";
import { PAYMENT_METHODS, type PayableStatus, type ReceivableStatus } from "../../shared/constants.js";
import { monthsInRange } from "../../shared/dates.js";
import { centsToDecimal } from "../../shared/format.js";
import type {
  ExpenseCategoryDto,
  FinanceSummary,
  MonthlyFinance,
  Page,
  PayableDto,
  PaymentDto,
  ReceivableDto,
} from "../../shared/types.js";

const method = z.enum(PAYMENT_METHODS);
const periodSchema = z
  .object({ from: dateStr, to: dateStr })
  .refine((p) => p.from <= p.to, { message: "Período inválido.", path: ["to"] });

export function parsePeriod(query: { from?: string; to?: string }, fallback: { from: string; to: string }) {
  return parse(periodSchema, { from: query.from ?? fallback.from, to: query.to ?? fallback.to });
}

// ================================================================ contas a receber
const RECEIVABLE_BASE = `
  select r.*, c.full_name as client_name, c.whatsapp as client_whatsapp,
         coalesce(p.received, 0)::int as received_cents, p.last_paid_on, p.last_method
    from receivables r
    left join clients c on c.id = r.client_id
    left join lateral (
      select sum(amount_cents) as received, max(paid_on) as last_paid_on,
             (array_agg(method order by paid_on desc, created_at desc))[1] as last_method
        from receivable_payments where receivable_id = r.id and voided_at is null
    ) p on true`;

export function receivableStatus(row: { status: string; due_date: string; received_cents: number; amount_cents: number }, todayStr = today()): ReceivableStatus {
  if (row.status === "cancelled") return "cancelled";
  if (row.status === "received") return "received";
  return row.due_date < todayStr ? "overdue" : "pending";
}

function receivableDto(row: any, payments: PaymentDto[] = []): ReceivableDto {
  const r = camel(row);
  return {
    id: r.id,
    description: r.description,
    clientId: r.clientId,
    clientName: r.clientName,
    clientWhatsapp: r.clientWhatsapp,
    subscriptionId: r.subscriptionId,
    amountCents: r.amountCents,
    receivedCents: r.receivedCents,
    remainingCents: Math.max(0, r.amountCents - r.receivedCents),
    dueDate: r.dueDate,
    status: receivableStatus(row),
    notes: r.notes,
    cancelReason: r.cancelReason,
    lastMethod: r.lastMethod,
    receivedOn: r.status === "received" ? r.lastPaidOn : null,
    payments,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

function paymentDto(row: any): PaymentDto {
  const r = camel(row);
  return {
    id: r.id,
    receivableId: r.receivableId,
    amountCents: r.amountCents,
    paidOn: r.paidOn,
    method: r.method,
    notes: r.notes,
    voidedAt: r.voidedAt ? new Date(r.voidedAt).toISOString() : null,
    voidReason: r.voidReason,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

async function paymentsFor(q: Queryable, ids: string[]): Promise<Map<string, PaymentDto[]>> {
  const map = new Map<string, PaymentDto[]>();
  if (!ids.length) return map;
  const r = await q.query("select * from receivable_payments where receivable_id = any($1::uuid[]) order by paid_on, created_at", [ids]);
  for (const row of r.rows) {
    const list = map.get(row.receivable_id) ?? [];
    list.push(paymentDto(row));
    map.set(row.receivable_id, list);
  }
  return map;
}

const receivableListSchema = z.object({
  status: z.enum(["pending", "overdue", "received", "cancelled"]).optional(),
  clientId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
});

function receivableWhere(f: z.infer<typeof receivableListSchema>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const push = (v: unknown) => (params.push(v), `$${params.length}`);
  const t = today();
  if (f.status === "pending") where.push(`r.status = 'pending' and r.due_date >= ${push(t)}::date`);
  if (f.status === "overdue") where.push(`r.status = 'pending' and r.due_date < ${push(t)}::date`);
  if (f.status === "received") where.push("r.status = 'received'");
  if (f.status === "cancelled") where.push("r.status = 'cancelled'");
  if (f.clientId) where.push(`r.client_id = ${push(f.clientId)}`);
  if (f.q) {
    const term = push(likeTerm(f.q));
    where.push(`(r.description ilike ${term} or c.full_name ilike ${term})`);
  }
  if (f.from) where.push(`r.due_date >= ${push(f.from)}::date`);
  if (f.to) where.push(`r.due_date <= ${push(f.to)}::date`);
  return { where: where.length ? `where ${where.join(" and ")}` : "", params };
}

export async function listReceivables(
  q: Queryable,
  query: unknown,
): Promise<Page<ReceivableDto> & { totals: { amountCents: number; receivedCents: number; remainingCents: number } }> {
  const f = parse(receivableListSchema, query);
  const { where, params } = receivableWhere(f);
  const order = f.status === "pending" || f.status === "overdue" ? "r.due_date asc" : "r.due_date desc";
  const rows = await q.query(
    `${RECEIVABLE_BASE} ${where} order by ${order}, r.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  const agg = await q.query<{ n: number; amount: number; received: number }>(
    `select count(*)::int as n,
            coalesce(sum(case when x.status <> 'cancelled' then x.amount_cents end), 0)::int as amount,
            coalesce(sum(case when x.status <> 'cancelled' then x.received_cents end), 0)::int as received
       from (${RECEIVABLE_BASE} ${where}) x`,
    params,
  );
  const pays = await paymentsFor(q, rows.rows.map((r) => r.id));
  return {
    items: rows.rows.map((r) => receivableDto(r, pays.get(r.id))),
    total: agg.rows[0].n,
    page: f.page,
    pageSize: f.pageSize,
    totals: {
      amountCents: agg.rows[0].amount,
      receivedCents: agg.rows[0].received,
      remainingCents: Math.max(0, agg.rows[0].amount - agg.rows[0].received),
    },
  };
}

export async function getReceivable(q: Queryable, id: string): Promise<ReceivableDto> {
  const r = await q.query(`${RECEIVABLE_BASE} where r.id = $1`, [id]);
  if (!r.rows[0]) throw notFound("Conta a receber");
  const pays = await paymentsFor(q, [id]);
  return receivableDto(r.rows[0], pays.get(id));
}

export async function receivablesByClient(q: Queryable, clientId: string): Promise<ReceivableDto[]> {
  const rows = await q.query(`${RECEIVABLE_BASE} where r.client_id = $1 order by r.due_date desc, r.created_at desc`, [clientId]);
  const pays = await paymentsFor(q, rows.rows.map((r) => r.id));
  return rows.rows.map((r) => receivableDto(r, pays.get(r.id)));
}

const receivableSchema = z.object({
  description: reqText(200),
  clientId: z.string().uuid().nullable().default(null),
  subscriptionId: z.string().uuid().nullable().default(null),
  amountCents: positiveCents,
  dueDate: dateStr,
  notes: text(500).default(""),
});

export async function createReceivable(q: Queryable, adminId: string, input: unknown): Promise<ReceivableDto> {
  const d = parse(receivableSchema, input);
  if (d.clientId && !(await q.query("select 1 from clients where id = $1", [d.clientId])).rowCount) throw notFound("Cliente");
  const r = await q.query<{ id: string }>(
    `insert into receivables (description, client_id, subscription_id, amount_cents, due_date, notes, created_by)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [d.description, d.clientId, d.subscriptionId, d.amountCents, d.dueDate, d.notes, adminId],
  );
  const id = r.rows[0].id;
  await audit(q, { adminId, action: "receivable.create", entity: "receivable", entityId: id, summary: `${d.description} — ${centsToDecimal(d.amountCents)}`, after: d });
  return getReceivable(q, id);
}

export async function updateReceivable(q: Queryable, adminId: string, id: string, input: unknown): Promise<ReceivableDto> {
  const d = parse(receivableSchema, input);
  const before = await getReceivable(q, id);
  if (before.status === "cancelled") throw conflict("Lançamentos cancelados não podem ser editados.");
  if (d.amountCents < before.receivedCents) {
    throw badRequest("O valor não pode ser menor que o total já recebido.", { amountCents: "Menor que o já recebido." });
  }
  await q.query(
    "update receivables set description=$2, client_id=$3, subscription_id=$4, amount_cents=$5, due_date=$6, notes=$7 where id=$1",
    [id, d.description, d.clientId, d.subscriptionId, d.amountCents, d.dueDate, d.notes],
  );
  await syncReceivableStatus(q, id);
  await audit(q, {
    adminId,
    action: "receivable.update",
    entity: "receivable",
    entityId: id,
    summary: d.description,
    before: { amountCents: before.amountCents, dueDate: before.dueDate, description: before.description },
    after: { amountCents: d.amountCents, dueDate: d.dueDate, description: d.description },
  });
  return getReceivable(q, id);
}

/** Mantém `status` coerente com a soma dos pagamentos (recebido quando quitado). */
async function syncReceivableStatus(q: Queryable, id: string) {
  await q.query(
    `update receivables r set status = case
        when r.status = 'cancelled' then 'cancelled'
        when coalesce((select sum(amount_cents) from receivable_payments where receivable_id = r.id and voided_at is null), 0) >= r.amount_cents then 'received'
        else 'pending' end
      where r.id = $1`,
    [id],
  );
}

const paymentSchema = z.object({
  amountCents: positiveCents.optional(),
  paidOn: dateStr.optional(),
  method,
  notes: text(300).default(""),
});

/** Registra um recebimento (total ou parcial). Sem `amountCents`, quita o saldo restante. */
export async function addPayment(q: Queryable, adminId: string, receivableId: string, input: unknown): Promise<ReceivableDto> {
  const d = parse(paymentSchema, input);
  const rec = await getReceivable(q, receivableId);
  if (rec.status === "cancelled") throw conflict("Esta conta foi cancelada.");
  if (rec.remainingCents <= 0) throw conflict("Esta conta já está quitada.");
  const amount = d.amountCents ?? rec.remainingCents;
  if (amount > rec.remainingCents) {
    throw badRequest(`O valor excede o saldo a receber (${centsToDecimal(rec.remainingCents)}).`, { amountCents: "Maior que o saldo restante." });
  }
  const paidOn = d.paidOn ?? today();
  const p = await q.query<{ id: string }>(
    `insert into receivable_payments (receivable_id, amount_cents, paid_on, method, notes, created_by)
     values ($1,$2,$3,$4,$5,$6) returning id`,
    [receivableId, amount, paidOn, d.method, d.notes, adminId],
  );
  await syncReceivableStatus(q, receivableId);
  await audit(q, {
    adminId,
    action: "receivable.payment",
    entity: "receivable",
    entityId: receivableId,
    summary: `Recebimento de ${centsToDecimal(amount)} em ${paidOn} (${d.method})`,
    after: { paymentId: p.rows[0].id, amountCents: amount, paidOn, method: d.method },
  });
  return getReceivable(q, receivableId);
}

export async function voidPayment(q: Queryable, adminId: string, paymentId: string, input: unknown): Promise<ReceivableDto> {
  const { reason } = parse(z.object({ reason: text(300).default("") }), input ?? {});
  const p = (await q.query("select * from receivable_payments where id = $1", [paymentId])).rows[0];
  if (!p) throw notFound("Pagamento");
  if (p.voided_at) throw conflict("Este pagamento já foi estornado.");
  await q.query("update receivable_payments set voided_at = now(), void_reason = $2 where id = $1", [paymentId, reason || null]);
  await syncReceivableStatus(q, p.receivable_id);
  await audit(q, {
    adminId,
    action: "receivable.payment_void",
    entity: "receivable",
    entityId: p.receivable_id,
    summary: `Estorno de ${centsToDecimal(p.amount_cents)} (${p.paid_on})`,
    before: { paymentId, amountCents: p.amount_cents, paidOn: p.paid_on },
  });
  return getReceivable(q, p.receivable_id);
}

export async function cancelReceivable(q: Queryable, adminId: string, id: string, input: unknown): Promise<ReceivableDto> {
  const { reason } = parse(z.object({ reason: text(300).default("") }), input ?? {});
  const rec = await getReceivable(q, id);
  if (rec.status === "cancelled") throw conflict("Esta conta já está cancelada.");
  if (rec.receivedCents > 0) throw conflict("Há recebimentos registrados. Estorne os pagamentos antes de cancelar a conta.");
  await q.query("update receivables set status='cancelled', cancelled_at=now(), cancel_reason=$2 where id=$1", [id, reason || null]);
  await audit(q, { adminId, action: "receivable.cancel", entity: "receivable", entityId: id, summary: `${rec.description} cancelada`, before: { amountCents: rec.amountCents } });
  return getReceivable(q, id);
}

/** Reabre uma conta cancelada (volta a pendente). */
export async function reopenReceivable(q: Queryable, adminId: string, id: string): Promise<ReceivableDto> {
  const rec = await getReceivable(q, id);
  if (rec.status !== "cancelled") throw conflict("Somente contas canceladas podem ser reabertas.");
  await q.query("update receivables set status='pending', cancelled_at=null, cancel_reason=null where id=$1", [id]);
  await audit(q, { adminId, action: "receivable.reopen", entity: "receivable", entityId: id, summary: rec.description });
  return getReceivable(q, id);
}

// ================================================================ contas a pagar
const PAYABLE_BASE = `select p.*, c.name as category_name from payables p join expense_categories c on c.id = p.category_id`;

export function payableStatus(row: { status: string; due_date: string }, todayStr = today()): PayableStatus {
  if (row.status === "paid") return "paid";
  if (row.status === "cancelled") return "cancelled";
  return row.due_date < todayStr ? "overdue" : "pending";
}

function payableDto(row: any): PayableDto {
  const r = camel(row);
  return {
    id: r.id,
    description: r.description,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    amountCents: r.amountCents,
    dueDate: r.dueDate,
    paidOn: r.paidOn,
    paymentMethod: r.paymentMethod,
    status: payableStatus(row),
    notes: r.notes,
    cancelReason: r.cancelReason,
    createdAt: new Date(r.createdAt).toISOString(),
  };
}

const payableListSchema = z.object({
  status: z.enum(["pending", "overdue", "paid", "cancelled"]).optional(),
  categoryId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
});

function payableWhere(f: z.infer<typeof payableListSchema>) {
  const where: string[] = [];
  const params: unknown[] = [];
  const push = (v: unknown) => (params.push(v), `$${params.length}`);
  const t = today();
  if (f.status === "pending") where.push(`p.status = 'pending' and p.due_date >= ${push(t)}::date`);
  if (f.status === "overdue") where.push(`p.status = 'pending' and p.due_date < ${push(t)}::date`);
  if (f.status === "paid") where.push("p.status = 'paid'");
  if (f.status === "cancelled") where.push("p.status = 'cancelled'");
  if (f.categoryId) where.push(`p.category_id = ${push(f.categoryId)}`);
  if (f.q) where.push(`p.description ilike ${push(likeTerm(f.q))}`);
  if (f.from) where.push(`p.due_date >= ${push(f.from)}::date`);
  if (f.to) where.push(`p.due_date <= ${push(f.to)}::date`);
  return { where: where.length ? `where ${where.join(" and ")}` : "", params };
}

export async function listPayables(q: Queryable, query: unknown): Promise<Page<PayableDto> & { totalAmountCents: number }> {
  const f = parse(payableListSchema, query);
  const { where, params } = payableWhere(f);
  const order = f.status === "pending" || f.status === "overdue" ? "p.due_date asc" : "p.due_date desc";
  const rows = await q.query(`${PAYABLE_BASE} ${where} order by ${order}, p.created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, params);
  const agg = await q.query<{ n: number; amount: number }>(
    `select count(*)::int as n, coalesce(sum(case when p.status <> 'cancelled' then p.amount_cents end), 0)::int as amount
       from payables p join expense_categories c on c.id = p.category_id ${where}`,
    params,
  );
  return { items: rows.rows.map(payableDto), total: agg.rows[0].n, page: f.page, pageSize: f.pageSize, totalAmountCents: agg.rows[0].amount };
}

export async function getPayable(q: Queryable, id: string): Promise<PayableDto> {
  const r = await q.query(`${PAYABLE_BASE} where p.id = $1`, [id]);
  if (!r.rows[0]) throw notFound("Conta a pagar");
  return payableDto(r.rows[0]);
}

const payableSchema = z.object({
  description: reqText(200),
  categoryId: z.string().uuid(),
  amountCents: positiveCents,
  dueDate: dateStr,
  notes: text(500).default(""),
  /** Se informado, a despesa já nasce paga. */
  paid: z.object({ paidOn: dateStr, method }).optional(),
});

async function assertCategory(q: Queryable, id: string) {
  if (!(await q.query("select 1 from expense_categories where id = $1", [id])).rowCount) throw badRequest("Categoria não encontrada.", { categoryId: "Categoria inválida." });
}

export async function createPayable(q: Queryable, adminId: string, input: unknown): Promise<PayableDto> {
  const d = parse(payableSchema, input);
  await assertCategory(q, d.categoryId);
  const r = await q.query<{ id: string }>(
    `insert into payables (description, category_id, amount_cents, due_date, notes, status, paid_on, payment_method, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
    [d.description, d.categoryId, d.amountCents, d.dueDate, d.notes, d.paid ? "paid" : "pending", d.paid?.paidOn ?? null, d.paid?.method ?? null, adminId],
  );
  await audit(q, { adminId, action: "payable.create", entity: "payable", entityId: r.rows[0].id, summary: `${d.description} — ${centsToDecimal(d.amountCents)}`, after: d });
  return getPayable(q, r.rows[0].id);
}

export async function updatePayable(q: Queryable, adminId: string, id: string, input: unknown): Promise<PayableDto> {
  const d = parse(payableSchema.omit({ paid: true }), input);
  const before = await getPayable(q, id);
  if (before.status === "cancelled") throw conflict("Lançamentos cancelados não podem ser editados.");
  await assertCategory(q, d.categoryId);
  await q.query("update payables set description=$2, category_id=$3, amount_cents=$4, due_date=$5, notes=$6 where id=$1", [
    id, d.description, d.categoryId, d.amountCents, d.dueDate, d.notes,
  ]);
  await audit(q, {
    adminId, action: "payable.update", entity: "payable", entityId: id, summary: d.description,
    before: { amountCents: before.amountCents, dueDate: before.dueDate, description: before.description },
    after: { amountCents: d.amountCents, dueDate: d.dueDate, description: d.description },
  });
  return getPayable(q, id);
}

export async function payPayable(q: Queryable, adminId: string, id: string, input: unknown): Promise<PayableDto> {
  const d = parse(z.object({ paidOn: dateStr.optional(), method }), input);
  const cur = await getPayable(q, id);
  if (cur.status === "cancelled") throw conflict("Esta conta foi cancelada.");
  if (cur.status === "paid") throw conflict("Esta conta já foi paga.");
  const paidOn = d.paidOn ?? today();
  await q.query("update payables set status='paid', paid_on=$2, payment_method=$3 where id=$1", [id, paidOn, d.method]);
  await audit(q, { adminId, action: "payable.pay", entity: "payable", entityId: id, summary: `${cur.description} paga em ${paidOn}`, after: { paidOn, method: d.method, amountCents: cur.amountCents } });
  return getPayable(q, id);
}

export async function unpayPayable(q: Queryable, adminId: string, id: string): Promise<PayableDto> {
  const cur = await getPayable(q, id);
  if (cur.status !== "paid") throw conflict("Esta conta não está paga.");
  await q.query("update payables set status='pending', paid_on=null, payment_method=null where id=$1", [id]);
  await audit(q, { adminId, action: "payable.unpay", entity: "payable", entityId: id, summary: `Pagamento de ${cur.description} estornado`, before: { paidOn: cur.paidOn, amountCents: cur.amountCents } });
  return getPayable(q, id);
}

export async function cancelPayable(q: Queryable, adminId: string, id: string, input: unknown): Promise<PayableDto> {
  const { reason } = parse(z.object({ reason: text(300).default("") }), input ?? {});
  const cur = await getPayable(q, id);
  if (cur.status === "cancelled") throw conflict("Esta conta já está cancelada.");
  if (cur.status === "paid") throw conflict("Estorne o pagamento antes de cancelar a conta.");
  await q.query("update payables set status='cancelled', cancelled_at=now(), cancel_reason=$2 where id=$1", [id, reason || null]);
  await audit(q, { adminId, action: "payable.cancel", entity: "payable", entityId: id, summary: `${cur.description} cancelada` });
  return getPayable(q, id);
}

// ================================================================ categorias de despesa
export async function listCategories(q: Queryable): Promise<(ExpenseCategoryDto & { usage: number })[]> {
  const r = await q.query(
    `select c.id, c.name, c.is_active, (select count(*)::int from payables p where p.category_id = c.id) as usage
       from expense_categories c order by lower(c.name)`,
  );
  return r.rows.map((x) => ({ id: x.id, name: x.name, isActive: x.is_active, usage: x.usage }));
}

const categorySchema = z.object({ name: reqText(60), isActive: z.boolean().default(true) });

export async function createCategory(q: Queryable, adminId: string, input: unknown): Promise<ExpenseCategoryDto> {
  const d = parse(categorySchema, input);
  if ((await q.query("select 1 from expense_categories where lower(name) = lower($1)", [d.name])).rowCount) {
    throw conflict("Já existe uma categoria com esse nome.");
  }
  const r = await q.query("insert into expense_categories (name, is_active) values ($1,$2) returning id, name, is_active", [d.name, d.isActive]);
  await audit(q, { adminId, action: "category.create", entity: "expense_category", entityId: r.rows[0].id, summary: d.name });
  return { id: r.rows[0].id, name: r.rows[0].name, isActive: r.rows[0].is_active };
}

export async function updateCategory(q: Queryable, adminId: string, id: string, input: unknown): Promise<ExpenseCategoryDto> {
  const d = parse(categorySchema, input);
  if ((await q.query("select 1 from expense_categories where lower(name) = lower($1) and id <> $2", [d.name, id])).rowCount) {
    throw conflict("Já existe uma categoria com esse nome.");
  }
  const r = await q.query("update expense_categories set name=$2, is_active=$3 where id=$1 returning id, name, is_active", [id, d.name, d.isActive]);
  if (!r.rows[0]) throw notFound("Categoria");
  await audit(q, { adminId, action: "category.update", entity: "expense_category", entityId: id, summary: d.name });
  return { id: r.rows[0].id, name: r.rows[0].name, isActive: r.rows[0].is_active };
}

export async function deleteCategory(q: Queryable, adminId: string, id: string): Promise<void> {
  const used = (await q.query<{ n: number }>("select count(*)::int as n from payables where category_id = $1", [id])).rows[0].n;
  if (used > 0) throw conflict("Esta categoria possui lançamentos. Desative-a em vez de excluir.");
  const r = await q.query("delete from expense_categories where id = $1 returning name", [id]);
  if (!r.rows[0]) throw notFound("Categoria");
  await audit(q, { adminId, action: "category.delete", entity: "expense_category", entityId: id, summary: r.rows[0].name });
}

// ================================================================ resumo e séries
/**
 * Regras (centralizadas aqui, nunca no frontend):
 *  - recebido  = pagamentos não estornados de contas não canceladas, por data de pagamento;
 *  - despesa paga = contas com status "paga", por data de pagamento;
 *  - pendente/atrasado = SALDO restante das contas pendentes com vencimento dentro do período;
 *  - cancelados nunca entram em nenhum total;
 *  - saldo realizado = recebido − despesas pagas;
 *  - saldo projetado = realizado + (a receber pendente + atrasado) − (a pagar pendente + atrasado).
 */
export async function financeSummary(q: Queryable, period: { from: string; to: string }): Promise<FinanceSummary> {
  const t = today();
  const [received, recvOpen, paid, payOpen] = await Promise.all([
    q.query<{ v: number }>(
      `select coalesce(sum(rp.amount_cents), 0)::int as v
         from receivable_payments rp join receivables r on r.id = rp.receivable_id
        where rp.voided_at is null and r.status <> 'cancelled' and rp.paid_on between $1::date and $2::date`,
      [period.from, period.to],
    ),
    q.query<{ pending: number; overdue: number }>(
      `select coalesce(sum(case when r.due_date >= $3::date then x.remaining end), 0)::int as pending,
              coalesce(sum(case when r.due_date <  $3::date then x.remaining end), 0)::int as overdue
         from receivables r
         cross join lateral (select r.amount_cents - coalesce((select sum(amount_cents) from receivable_payments where receivable_id = r.id and voided_at is null), 0) as remaining) x
        where r.status = 'pending' and r.due_date between $1::date and $2::date`,
      [period.from, period.to, t],
    ),
    q.query<{ v: number }>(
      "select coalesce(sum(amount_cents), 0)::int as v from payables where status = 'paid' and paid_on between $1::date and $2::date",
      [period.from, period.to],
    ),
    q.query<{ pending: number; overdue: number }>(
      `select coalesce(sum(case when due_date >= $3::date then amount_cents end), 0)::int as pending,
              coalesce(sum(case when due_date <  $3::date then amount_cents end), 0)::int as overdue
         from payables where status = 'pending' and due_date between $1::date and $2::date`,
      [period.from, period.to, t],
    ),
  ]);
  const receivedCents = received.rows[0].v;
  const paidExpensesCents = paid.rows[0].v;
  const realized = receivedCents - paidExpensesCents;
  const pr = recvOpen.rows[0];
  const pe = payOpen.rows[0];
  return {
    period,
    receivedCents,
    pendingReceivableCents: pr.pending,
    overdueReceivableCents: pr.overdue,
    paidExpensesCents,
    pendingExpensesCents: pe.pending,
    overdueExpensesCents: pe.overdue,
    realizedBalanceCents: realized,
    projectedBalanceCents: realized + pr.pending + pr.overdue - pe.pending - pe.overdue,
  };
}

export async function monthlyFinance(q: Queryable, period: { from: string; to: string }): Promise<MonthlyFinance[]> {
  const months = monthsInRange(period.from, period.to);
  const [rec, pay, pr, pp] = await Promise.all([
    q.query<{ m: string; v: number }>(
      `select to_char(rp.paid_on, 'YYYY-MM') as m, sum(rp.amount_cents)::int as v
         from receivable_payments rp join receivables r on r.id = rp.receivable_id
        where rp.voided_at is null and r.status <> 'cancelled' and rp.paid_on between $1::date and $2::date group by 1`,
      [period.from, period.to],
    ),
    q.query<{ m: string; v: number }>(
      "select to_char(paid_on, 'YYYY-MM') as m, sum(amount_cents)::int as v from payables where status='paid' and paid_on between $1::date and $2::date group by 1",
      [period.from, period.to],
    ),
    q.query<{ m: string; v: number }>(
      `select to_char(r.due_date, 'YYYY-MM') as m,
              sum(r.amount_cents - coalesce((select sum(amount_cents) from receivable_payments where receivable_id = r.id and voided_at is null), 0))::int as v
         from receivables r where r.status = 'pending' and r.due_date between $1::date and $2::date group by 1`,
      [period.from, period.to],
    ),
    q.query<{ m: string; v: number }>(
      "select to_char(due_date, 'YYYY-MM') as m, sum(amount_cents)::int as v from payables where status='pending' and due_date between $1::date and $2::date group by 1",
      [period.from, period.to],
    ),
  ]);
  const pick = (r: { rows: { m: string; v: number }[] }, m: string) => r.rows.find((x) => x.m === m)?.v ?? 0;
  return months.map((m) => ({
    month: m,
    receivedCents: pick(rec, m),
    paidCents: pick(pay, m),
    balanceCents: pick(rec, m) - pick(pay, m),
    pendingReceivableCents: pick(pr, m),
    pendingExpensesCents: pick(pp, m),
  }));
}

// ================================================================ extrato (movimentos realizados)
export interface LedgerItem {
  id: string;
  kind: "in" | "out";
  date: string;
  description: string;
  counterparty: string | null;
  amountCents: number;
  method: string | null;
  sourceId: string;
}

export async function ledger(q: Queryable, period: { from: string; to: string }): Promise<LedgerItem[]> {
  const r = await q.query(
    `select * from (
        select rp.id::text as id, 'in' as kind, rp.paid_on as date, r.description, c.full_name as counterparty,
               rp.amount_cents, rp.method, r.id::text as source_id
          from receivable_payments rp join receivables r on r.id = rp.receivable_id left join clients c on c.id = r.client_id
         where rp.voided_at is null and r.status <> 'cancelled' and rp.paid_on between $1::date and $2::date
        union all
        select p.id::text, 'out', p.paid_on, p.description, ec.name, p.amount_cents, p.payment_method, p.id::text
          from payables p join expense_categories ec on ec.id = p.category_id
         where p.status = 'paid' and p.paid_on between $1::date and $2::date
     ) x order by date desc, kind`,
    [period.from, period.to],
  );
  return r.rows.map((x) => ({
    id: x.id,
    kind: x.kind,
    date: x.date,
    description: x.description,
    counterparty: x.counterparty,
    amountCents: x.amount_cents,
    method: x.method,
    sourceId: x.source_id,
  }));
}

// ================================================================ CSV
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // neutraliza "injeção de fórmulas" em planilhas
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export async function exportReceivablesCsv(q: Queryable, query: unknown): Promise<string> {
  const page = await listReceivables(q, { ...(query as object), page: 1, pageSize: 200 });
  const all: ReceivableDto[] = [...page.items];
  for (let p = 2; all.length < page.total && p < 50; p++) {
    all.push(...(await listReceivables(q, { ...(query as object), page: p, pageSize: 200 })).items);
  }
  return toCsv(
    ["Descrição", "Cliente", "Valor", "Recebido", "Saldo", "Vencimento", "Status", "Última forma", "Observações"],
    all.map((r) => [r.description, r.clientName, centsToDecimal(r.amountCents), centsToDecimal(r.receivedCents), centsToDecimal(r.remainingCents), r.dueDate, r.status, r.lastMethod, r.notes]),
  );
}

export async function exportPayablesCsv(q: Queryable, query: unknown): Promise<string> {
  const page = await listPayables(q, { ...(query as object), page: 1, pageSize: 200 });
  const all: PayableDto[] = [...page.items];
  for (let p = 2; all.length < page.total && p < 50; p++) {
    all.push(...(await listPayables(q, { ...(query as object), page: p, pageSize: 200 })).items);
  }
  return toCsv(
    ["Descrição", "Categoria", "Valor", "Vencimento", "Pago em", "Forma", "Status", "Observações"],
    all.map((r) => [r.description, r.categoryName, centsToDecimal(r.amountCents), r.dueDate, r.paidOn, r.paymentMethod, r.status, r.notes]),
  );
}
