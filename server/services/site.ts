import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { badRequest, notFound } from "../lib/errors.js";
import { parse } from "../lib/validate.js";
import { LOCKED_SECTIONS, SECTION_KEYS, type SectionKey } from "../../shared/constants.js";
import {
  DEFAULT_PHOTO,
  DEFAULT_SECTIONS,
  DEFAULT_SETTINGS,
  type SectionContentMap,
  type SiteSettings,
} from "../../shared/site-content.js";
import { normalizeWhatsapp } from "../../shared/phone.js";
import type {
  AdminSection,
  PublicImage,
  PublicSection,
  PublicSettings,
  PublicSite,
} from "../../shared/types.js";
import { loadMedia } from "./media.js";
import { publicGallery } from "./posts.js";
import { publicPlans } from "./plans.js";
import { publicReviews } from "./reviews.js";

// ---------------------------------------------------------------- configurações
const s = (max = 300) => z.string().trim().max(max);
const optionalUrl = s(300).refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), "Informe um link começando com https://");
const mediaId = z.string().uuid().nullable();

export const settingsSchema = z.object({
  businessName: s(120).min(1),
  trainerName: s(120).min(1),
  whatsappNumber: s(30)
    .transform((v) => normalizeWhatsapp(v))
    .refine((v) => v.length >= 12 && v.length <= 13, "Número inválido. Informe DDI+DDD+número, ex.: 5585999999999."),
  contactEmail: s(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido."),
  instagramUrl: optionalUrl,
  facebookUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  tiktokUrl: optionalUrl,
  logoMediaId: mediaId,
  seoTitle: s(120),
  seoDescription: s(300),
  footerText: s(300),
  whatsappPlanMessage: s(400).min(1),
  whatsappGeneralMessage: s(400).min(1),
  renewalMessage: s(400).min(1),
  overdueMessage: s(400).min(1),
  expiringDays: z.number().int().min(1).max(60),
}) satisfies z.ZodType<SiteSettings, z.ZodTypeDef, unknown>;

export async function getSettings(q: Queryable): Promise<SiteSettings> {
  const r = await q.query<{ key: string; value: unknown }>("select key, value from site_settings where key not like '\\_%'");
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of r.rows) if (row.key in DEFAULT_SETTINGS) out[row.key] = row.value;
  return out as unknown as SiteSettings;
}

