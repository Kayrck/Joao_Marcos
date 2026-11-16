import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel, likeTerm } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { badRequest, conflict, notFound } from "../lib/errors.js";
import { parse, reqText, text } from "../lib/validate.js";
import { EXT_BY_MIME, getStorage, sniffMime, type StorageDriver } from "../storage/index.js";
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_VIDEO_MIME,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
} from "../../shared/constants.js";
import type { MediaDto, Page, UploadInit } from "../../shared/types.js";

// ---------------------------------------------------------------- vídeos externos
export interface ExternalVideo {
  provider: "youtube" | "vimeo";
  id: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

export function parseExternalVideo(raw: string): ExternalVideo | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const yt = (id: string | null | undefined): ExternalVideo | null =>
    id && /^[\w-]{11}$/.test(id)
      ? {
          provider: "youtube",
          id,
          url: `https://www.youtube.com/watch?v=${id}`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        }
      : null;
  if (host === "youtu.be") return yt(u.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = u.pathname.match(/^\/(embed|shorts|live|v)\/([\w-]{11})/);
    return m ? yt(m[2]) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^\/video)?\/(\d{6,12})(?:\/|$)/);
    if (m)
      return {
        provider: "vimeo",
        id: m[1],
        url: `https://vimeo.com/${m[1]}`,
        embedUrl: `https://player.vimeo.com/video/${m[1]}?dnt=1`,
        thumbnailUrl: null,
      };
  }
  return null;
}

// ---------------------------------------------------------------- DTO
interface MediaRow {
  id: string;
  kind: "image" | "video" | "external_video";
  storageKey: string | null;
  url: string;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  title: string;
  altText: string;
  category: string;
  externalProvider: string | null;
  externalId: string | null;
  thumbnailUrl: string | null;
  createdAt: Date | string;
}

