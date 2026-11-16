import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel, likeTerm } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { today } from "../lib/clock.js";
import { conflict, notFound } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { hashIp } from "../lib/security.js";
import { dateStr, parse, phoneField, reqText, text } from "../lib/validate.js";
import { LEAD_STATUSES } from "../../shared/constants.js";
import { normalizeWhatsapp } from "../../shared/phone.js";
import type { ClientDetail, LeadDto, LeadNoteDto, Page } from "../../shared/types.js";
import { createClient } from "./clients.js";

function leadDto(row: any, notes?: LeadNoteDto[]): LeadDto {
  const r = camel(row);
  return {
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    whatsapp: r.whatsapp,
    source: r.source,
    interest: r.interest,
    status: r.status,
    firstContactOn: r.firstContactOn,
    consentGiven: r.consentGiven,
    convertedClientId: r.convertedClientId,
    createdAt: new Date(r.createdAt).toISOString(),
    ...(notes ? { notes } : {}),
  };
}

const noteDto = (r: any): LeadNoteDto => ({ id: r.id, body: r.body, createdAt: new Date(r.created_at).toISOString() });

// ---------------------------------------------------------------- público (formulário de contato)
const publicSchema = z.object({
  name: reqText(100),
  whatsapp: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe um WhatsApp com DDD."),
  message: text(500).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Autorize o contato para enviar." }) }),
  website: z.string().max(200).optional(), // honeypot
});

/** Registra um interessado vindo do formulário do site (somente com consentimento explícito). */
export async function submitPublicLead(q: Queryable, ip: string, input: unknown): Promise<{ ok: true }> {
  const d = parse(publicSchema, input);
  if (d.website) return { ok: true };
  const h = hashIp(ip);
  await rateLimit(q, `lead:ip:${h}`, 3, 3600, "Você já enviou seus dados recentemente. Tente novamente mais tarde.");
  await rateLimit(q, "lead:global", 100, 3600);
  const wa = normalizeWhatsapp(d.whatsapp);
  const r = await q.query<{ id: string }>(
    `insert into leads (full_name, phone, whatsapp, source, interest, status, first_contact_on, consent_given, consent_at)
     values ($1,$2,$2,'Site',$3,'new',$4,true,now()) returning id`,
    [d.name, wa, d.message ?? "", today()],
  );
  void r;
  return { ok: true };
}

// ---------------------------------------------------------------- admin
const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
});

export async function listLeads(q: Queryable, query: unknown): Promise<Page<LeadDto> & { counts: Record<string, number> }> {
  const f = parse(listSchema, query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) (params.push(f.status), where.push(`status = $${params.length}`));
  if (f.q) {
    params.push(likeTerm(f.q));
    const n = params.length;
    where.push(`(full_name ilike $${n} or coalesce(phone,'') ilike $${n} or coalesce(whatsapp,'') ilike $${n} or interest ilike $${n})`);
  }
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await q.query<{ n: number }>(`select count(*)::int as n from leads ${w}`, params)).rows[0].n;
  const rows = await q.query(`select * from leads ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`, params);
  const counts = await q.query<{ status: string; n: number }>("select status, count(*)::int as n from leads group by status");
  const c: Record<string, number> = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0]));
  for (const r of counts.rows) c[r.status] = r.n;
  return { items: rows.rows.map((r) => leadDto(r)), total, page: f.page, pageSize: f.pageSize, counts: c };
}

export async function getLead(q: Queryable, id: string): Promise<LeadDto> {
  const r = await q.query("select * from leads where id = $1", [id]);
  if (!r.rows[0]) throw notFound("Interessado");
  const notes = await q.query("select * from lead_notes where lead_id = $1 order by created_at desc", [id]);
  return leadDto(r.rows[0], notes.rows.map(noteDto));
}

const leadSchema = z.object({
  fullName: reqText(160),
  phone: phoneField,
  whatsapp: phoneField,
  firstContactOn: dateStr.optional(),
  source: text(80).default(""),
  interest: text(300).default(""),
  status: z.enum(LEAD_STATUSES).default("new"),
});

