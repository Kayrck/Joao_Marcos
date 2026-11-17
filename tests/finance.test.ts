import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginAs, setup, teardown, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await setup();
  await loginAs(h);
});
afterAll(() => teardown(h));

const summary = async (from: string, to: string) => (await h.api("GET", `/api/admin/finance/summary?from=${from}&to=${to}`)).json;

describe("financeiro", () => {
  let catId: string;
  let overdueId: string;
  let futureId: string;

  it("categorias de despesa padrão existem e podem ser criadas/editadas", async () => {
    const cats = (await h.api("GET", "/api/admin/expense-categories")).json as any[];
    expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(["Equipamentos", "Marketing", "Outros"]));
    catId = cats.find((c) => c.name === "Equipamentos").id;
    const dup = await h.api("POST", "/api/admin/expense-categories", { name: "equipamentos" });
    expect(dup.status).toBe(409);
    const made = await h.api("POST", "/api/admin/expense-categories", { name: "Academia" });
    expect(made.status).toBe(201);
    const renamed = await h.api("PUT", `/api/admin/expense-categories/${made.json.id}`, { name: "Aluguel de espaço", isActive: true });
    expect(renamed.json.name).toBe("Aluguel de espaço");
  });

  it("cadastra contas a receber e calcula status atrasado/pendente pela data de vencimento", async () => {
    const o = await h.api("POST", "/api/admin/receivables", { description: "Mensalidade atrasada", amountCents: 10000, dueDate: "2026-11-10" });
    const f = await h.api("POST", "/api/admin/receivables", { description: "Mensalidade futura", amountCents: 15000, dueDate: "2026-11-25" });
    expect(o.status).toBe(201);
    expect(o.json.status).toBe("overdue");
    expect(f.json.status).toBe("pending");
    overdueId = o.json.id;
    futureId = f.json.id;
  });

  it("valida valores (zero, negativo, data inválida)", async () => {
    expect((await h.api("POST", "/api/admin/receivables", { description: "x", amountCents: 0, dueDate: "2026-11-10" })).status).toBe(400);
    expect((await h.api("POST", "/api/admin/receivables", { description: "x", amountCents: -5, dueDate: "2026-11-10" })).status).toBe(400);
    expect((await h.api("POST", "/api/admin/receivables", { description: "x", amountCents: 100, dueDate: "2026-13-40" })).status).toBe(400);
  });

  it("recebimento parcial mantém saldo e não conta o pendente como receita realizada", async () => {
    const r = await h.api("POST", `/api/admin/receivables/${overdueId}/payments`, { amountCents: 4000, paidOn: "2026-11-12", method: "pix" });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ receivedCents: 4000, remainingCents: 6000, status: "overdue" });
    const s = await summary("2026-11-01", "2026-11-30");
    expect(s.summary.receivedCents).toBe(4000);
    expect(s.summary.overdueReceivableCents).toBe(6000); // só o saldo restante
    expect(s.summary.pendingReceivableCents).toBe(15000);
  });

  it("impede receber mais do que o saldo e quitar duas vezes", async () => {
    const over = await h.api("POST", `/api/admin/receivables/${overdueId}/payments`, { amountCents: 7000, method: "pix" });
    expect(over.status).toBe(400);
    const done = await h.api("POST", `/api/admin/receivables/${overdueId}/payments`, { method: "dinheiro", paidOn: "2026-11-14" });
    expect(done.json).toMatchObject({ receivedCents: 10000, remainingCents: 0, status: "received" });
    expect((await h.api("POST", `/api/admin/receivables/${overdueId}/payments`, { amountCents: 1, method: "pix" })).status).toBe(409);
  });

  it("despesas: pendente não entra no realizado; ao pagar, entra", async () => {
    const p = await h.api("POST", "/api/admin/payables", { description: "Anilhas", categoryId: catId, amountCents: 3000, dueDate: "2026-11-20" });
    expect(p.status).toBe(201);
    expect(p.json.status).toBe("pending");
    let s = (await summary("2026-11-01", "2026-11-30")).summary;
    expect(s.paidExpensesCents).toBe(0);
    expect(s.pendingExpensesCents).toBe(3000);
    expect(s.realizedBalanceCents).toBe(10000);

    const paid = await h.api("POST", `/api/admin/payables/${p.json.id}/pay`, { paidOn: "2026-11-15", method: "pix" });
    expect(paid.json.status).toBe("paid");
    s = (await summary("2026-11-01", "2026-11-30")).summary;
    expect(s).toMatchObject({ receivedCents: 10000, paidExpensesCents: 3000, pendingExpensesCents: 0, realizedBalanceCents: 7000 });
    // projetado = realizado + a receber pendente (15000) − a pagar pendente (0)
    expect(s.projectedBalanceCents).toBe(7000 + 15000);
  });

  it("despesa vencida sem pagamento aparece como atrasada", async () => {
    const p = await h.api("POST", "/api/admin/payables", { description: "Software", categoryId: catId, amountCents: 2000, dueDate: "2026-11-05" });
    expect(p.json.status).toBe("overdue");
    const s = (await summary("2026-11-01", "2026-11-30")).summary;
    expect(s.overdueExpensesCents).toBe(2000);
    expect(s.projectedBalanceCents).toBe(7000 + 15000 - 2000);
  });

  it("cancelados não entram em nenhum total e não se cancela conta com recebimento", async () => {
    expect((await h.api("POST", `/api/admin/receivables/${overdueId}/cancel`, {})).status).toBe(409);
    const c = await h.api("POST", `/api/admin/receivables/${futureId}/cancel`, { reason: "Cliente desistiu" });
    expect(c.json.status).toBe("cancelled");
    const s = (await summary("2026-11-01", "2026-11-30")).summary;
    expect(s.pendingReceivableCents).toBe(0);
    expect((await h.api("PUT", `/api/admin/receivables/${futureId}`, { description: "x", amountCents: 100, dueDate: "2026-11-25" })).status).toBe(409);
  });

  it("estorno de pagamento volta o saldo e fica no histórico de auditoria", async () => {
    const rec = (await h.api("GET", `/api/admin/receivables/${overdueId}`)).json;
    const last = rec.payments[rec.payments.length - 1];
    const v = await h.api("POST", `/api/admin/payments/${last.id}/void`, { reason: "Lançado errado" });
    expect(v.json).toMatchObject({ receivedCents: 4000, remainingCents: 6000, status: "overdue" });
    expect((await summary("2026-11-01", "2026-11-30")).summary.receivedCents).toBe(4000);
    const audit = (await h.api("GET", `/api/admin/audit?entity=receivable&entityId=${overdueId}`)).json as any[];
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["receivable.create", "receivable.payment", "receivable.payment_void"]));
  });

  it("filtros por período isolam os meses e a série mensal bate com os totais", async () => {
    await h.api("POST", "/api/admin/receivables", { description: "Dezembro", amountCents: 5000, dueDate: "2026-12-05" });
    const dez = await summary("2026-12-01", "2026-12-31");
    expect(dez.summary.receivedCents).toBe(0);
    expect(dez.summary.pendingReceivableCents).toBe(5000);
    const range = await summary("2026-11-01", "2026-12-31");
    expect(range.monthly.map((m: any) => m.month)).toEqual(["2026-11", "2026-12"]);
    expect(range.monthly[0].receivedCents).toBe(4000);
    expect(range.monthly[1].pendingReceivableCents).toBe(5000);
    expect((await h.api("GET", "/api/admin/finance/summary?from=2026-12-31&to=2026-12-01")).status).toBe(400);
  });

  it("exporta CSV com BOM e neutraliza fórmulas de planilha", async () => {
    await h.api("POST", "/api/admin/receivables", { description: "=HYPERLINK(\"x\")", amountCents: 100, dueDate: "2026-11-30" });
    const res = await h.api("GET", "/api/admin/receivables.csv?from=2026-11-01&to=2026-11-30");
    expect(res.res.headers.get("content-type")).toMatch(/text\/csv/);
    const raw = new Uint8Array(await (await h.app.request("http://localhost/api/admin/receivables.csv?from=2026-11-01&to=2026-11-30", { headers: { Cookie: h.cookie } })).arrayBuffer());
    expect([...raw.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 (Excel)
    expect(res.json).toContain("'=HYPERLINK");
    expect(res.json).toContain("Descrição;Cliente;Valor");
  });

  it("extrato lista somente movimentos realizados", async () => {
    const l = (await h.api("GET", "/api/admin/finance/ledger?from=2026-11-01&to=2026-11-30")).json as any[];
    expect(l.filter((x) => x.kind === "in").reduce((a, x) => a + x.amountCents, 0)).toBe(4000);
    expect(l.filter((x) => x.kind === "out").reduce((a, x) => a + x.amountCents, 0)).toBe(3000);
  });
});
