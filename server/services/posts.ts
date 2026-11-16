import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel, likeTerm } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { now } from "../lib/clock.js";
import { badRequest, notFound } from "../lib/errors.js";
import { parse, reqText, text } from "../lib/validate.js";
import { POST_CATEGORIES, POST_STATUSES, type PostCategory } from "../../shared/constants.js";
import type {
  Page,
  PostBlock,
  PostDto,
  PublicImage,
  PublicPostCard,
  PublicPostDetail,
} from "../../shared/types.js";
import { loadMedia } from "./media.js";

const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string().trim().min(1).max(5000) }),
  z.object({ type: z.literal("image"), mediaId: z.string().uuid(), caption: text(300).optional() }),
  z.object({ type: z.literal("video"), mediaId: z.string().uuid(), caption: text(300).optional() }),
]);

const postSchema = z.object({
  title: reqText(160),
  summary: text(300).default(""),
  category: z.enum(POST_CATEGORIES),
  body: z.array(blockSchema).max(60).default([]),
  coverMediaId: z.string().uuid().nullable().default(null),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  authorizationConfirmed: z.boolean().default(false),
  /** Data/hora de publicação (ISO). Futuro = publicação agendada. */
  publishedAt: z.string().datetime({ offset: true }).nullable().default(null),
});

function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "publicacao"
  );
}

async function uniqueSlug(q: Queryable, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  for (let i = 2; (await q.query("select 1 from posts where slug = $1", [slug])).rowCount > 0; i++) slug = `${base}-${i}`;
  return slug;
}

async function assertMediaIds(q: Queryable, body: PostBlock[], cover: string | null) {
  const ids = [cover, ...body.map((b) => (b.type === "text" ? null : b.mediaId))].filter((v): v is string => !!v);
  const found = await loadMedia(q, ids);
  for (const id of ids) if (!found.has(id)) throw badRequest("Uma das mídias selecionadas não existe mais.");
  for (const b of body) {
    const m = b.type === "text" ? null : found.get(b.mediaId);
    if (b.type === "image" && m?.kind !== "image") throw badRequest("Um bloco de imagem aponta para um arquivo que não é imagem.");
    if (b.type === "video" && m?.kind === "image") throw badRequest("Um bloco de vídeo aponta para uma imagem.");
  }
}

// ---------------------------------------------------------------- admin
function visibility(row: { status: string; published_at: Date | null }): PostDto["visibility"] {
  if (row.status !== "published") return "draft";
  return row.published_at && new Date(row.published_at) > now() ? "scheduled" : "published";
}

async function toDtos(q: Queryable, rows: any[]): Promise<PostDto[]> {
  const media = await loadMedia(q, rows.map((r) => r.cover_media_id));
  return rows.map((row) => {
    const r = camel(row);
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      summary: r.summary,
      category: r.category,
      body: r.body,
      coverMediaId: r.coverMediaId,
      coverUrl: r.coverMediaId ? (media.get(r.coverMediaId)?.thumbnailUrl ?? null) : null,
      status: r.status,
      visibility: visibility(row),
      publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : null,
      sortOrder: r.sortOrder,
      isFeatured: r.isFeatured,
      authorizationConfirmed: r.authorizationConfirmed,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  });
}