export async function updateSettings(q: Queryable, adminId: string, input: unknown): Promise<SiteSettings> {
  const before = await getSettings(q);
  const d = parse(settingsSchema, { ...before, ...(input as object) }) as SiteSettings;
  if (d.logoMediaId) await assertMedia(q, d.logoMediaId);
  for (const [key, value] of Object.entries(d)) {
    await q.query(
      `insert into site_settings (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)],
    );
  }
  await audit(q, { adminId, action: "settings.update", entity: "settings", summary: "Configurações atualizadas", before, after: d });
  return d;
}

async function assertMedia(q: Queryable, id: string, kind?: "image") {
  const r = await q.query<{ kind: string }>("select kind from media where id = $1", [id]);
  if (!r.rows[0]) throw badRequest("A mídia selecionada não existe mais.");
  if (kind && r.rows[0].kind !== kind) throw badRequest("Selecione uma imagem.");
}

// ---------------------------------------------------------------- seções
const item = z.object({ icon: s(40), title: s(120).min(1), text: s(400) });
const list = (max: number) => z.array(s(120).min(1)).max(max);

const sectionSchemas: { [K in SectionKey]: z.ZodType<SectionContentMap[K], z.ZodTypeDef, unknown> } = {
  hero: z.object({
    eyebrow: s(60),
    titleLine: s(80).min(1),
    titleAccent: s(80),
    subtitle: s(400),
    primaryCtaLabel: s(40).min(1),
    secondaryCtaLabel: s(40).min(1),
    highlights: list(4),
    imageMediaId: mediaId,
    imageAlt: s(200),
  }),
  about: z.object({
    eyebrow: s(60),
    title: s(100).min(1),
    role: s(100),
    bio: s(2000),
    experience: s(1500),
    methodology: s(1500),
    followUp: s(1000),
    highlights: list(6),
    imageMediaId: mediaId,
    imageAlt: s(200),
  }),
  how_it_works: z.object({ eyebrow: s(60), title: s(120).min(1), subtitle: s(300), steps: z.array(item).min(1).max(6) }),
  benefits: z.object({ eyebrow: s(60), title: s(120).min(1), subtitle: s(300), items: z.array(item).min(1).max(8) }),
  gallery: z.object({ eyebrow: s(60), title: s(120).min(1), subtitle: s(300) }),
  plans: z.object({ eyebrow: s(60), title: s(160).min(1), subtitle: s(300), footnote: s(300) }),
  reviews: z.object({
    eyebrow: s(60),
    title: s(120).min(1),
    subtitle: s(300),
    formTitle: s(160),
    formIntro: s(300),
  }),
  final_cta: z.object({
    title: s(120).min(1),
    text: s(400),
    buttonLabel: s(40).min(1),
    imageMediaId: mediaId,
    imageAlt: s(200),
  }),
};

function sectionDto(row: any): AdminSection {
  return {
    key: row.key,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    content: row.content,
    updatedAt: new Date(row.updated_at).toISOString(),
  } as AdminSection;
}

export async function listSections(q: Queryable): Promise<AdminSection[]> {
  const r = await q.query("select * from site_sections order by sort_order");
  const present = new Set(r.rows.map((x) => x.key));
  const rows = [...r.rows];
  // seções que ainda não existem no banco aparecem com o conteúdo padrão (e são criadas ao salvar)
  for (const [i, d] of DEFAULT_SECTIONS.entries()) {
    if (!present.has(d.key)) rows.push({ key: d.key, enabled: true, sort_order: (i + 1) * 10, content: d.content, updated_at: new Date() });
  }
  return rows.sort((a, b) => a.sort_order - b.sort_order).map(sectionDto);
}

const sectionUpdateSchema = z.object({ enabled: z.boolean().optional(), content: z.unknown().optional() });

export async function updateSection(q: Queryable, adminId: string, key: string, input: unknown): Promise<AdminSection> {
  if (!(SECTION_KEYS as readonly string[]).includes(key)) throw notFound("Seção");
  const k = key as SectionKey;
  const d = parse(sectionUpdateSchema, input);
  if (d.enabled === false && LOCKED_SECTIONS.includes(k)) throw badRequest("Esta seção não pode ser desativada.");
  const existing = (await q.query("select * from site_sections where key = $1", [k])).rows[0];
  const def = DEFAULT_SECTIONS.find((x) => x.key === k)!;
  const content = d.content === undefined ? (existing?.content ?? def.content) : parse(sectionSchemas[k], d.content);
  const mid = (content as { imageMediaId?: string | null }).imageMediaId;
  if (mid) await assertMedia(q, mid, "image");
  const order = existing?.sort_order ?? (SECTION_KEYS.indexOf(k) + 1) * 10;
  const r = await q.query(
    `insert into site_sections (key, enabled, sort_order, content) values ($1, $2, $3, $4::jsonb)
     on conflict (key) do update set enabled = excluded.enabled, content = excluded.content returning *`,
    [k, d.enabled ?? existing?.enabled ?? true, order, JSON.stringify(content)],
  );
  await audit(q, { adminId, action: "section.update", entity: "section", entityId: k, summary: `Seção ${k} atualizada`, before: existing?.content, after: content });
  return sectionDto(r.rows[0]);
}

export async function reorderSections(q: Queryable, adminId: string, input: unknown): Promise<AdminSection[]> {
  const { keys } = parse(z.object({ keys: z.array(z.enum(SECTION_KEYS)).min(1) }), input);
  // a seção hero é sempre a primeira
  const ordered = ["hero", ...keys.filter((k) => !LOCKED_SECTIONS.includes(k))];
  for (const [i, key] of ordered.entries()) {
    const def = DEFAULT_SECTIONS.find((x) => x.key === key)!;
    await q.query(
      `insert into site_sections (key, enabled, sort_order, content) values ($1, true, $2, $3::jsonb)
       on conflict (key) do update set sort_order = excluded.sort_order`,
      [key, (i + 1) * 10, JSON.stringify(def.content)],
    );
  }
  await audit(q, { adminId, action: "section.reorder", entity: "section", summary: "Ordem das seções alterada", after: ordered });
  return listSections(q);
}

// ---------------------------------------------------------------- payload público
export function toPublicSettings(s: SiteSettings, logoUrl: string | null): PublicSettings {
  return {
    businessName: s.businessName,
    trainerName: s.trainerName,
    whatsappNumber: s.whatsappNumber,
    contactEmail: s.contactEmail,
    instagramUrl: s.instagramUrl,
    facebookUrl: s.facebookUrl,
    youtubeUrl: s.youtubeUrl,
    tiktokUrl: s.tiktokUrl,
    seoTitle: s.seoTitle,
    seoDescription: s.seoDescription,
    footerText: s.footerText,
    whatsappPlanMessage: s.whatsappPlanMessage,
    whatsappGeneralMessage: s.whatsappGeneralMessage,
    logoUrl,
  };
}

export async function getPublicSite(q: Queryable): Promise<PublicSite> {
  const [settings, sectionsAll, planInfo, reviews] = await Promise.all([
    getSettings(q),
    listSections(q),
    publicPlans(q),
    publicReviews(q),
  ]);
  const sections = sectionsAll.filter((sec) => sec.enabled);
  const media = await loadMedia(q, [
    settings.logoMediaId,
    ...sections.map((sec) => (sec.content as { imageMediaId?: string | null }).imageMediaId),
  ]);
  const image = (id: string | null | undefined, alt: string, fallback: boolean): PublicImage | null => {
    const m = id ? media.get(id) : null;
    if (m && m.kind === "image") return { url: m.url, width: m.width, height: m.height, alt: m.altText || alt };
    return fallback ? { url: DEFAULT_PHOTO, width: 1018, height: 1280, alt } : null;
  };

  const gallery = await publicGallery(q, { offset: 0, limit: 6 });
  const publicSections = sections
    .filter((sec) => sec.key !== "gallery" || gallery.items.length > 0)
    .map((sec) => {
      const c = sec.content as { imageMediaId?: string | null; imageAlt?: string };
      const hasImageSlot = sec.key === "hero" || sec.key === "about" || sec.key === "final_cta";
      return {
        key: sec.key,
        content: sec.content,
        image: hasImageSlot ? image(c.imageMediaId, c.imageAlt ?? "", true) : null,
      } as PublicSection;
    });

  const logo = settings.logoMediaId ? media.get(settings.logoMediaId) : null;
  return {
    settings: toPublicSettings(settings, logo?.url ?? null),
    sections: publicSections,
    plans: planInfo.plans,
    activePromotion: planInfo.activePromotion,
    reviews,
    gallery,
  };
}
