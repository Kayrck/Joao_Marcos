import { mkdir, rm } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setClockForTests } from "../server/lib/clock.js";
import { loginAs, setup, teardown, type Harness } from "./helpers.js";

let h: Harness;
beforeAll(async () => {
  await mkdir(".data/test-uploads", { recursive: true });
  h = await setup();
  await loginAs(h);
});
afterAll(async () => {
  await teardown(h);
  await rm(".data/test-uploads", { recursive: true, force: true });
});

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** Envia o arquivo como o navegador faria: init -> PUT na URL devolvida -> confirm. */
async function uploadFile(buf: Buffer, contentType: string, filename: string, size = buf.length) {
  const init = await h.api("POST", "/api/admin/media/upload-init", { filename, contentType, size });
  if (init.status !== 200) return { init };
  const put = await h.app.request(`http://localhost${init.json.upload.url}`, {
    method: "PUT",
    headers: { Origin: "http://localhost", Host: "localhost", Cookie: h.cookie, "Content-Type": contentType },
    body: new Uint8Array(buf),
  });
  const confirm = await h.api("POST", "/api/admin/media/upload-confirm", { key: init.json.key, title: filename, altText: "Foto de teste", category: "treinos", width: 1, height: 1 });
  return { init, put, confirm };
}

describe("agenda particular", () => {
  const at = (d: string, from: string, to: string) => ({ startsAt: `${d}T${from}:00-03:00`, endsAt: `${d}T${to}:00-03:00` });
  let firstId: string;

  it("só é acessível por administradores", async () => {
    const r = await h.api("GET", "/api/admin/appointments?from=2026-11-01&to=2026-11-30", undefined, { auth: false });
    expect(r.status).toBe(401);
  });

  it("cria, lista e valida compromissos", async () => {
    const r = await h.api("POST", "/api/admin/appointments", { clientName: "Carlos", kind: "aula", ...at("2026-11-17", "09:00", "10:00") });
    expect(r.status).toBe(201);
    firstId = r.json.id;
    const bad = await h.api("POST", "/api/admin/appointments", { clientName: "Carlos", ...at("2026-11-17", "11:00", "10:00") });
    expect(bad.status).toBe(400);
    const noName = await h.api("POST", "/api/admin/appointments", { clientName: "", ...at("2026-11-17", "11:00", "12:00") });
    expect(noName.status).toBe(400);
    const list = await h.api("GET", "/api/admin/appointments?from=2026-11-17&to=2026-11-17");
    expect(list.json).toHaveLength(1);
  });

  it("detecta conflito de horário (409) e permite forçar", async () => {
    const c = await h.api("POST", "/api/admin/appointments", { clientName: "Ana", ...at("2026-11-17", "09:30", "10:30") });
    expect(c.status).toBe(409);
    expect(c.json.error.code).toBe("schedule_conflict");
    expect(c.json.error.details.conflicts[0].clientName).toBe("Carlos");
    // horários adjacentes não conflitam
    const adj = await h.api("POST", "/api/admin/appointments", { clientName: "Ana", ...at("2026-11-17", "10:00", "11:00") });
    expect(adj.status).toBe(201);
    const forced = await h.api("POST", "/api/admin/appointments", { clientName: "Dupla", force: true, ...at("2026-11-17", "09:30", "10:30") });
    expect(forced.status).toBe(201);
  });

  it("reagenda (com checagem de conflito), cancela e libera o horário", async () => {
    const conflict = await h.api("POST", `/api/admin/appointments/${firstId}/reschedule`, at("2026-11-17", "10:00", "11:00"));
    expect(conflict.status).toBe(409);
    const ok = await h.api("POST", `/api/admin/appointments/${firstId}/reschedule`, at("2026-11-18", "09:00", "10:00"));
    expect(ok.status).toBe(200);
    expect(ok.json.startsAt).toBe("2026-11-18T12:00:00.000Z");
    await h.api("POST", `/api/admin/appointments/${firstId}/status`, { status: "cancelled" });
    const again = await h.api("POST", "/api/admin/appointments", { clientName: "Novo", ...at("2026-11-18", "09:00", "10:00") });
    expect(again.status).toBe(201);
  });

  it("consulta disponibilidade de um dia", async () => {
    const a = (await h.api("GET", "/api/admin/appointments/availability?date=2026-11-17&duration=60")).json;
    expect(a.freeStarts).toContain("06:00");
    expect(a.freeStarts).not.toContain("10:00"); // ocupado (Ana 10:00–11:00)
    expect(a.freeStarts).not.toContain("09:30");
    expect(a.freeStarts).toContain("11:00");
  });

  it("exclui compromisso", async () => {
    expect((await h.api("DELETE", `/api/admin/appointments/${firstId}`)).status).toBe(200);
    expect((await h.api("DELETE", `/api/admin/appointments/${firstId}`)).status).toBe(404);
  });
});

