import { z } from "zod";
import type { Queryable } from "../db/index.js";
import { camel } from "../db/index.js";
import { audit } from "../lib/audit.js";
import { today } from "../lib/clock.js";
import { notFound } from "../lib/errors.js";
import { rateLimit } from "../lib/rate-limit.js";
import { hashIp } from "../lib/security.js";
import { parse, reqText } from "../lib/validate.js";
import { REVIEW_STATUSES } from "../../shared/constants.js";
import type { AuditEntryDto, Page, PublicReview, ReviewDto } from "../../shared/types.js";
import { loadMedia } from "./media.js";

// ---------------------------------------------------------------- público
const submitSchema = z.object({
  name: reqText(80),
  rating: z.number().int().min(1, "Escolha de 1 a 5 estrelas.").max(5, "Escolha de 1 a 5 estrelas."),
  body: z.string().trim().min(10, "Conte um pouco mais (mínimo de 10 caracteres).").max(1000),
  consent: z.literal(true, { errorMap: () => ({ message: "É necessário autorizar a publicação para enviar." }) }),
  /** Campo-isca (honeypot): pessoas não o veem; robôs o preenchem. */
  website: z.string().max(200).optional(),
});

/** Recebe uma avaliação pública. Sempre entra como PENDENTE; nunca é publicada automaticamente. */
export async function submitReview(q: Queryable, ip: string, input: unknown): Promise<{ ok: true }> {
  const d = parse(submitSchema, input);
  if (d.website) return { ok: true }; // robô: finge sucesso sem gravar
  const ipHash = hashIp(ip);
  await rateLimit(q, `review:ip:${ipHash}`, 3, 3600, "Você já enviou avaliações recentemente. Tente novamente mais tarde.");
  await rateLimit(q, "review:global", 60, 3600, "Estamos recebendo muitas avaliações agora. Tente novamente em instantes.");
  await q.query(
    `insert into reviews (author_name, rating, body, consent_publish, display_date, ip_hash)
     values ($1, $2, $3, true, $4, $5)`,
    [d.name, d.rating, d.body, today(), ipHash],
  );
  return { ok: true };
}

export async function publicReviews(q: Queryable): Promise<{ items: PublicReview[]; count: number; average: number | null }> {
  const [list, agg] = await Promise.all([
    q.query(
      `select id, author_name, rating, body, display_date, photo_media_id from reviews
        where status = 'approved' order by display_date desc, created_at desc limit 12`,
    ),
    q.query<{ n: number; avg: number | null }>(
      "select count(*)::int as n, avg(rating)::float as avg from reviews where status = 'approved'",
    ),
  ]);
  const media = await loadMedia(q, list.rows.map((r) => r.photo_media_id));
  const avg = agg.rows[0].avg;
  return {
    items: list.rows.map((r) => ({
      id: r.id,
      authorName: r.author_name,
      rating: r.rating,
      body: r.body,
      displayDate: r.display_date,
      photoUrl: r.photo_media_id ? (media.get(r.photo_media_id)?.thumbnailUrl ?? null) : null,
    })),
    count: agg.rows[0].n,
    average: avg === null ? null : Math.round(avg * 10) / 10,
  };
}

// ---------------------------------------------------------------- admin
async function toDtos(q: Queryable, rows: any[]): Promise<ReviewDto[]> {
  const media = await loadMedia(q, rows.map((r) => r.photo_media_id));
  return rows.map((row) => {
    const r = camel(row);
    return {
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      body: r.body,
      status: r.status,
      displayDate: r.displayDate,
      photoMediaId: r.photoMediaId,
      photoUrl: r.photoMediaId ? (media.get(r.photoMediaId)?.thumbnailUrl ?? null) : null,
      rejectionNote: r.rejectionNote,
      moderatedAt: r.moderatedAt ? new Date(r.moderatedAt).toISOString() : null,
      createdAt: new Date(r.createdAt).toISOString(),
      updatedAt: new Date(r.updatedAt).toISOString(),
    };
  });
}

const listSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export async function listReviews(q: Queryable, query: unknown): Promise<Page<ReviewDto> & { counts: Record<string, number> }> {
  const f = parse(listSchema, query);
  const params: unknown[] = [];
  let w = "";
  if (f.status) {
    params.push(f.status);
    w = "where status = $1";
  }
  const total = (await q.query<{ n: number }>(`select count(*)::int as n from reviews ${w}`, params)).rows[0].n;
  const rows = await q.query(
    `select * from reviews ${w} order by created_at desc limit ${f.pageSize} offset ${(f.page - 1) * f.pageSize}`,
    params,
  );
  const counts = await q.query<{ status: string; n: number }>("select status, count(*)::int as n from reviews group by status");
  const c: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of counts.rows) c[r.status] = r.n;
  return { items: await toDtos(q, rows.rows), total, page: f.page, pageSize: f.pageSize, counts: c };
}

export async function pendingReviewsCount(q: Queryable): Promise<number> {
  return (await q.query<{ n: number }>("select count(*)::int as n from reviews where status = 'pending'")).rows[0].n;
}

async function mustGet(q: Queryable, id: string) {
  const r = await q.query("select * from reviews where id = $1", [id]);
  if (!r.rows[0]) throw notFound("Avaliação");
  return r.rows[0];
}

export async function moderateReview(
  q: Queryable,
  adminId: string,
  id: string,
  status: "approved" | "rejected" | "pending",
  note?: string | null,
): Promise<ReviewDto> {
  const before = await mustGet(q, id);
  const r = await q.query(
    `update reviews set status = $2, moderated_at = case when $2 = 'pending' then null else now() end,
            moderated_by = case when $2 = 'pending' then null else $3::uuid end,
            rejection_note = case when $2 = 'rejected' then $4 else null end
      where id = $1 returning *`,
    [id, status, adminId, note ?? null],
  );
  await audit(q, {
    adminId,
    action: `review.${status}`,
    entity: "review",
    entityId: id,
    summary: `${before.author_name}: ${before.status} → ${status}`,
  });
  return (await toDtos(q, r.rows))[0];
}

const editSchema = z.object({
  authorName: reqText(80),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(1).max(1000),
  displayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  photoMediaId: z.string().uuid().nullable().default(null),
});

export async function editReview(q: Queryable, adminId: string, id: string, input: unknown): Promise<ReviewDto> {
  const d = parse(editSchema, input);
  const before = await mustGet(q, id);
  const r = await q.query(
    "update reviews set author_name=$2, rating=$3, body=$4, display_date=$5, photo_media_id=$6 where id=$1 returning *",
    [id, d.authorName, d.rating, d.body, d.displayDate, d.photoMediaId],
  );
  await audit(q, {
    adminId,
    action: "review.edit",
    entity: "review",
    entityId: id,
    summary: `Avaliação de ${before.author_name} editada`,
    before: { authorName: before.author_name, rating: before.rating, body: before.body },
    after: { authorName: d.authorName, rating: d.rating, body: d.body },
  });
  return (await toDtos(q, r.rows))[0];
}

export async function deleteReview(q: Queryable, adminId: string, id: string): Promise<void> {
  const before = await mustGet(q, id);
  await q.query("delete from reviews where id = $1", [id]);
  await audit(q, { adminId, action: "review.delete", entity: "review", entityId: id, summary: `Avaliação de ${before.author_name} excluída` });
}

export async function reviewHistory(q: Queryable, id: string): Promise<AuditEntryDto[]> {
  const r = await q.query(
    `select a.id, a.action, a.summary, a.created_at, ad.name as admin_name
       from audit_logs a left join administrators ad on ad.id = a.admin_id
      where a.entity = 'review' and a.entity_id = $1 order by a.created_at desc, a.id desc`,
    [id],
  );
  return r.rows.map((x) => ({
    id: x.id,
    action: x.action,
    summary: x.summary,
    createdAt: new Date(x.created_at).toISOString(),
    adminName: x.admin_name,
  }));
}
