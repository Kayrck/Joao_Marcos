import { TIMEZONE, TZ_OFFSET } from "./constants.js";

/** Funções puras de data. Todas as datas "de calendário" são strings YYYY-MM-DD no fuso America/Fortaleza. */

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data (YYYY-MM-DD) de um instante, no fuso de Fortaleza. */
export function toLocalDate(d: Date): string {
  return dateFmt.format(d);
}

export function todayLocal(now: Date = new Date()): string {
  return toLocalDate(now);
}

export function isDateString(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function fmt(y: number, m: number, d: number) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const { y, m, d } = parts(date);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Soma meses preservando o dia quando possível (31/01 + 1 mês = 28/02). */
export function addMonths(date: string, months: number): string {
  const { y, m, d } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return fmt(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/**
 * Último dia de acesso de um plano que começa em `startsOn` e dura `months` meses.
 * Ex.: início 16/11, 1 mês -> 15/12.
 */
export function subscriptionEnd(startsOn: string, months: number): string {
  return addDays(addMonths(startsOn, months), -1);
}

export function startOfMonth(date: string): string {
  const { y, m } = parts(date);
  return fmt(y, m, 1);
}

export function endOfMonth(date: string): string {
  const { y, m } = parts(date);
  return fmt(y, m, daysInMonth(y, m));
}

export function startOfWeek(date: string): string {
  const { y, m, d } = parts(date);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
  return addDays(date, -dow);
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** Instante (ISO UTC) do início do dia local. */
export function startOfLocalDay(date: string): string {
  return new Date(`${date}T00:00:00${TZ_OFFSET}`).toISOString();
}

/** Instante (ISO UTC) do início do dia SEGUINTE local (limite superior exclusivo). */
export function startOfNextLocalDay(date: string): string {
  return new Date(`${addDays(date, 1)}T00:00:00${TZ_OFFSET}`).toISOString();
}

/** Converte data+hora locais (ex.: "2026-12-31", "23:59") para ISO UTC. */
export function localToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00${TZ_OFFSET}`).toISOString();
}

/** Decompõe um instante em data e hora locais de Fortaleza. */
export function isoToLocalParts(iso: string | Date): { date: string; time: string } {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const date = toLocalDate(d);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { date, time };
}

export interface Period {
  from: string;
  to: string;
}

export type PeriodPreset =
  | "today"
  | "week"
  | "month"
  | "prev_month"
  | "year"
  | "custom";

export function periodFromPreset(preset: PeriodPreset, today: string = todayLocal()): Period {
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6) };
    }
    case "prev_month": {
      const prev = addMonths(startOfMonth(today), -1);
      return { from: prev, to: endOfMonth(prev) };
    }
    case "year": {
      const y = today.slice(0, 4);
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case "month":
    default:
      return { from: startOfMonth(today), to: endOfMonth(today) };
  }
}

/** Lista de meses (YYYY-MM) entre duas datas, inclusive. */
export function monthsInRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  while (cur <= end) {
    out.push(monthKey(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}
