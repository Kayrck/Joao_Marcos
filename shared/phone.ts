/** Utilitários de telefone/WhatsApp (puros, usados na API e na interface). */

export function digitsOnly(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

/**
 * Normaliza para o formato internacional usado pelo wa.me (somente dígitos, com DDI 55).
 * Aceita "(85) 99999-9999", "85999999999", "+55 85 99999-9999" etc.
 */
export function normalizeWhatsapp(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function isPlausiblePhone(input: string | null | undefined): boolean {
  const d = digitsOnly(input);
  return d.length >= 10 && d.length <= 13;
}

export function whatsappUrl(number: string | null | undefined, message?: string): string {
  const n = normalizeWhatsapp(number);
  const base = `https://wa.me/${n}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** Formata para exibição: (85) 99999-9999. */
export function formatPhone(input: string | null | undefined): string {
  const d = digitsOnly(input);
  if (!d) return "";
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return input ?? d;
}
