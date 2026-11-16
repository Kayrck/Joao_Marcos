/** Formatação pt-BR (pura; usada na API para CSV/mensagens e na interface). */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number | null | undefined): string {
  return brl.format((cents ?? 0) / 100);
}

/** "1234,56" (sem símbolo) — usado em CSV. */
export function centsToDecimal(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

/** "1.234,56" | "R$ 12,5" | "12" -> centavos. Retorna null se inválido. */
export function parseMoneyToCents(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (!input) return null;
  const clean = input.replace(/[R$\s]/g, "");
  if (!clean) return null;
  let normalized = clean;
  if (clean.includes(",")) normalized = clean.replace(/\./g, "").replace(",", ".");
  else if ((clean.match(/\./g) ?? []).length > 1) normalized = clean.replace(/\./g, "");
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** 2026-12-31 -> 31/12/2026 */
export function formatDateBR(date: string | null | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonthBR(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

/** Substitui {chave} por valores. Chaves desconhecidas permanecem como estão. */
export function fillTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export function planMessage(template: string, planName: string): string {
  return fillTemplate(template, { plano: planName.toLowerCase() });
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}
