import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { AppError, badRequest, notFound } from "../lib/errors.js";
import { dateStr, parse, text } from "../lib/validate.js";
import { APPOINTMENT_KINDS, APPOINTMENT_STATUSES } from "../../shared/constants.js";
import { isoToLocalParts, localToIso, startOfLocalDay, startOfNextLocalDay } from "../../shared/dates.js";
import type { AppointmentDto } from "../../shared/types.js";

/**
 * AGENDA PRIVADA — estas funções só são alcançadas por rotas sob /api/admin (autenticadas).
 * Nada daqui é exposto no site público.
 */

export function appointmentDto(row: any): AppointmentDto {
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

const rangeSchema = z.object({ from: dateStr, to: dateStr });

/** Lista os compromissos de um intervalo de datas (inclusive), no fuso de Fortaleza. */
export async function listAppointments(q: Queryable, query: unknown): Promise<AppointmentDto[]> {
  const f = parse(rangeSchema, query);
  const r = await q.query(
    "select * from appointments where starts_at >= $1 and starts_at < $2 order by starts_at, ends_at",
    [startOfLocalDay(f.from), startOfNextLocalDay(f.to)],
  );
  return r.rows.map(appointmentDto);
}

const appointmentSchema = z
  .object({
    clientId: z.string().uuid().nullable().default(null),
    clientName: z.string().trim().max(160).default(""),
    kind: z.enum(APPOINTMENT_KINDS).default("aula"),
    title: text(160).default(""),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    notes: text(1000).default(""),
    status: z.enum(APPOINTMENT_STATUSES).default("scheduled"),
    /** Agenda mesmo havendo conflito de horário (ex.: aula em dupla). */
    force: z.boolean().default(false),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { message: "O horário final deve ser depois do inicial.", path: ["endsAt"] })
  .refine((v) => new Date(v.endsAt).getTime() - new Date(v.startsAt).getTime() <= 12 * 3600_000, {
    message: "Duração máxima de 12 horas.",
    path: ["endsAt"],
  });

/** Compromissos que se sobrepõem ao intervalo (ignora cancelados e faltas). */
export async function findConflicts(q: Queryable, startsAt: string, endsAt: string, excludeId?: string): Promise<AppointmentDto[]> {
  const r = await q.query(
    `select * from appointments
      where status in ('scheduled','completed') and starts_at < $2 and ends_at > $1 and ($3::uuid is null or id <> $3::uuid)
      order by starts_at`,
    [startsAt, endsAt, excludeId ?? null],
  );
  return r.rows.map(appointmentDto);
}

async function resolveClientName(q: Queryable, d: { clientId: string | null; clientName: string }): Promise<string> {
  if (d.clientId) {
    const c = (await q.query("select full_name from clients where id = $1", [d.clientId])).rows[0];
    if (!c) throw notFound("Cliente");
    return d.clientName || c.full_name;
  }
  if (!d.clientName) throw badRequest("Informe o nome do cliente.", { clientName: "Campo obrigatório." });
  return d.clientName;
}

function conflictError(conflicts: AppointmentDto[]) {
  return new AppError(
    409,
    "schedule_conflict",
    `Conflito de horário com ${conflicts.map((c) => `${c.clientName} (${isoToLocalParts(c.startsAt).time}–${isoToLocalParts(c.endsAt).time})`).join(", ")}.`,
    undefined,
    { conflicts },
  );
}

export async function createAppointment(q: Queryable, adminId: string, input: unknown): Promise<AppointmentDto> {
  const d = parse(appointmentSchema, input);
  const name = await resolveClientName(q, d);
  if (!d.force && d.status !== "cancelled") {
    const conflicts = await findConflicts(q, d.startsAt, d.endsAt);
    if (conflicts.length) throw conflictError(conflicts);
  }
  const r = await q.query(
    `insert into appointments (client_id, client_name, kind, title, starts_at, ends_at, notes, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [d.clientId, name, d.kind, d.title, d.startsAt, d.endsAt, d.notes, d.status],
  );
  await audit(q, { adminId, action: "appointment.create", entity: "appointment", entityId: r.rows[0].id, summary: `${name} — ${d.startsAt}` });
  return appointmentDto(r.rows[0]);
}

export async function updateAppointment(q: Queryable, adminId: string, id: string, input: unknown): Promise<AppointmentDto> {
  const d = parse(appointmentSchema, input);
  if (!(await q.query("select 1 from appointments where id = $1", [id])).rowCount) throw notFound("Compromisso");
  const name = await resolveClientName(q, d);
  if (!d.force && d.status !== "cancelled" && d.status !== "no_show") {
    const conflicts = await findConflicts(q, d.startsAt, d.endsAt, id);
    if (conflicts.length) throw conflictError(conflicts);
  }
  const r = await q.query(
    `update appointments set client_id=$2, client_name=$3, kind=$4, title=$5, starts_at=$6, ends_at=$7, notes=$8, status=$9
      where id=$1 returning *`,
    [id, d.clientId, name, d.kind, d.title, d.startsAt, d.endsAt, d.notes, d.status],
  );
  await audit(q, { adminId, action: "appointment.update", entity: "appointment", entityId: id, summary: `${name} — ${d.startsAt}` });
  return appointmentDto(r.rows[0]);
}

const rescheduleSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  force: z.boolean().default(false),
});

export async function rescheduleAppointment(q: Queryable, adminId: string, id: string, input: unknown): Promise<AppointmentDto> {
  const d = parse(rescheduleSchema, input);
  if (new Date(d.endsAt) <= new Date(d.startsAt)) throw badRequest("O horário final deve ser depois do inicial.");
  const cur = (await q.query("select * from appointments where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Compromisso");
  if (!d.force) {
    const conflicts = await findConflicts(q, d.startsAt, d.endsAt, id);
    if (conflicts.length) throw conflictError(conflicts);
  }
  const r = await q.query("update appointments set starts_at=$2, ends_at=$3, status = case when status in ('cancelled','no_show') then 'scheduled' else status end where id=$1 returning *", [id, d.startsAt, d.endsAt]);
  await audit(q, {
    adminId,
    action: "appointment.reschedule",
    entity: "appointment",
    entityId: id,
    summary: `${cur.client_name} reagendado`,
    before: { startsAt: cur.starts_at, endsAt: cur.ends_at },
    after: { startsAt: d.startsAt, endsAt: d.endsAt },
  });
  return appointmentDto(r.rows[0]);
}

export async function setAppointmentStatus(q: Queryable, adminId: string, id: string, input: unknown): Promise<AppointmentDto> {
  const { status } = parse(z.object({ status: z.enum(APPOINTMENT_STATUSES) }), input);
  const r = await q.query("update appointments set status = $2 where id = $1 returning *", [id, status]);
  if (!r.rows[0]) throw notFound("Compromisso");
  await audit(q, { adminId, action: "appointment.status", entity: "appointment", entityId: id, summary: `${r.rows[0].client_name} → ${status}` });
  return appointmentDto(r.rows[0]);
}

export async function deleteAppointment(q: Queryable, adminId: string, id: string): Promise<void> {
  const r = await q.query("delete from appointments where id = $1 returning client_name", [id]);
  if (!r.rows[0]) throw notFound("Compromisso");
  await audit(q, { adminId, action: "appointment.delete", entity: "appointment", entityId: id, summary: r.rows[0].client_name });
}

const availabilitySchema = z.object({
  date: dateStr,
  duration: z.coerce.number().int().min(15).max(240).default(60),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).default("06:00"),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).default("21:00"),
  step: z.coerce.number().int().min(15).max(120).default(30),
});

/** Horários livres (início) em um dia, para uma duração. */
export async function availability(q: Queryable, query: unknown): Promise<{ date: string; busy: AppointmentDto[]; freeStarts: string[] }> {
  const f = parse(availabilitySchema, query);
  const busy = await listAppointments(q, { from: f.date, to: f.date });
  const active = busy.filter((a) => a.status === "scheduled" || a.status === "completed");
  const freeStarts: string[] = [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  for (let m = toMin(f.dayStart); m + f.duration <= toMin(f.dayEnd); m += f.step) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const s = new Date(localToIso(f.date, `${hh}:${mm}`));
    const e = new Date(s.getTime() + f.duration * 60_000);
    if (!active.some((a) => new Date(a.startsAt) < e && new Date(a.endsAt) > s)) freeStarts.push(`${hh}:${mm}`);
  }
  return { date: f.date, busy, freeStarts };
}