export function toMediaDto(row: MediaRow, storage: StorageDriver): MediaDto {
  const stored = row.kind !== "external_video" && row.storageKey;
  const url = stored ? storage.publicUrl(row.storageKey!) : row.url;
  let embedUrl: string | null = null;
  if (row.kind === "external_video" && row.externalId) {
    embedUrl =
      row.externalProvider === "youtube"
        ? `https://www.youtube-nocookie.com/embed/${row.externalId}`
        : `https://player.vimeo.com/video/${row.externalId}?dnt=1`;
  }
  return {
    id: row.id,
    kind: row.kind,
    url,
    thumbnailUrl: row.kind === "image" ? url : row.thumbnailUrl,
    embedUrl,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    title: row.title,
    altText: row.altText,
    category: row.category,
    externalProvider: row.externalProvider,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

/** Carrega vários itens de mídia por id, retornando um Map. */
export async function loadMedia(q: Queryable, ids: (string | null | undefined)[]): Promise<Map<string, MediaDto>> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  const out = new Map<string, MediaDto>();
  if (!unique.length) return out;
  const storage = await getStorage();
  const r = await q.query("select * from media where id = any($1::uuid[])", [unique]);
  for (const row of r.rows) out.set(row.id, toMediaDto(camel(row), storage));
  return out;
}

// ---------------------------------------------------------------- upload (URL pré-assinada)
const initSchema = z.object({
  filename: reqText(200),
  contentType: z.string().trim().toLowerCase(),
  size: z.number().int().positive(),
});

export async function initUpload(input: unknown): Promise<UploadInit> {
  const d = parse(initSchema, input);
  const isImage = (ALLOWED_IMAGE_MIME as readonly string[]).includes(d.contentType);
  const isVideo = (ALLOWED_VIDEO_MIME as readonly string[]).includes(d.contentType);
  if (!isImage && !isVideo) {
    throw badRequest("Tipo de arquivo não permitido. Envie imagens (JPG, PNG, WebP, AVIF) ou vídeos (MP4, WebM, MOV).", {
      contentType: "Tipo não permitido.",
    });
  }
  const max = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (d.size > max) {
    throw badRequest(`Arquivo grande demais. Limite: ${Math.round(max / 1024 / 1024)} MB.`, { size: "Arquivo grande demais." });
  }
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT_BY_MIME[d.contentType]}`;
  const storage = await getStorage();
  return { key, upload: await storage.presignUpload(key, d.contentType, d.size) };
}

const confirmSchema = z.object({
  key: z.string().regex(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/, "Chave inválida."),
  title: text(160).default(""),
  altText: text(300).default(""),
  category: text(60).default("geral"),
  width: z.number().int().positive().max(20000).nullish(),
  height: z.number().int().positive().max(20000).nullish(),
});

export async function confirmUpload(q: Queryable, adminId: string, input: unknown): Promise<MediaDto> {
  const d = parse(confirmSchema, input);
  const storage = await getStorage();
  const info = await storage.head(d.key);
  if (!info) throw badRequest("O arquivo não foi encontrado no armazenamento. Tente enviar novamente.");

  const head = await storage.readHead(d.key, 32);
  const real = head ? sniffMime(head) : null;
  const ext = d.key.split(".").pop()!;
  const declared = Object.entries(EXT_BY_MIME).find(([, e]) => e === ext)?.[0];
  const isImage = !!real && (ALLOWED_IMAGE_MIME as readonly string[]).includes(real);
  const isVideo = !!real && (ALLOWED_VIDEO_MIME as readonly string[]).includes(real);
  const max = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const family = (m?: string | null) => m?.split("/")[0];
  if ((!isImage && !isVideo) || family(real) !== family(declared) || info.size > max) {
    await storage.remove(d.key).catch(() => undefined);
    throw badRequest("O arquivo enviado é inválido, está corrompido ou excede o limite permitido.");
  }

  const r = await q.query(
    `insert into media (kind, storage_key, url, mime_type, size_bytes, width, height, title, alt_text, category, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning *`,
    [
      isImage ? "image" : "video",
      d.key,
      storage.publicUrl(d.key),
      real,
      info.size,
      d.width ?? null,
      d.height ?? null,
      d.title,
      d.altText,
      d.category || "geral",
      adminId,
    ],
  );
  await audit(q, { adminId, action: "media.upload", entity: "media", entityId: r.rows[0].id, summary: d.title || d.key });
  return toMediaDto(camel(r.rows[0]), storage);
}

const externalSchema = z.object({
  url: z.string().trim().max(500),
  title: text(160).default(""),
  category: text(60).default("geral"),
});

export async function addExternalVideo(q: Queryable, adminId: string, input: unknown): Promise<MediaDto> {
  const d = parse(externalSchema, input);
  const ext = parseExternalVideo(d.url);
  if (!ext) throw badRequest("Informe um link válido do YouTube ou do Vimeo.", { url: "Link de vídeo não reconhecido." });
  const r = await q.query(
    `insert into media (kind, url, title, category, external_provider, external_id, thumbnail_url, created_by)
     values ('external_video', $1, $2, $3, $4, $5, $6, $7) returning *`,
    [ext.url, d.title, d.category || "geral", ext.provider, ext.id, ext.thumbnailUrl, adminId],
  );
  await audit(q, { adminId, action: "media.external", entity: "media", entityId: r.rows[0].id, summary: ext.url });
  return toMediaDto(camel(r.rows[0]), await getStorage());
}

// ---------------------------------------------------------------- consulta
const listSchema = z.object({
  kind: z.enum(["image", "video", "external_video"]).optional(),
  category: z.string().trim().max(60).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export async function listMedia(q: Queryable, query: unknown): Promise<Page<MediaDto>> {
  const f = parse(listSchema, query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.kind) {
    params.push(f.kind);
    where.push(`kind = $${params.length}`);
  }
  if (f.category) {
    params.push(f.category);
    where.push(`category = $${params.length}`);
  }
  if (f.q) {
    params.push(likeTerm(f.q));
    where.push(`(title ilike $${params.length} or alt_text ilike $${params.length})`);
  }
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await q.query<{ n: number }>(`select count(*)::int as n from media ${w}`, params)).rows[0].n;
  const rows = await q.query(
    `select * from media ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  const storage = await getStorage();
  return {
    items: rows.rows.map((r) => toMediaDto(camel(r), storage)),
    total,
    page: f.page,
    pageSize: f.pageSize,
  };
}

const updateSchema = z.object({
  title: text(160).optional(),
  altText: text(300).optional(),
  category: text(60).optional(),
});

export async function updateMedia(q: Queryable, adminId: string, id: string, input: unknown): Promise<MediaDto> {
  const d = parse(updateSchema, input);
  const r = await q.query(
    `update media set title = coalesce($2, title), alt_text = coalesce($3, alt_text), category = coalesce($4, category)
     where id = $1 returning *`,
    [id, d.title ?? null, d.altText ?? null, d.category ?? null],
  );
  if (!r.rows[0]) throw notFound("Mídia");
  await audit(q, { adminId, action: "media.update", entity: "media", entityId: id });
  return toMediaDto(camel(r.rows[0]), await getStorage());
}

/** Onde uma mídia está sendo usada (publicações, seções, configurações, avaliações). */
export async function mediaUsage(q: Queryable, id: string): Promise<number> {
  const r = await q.query<{ n: number }>(
    `select (
       (select count(*) from posts where cover_media_id = $1::uuid or body::text like '%' || $2 || '%') +
       (select count(*) from site_sections where content::text like '%' || $2 || '%') +
       (select count(*) from site_settings where value::text like '%' || $2 || '%') +
       (select count(*) from reviews where photo_media_id = $1::uuid)
     )::int as n`,
    [id, id],
  );
  return r.rows[0].n;
}

export async function deleteMedia(q: Queryable, adminId: string, id: string): Promise<void> {
  const row = (await q.query("select * from media where id = $1", [id])).rows[0];
  if (!row) throw notFound("Mídia");
  const used = await mediaUsage(q, id);
  if (used > 0) {
    throw conflict("Esta mídia está em uso (publicação, seção do site ou avaliação). Remova-a de lá antes de excluir.", {
      usedIn: used,
    });
  }
  await q.query("delete from media where id = $1", [id]);
  if (row.storage_key) {
    const storage = await getStorage();
    await storage.remove(row.storage_key).catch(() => undefined);
  }
  await audit(q, { adminId, action: "media.delete", entity: "media", entityId: id, summary: row.title || row.storage_key });
}