export async function createLead(q: Queryable, adminId: string, input: unknown): Promise<LeadDto> {
  const d = parse(leadSchema, input);
  const r = await q.query<{ id: string }>(
    `insert into leads (full_name, phone, whatsapp, source, interest, status, first_contact_on)
     values ($1,$2,$3,$4,$5,$6,$7) returning id`,
    [d.fullName, d.phone, d.whatsapp ? normalizeWhatsapp(d.whatsapp) : null, d.source, d.interest, d.status, d.firstContactOn ?? today()],
  );
  await audit(q, { adminId, action: "lead.create", entity: "lead", entityId: r.rows[0].id, summary: d.fullName });
  return getLead(q, r.rows[0].id);
}

export async function updateLead(q: Queryable, adminId: string, id: string, input: unknown): Promise<LeadDto> {
  const d = parse(leadSchema, input);
  const cur = (await q.query("select converted_client_id from leads where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Interessado");
  if (cur.converted_client_id && d.status !== "converted") d.status = "converted";
  await q.query(
    `update leads set full_name=$2, phone=$3, whatsapp=$4, source=$5, interest=$6, status=$7, first_contact_on=coalesce($8::date, first_contact_on) where id=$1`,
    [id, d.fullName, d.phone, d.whatsapp ? normalizeWhatsapp(d.whatsapp) : null, d.source, d.interest, d.status, d.firstContactOn ?? null],
  );
  await audit(q, { adminId, action: "lead.update", entity: "lead", entityId: id, summary: d.fullName });
  return getLead(q, id);
}

export async function setLeadStatus(q: Queryable, adminId: string, id: string, input: unknown): Promise<LeadDto> {
  const { status } = parse(z.object({ status: z.enum(LEAD_STATUSES) }), input);
  const cur = (await q.query("select full_name, converted_client_id from leads where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Interessado");
  if (cur.converted_client_id) throw conflict("Este interessado já foi convertido em cliente.");
  await q.query("update leads set status = $2 where id = $1", [id, status]);
  await audit(q, { adminId, action: "lead.status", entity: "lead", entityId: id, summary: `${cur.full_name} → ${status}` });
  return getLead(q, id);
}

export async function addLeadNote(q: Queryable, adminId: string, id: string, input: unknown): Promise<LeadDto> {
  const { body } = parse(z.object({ body: reqText(1000) }), input);
  if (!(await q.query("select 1 from leads where id = $1", [id])).rowCount) throw notFound("Interessado");
  await q.query("insert into lead_notes (lead_id, body, created_by) values ($1,$2,$3)", [id, body, adminId]);
  return getLead(q, id);
}

export async function deleteLead(q: Queryable, adminId: string, id: string): Promise<void> {
  const r = await q.query("delete from leads where id = $1 returning full_name", [id]);
  if (!r.rows[0]) throw notFound("Interessado");
  await audit(q, { adminId, action: "lead.delete", entity: "lead", entityId: id, summary: r.rows[0].full_name });
}

/** Converte o interessado em cliente reaproveitando os dados e vincula os dois cadastros. */
export async function convertLead(q: Queryable, adminId: string, id: string): Promise<{ lead: LeadDto; client: ClientDetail }> {
  const lead = (await q.query("select * from leads where id = $1", [id])).rows[0];
  if (!lead) throw notFound("Interessado");
  if (lead.converted_client_id) throw conflict("Este interessado já foi convertido em cliente.");
  const notes = await q.query("select body from lead_notes where lead_id = $1 order by created_at", [id]);
  const history = [lead.interest && `Interesse: ${lead.interest}`, ...notes.rows.map((n) => n.body)].filter(Boolean).join("\n");
  const client = await createClient(q, adminId, {
    fullName: lead.full_name,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    notes: history ? `Origem: interessado (${lead.source || "sem origem"}).\n${history}` : `Origem: interessado (${lead.source || "sem origem"}).`,
  });
  await q.query("update leads set status='converted', converted_client_id=$2 where id=$1", [id, client.id]);
  await audit(q, { adminId, action: "lead.convert", entity: "lead", entityId: id, summary: `${lead.full_name} convertido em cliente`, after: { clientId: client.id } });
  return { lead: await getLead(q, id), client };
}
