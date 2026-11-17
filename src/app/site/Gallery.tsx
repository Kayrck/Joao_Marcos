import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { api, qs } from "../../lib/api";
import { POST_CATEGORY_LABELS, type PostCategory } from "../../../shared/constants";
import type { PublicBlockMedia, PublicPostCard, PublicPostDetail, PublicSite } from "../../../shared/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../components/ui/dialog";
import { SectionHeading, getSection } from "./common";

type Page = PublicSite["gallery"];

function Cover({ post }: { post: PublicPostCard }) {
  return post.cover ? (
    <img
      src={post.cover.url}
      alt={post.cover.alt}
      loading="lazy"
      decoding="async"
      width={post.cover.width ?? 480}
      height={post.cover.height ?? 640}
      className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  ) : (
    <div className="absolute inset-0 grid place-items-center bg-ink text-ink-muted">
      <ImageIcon size={36} aria-hidden />
    </div>
  );
}

function VideoBlock({ media, title }: { media: PublicBlockMedia; title: string }) {
  const [play, setPlay] = useState(false);
  if (media.kind === "external_video" && media.embedUrl) {
    // o player externo só é carregado após o clique (performance e privacidade)
    return play ? (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          src={`${media.embedUrl}${media.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
          title={title}
          className="size-full"
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    ) : (
      <button type="button" onClick={() => setPlay(true)} className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-ink" aria-label={`Reproduzir vídeo: ${title}`}>
        {media.thumbnailUrl && <img src={media.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover opacity-90" />}
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110">
            <Play size={28} className="ml-1 fill-current" aria-hidden />
          </span>
        </span>
      </button>
    );
  }
  return <video src={media.url} controls preload="metadata" playsInline className="aspect-video w-full rounded-xl bg-black" aria-label={title} />;
}

export function PostBlocks({ blocks, title }: { blocks: PublicPostDetail["blocks"]; title: string }) {
  return (
    <>
      {blocks.map((b, i) =>
        b.type === "text" ? (
          <p key={i} className="whitespace-pre-line text-lg leading-relaxed">
            {b.text}
          </p>
        ) : (
          <figure key={i}>
            {b.type === "video" ? (
              <VideoBlock media={b.media} title={b.caption || title} />
            ) : (
              <img src={b.media.url} alt={b.media.alt} loading="lazy" decoding="async" width={b.media.width ?? undefined} height={b.media.height ?? undefined} className="w-full rounded-xl object-contain" />
            )}
            {b.caption && <figcaption className="mt-2 text-sm text-muted-foreground">{b.caption}</figcaption>}
          </figure>
        ),
      )}
    </>
  );
}

function PostDialog({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const q = useQuery({ queryKey: ["public-post", slug], queryFn: () => api.get<PublicPostDetail>(`/api/public/posts/${slug}`), enabled: !!slug });
  const post = q.data;
  return (
    <Dialog open={!!slug} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <div className="p-5 pb-3 sm:p-8 sm:pb-4">
          <p className="eyebrow">{post ? POST_CATEGORY_LABELS[post.category] : "Conteúdo"}</p>
          <DialogTitle className="h-display mt-2 pr-8 text-4xl">{post?.title ?? "Carregando…"}</DialogTitle>
          <DialogDescription className={post?.summary ? "mt-3 text-base text-muted-foreground" : "sr-only"}>{post?.summary || "Detalhes da publicação"}</DialogDescription>
        </div>
        <div className="space-y-5 px-5 pb-8 sm:px-8">
          {q.isLoading && <div className="skeleton aspect-video w-full" />}
          {q.isError && <p className="text-destructive">Não foi possível carregar esta publicação.</p>}
          {post && <PostBlocks blocks={post.blocks} title={post.title} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Gallery({ site }: { site: PublicSite }) {
  const s = getSection(site, "gallery");
  const [cat, setCat] = useState<PostCategory | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const q = useInfiniteQuery({
    queryKey: ["gallery", cat],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => api.get<Page>(`/api/public/posts${qs({ category: cat, cursor: pageParam, limit: 6 })}`),
    getNextPageParam: (last) => (last.nextCursor ? Number(last.nextCursor) : undefined),
    initialData: cat === null ? { pages: [site.gallery], pageParams: [0] } : undefined,
    staleTime: 30_000,
  });
  if (!s) return null;
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const cats = site.gallery.categories;

  return (
    <section id="galeria" className="bg-surface py-16 sm:py-24">
      <div className="container-x">
        <SectionHeading eyebrow={s.content.eyebrow} title={s.content.title} subtitle={s.content.subtitle} />

        {cats.length > 1 && (
          <div className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categorias">
            {[{ value: null, label: "Tudo" }, ...cats.map((c) => ({ value: c.value as PostCategory | null, label: POST_CATEGORY_LABELS[c.value] }))].map((c) => (
              <button
                key={c.label}
                type="button"
                role="tab"
                aria-selected={cat === c.value}
                onClick={() => setCat(c.value)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${cat === c.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40"}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p.slug)} className="group relative block aspect-[3/4] w-full overflow-hidden rounded-2xl border border-border bg-card text-left">
                <Cover post={p} />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                {p.hasVideo && (
                  <span className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                    <Play size={16} className="ml-0.5 fill-current" aria-label="Contém vídeo" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                  <span className="text-[0.7rem] font-bold uppercase tracking-wider text-[#ffb3b5]">{POST_CATEGORY_LABELS[p.category]}</span>
                  <span className="mt-0.5 block font-display text-xl font-bold uppercase leading-tight sm:text-2xl">{p.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {q.isFetching && !q.isFetchingNextPage && items.length === 0 && <p className="mt-8 text-center text-muted-foreground">Carregando…</p>}
        {!q.isFetching && items.length === 0 && <p className="mt-8 text-center text-muted-foreground">Nenhum conteúdo nesta categoria ainda.</p>}
        {q.hasNextPage && (
          <div className="mt-8 text-center">
            <button type="button" className="btn btn-outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
              {q.isFetchingNextPage ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
              Carregar mais
            </button>
          </div>
        )}
      </div>
      <PostDialog slug={open} onClose={() => setOpen(null)} />
    </section>
  );
}