const listSchema = z.object({
  status: z.enum(POST_STATUSES).optional(),
  category: z.enum(POST_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listPosts(q: Queryable, query: unknown): Promise<Page<PostDto>> {
  const f = parse(listSchema, query);
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.status) (params.push(f.status), where.push(`status = $${params.length}`));
  if (f.category) (params.push(f.category), where.push(`category = $${params.length}`));
  if (f.q) (params.push(likeTerm(f.q)), where.push(`title ilike $${params.length}`));
  const w = where.length ? `where ${where.join(" and ")}` : "";
  const total = (await q.query<{ n: number }>(`select count(*)::int as n from posts ${w}`, params)).rows[0].n;
  const rows = await q.query(
    `select * from posts ${w} order by sort_order, coalesce(published_at, created_at) desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  return { items: await toDtos(q, rows.rows), total, page: f.page, pageSize: f.pageSize };
}

export async function getPost(q: Queryable, id: string): Promise<PostDto> {
  const r = await q.query("select * from posts where id = $1", [id]);
  if (!r.rows[0]) throw notFound("Publicação");
  return (await toDtos(q, r.rows))[0];
}

export async function createPost(q: Queryable, adminId: string, input: unknown): Promise<PostDto> {
  const d = parse(postSchema, input);
  await assertMediaIds(q, d.body, d.coverMediaId);
  const slug = await uniqueSlug(q, d.title);
  const r = await q.query(
    `insert into posts (title, slug, summary, category, body, cover_media_id, is_featured, sort_order, authorization_confirmed, published_at, created_by)
     values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11) returning *`,
    [d.title, slug, d.summary, d.category, JSON.stringify(d.body), d.coverMediaId, d.isFeatured, d.sortOrder, d.authorizationConfirmed, d.publishedAt, adminId],
  );
  await audit(q, { adminId, action: "post.create", entity: "post", entityId: r.rows[0].id, summary: d.title });
  return (await toDtos(q, r.rows))[0];
}

export async function updatePost(q: Queryable, adminId: string, id: string, input: unknown): Promise<PostDto> {
  const d = parse(postSchema, input);
  const cur = (await q.query("select * from posts where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Publicação");
  await assertMediaIds(q, d.body, d.coverMediaId);
  if (cur.status === "published") assertPublishable(d);
  const r = await q.query(
    `update posts set title=$2, summary=$3, category=$4, body=$5::jsonb, cover_media_id=$6, is_featured=$7,
            sort_order=$8, authorization_confirmed=$9, published_at = case when status = 'published' then coalesce($10::timestamptz, published_at) else $10::timestamptz end
      where id=$1 returning *`,
    [id, d.title, d.summary, d.category, JSON.stringify(d.body), d.coverMediaId, d.isFeatured, d.sortOrder, d.authorizationConfirmed, d.publishedAt],
  );
  await audit(q, { adminId, action: "post.update", entity: "post", entityId: id, summary: d.title });
  return (await toDtos(q, r.rows))[0];
}

function assertPublishable(d: { title: string; body: PostBlock[]; coverMediaId: string | null; category: PostCategory; authorizationConfirmed: boolean }) {
  if (!d.body.length && !d.coverMediaId) throw badRequest("Adicione ao menos um texto, imagem ou vídeo antes de publicar.");
  if (d.category === "resultados" && !d.authorizationConfirmed) {
    throw badRequest("Confirme que o aluno autorizou a divulgação do resultado antes de publicar.", {
      authorizationConfirmed: "Confirme a autorização.",
    });
  }
}

export async function setPublished(q: Queryable, adminId: string, id: string, published: boolean, publishedAt?: string | null): Promise<PostDto> {
  const cur = (await q.query("select * from posts where id = $1", [id])).rows[0];
  if (!cur) throw notFound("Publicação");
  if (published) {
    assertPublishable({
      title: cur.title,
      body: cur.body,
      coverMediaId: cur.cover_media_id,
      category: cur.category,
      authorizationConfirmed: cur.authorization_confirmed,
    });
    const at = publishedAt ?? (cur.published_at ? new Date(cur.published_at).toISOString() : now().toISOString());
    // ao publicar "agora" de novo um rascunho antigo, usa o instante atual
    const effective = publishedAt === undefined && cur.status !== "published" ? now().toISOString() : at;
    await q.query("update posts set status='published', published_at=$2 where id=$1", [id, effective]);
  } else {
    await q.query("update posts set status='draft' where id=$1", [id]);
  }
  await audit(q, { adminId, action: published ? "post.publish" : "post.unpublish", entity: "post", entityId: id, summary: cur.title });
  return getPost(q, id);
}

export async function deletePost(q: Queryable, adminId: string, id: string): Promise<void> {
  const r = await q.query("delete from posts where id = $1 returning title", [id]);
  if (!r.rows[0]) throw notFound("Publicação");
  await audit(q, { adminId, action: "post.delete", entity: "post", entityId: id, summary: r.rows[0].title });
}

// ---------------------------------------------------------------- público
const PUBLIC_FILTER = `p.status = 'published' and p.published_at <= $1 and (p.category <> 'resultados' or p.authorization_confirmed)`;

function firstMediaId(row: { cover_media_id: string | null; body: PostBlock[] }): string | null {
  if (row.cover_media_id) return row.cover_media_id;
  const b = (row.body ?? []).find((x) => x.type !== "text") as { mediaId: string } | undefined;
  return b?.mediaId ?? null;
}

async function toCards(q: Queryable, rows: any[]): Promise<PublicPostCard[]> {
  const media = await loadMedia(q, rows.map(firstMediaId));
  return rows.map((r) => {
    const m = media.get(firstMediaId(r) ?? "");
    let cover: PublicImage | null = null;
    if (m?.thumbnailUrl) cover = { url: m.thumbnailUrl, width: m.width, height: m.height, alt: m.altText || r.title };
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      category: r.category,
      publishedAt: new Date(r.published_at).toISOString(),
      isFeatured: r.is_featured,
      cover,
      hasVideo: (r.body ?? []).some((b: PostBlock) => b.type === "video"),
    };
  });
}

export async function publicGallery(
  q: Queryable,
  opts: { offset: number; limit: number; category?: PostCategory },
): Promise<{ items: PublicPostCard[]; nextCursor: string | null; categories: { value: PostCategory; count: number }[] }> {
  const at = now().toISOString();
  const params: unknown[] = [at];
  let extra = "";
  if (opts.category) {
    params.push(opts.category);
    extra = ` and p.category = $${params.length}`;
  }
  const rows = await q.query(
    `select p.* from posts p where ${PUBLIC_FILTER}${extra}
      order by p.is_featured desc, p.sort_order asc, p.published_at desc, p.id
      limit ${opts.limit + 1} offset ${opts.offset}`,
    params,
  );
  const hasMore = rows.rows.length > opts.limit;
  const cats = await q.query<{ category: PostCategory; n: number }>(
    `select p.category, count(*)::int as n from posts p where ${PUBLIC_FILTER} group by p.category order by n desc`,
    [at],
  );
  return {
    items: await toCards(q, rows.rows.slice(0, opts.limit)),
    nextCursor: hasMore ? String(opts.offset + opts.limit) : null,
    categories: cats.rows.map((c) => ({ value: c.category, count: c.n })),
  };
}

async function buildDetail(q: Queryable, row: any): Promise<PublicPostDetail> {
  const [card] = await toCards(q, [row]);
  const blocks = (row.body ?? []) as PostBlock[];
  const media = await loadMedia(q, blocks.map((b) => (b.type === "text" ? null : b.mediaId)));
  const out: PublicPostDetail["blocks"] = [];
  for (const b of blocks) {
    if (b.type === "text") {
      out.push(b);
      continue;
    }
    const m = media.get(b.mediaId);
    if (!m) continue;
    out.push({
      type: b.type,
      caption: b.caption,
      media: {
        id: m.id,
        kind: m.kind,
        url: m.url,
        embedUrl: m.embedUrl,
        thumbnailUrl: m.thumbnailUrl,
        width: m.width,
        height: m.height,
        alt: m.altText || b.caption || row.title,
      },
    } as PublicPostDetail["blocks"][number]);
  }
  return { ...card, blocks: out };
}

export async function publicPost(q: Queryable, slug: string): Promise<PublicPostDetail> {
  const r = await q.query(`select p.* from posts p where ${PUBLIC_FILTER} and p.slug = $2`, [now().toISOString(), slug]);
  if (!r.rows[0]) throw notFound("Publicação");
  return buildDetail(q, r.rows[0]);
}

/** Pré-visualização para o administrador: renderiza como o público veria, mesmo sendo rascunho. */
export async function previewPost(q: Queryable, id: string): Promise<PublicPostDetail> {
  const r = await q.query("select * from posts where id = $1", [id]);
  if (!r.rows[0]) throw notFound("Publicação");
  const row = { ...r.rows[0], published_at: r.rows[0].published_at ?? now() };
  return buildDetail(q, row);
}
