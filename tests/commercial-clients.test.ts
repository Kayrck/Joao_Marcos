import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setClockForTests } from "../server/lib/clock.js";
import { loginAs, setup, teardown, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  h = await setup();
  await loginAs(h);
});
afterAll(() => teardown(h));

const publicSite = async () => (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
const plansAdmin = async () => (await h.api("GET", "/api/admin/plans")).json as any[];
const planByName = async (name: string) => (await plansAdmin()).find((p) => p.name === name);

describe("planos e promoções", () => {
  it("instalação inicial: 3 planos com preço promocional válido até 31/12/2026", async () => {
    const site = await publicSite();
    expect(site.plans.map((p: any) => p.name)).toEqual(["Mensal", "Bimestral", "Trimestral"]);
    expect(site.plans.map((p: any) => p.durationMonths)).toEqual([1, 2, 3]);
    expect(site.plans.map((p: any) => p.price.cents)).toEqual([10000, 15000, 20000]);
    expect(site.plans.every((p: any) => p.price.kind === "promo")).toBe(true);
    expect(site.plans[0].price.validUntilDate).toBe("2026-12-31");
    expect(site.activePromotion.validUntilDate).toBe("2026-12-31");
  });

  it("promoção ainda vale em 31/12/2026 às 23:59 (Fortaleza) e expira à meia-noite", async () => {
    setClockForTests("2026-12-31T23:59:00-03:00");
    expect((await publicSite()).plans[0].price.kind).toBe("promo");
    setClockForTests("2027-01-01T00:00:00-03:00");
    const site = await publicSite();
    expect(site.activePromotion).toBeNull();
    // sem preço regular definido, o site NÃO inventa valor: mostra "consulte"
    expect(site.plans[0].price).toMatchObject({ kind: "consult", cents: null });
    setClockForTests("2026-11-16T12:00:00-03:00");
  });

  it("preço regular definido pelo admin aparece quando não há promoção vigente", async () => {
    const mensal = await planByName("Mensal");
    const upd = await h.api("PUT", `/api/admin/plans/${mensal.id}`, { ...mensal, regularPriceCents: 12000 });
    expect(upd.status).toBe(200);
    setClockForTests("2027-02-01T10:00:00-03:00");
    const p = (await publicSite()).plans.find((x: any) => x.name === "Mensal");
    expect(p.price).toMatchObject({ kind: "regular", cents: 12000 });
    setClockForTests("2026-11-16T12:00:00-03:00");
    await h.api("PUT", `/api/admin/plans/${mensal.id}`, { ...mensal, regularPriceCents: null });
  });

  it("cria campanha futura sem alterar o frontend e respeita desativação", async () => {
    const trimestral = await planByName("Trimestral");
    const created = await h.api("POST", "/api/admin/promotions", {
      name: "Black Friday",
      startsAt: "2026-11-20T00:00:00-03:00",
      endsAt: "2026-11-30T00:00:00-03:00",
      plans: [{ planId: trimestral.id, promoPriceCents: 17000 }],
    });
    expect(created.status).toBe(201);
    expect(created.json.status).toBe("scheduled");
    // ainda não vigente: preço continua o da campanha 2026
    expect((await publicSite()).plans.find((p: any) => p.name === "Trimestral").price.cents).toBe(20000);
    setClockForTests("2026-11-22T12:00:00-03:00");
    // com duas promoções vigentes vale o MENOR preço
    expect((await publicSite()).plans.find((p: any) => p.name === "Trimestral").price.cents).toBe(17000);
    const off = await h.api("POST", `/api/admin/promotions/${created.json.id}/active`, { active: false });
    expect(off.json.status).toBe("disabled");
    expect((await publicSite()).plans.find((p: any) => p.name === "Trimestral").price.cents).toBe(20000);
    setClockForTests("2026-11-16T12:00:00-03:00");
  });

  it("valida período e exige planos", async () => {
    const bad = await h.api("POST", "/api/admin/promotions", { name: "X", startsAt: "2026-12-01T00:00:00-03:00", endsAt: "2026-11-01T00:00:00-03:00", plans: [] });
    expect(bad.status).toBe(400);
    expect(bad.json.error.fields).toBeTruthy();
  });
});

describe("clientes, contratações e vencimentos", () => {
  let clientId: string;

  it("cadastra cliente (status pendente até contratar plano)", async () => {
    const r = await h.api("POST", "/api/admin/clients", { fullName: "Maria Souza", whatsapp: "(85) 98888-7777", email: "maria@x.com" });
    expect(r.status).toBe(201);
    expect(r.json.status).toBe("pending");
    expect(r.json.whatsapp).toBe("5585988887777");
    clientId = r.json.id;
  });

  it("valida campos do cadastro", async () => {
    const r = await h.api("POST", "/api/admin/clients", { fullName: "", phone: "123", email: "nao-e-email" });
    expect(r.status).toBe(400);
    expect(Object.keys(r.json.error.fields)).toEqual(expect.arrayContaining(["fullName", "phone", "email"]));
  });

  it("contrata plano com o preço vigente, gera cobrança paga e fica ativo", async () => {
    const mensal = await planByName("Mensal");
    const r = await h.api("POST", `/api/admin/clients/${clientId}/subscriptions`, {
      planId: mensal.id,
      startsOn: "2026-11-16",
      charge: { dueDate: "2026-11-16", paid: { paidOn: "2026-11-16", method: "pix" } },
    });
    expect(r.status).toBe(201);
    const c = r.json;
    expect(c.status).toBe("active");
    expect(c.subscriptions[0]).toMatchObject({ planName: "Mensal", agreedPriceCents: 10000, startsOn: "2026-11-16", endsOn: "2026-12-15", phase: "current" });
    expect(c.receivables[0]).toMatchObject({ amountCents: 10000, receivedCents: 10000, status: "received" });
    expect(c.totals.receivedCents).toBe(10000);
  });

  it("alterar o preço do plano depois NÃO muda contratos anteriores", async () => {
    const mensal = await planByName("Mensal");
    await h.api("PUT", `/api/admin/plans/${mensal.id}`, { ...mensal, regularPriceCents: 99900 });
    const promos = (await h.api("GET", "/api/admin/promotions")).json as any[];
    const p2026 = promos.find((p) => p.name === "Promoção 2026");
    await h.api("PUT", `/api/admin/promotions/${p2026.id}`, {
      name: p2026.name,
      description: p2026.description,
      startsAt: p2026.startsAt,
      endsAt: p2026.endsAt,
      isActive: true,
      plans: p2026.plans.map((x: any) => ({ planId: x.planId, promoPriceCents: x.planName === "Mensal" ? 55500 : x.promoPriceCents })),
    });
    const c = (await h.api("GET", `/api/admin/clients/${clientId}`)).json;
    expect(c.subscriptions[0].agreedPriceCents).toBe(10000);
    expect(c.receivables[0].amountCents).toBe(10000);
    // restaura
    await h.api("PUT", `/api/admin/plans/${mensal.id}`, { ...mensal, regularPriceCents: null });
    await h.api("PUT", `/api/admin/promotions/${p2026.id}`, {
      name: p2026.name, description: p2026.description, startsAt: p2026.startsAt, endsAt: p2026.endsAt, isActive: true,
      plans: p2026.plans.map((x: any) => ({ planId: x.planId, promoPriceCents: x.promoPriceCents })),
    });
  });

  it("impede planos sobrepostos e sugere a data de renovação", async () => {
    const bi = await planByName("Bimestral");
    const r = await h.api("POST", `/api/admin/clients/${clientId}/subscriptions`, { planId: bi.id, startsOn: "2026-12-01" });
    expect(r.status).toBe(409);
    expect(r.json.error.details.suggestedStart).toBe("2026-12-16");
    const renew = await h.api("POST", `/api/admin/clients/${clientId}/subscriptions`, { planId: bi.id, startsOn: "2026-12-16" });
    expect(renew.status).toBe(201);
    expect(renew.json.subscriptions).toHaveLength(2);
    expect(renew.json.subscriptions.find((s: any) => s.planName === "Bimestral").endsOn).toBe("2027-02-15");
  });

  it("identifica planos próximos do vencimento e vencidos nos indicadores", async () => {
    const mensal = await planByName("Mensal");
    const mk = async (name: string, startsOn: string) => {
      const c = (await h.api("POST", "/api/admin/clients", { fullName: name, whatsapp: "85977776666" })).json;
      await h.api("POST", `/api/admin/clients/${c.id}/subscriptions`, { planId: mensal.id, startsOn });
      return c.id as string;
    };
    const soon = await mk("Cliente Vencendo", "2026-10-20"); // termina 2026-11-19
    const expired = await mk("Cliente Vencido", "2026-09-01"); // terminou 2026-09-30

    const s = (await h.api("GET", `/api/admin/clients/${soon}`)).json;
    expect(s).toMatchObject({ status: "active", expiringSoon: true, daysToEnd: 3 });
    const e = (await h.api("GET", `/api/admin/clients/${expired}`)).json;
    expect(e.status).toBe("expired");

    const list = (await h.api("GET", "/api/admin/clients?status=expiring")).json;
    expect(list.items.map((c: any) => c.fullName)).toContain("Cliente Vencendo");
    expect(list.items.map((c: any) => c.fullName)).not.toContain("Cliente Vencido");

    const dash = (await h.api("GET", "/api/admin/dashboard?from=2026-11-01&to=2026-11-30")).json;
    expect(dash.kpis.expiringSoon).toBe(1);
    expect(dash.kpis.expired).toBe(1);
    expect(dash.kpis.clientsActive).toBe(2);

    // alterar a data de vencimento reflete nos indicadores
    const sub = s.subscriptions[0];
    await h.api("PUT", `/api/admin/subscriptions/${sub.id}`, { startsOn: sub.startsOn, endsOn: "2026-12-30", agreedPriceCents: sub.agreedPriceCents, notes: "" });
    const dash2 = (await h.api("GET", "/api/admin/dashboard?from=2026-11-01&to=2026-11-30")).json;
    expect(dash2.kpis.expiringSoon).toBe(0);

    const alerts = (await h.api("GET", "/api/admin/alerts")).json as any[];
    expect(alerts.some((a) => a.type === "plan_expired" && a.whatsapp?.number)).toBe(true);
  });

  it("arquiva clientes com histórico e bloqueia exclusão física", async () => {
    const del = await h.api("DELETE", `/api/admin/clients/${clientId}`);
    expect(del.status).toBe(409);
    const arch = await h.api("POST", `/api/admin/clients/${clientId}/archive`, {});
    expect(arch.json.status).toBe("archived");
    const list = (await h.api("GET", "/api/admin/clients")).json;
    expect(list.items.map((c: any) => c.id)).not.toContain(clientId);
    const empty = (await h.api("POST", "/api/admin/clients", { fullName: "Sem histórico" })).json;
    expect((await h.api("DELETE", `/api/admin/clients/${empty.id}`)).status).toBe(200);
  });

  it("anonimiza dados pessoais (LGPD) preservando o histórico financeiro", async () => {
    const found = (await h.api("GET", "/api/admin/privacy/search?q=Maria")).json;
    expect(found.clients.map((c: any) => c.id)).toContain(clientId);
    const r = await h.api("POST", `/api/admin/privacy/clients/${clientId}/anonymize`, {});
    expect(r.status).toBe(200);
    const c = (await h.api("GET", `/api/admin/clients/${clientId}`)).json;
    expect(c.fullName).toBe("Titular removido");
    expect(c.email).toBeNull();
    expect(c.whatsapp).toBeNull();
    expect(c.receivables[0].amountCents).toBe(10000); // financeiro preservado
    expect(c.receivables[0].description).not.toContain("Maria");
  });
});

describe("interessados", () => {
  it("recebe contato público com consentimento e converte em cliente reaproveitando dados", async () => {
    const noConsent = await h.api("POST", "/api/public/leads", { name: "João Lead", whatsapp: "85999990000", consent: false }, { auth: false });
    expect(noConsent.status).toBe(400);
    const pub = await h.api("POST", "/api/public/leads", { name: "João Lead", whatsapp: "(85) 99999-0000", message: "Quero emagrecer", consent: true }, { auth: false, headers: { "x-real-ip": "1.1.1.1" } });
    expect(pub.status).toBe(201);
    const list = (await h.api("GET", "/api/admin/leads")).json;
    const lead = list.items.find((l: any) => l.fullName === "João Lead");
    expect(lead).toMatchObject({ status: "new", source: "Site", consentGiven: true, whatsapp: "5585999990000" });

    await h.api("POST", `/api/admin/leads/${lead.id}/notes`, { body: "Ligar à tarde" });
    const conv = await h.api("POST", `/api/admin/leads/${lead.id}/convert`, {});
    expect(conv.status).toBe(201);
    expect(conv.json.client.fullName).toBe("João Lead");
    expect(conv.json.client.whatsapp).toBe("5585999990000");
    expect(conv.json.lead.status).toBe("converted");
    expect((await h.api("POST", `/api/admin/leads/${lead.id}/convert`, {})).status).toBe(409);
  });

  it("honeypot não grava e rate limit protege o formulário", async () => {
    const before = (await h.api("GET", "/api/admin/leads")).json.total;
    await h.api("POST", "/api/public/leads", { name: "Robô", whatsapp: "85999990000", consent: true, website: "http://spam" }, { auth: false, headers: { "x-real-ip": "2.2.2.2" } });
    expect((await h.api("GET", "/api/admin/leads")).json.total).toBe(before);
    let last = 0;
    for (let i = 0; i < 5; i++) {
      last = (await h.api("POST", "/api/public/leads", { name: `Pessoa ${i}`, whatsapp: "85999990000", consent: true }, { auth: false, headers: { "x-real-ip": "3.3.3.3" } })).status;
    }
    expect(last).toBe(429);
  });
});
