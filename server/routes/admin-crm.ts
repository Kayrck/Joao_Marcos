import { Hono } from "hono";
import type { Context } from "hono";
import type { Queryable } from "../db/index.js";
import { today } from "../lib/clock.js";
import { readJson, type AppEnv } from "../middleware/index.js";
import * as appointments from "../services/appointments.js";
import * as clients from "../services/clients.js";
import * as finance from "../services/finance.js";
import * as leads from "../services/leads.js";
import { endOfMonth, startOfMonth } from "../../shared/dates.js";

/** Clientes, interessados, financeiro e agenda — tudo exige sessão de administrador. */
export const adminCrmRoutes = new Hono<AppEnv>();

const tx = <T>(c: Context<AppEnv>, fn: (q: Queryable, adminId: string) => Promise<T>) => c.var.db.tx((q) => fn(q, c.var.admin.id));
const id = (c: Context<AppEnv>) => c.req.param("id") as string;
const ok = (c: Context<AppEnv>) => c.json({ ok: true });
const period = (c: Context<AppEnv>) => finance.parsePeriod(c.req.query(), { from: startOfMonth(today()), to: endOfMonth(today()) });
const csv = (c: Context<AppEnv>, name: string, body: string) => {
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="${name}"`);
  return c.body(body);
};

// ---------------------------------------------------------------- clientes
adminCrmRoutes.get("/clients", async (c) => c.json(await clients.listClients(c.var.db, c.req.query())));
adminCrmRoutes.post("/clients", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => clients.createClient(q, a, b)), 201);
});
adminCrmRoutes.get("/clients/:id", async (c) => c.json(await clients.getClient(c.var.db, id(c))));
adminCrmRoutes.put("/clients/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => clients.updateClient(q, a, id(c), b)));
});
adminCrmRoutes.post("/clients/:id/archive", async (c) => c.json(await tx(c, (q, a) => clients.archiveClient(q, a, id(c), true))));
adminCrmRoutes.post("/clients/:id/restore", async (c) => c.json(await tx(c, (q, a) => clients.archiveClient(q, a, id(c), false))));
adminCrmRoutes.delete("/clients/:id", async (c) => {
  await tx(c, (q, a) => clients.deleteClient(q, a, id(c)));
  return ok(c);
});
adminCrmRoutes.post("/clients/:id/subscriptions", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => clients.createSubscription(q, a, id(c), b)), 201);
});
adminCrmRoutes.put("/subscriptions/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => clients.updateSubscription(q, a, id(c), b)));
});
adminCrmRoutes.post("/subscriptions/:id/cancel", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return c.json(await tx(c, (q, a) => clients.cancelSubscription(q, a, id(c), b)));
});

// ---------------------------------------------------------------- interessados
adminCrmRoutes.get("/leads", async (c) => c.json(await leads.listLeads(c.var.db, c.req.query())));
adminCrmRoutes.post("/leads", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => leads.createLead(q, a, b)), 201);
});
adminCrmRoutes.get("/leads/:id", async (c) => c.json(await leads.getLead(c.var.db, id(c))));
adminCrmRoutes.put("/leads/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => leads.updateLead(q, a, id(c), b)));
});
adminCrmRoutes.post("/leads/:id/status", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => leads.setLeadStatus(q, a, id(c), b)));
});
adminCrmRoutes.post("/leads/:id/notes", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => leads.addLeadNote(q, a, id(c), b)), 201);
});
adminCrmRoutes.post("/leads/:id/convert", async (c) => c.json(await tx(c, (q, a) => leads.convertLead(q, a, id(c))), 201));
adminCrmRoutes.delete("/leads/:id", async (c) => {
  await tx(c, (q, a) => leads.deleteLead(q, a, id(c)));
  return ok(c);
});

// ---------------------------------------------------------------- financeiro
adminCrmRoutes.get("/finance/summary", async (c) => {
  const p = period(c);
  const [summary, monthly] = await Promise.all([finance.financeSummary(c.var.db, p), finance.monthlyFinance(c.var.db, p)]);
  return c.json({ summary, monthly });
});
adminCrmRoutes.get("/finance/ledger", async (c) => c.json(await finance.ledger(c.var.db, period(c))));

adminCrmRoutes.get("/receivables", async (c) => c.json(await finance.listReceivables(c.var.db, c.req.query())));
adminCrmRoutes.get("/receivables.csv", async (c) => csv(c, "contas-a-receber.csv", await finance.exportReceivablesCsv(c.var.db, c.req.query())));
adminCrmRoutes.post("/receivables", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.createReceivable(q, a, b)), 201);
});
adminCrmRoutes.get("/receivables/:id", async (c) => c.json(await finance.getReceivable(c.var.db, id(c))));
adminCrmRoutes.put("/receivables/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.updateReceivable(q, a, id(c), b)));
});
adminCrmRoutes.post("/receivables/:id/payments", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.addPayment(q, a, id(c), b)), 201);
});
adminCrmRoutes.post("/receivables/:id/cancel", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return c.json(await tx(c, (q, a) => finance.cancelReceivable(q, a, id(c), b)));
});
adminCrmRoutes.post("/receivables/:id/reopen", async (c) => c.json(await tx(c, (q, a) => finance.reopenReceivable(q, a, id(c)))));
adminCrmRoutes.post("/payments/:id/void", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return c.json(await tx(c, (q, a) => finance.voidPayment(q, a, id(c), b)));
});

adminCrmRoutes.get("/payables", async (c) => c.json(await finance.listPayables(c.var.db, c.req.query())));
adminCrmRoutes.get("/payables.csv", async (c) => csv(c, "contas-a-pagar.csv", await finance.exportPayablesCsv(c.var.db, c.req.query())));
adminCrmRoutes.post("/payables", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.createPayable(q, a, b)), 201);
});
adminCrmRoutes.put("/payables/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.updatePayable(q, a, id(c), b)));
});
adminCrmRoutes.post("/payables/:id/pay", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.payPayable(q, a, id(c), b)));
});
adminCrmRoutes.post("/payables/:id/unpay", async (c) => c.json(await tx(c, (q, a) => finance.unpayPayable(q, a, id(c)))));
adminCrmRoutes.post("/payables/:id/cancel", async (c) => {
  const b = await c.req.json().catch(() => ({}));
  return c.json(await tx(c, (q, a) => finance.cancelPayable(q, a, id(c), b)));
});

adminCrmRoutes.get("/expense-categories", async (c) => c.json(await finance.listCategories(c.var.db)));
adminCrmRoutes.post("/expense-categories", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.createCategory(q, a, b)), 201);
});
adminCrmRoutes.put("/expense-categories/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => finance.updateCategory(q, a, id(c), b)));
});
adminCrmRoutes.delete("/expense-categories/:id", async (c) => {
  await tx(c, (q, a) => finance.deleteCategory(q, a, id(c)));
  return ok(c);
});

// ---------------------------------------------------------------- agenda privada
adminCrmRoutes.get("/appointments", async (c) => c.json(await appointments.listAppointments(c.var.db, c.req.query())));
adminCrmRoutes.get("/appointments/availability", async (c) => c.json(await appointments.availability(c.var.db, c.req.query())));
adminCrmRoutes.post("/appointments", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => appointments.createAppointment(q, a, b)), 201);
});
adminCrmRoutes.put("/appointments/:id", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => appointments.updateAppointment(q, a, id(c), b)));
});
adminCrmRoutes.post("/appointments/:id/reschedule", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => appointments.rescheduleAppointment(q, a, id(c), b)));
});
adminCrmRoutes.post("/appointments/:id/status", async (c) => {
  const b = await readJson(c);
  return c.json(await tx(c, (q, a) => appointments.setAppointmentStatus(q, a, id(c), b)));
});
adminCrmRoutes.delete("/appointments/:id", async (c) => {
  await tx(c, (q, a) => appointments.deleteAppointment(q, a, id(c)));
  return ok(c);
});