describe("avaliações: envio público → moderação → exibição", () => {
  const ip = { "x-real-ip": "9.9.9.9" };
  const review = { name: "Fernanda", rating: 5, body: "Treino muito bem acompanhado, adorei!", consent: true };
  let reviewId: string;

  it("valida o envio (nota, texto e consentimento obrigatórios)", async () => {
    const send = (b: object) => h.api("POST", "/api/public/reviews", b, { auth: false, headers: ip });
    expect((await send({ ...review, rating: 6 })).status).toBe(400);
    expect((await send({ ...review, rating: 0 })).status).toBe(400);
    expect((await send({ ...review, consent: false })).status).toBe(400);
    expect((await send({ ...review, body: "curto" })).status).toBe(400);
    expect((await send({ ...review, name: "" })).status).toBe(400);
  });

  it("entra como PENDENTE, não aparece no site e sinaliza ao administrador", async () => {
    const r = await h.api("POST", "/api/public/reviews", review, { auth: false, headers: ip });
    expect(r.status).toBe(201);
    const site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    expect(site.reviews.items).toHaveLength(0);
    expect(site.reviews.count).toBe(0);
    const list = (await h.api("GET", "/api/admin/reviews?status=pending")).json;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].status).toBe("pending");
    reviewId = list.items[0].id;
    expect((await h.api("GET", "/api/admin/reviews/pending-count")).json.count).toBe(1);
    const alerts = (await h.api("GET", "/api/admin/alerts")).json as any[];
    expect(alerts.some((a) => a.type === "review_pending")).toBe(true);
    // o IP não é guardado em texto puro
    const row = (await h.db.query("select ip_hash from reviews")).rows[0];
    expect(row.ip_hash).toBeTruthy();
    expect(row.ip_hash).not.toContain("9.9.9.9");
  });

  it("aplica rate limit por IP", async () => {
    let last = 0;
    for (let i = 0; i < 4; i++) last = (await h.api("POST", "/api/public/reviews", review, { auth: false, headers: ip })).status;
    expect(last).toBe(429);
  });

  it("aprova → aparece no site; rejeita → some; histórico registra tudo", async () => {
    const ap = await h.api("POST", `/api/admin/reviews/${reviewId}/moderate`, { status: "approved" });
    expect(ap.json.status).toBe("approved");
    let site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    expect(site.reviews.items.map((r: any) => r.authorName)).toContain("Fernanda");
    expect(site.reviews.average).toBe(5);
    // dados internos nunca vão para o site público
    expect(JSON.stringify(site.reviews)).not.toMatch(/ip_hash|ipHash|status/);

    await h.api("POST", `/api/admin/reviews/${reviewId}/moderate`, { status: "rejected", note: "Fora do tema" });
    site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    expect(site.reviews.items).toHaveLength(0);

    const hist = (await h.api("GET", `/api/admin/reviews/${reviewId}/history`)).json as any[];
    expect(hist.map((x) => x.action)).toEqual(expect.arrayContaining(["review.approved", "review.rejected"]));
  });

  it("administrador edita e exclui; visitante não consegue alterar", async () => {
    const ed = await h.api("PUT", `/api/admin/reviews/${reviewId}`, { authorName: "Fernanda S.", rating: 4, body: "Texto ajustado pelo administrador.", displayDate: "2026-11-10", photoMediaId: null });
    expect(ed.json).toMatchObject({ authorName: "Fernanda S.", rating: 4 });
    expect((await h.api("PUT", `/api/public/reviews/${reviewId}`, {}, { auth: false })).status).toBe(404);
    expect((await h.api("DELETE", `/api/public/reviews/${reviewId}`, undefined, { auth: false })).status).toBe(404);
    expect((await h.api("DELETE", `/api/admin/reviews/${reviewId}`)).status).toBe(200);
  });
});

