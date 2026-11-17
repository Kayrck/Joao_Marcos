import type { Queryable } from "../db/index.js";
import { camel } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { now, today } from "../lib/clock.js";
import { notFound } from "../lib/errors.js";
import { addDays, endOfMonth, monthsInRange, startOfLocalDay, startOfNextLocalDay, toLocalDate } from "../../shared/dates.js";
import { centsToDecimal, fillTemplate, formatBRL, formatDateBR } from "../../shared/format.js";
import { digitsOnly, normalizeWhatsapp } from "../../shared/phone.js";
import type { AlertItem, AuditEntryDto, DashboardData } from "../../shared/types.js";
import { appointmentDto } from "./appointments.js";
import { CLIENT_BASE } from "./clients.js";
import { financeSummary, monthlyFinance, toCsv } from "./finance.js";
import { pendingReviewsCount } from "./reviews.js";
import { getSettings } from "./site.js";

export async function dashboard(q: Queryable, period: { from: string; to: string }): Promise<DashboardData> {
  const t = today();
  const settings = await getSettings(q);
  const nowIso = now().toISOString();
  const [statusRows, expiring, newClients, summary, monthly, pendingReviews, leadsWaiting, upcomingCount, upcoming] = await Promise.all([
    q.query<{ status: string; n: number }>(`with base as (${CLIENT_BASE}) select status, count(*)::int as n from base group by status`, [t]),
    q.query<{ n: number }>(
      `with base as (${CLIENT_BASE}) select count(*)::int as n from base where status = 'active' and current_ends_on <= $2::date`,
      [t, addDays(t, settings.expiringDays)],
    ),
    q.query<{ n: number }>("select count(*)::int as n from clients where created_at >= $1 and created_at < $2", [
      startOfLocalDay(period.from),
      startOfNextLocalDay(period.to),
    ]),
    financeSummary(q, period),
    monthlyFinance(q, period),
    pendingReviewsCount(q),
    q.query<{ n: number }>("select count(*)::int as n from leads where status = 'new'"),
    q.query<{ n: number }>(
      "select count(*)::int as n from appointments where status = 'scheduled' and starts_at >= $1 and starts_at < $2",
      [nowIso, new Date(now().getTime() + 7 * 86_400_000).toISOString()],
    ),
    q.query("select * from appointments where status = 'scheduled' and ends_at >= $1 order by starts_at limit 5", [nowIso]),
  ]);

  const by: Record<string, number> = {};
  for (const r of statusRows.rows) by[r.status] = r.n;
  const clientsTotal = (by.active ?? 0) + (by.inactive ?? 0) + (by.pending ?? 0) + (by.expired ?? 0);

  // clientes por mês (novos cadastros e clientes com plano vigente no mês)
  const [created, subs] = await Promise.all([
    q.query<{ created_at: Date }>("select created_at from clients where created_at >= $1 and created_at < $2", [
      startOfLocalDay(period.from),
      startOfNextLocalDay(period.to),
    ]),
    q.query<{ client_id: string; starts_on: string; ends_on: string }>(
      "select client_id, starts_on, ends_on from client_subscriptions where status = 'active'",
    ),
  ]);
  const clientsByMonth = monthsInRange(period.from, period.to).map((m) => {
    const first = `${m}-01`;
    const last = endOfMonth(first);
    return {
      month: m,
      newClients: created.rows.filter((c) => toLocalDate(new Date(c.created_at)).slice(0, 7) === m).length,
      activeAtEnd: new Set(subs.rows.filter((s) => s.starts_on <= last && s.ends_on >= first).map((s) => s.client_id)).size,
    };
  });

  const dist = await q.query<{ plan_name: string; duration_months: number; n: number }>(
    `select s.plan_name, s.duration_months, count(distinct s.client_id)::int as n
       from client_subscriptions s join clients c on c.id = s.client_id
      where s.status = 'active' and s.starts_on <= $1::date and s.ends_on >= $1::date and c.archived_at is null and c.is_active
      group by s.plan_name, s.duration_months order by s.duration_months`,
    [t],
  );

  return {
    period,
    kpis: {
      clientsTotal,
      clientsActive: by.active ?? 0,
      clientsInactive: by.inactive ?? 0,
      clientsNewInPeriod: newClients.rows[0].n,
      expiringSoon: expiring.rows[0].n,
      expired: by.expired ?? 0,
      receivedCents: summary.receivedCents,
      pendingReceivableCents: summary.pendingReceivableCents + summary.overdueReceivableCents,
      overdueReceivableCents: summary.overdueReceivableCents,
      paidExpensesCents: summary.paidExpensesCents,
      pendingExpensesCents: summary.pendingExpensesCents + summary.overdueExpensesCents,
      realizedBalanceCents: summary.realizedBalanceCents,
      projectedBalanceCents: summary.projectedBalanceCents,
      pendingReviews,
      upcomingAppointments: upcomingCount.rows[0].n,
      leadsWaiting: leadsWaiting.rows[0].n,
    },
    monthly,
    clientsByMonth,
    planDistribution: dist.rows.map((d) => ({ planName: d.plan_name, durationMonths: d.duration_months, clients: d.n })),
    receivedVsPending: {
      receivedCents: summary.receivedCents,
      pendingCents: summary.pendingReceivableCents,
      overdueCents: summary.overdueReceivableCents,
    },
    upcoming: upcoming.rows.map(appointmentDto),
  };
}

