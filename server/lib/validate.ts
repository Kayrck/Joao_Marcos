import { z } from "zod";
import { badRequest } from "./errors.js";

/** Mensagens de validação em português. */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") return { message: "Campo obrigatório." };
      return { message: "Valor em formato inválido." };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string")
        return { message: issue.minimum === 1 ? "Campo obrigatório." : `Use ao menos ${issue.minimum} caracteres.` };
      if (issue.type === "array") return { message: `Informe ao menos ${issue.minimum} item(ns).` };
      return { message: `O valor mínimo é ${issue.minimum}.` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Use no máximo ${issue.maximum} caracteres.` };
      if (issue.type === "array") return { message: `Informe no máximo ${issue.maximum} itens.` };
      return { message: `O valor máximo é ${issue.maximum}.` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Opção inválida." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "E-mail inválido." };
      if (issue.validation === "uuid") return { message: "Identificador inválido." };
      return { message: "Texto em formato inválido." };
  }
  return { message: ctx.defaultError };
});

export function parse<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest("Verifique os campos informados.", fields);
}

// ---- schemas reutilizáveis
export const uuid = z.string().uuid();
export const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .refine(
    (v) => !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
    "Data inválida.",
  );
export const cents = z.number().int("Valor inválido.").min(0, "O valor não pode ser negativo.").max(100_000_000);
export const positiveCents = cents.refine((v) => v > 0, "Informe um valor maior que zero.");
/** Texto livre: aparado, com limite. */
export const text = (max = 500) => z.string().trim().max(max);
export const reqText = (max = 200) => z.string().trim().min(1).max(max);
export const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
export const phoneField = z
  .string()
  .trim()
  .max(30)
  .nullish()
  .refine((v) => !v || v.replace(/\D/g, "").length >= 10, "Telefone inválido (inclua o DDD).")
  .transform((v) => (v ? v : null));
export const emailField = z
  .string()
  .trim()
  .max(200)
  .nullish()
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido.")
  .transform((v) => (v ? v.toLowerCase() : null));

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: Record<string, string | string[] | undefined>) {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(query)) flat[k] = Array.isArray(v) ? v[0] : v;
  // strings vazias viram undefined para que os defaults funcionem
  for (const k of Object.keys(flat)) if (flat[k] === "") delete flat[k];
  return parse(schema, flat);
}