describe("mídias e publicações", () => {
  let imageId: string;
  let postId: string;

  it("faz upload válido de imagem (persistido e verificado pelos bytes)", async () => {
    const { init, put, confirm } = await uploadFile(PNG, "image/png", "treino.png");
    expect(init.status).toBe(200);
    expect(put!.status).toBe(200);
    expect(confirm!.status).toBe(201);
    expect(confirm!.json).toMatchObject({ kind: "image", mimeType: "image/png", category: "treinos" });
    expect(confirm!.json.url).toMatch(/^\/uploads\/\d{4}\/\d{2}\/.+\.png$/);
    imageId = confirm!.json.id;
  });

  it("rejeita tipo não permitido, arquivo grande demais e conteúdo falso", async () => {
    expect((await h.api("POST", "/api/admin/media/upload-init", { filename: "a.exe", contentType: "application/x-msdownload", size: 10 })).status).toBe(400);
    expect((await h.api("POST", "/api/admin/media/upload-init", { filename: "a.svg", contentType: "image/svg+xml", size: 10 })).status).toBe(400);
    expect((await h.api("POST", "/api/admin/media/upload-init", { filename: "g.png", contentType: "image/png", size: 50 * 1024 * 1024 })).status).toBe(400);
    // arquivo .png que na verdade é texto (poderia ser um script)
    const fake = await uploadFile(Buffer.from("<script>alert(1)</script> not an image at all"), "image/png", "fake.png");
    expect(fake.confirm!.status).toBe(400);
  });

  it("não permite upload sem sessão", async () => {
    const r = await h.api("POST", "/api/admin/media/upload-init", { filename: "a.png", contentType: "image/png", size: 10 }, { auth: false });
    expect(r.status).toBe(401);
  });

  it("cadastra vídeo externo do YouTube e rejeita links desconhecidos", async () => {
    const ok = await h.api("POST", "/api/admin/media/external", { url: "https://youtu.be/dQw4w9WgXcQ", title: "Agachamento" });
    expect(ok.status).toBe(201);
    expect(ok.json).toMatchObject({ kind: "external_video", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" });
    expect((await h.api("POST", "/api/admin/media/external", { url: "https://example.com/video" })).status).toBe(400);
    expect((await h.api("POST", "/api/admin/media/external", { url: "javascript:alert(1)" })).status).toBe(400);
  });

  it("rascunho NÃO aparece; publicado aparece; despublicar remove", async () => {
    const draft = await h.api("POST", "/api/admin/posts", {
      title: "Técnica de agachamento",
      category: "execucao",
      summary: "Passo a passo",
      coverMediaId: imageId,
      body: [
        { type: "text", text: "Mantenha a coluna neutra." },
        { type: "image", mediaId: imageId, caption: "Postura" },
      ],
    });
    expect(draft.status).toBe(201);
    expect(draft.json).toMatchObject({ status: "draft", visibility: "draft", slug: "tecnica-de-agachamento" });
    postId = draft.json.id;
    let gallery = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json.gallery;
    expect(gallery.items).toHaveLength(0);
    expect((await h.api("GET", "/api/public/posts/tecnica-de-agachamento", undefined, { auth: false })).status).toBe(404);

    // pré-visualização para o admin mesmo como rascunho
    const prev = await h.api("GET", `/api/admin/posts/${postId}/preview`);
    expect(prev.status).toBe(200);
    expect(prev.json.blocks).toHaveLength(2);

    const pub = await h.api("POST", `/api/admin/posts/${postId}/publish`, {});
    expect(pub.json.visibility).toBe("published");
    const site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    gallery = site.gallery;
    expect(gallery.items.map((p: any) => p.title)).toEqual(["Técnica de agachamento"]);
    expect(gallery.items[0].cover.url).toMatch(/^\/uploads\//);
    expect(site.sections.some((s: any) => s.key === "gallery")).toBe(true);
    const detail = (await h.api("GET", "/api/public/posts/tecnica-de-agachamento", undefined, { auth: false })).json;
    expect(detail.blocks[1]).toMatchObject({ type: "image", caption: "Postura" });

    await h.api("POST", `/api/admin/posts/${postId}/unpublish`, {});
    expect((await h.api("GET", "/api/public/site", undefined, { auth: false })).json.gallery.items).toHaveLength(0);
  });

  it("publicação agendada só aparece depois da data", async () => {
    await h.api("POST", `/api/admin/posts/${postId}/publish`, { publishedAt: "2026-11-20T08:00:00-03:00" });
    const before = (await h.api("GET", "/api/public/posts", undefined, { auth: false })).json;
    expect(before.items).toHaveLength(0);
    setClockForTests("2026-11-21T08:00:00-03:00");
    const after = (await h.api("GET", "/api/public/posts", undefined, { auth: false })).json;
    expect(after.items).toHaveLength(1);
    setClockForTests("2026-11-16T12:00:00-03:00");
  });

  it("'Resultados' exige autorização do aluno para publicar", async () => {
    const p = await h.api("POST", "/api/admin/posts", { title: "Resultado de aluno", category: "resultados", body: [{ type: "text", text: "Depoimento" }] });
    const fail = await h.api("POST", `/api/admin/posts/${p.json.id}/publish`, {});
    expect(fail.status).toBe(400);
    const upd = await h.api("PUT", `/api/admin/posts/${p.json.id}`, { title: "Resultado de aluno", category: "resultados", body: [{ type: "text", text: "Depoimento" }], authorizationConfirmed: true });
    expect(upd.status).toBe(200);
    expect((await h.api("POST", `/api/admin/posts/${p.json.id}/publish`, {})).status).toBe(200);
  });

  it("texto da publicação nunca vira HTML (sem XSS armazenado) e mídia em uso não é excluída", async () => {
    const x = await h.api("POST", "/api/admin/posts", { title: "<img src=x onerror=alert(1)>", category: "dicas", body: [{ type: "text", text: "<script>alert(1)</script>" }] });
    expect(x.status).toBe(201);
    expect(x.json.slug).toBe("img-src-x-onerror-alert-1");
    const del = await h.api("DELETE", `/api/admin/media/${imageId}`);
    expect(del.status).toBe(409);
    await h.api("DELETE", `/api/admin/posts/${postId}`);
  });

  it("edição do conteúdo do site reflete no público sem deploy; hero não pode ser desativado", async () => {
    const secs = (await h.api("GET", "/api/admin/site/sections")).json as any[];
    const hero = secs.find((s) => s.key === "hero");
    const upd = await h.api("PUT", "/api/admin/site/sections/hero", { content: { ...hero.content, titleLine: "Novo título", imageMediaId: imageId } });
    expect(upd.status).toBe(200);
    let site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    const pubHero = site.sections.find((s: any) => s.key === "hero");
    expect(pubHero.content.titleLine).toBe("Novo título");
    expect(pubHero.image.url).toMatch(/^\/uploads\//);
    expect((await h.api("PUT", "/api/admin/site/sections/hero", { enabled: false })).status).toBe(400);

    await h.api("PUT", "/api/admin/site/sections/benefits", { enabled: false });
    site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    expect(site.sections.some((s: any) => s.key === "benefits")).toBe(false);

    const order = ["hero", "plans", "about", "how_it_works", "benefits", "gallery", "reviews", "final_cta"];
    await h.api("PUT", "/api/admin/site/sections/order", { keys: order });
    site = (await h.api("GET", "/api/public/site", undefined, { auth: false })).json;
    expect(site.sections.map((s: any) => s.key).slice(0, 2)).toEqual(["hero", "plans"]);
  });

  it("configurações: WhatsApp centralizado, validado e refletido no site", async () => {
    const s = (await h.api("GET", "/api/admin/settings")).json;
    expect(s.whatsappNumber).toBe("558592718614");
    const upd = await h.api("PUT", "/api/admin/settings", { whatsappNumber: "(85) 99999-1234" });
    expect(upd.json.whatsappNumber).toBe("5585999991234");
    expect((await h.api("GET", "/api/public/site", undefined, { auth: false })).json.settings.whatsappNumber).toBe("5585999991234");
    expect((await h.api("PUT", "/api/admin/settings", { whatsappNumber: "123" })).status).toBe(400);
    expect((await h.api("PUT", "/api/admin/settings", { instagramUrl: "javascript:alert(1)" })).status).toBe(400);
  });
});