// ================================================================ alertas internos (derivados do banco)
export async function alerts(q: Queryable): Promise<AlertItem[]> {
  const t = today();
  const s = await getSettings(q);
  const out: AlertItem[] = [];
  const waLink = (phone: string | null, message: string) => {
    const n = normalizeWhatsapp(phone);
    return n ? { number: n, message } : null;
  };

  const reviews = await pendingReviewsCount(q);
  if (reviews > 0) {
    out.push({ id: "reviews", type: "review_pending", severity: "info", title: `${reviews} avaliação(ões) aguardando aprovação`, detail: "Analise e aprove ou rejeite.", date: null, href: "/admin/avaliacoes" });
  }

  const overdue = await q.query(
    `select r.id, r.description, r.due_date, r.amount_cents, c.full_name, coalesce(c.whatsapp, c.phone) as wa,
            r.amount_cents - coalesce((select sum(amount_cents) from receivable_payments where receivable_id = r.id and voided_at is null), 0) as remaining
       from receivables r left join clients c on c.id = r.client_id
      where r.status = 'pending' and r.due_date < $1::date order by r.due_date limit 10`,
    [t],
  );
  for (const r of overdue.rows) {
    out.push({
      id: `rec-${r.id}`,
      type: "receivable_overdue",
      severity: "danger",
      title: `${r.full_name ?? r.description} — ${formatBRL(r.remaining)} em atraso`,
      detail: `Venceu em ${formatDateBR(r.due_date)}`,
      date: r.due_date,
      href: "/admin/receber",
      whatsapp: waLink(r.wa, fillTemplate(s.overdueMessage, { nome: (r.full_name ?? "").split(" ")[0], valor: formatBRL(r.remaining), data: formatDateBR(r.due_date) })),
    });
  }

  const pay = await q.query("select id, description, due_date, amount_cents from payables where status = 'pending' and due_date <= $1::date order by due_date limit 10", [addDays(t, 7)]);
  for (const p of pay.rows) {
    const late = p.due_date < t;
    out.push({
      id: `pay-${p.id}`,
      type: late ? "payable_overdue" : "payable_due_soon",
      severity: late ? "danger" : "warning",
      title: `${p.description} — ${formatBRL(p.amount_cents)}`,
      detail: late ? `Venceu em ${formatDateBR(p.due_date)}` : `Vence em ${formatDateBR(p.due_date)}`,
      date: p.due_date,
      href: "/admin/pagar",
    });
  }

  const clients = await q.query(
    `with base as (${CLIENT_BASE})
     select id, full_name, status, current_plan_name, current_ends_on, last_ends_on, coalesce(whatsapp, phone) as wa from base
      where (status = 'active' and current_ends_on <= $2::date) or status = 'expired'
      order by coalesce(current_ends_on, last_ends_on) limit 20`,
    [t, addDays(t, s.expiringDays)],
  );
  for (const c of clients.rows) {
    const expired = c.status === "expired";
    const ends = expired ? c.last_ends_on : c.current_ends_on;
    out.push({
      id: `plan-${c.id}`,
      type: expired ? "plan_expired" : "plan_expiring",
      severity: expired ? "danger" : "warning",
      title: `${c.full_name} — plano ${expired ? "vencido" : "próximo do vencimento"}`,
      detail: `${expired ? "Venceu" : "Vence"} em ${formatDateBR(ends)}`,
      date: ends,
      href: `/admin/clientes/${c.id}`,
      whatsapp: waLink(c.wa, fillTemplate(s.renewalMessage, { nome: c.full_name.split(" ")[0], data: formatDateBR(ends) })),
    });
  }

  const leads = await q.query("select id, full_name, whatsapp, source, created_at from leads where status = 'new' order by created_at desc limit 10");
  for (const l of leads.rows) {
    out.push({ id: `lead-${l.id}`, type: "lead_new", severity: "info", title: `Novo interessado: ${l.full_name}`, detail: l.source ? `Origem: ${l.source}` : "Aguardando contato", date: toLocalDate(new Date(l.created_at)), href: "/admin/interessados", whatsapp: waLink(l.whatsapp, s.whatsappGeneralMessage.replace("Olá, João!", `Olá, ${l.full_name.split(" ")[0]}!`)) });
  }

  const appts = await q.query("select * from appointments where status = 'scheduled' and starts_at >= $1 and starts_at < $2 order by starts_at limit 10", [
    now().toISOString(),
    new Date(now().getTime() + 48 * 3600_000).toISOString(),
  ]);
  for (const a of appts.rows.map(appointmentDto)) {
    out.push({ id: `appt-${a.id}`, type: "appointment_soon", severity: "info", title: `${a.clientName} — ${a.kind}`, detail: new Date(a.startsAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", dateStyle: "short", timeStyle: "short" }), date: toLocalDate(new Date(a.startsAt)), href: "/admin/agenda" });
  }
  return out;
}

// ================================================================ relatórios
export async function report(q: Queryable, period: { from: string; to: string }) {
  const [summary, monthly, methods, categories, plans, newClients, overdue] = await Promise.all([
    financeSummary(q, period),
    monthlyFinance(q, period),
    q.query<{ method: string; v: number }>(
      `select rp.method, sum(rp.amount_cents)::int as v from receivable_payments rp join receivables r on r.id = rp.receivable_id
        where rp.voided_at is null and r.status <> 'cancelled' and rp.paid_on between $1::date and $2::date group by 1 order by 2 desc`,
      [period.from, period.to],
    ),
    q.query<{ name: string; v: number }>(
      `select c.name, sum(p.amount_cents)::int as v from payables p join expense_categories c on c.id = p.category_id
        where p.status = 'paid' and p.paid_on between $1::date and $2::date group by 1 order by 2 desc`,
      [period.from, period.to],
    ),
    q.query<{ plan_name: string; n: number; v: number }>(
      `select plan_name, count(*)::int as n, coalesce(sum(agreed_price_cents), 0)::int as v from client_subscriptions
        where status = 'active' and starts_on between $1::date and $2::date group by 1 order by 2 desc`,
      [period.from, period.to],
    ),
    q.query<{ n: number }>("select count(*)::int as n from clients where created_at >= $1 and created_at < $2", [startOfLocalDay(period.from), startOfNextLocalDay(period.to)]),
    q.query(
      `select r.description, r.due_date, c.full_name,
              r.amount_cents - coalesce((select sum(amount_cents) from receivable_payments where receivable_id = r.id and voided_at is null), 0) as remaining
         from receivables r left join clients c on c.id = r.client_id
        where r.status = 'pending' and r.due_date < $1::date order by r.due_date limit 20`,
      [today()],
    ),
  ]);
  return {
    period,
    summary,
    monthly,
    receivedByMethod: methods.rows.map((m) => ({ method: m.method, cents: m.v })),
    expensesByCategory: categories.rows.map((c) => ({ category: c.name, cents: c.v })),
    subscriptionsStarted: plans.rows.map((p) => ({ planName: p.plan_name, contracts: p.n, revenueCents: p.v })),
    newClients: newClients.rows[0].n,
    overdue: overdue.rows.map((o) => ({ description: o.description, clientName: o.full_name, dueDate: o.due_date, remainingCents: o.remaining })),
  };
}

export async function reportCsv(q: Queryable, period: { from: string; to: string }): Promise<string> {
  const r = await report(q, period);
  return toCsv(
    ["Mês", "Recebido", "Despesas pagas", "Saldo realizado", "A receber (venc. no mês)", "A pagar (venc. no mês)"],
    r.monthly.map((m) => [m.month, centsToDecimal(m.receivedCents), centsToDecimal(m.paidCents), centsToDecimal(m.balanceCents), centsToDecimal(m.pendingReceivableCents), centsToDecimal(m.pendingExpensesCents)]),
  );
}

// ================================================================ privacidade (LGPD)
export async function searchPerson(q: Queryable, term: string) {
  const t = term.trim();
  if (t.length < 3) return { clients: [], leads: [], reviews: [] };
  const like = `%${t.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const digits = digitsOnly(t);
  const dl = digits.length >= 4 ? `%${digits}%` : "%__no_digits__%";
  const [clients, leads, reviews] = await Promise.all([
    q.query(
      `select id, full_name, phone, whatsapp, email, archived_at, anonymized_at from clients
        where full_name ilike $1 or coalesce(email,'') ilike $1 or regexp_replace(coalesce(phone,'') || coalesce(whatsapp,''), '\\D', '', 'g') like $2 limit 20`,
      [like, dl],
    ),
    q.query(
      `select id, full_name, phone, whatsapp, status from leads
        where full_name ilike $1 or regexp_replace(coalesce(phone,'') || coalesce(whatsapp,''), '\\D', '', 'g') like $2 limit 20`,
      [like, dl],
    ),
    q.query("select id, author_name, status from reviews where author_name ilike $1 limit 20", [like]),
  ]);
  return {
    clients: clients.rows.map((r) => camel(r)),
    leads: leads.rows.map((r) => camel(r)),
    reviews: reviews.rows.map((r) => camel(r)),
  };
}

/**
 * Atende pedido de exclusão de dados pessoais de um cliente SEM apagar o histórico financeiro:
 * remove nome/contatos/observações e mantém valores, datas e vínculos contábeis.
 */
export async function anonymizeClient(q: Queryable, adminId: string, id: string): Promise<void> {
  const c = (await q.query("select full_name from clients where id = $1", [id])).rows[0];
  if (!c) throw notFound("Cliente");
  const label = "Titular removido";
  await q.query(
    `update clients set full_name = $2, phone = null, whatsapp = null, email = null, notes = '',
            is_active = false, archived_at = coalesce(archived_at, now()), anonymized_at = now() where id = $1`,
    [id, label],
  );
  await q.query("update appointments set client_name = $2, notes = '' where client_id = $1", [id, label]);
  await q.query("update receivables set description = replace(description, $2, $3) where client_id = $1", [id, c.full_name, label]);
  const leads = await q.query<{ id: string }>("select id from leads where converted_client_id = $1", [id]);
  for (const l of leads.rows) {
    await q.query("delete from lead_notes where lead_id = $1", [l.id]);
    await q.query("update leads set full_name = $2, phone = null, whatsapp = null, interest = '' where id = $1", [l.id, label]);
  }
  await audit(q, { adminId, action: "privacy.anonymize_client", entity: "client", entityId: id, summary: "Dados pessoais do cliente anonimizados (pedido do titular)" });
}

// ================================================================ auditoria
export async function listAudit(q: Queryable, filter: { entity?: string; entityId?: string; limit?: number }): Promise<AuditEntryDto[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.entity) (params.push(filter.entity), where.push(`a.entity = $${params.length}`));
  if (filter.entityId) (params.push(filter.entityId), where.push(`a.entity_id = $${params.length}`));
  const r = await q.query(
    `select a.id, a.action, a.summary, a.created_at, ad.name as admin_name from audit_logs a
       left join administrators ad on ad.id = a.admin_id ${where.length ? `where ${where.join(" and ")}` : ""}
      order by a.created_at desc, a.id desc limit ${Math.min(filter.limit ?? 100, 500)}`,
    params,
  );
  return r.rows.map((x) => ({ id: x.id, action: x.action, summary: x.summary, createdAt: new Date(x.created_at).toISOString(), adminName: x.admin_name }));
}
