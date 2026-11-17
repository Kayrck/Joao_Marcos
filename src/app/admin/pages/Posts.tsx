import { ArrowDown, ArrowUp, Eye, FileText, Film, ImageIcon, Plus, Trash2, Type } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, qs } from "../../../lib/api";
import { POST_CATEGORIES, POST_CATEGORY_LABELS, type PostCategory } from "../../../../shared/constants";
import { isoToLocalParts, localToIso } from "../../../../shared/dates";
import { formatDateBR } from "../../../../shared/format";
import type { MediaDto, Page, PostBlock, PostDto, PublicPostDetail } from "../../../../shared/types";
import { PostBlocks } from "../../site/Gallery";
import { AreaField, Async, Badge, Button, CheckField, Chips, EmptyState, Modal, PageHeader, Panel, SearchBox, SelectField, TextField, useAction, useConfirm, useDebounced, useGet } from "../ui";
import { MediaPicker, MediaThumb } from "../MediaPicker";

const KEYS = [["posts"], ["public-site"], ["gallery"]];
type EditorBlock = PostBlock;

function PreviewModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useGet<PublicPostDetail>(["posts", "preview", id], id ? `/api/admin/posts/${id}/preview` : null);
  if (!id) return null;
  return (
    <Modal open onClose={onClose} title="Pré-visualização" description="Assim a publicação aparece para os visitantes." wide>
      <Async q={q} rows={2}>
        {(p) => (
          <article className="space-y-5">
            <p className="eyebrow">{POST_CATEGORY_LABELS[p.category]}</p>
            <h2 className="h-display text-4xl">{p.title}</h2>
            {p.summary && <p className="text-muted-foreground">{p.summary}</p>}
            <PostBlocks blocks={p.blocks} title={p.title} />
          </article>
        )}
      </Async>
    </Modal>
  );
}

function Editor({ open, onClose, post }: { open: boolean; onClose: () => void; post: PostDto | null }) {
  const media = useGet<Page<MediaDto>>(["media", "editor"], "/api/admin/media?pageSize=100", { enabled: open });
  const byId = new Map((media.data?.items ?? []).map((m) => [m.id, m]));
  const confirm = useConfirm();
  const blank = { title: "", summary: "", category: "treinamentos" as PostCategory, body: [] as EditorBlock[], coverMediaId: null as string | null, isFeatured: false, authorizationConfirmed: false, schedule: false, publishDate: "", publishTime: "08:00" };
  const [v, setV] = useState(blank);
  const [picker, setPicker] = useState<null | { target: "cover" | { index: number } | "new-image" | "new-video" }>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSavedId(post?.id ?? null);
    if (post) {
      const p = post.publishedAt ? isoToLocalParts(post.publishedAt) : null;
      setV({ title: post.title, summary: post.summary, category: post.category, body: post.body, coverMediaId: post.coverMediaId, isFeatured: post.isFeatured, authorizationConfirmed: post.authorizationConfirmed, schedule: post.visibility === "scheduled", publishDate: p?.date ?? "", publishTime: p?.time ?? "08:00" });
    } else setV(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post]);

  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const scheduledAt = v.schedule && v.publishDate ? localToIso(v.publishDate, v.publishTime) : null;

  const persist = useAction(
    async (mode: "draft" | "publish" | "unpublish") => {
      const body = { title: v.title, summary: v.summary, category: v.category, body: v.body, coverMediaId: v.coverMediaId, isFeatured: v.isFeatured, authorizationConfirmed: v.authorizationConfirmed, sortOrder: post?.sortOrder ?? 0, publishedAt: scheduledAt };
      const id = savedId ?? post?.id;
      const saved = id ? await api.put<PostDto>(`/api/admin/posts/${id}`, body) : await api.post<PostDto>("/api/admin/posts", body);
      setSavedId(saved.id);
      if (mode === "publish") await api.post(`/api/admin/posts/${saved.id}/publish`, scheduledAt ? { publishedAt: scheduledAt } : {});
      if (mode === "unpublish") await api.post(`/api/admin/posts/${saved.id}/unpublish`);
      return { saved, mode };
    },
    {
      invalidate: KEYS,
      onSuccess: ({ mode }) => {
        import("sonner").then(({ toast }) => toast.success(mode === "publish" ? (scheduledAt ? "Publicação agendada." : "Publicado no site.") : mode === "unpublish" ? "Publicação retirada do site." : "Rascunho salvo."));
        onClose();
      },
    },
  );

  const addBlock = (b: EditorBlock) => set("body", [...v.body, b]);
  const move = (i: number, d: -1 | 1) => {
    const arr = [...v.body];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    set("body", arr);
  };
  const upd = (i: number, patch: Partial<EditorBlock>) => set("body", v.body.map((b, k) => (k === i ? ({ ...b, ...patch } as EditorBlock) : b)));
  const cover = v.coverMediaId ? byId.get(v.coverMediaId) : null;
  const isPublished = post?.status === "published";

  return (
    <>
      <Modal
        open={open}
        onClose={() => (v.title || v.body.length ? confirm({ title: "Fechar sem salvar?", message: "As alterações não salvas serão perdidas.", confirmLabel: "Fechar", danger: true }).then((ok) => ok && onClose()) : onClose())}
        title={post ? "Editar publicação" : "Nova publicação"}
        wide
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            {savedId && <Button variant="ghost" onClick={() => setPreview(savedId)}><Eye size={16} aria-hidden /> Pré-visualizar</Button>}
            {isPublished && <Button variant="outline" onClick={() => persist.mutate("unpublish")} loading={persist.isPending}>Despublicar</Button>}
            <Button variant="outline" onClick={() => persist.mutate("draft")} loading={persist.isPending}>Salvar {isPublished ? "alterações" : "rascunho"}</Button>
            <Button onClick={() => persist.mutate("publish")} loading={persist.isPending}>{scheduledAt ? "Agendar publicação" : isPublished ? "Atualizar e manter publicada" : "Publicar agora"}</Button>
          </div>
        }
      >
        <TextField label="Título" value={v.title} maxLength={160} onChange={(e) => set("title", e.target.value)} error={persist.fields.title} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Categoria" value={v.category} onChange={(e) => set("category", e.target.value as PostCategory)}>
            {POST_CATEGORIES.map((c) => <option key={c} value={c}>{POST_CATEGORY_LABELS[c]}</option>)}
          </SelectField>
          <div className="space-y-2 pt-0.5">
            <CheckField label="Destacar na galeria" checked={v.isFeatured} onChange={(c) => set("isFeatured", c)} />
          </div>
        </div>
        {v.category === "resultados" && (
          <CheckField label="O aluno autorizou a divulgação deste resultado" hint="Obrigatório para publicar conteúdos de resultados (LGPD)." checked={v.authorizationConfirmed} onChange={(c) => set("authorizationConfirmed", c)} />
        )}
        {persist.fields.authorizationConfirmed && <p role="alert" className="text-sm font-semibold text-destructive">{persist.fields.authorizationConfirmed}</p>}
        <TextField label="Resumo (aparece abaixo do título)" value={v.summary} maxLength={300} onChange={(e) => set("summary", e.target.value)} />

        <div>
          <p className="mb-1.5 text-sm font-semibold">Imagem de capa</p>
          <div className="flex items-center gap-3">
            <div className="aspect-[3/4] w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">{cover ? <MediaThumb m={cover} /> : <span className="grid size-full place-items-center text-muted-foreground"><ImageIcon size={22} aria-hidden /></span>}</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPicker({ target: "cover" })}>{v.coverMediaId ? "Trocar capa" : "Escolher capa"}</Button>
              {v.coverMediaId && <Button size="sm" variant="ghost" onClick={() => set("coverMediaId", null)}>Remover</Button>}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Conteúdo</p>
          {v.body.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Adicione textos, imagens e vídeos abaixo, na ordem em que devem aparecer.</p>}
          <ul className="space-y-3">
            {v.body.map((b, i) => {
              const m = b.type !== "text" ? byId.get(b.mediaId) : null;
              return (
                <li key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {b.type === "text" ? <Type size={14} aria-hidden /> : b.type === "image" ? <ImageIcon size={14} aria-hidden /> : <Film size={14} aria-hidden />}
                    {b.type === "text" ? "Texto" : b.type === "image" ? "Imagem" : "Vídeo"}
                    <span className="ml-auto flex gap-1">
                      <button type="button" aria-label="Mover para cima" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} aria-hidden /></button>
                      <button type="button" aria-label="Mover para baixo" className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30" disabled={i === v.body.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} aria-hidden /></button>
                      <button type="button" aria-label="Remover bloco" className="grid size-8 place-items-center rounded text-destructive hover:bg-muted" onClick={() => set("body", v.body.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden /></button>
                    </span>
                  </div>
                  {b.type === "text" ? (
                    <AreaField label="Texto" rows={4} value={b.text} maxLength={5000} onChange={(e) => upd(i, { text: e.target.value })} />
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="aspect-square w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{m ? <MediaThumb m={m} /> : <span className="grid size-full place-items-center text-muted-foreground"><ImageIcon size={18} aria-hidden /></span>}</div>
                        <p className="min-w-0 flex-1 truncate text-sm">{m?.title || "Mídia selecionada"}</p>
                        <Button size="sm" variant="outline" onClick={() => setPicker({ target: { index: i } })}>Trocar</Button>
                      </div>
                      <TextField label="Legenda (opcional)" value={b.caption ?? ""} maxLength={300} onChange={(e) => upd(i, { caption: e.target.value })} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {persist.fields["body"] && <p role="alert" className="mt-1 text-sm font-semibold text-destructive">{persist.fields["body"]}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => addBlock({ type: "text", text: "" })}><Plus size={15} aria-hidden /> Texto</Button>
            <Button size="sm" variant="outline" onClick={() => setPicker({ target: "new-image" })}><Plus size={15} aria-hidden /> Imagem</Button>
            <Button size="sm" variant="outline" onClick={() => setPicker({ target: "new-video" })}><Plus size={15} aria-hidden /> Vídeo</Button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-muted/60 p-3">
          <CheckField label="Agendar a publicação" hint="Fica invisível até a data e hora escolhidas (fuso de Fortaleza)." checked={v.schedule} onChange={(c) => set("schedule", c)} />
          {v.schedule && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Data" type="date" value={v.publishDate} onChange={(e) => set("publishDate", e.target.value)} />
              <TextField label="Hora" type="time" value={v.publishTime} onChange={(e) => set("publishTime", e.target.value)} />
            </div>
          )}
        </div>
      </Modal>

      <MediaPicker
        open={!!picker}
        onClose={() => setPicker(null)}
        kind={picker?.target === "cover" || picker?.target === "new-image" ? "image" : picker?.target === "new-video" ? "video" : picker && typeof picker.target === "object" ? (v.body[picker.target.index]?.type === "video" ? "video" : "image") : "any"}
        title={picker?.target === "cover" ? "Escolher capa" : "Escolher mídia"}
        onPick={(m) => {
          const t = picker?.target;
          if (t === "cover") set("coverMediaId", m.id);
          else if (t === "new-image") addBlock({ type: "image", mediaId: m.id });
          else if (t === "new-video") addBlock({ type: "video", mediaId: m.id });
          else if (t && typeof t === "object") upd(t.index, { mediaId: m.id } as Partial<EditorBlock>);
          setPicker(null);
        }}
      />
      <PreviewModal id={preview} onClose={() => setPreview(null)} />
    </>
  );
}

const VIS: Record<PostDto["visibility"], { label: string; tone: "success" | "neutral" | "info" }> = {
  published: { label: "Publicada", tone: "success" },
  draft: { label: "Rascunho", tone: "neutral" },
  scheduled: { label: "Agendada", tone: "info" },
};

export default function Posts() {
  const [params, setParams] = useSearchParams();
  const confirm = useConfirm();
  const [status, setStatus] = useState<"" | "draft" | "published">("");
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const q = useGet<Page<PostDto>>(["posts", status, term], `/api/admin/posts${qs({ status, q: term, pageSize: 50 })}`);
  const [editor, setEditor] = useState<{ open: boolean; post: PostDto | null }>({ open: params.get("novo") === "1", post: null });
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (params.get("novo")) setParams({}, { replace: true });
  }, [params, setParams]);
  const remove = useAction((id: string) => api.del(`/api/admin/posts/${id}`), { invalidate: KEYS, success: "Publicação excluída." });
  const toggle = useAction((o: { id: string; publish: boolean }) => api.post(`/api/admin/posts/${o.id}/${o.publish ? "publish" : "unpublish"}`, {}), { invalidate: KEYS, success: "Publicação atualizada." });

  return (
    <>
      <PageHeader title="Publicações" description="Treinos, execuções, dicas e bastidores que alimentam a galeria do site. Só o que estiver publicado aparece para os visitantes." actions={<Button onClick={() => setEditor({ open: true, post: null })}><Plus size={18} aria-hidden /> Nova publicação</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por título" />
        <Chips label="Situação" value={status} onChange={setStatus} options={[{ value: "", label: "Todas" }, { value: "published", label: "Publicadas" }, { value: "draft", label: "Rascunhos" }]} />
      </div>
      <Async q={q} rows={3}>
        {(d) => d.items.length === 0 ? (
          <Panel><EmptyState icon={<FileText size={26} />} title="Nenhuma publicação" text="Crie a primeira para a galeria do site ganhar vida. Enquanto não houver publicações, a seção de galeria fica oculta no site." action={<Button onClick={() => setEditor({ open: true, post: null })}>Criar publicação</Button>} /></Panel>
        ) : (
          <Panel pad={false}>
            <ul className="divide-y divide-border">
              {d.items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                  <div className="aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">{p.coverUrl ? <img src={p.coverUrl} alt="" loading="lazy" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-muted-foreground"><ImageIcon size={16} aria-hidden /></span>}</div>
                  <div className="min-w-0 flex-1 basis-52">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="text-sm text-muted-foreground">{POST_CATEGORY_LABELS[p.category]} · {p.publishedAt ? formatDateBR(isoToLocalParts(p.publishedAt).date) : "sem data"} · {p.body.length} bloco(s)</p>
                  </div>
                  <Badge tone={VIS[p.visibility].tone}>{VIS[p.visibility].label}</Badge>
                  {p.isFeatured && <Badge tone="brand">Destaque</Badge>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditor({ open: true, post: p })}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPreview(p.id)}><Eye size={15} aria-hidden /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: p.id, publish: p.status !== "published" })}>{p.status === "published" ? "Despublicar" : "Publicar"}</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir ${p.title}`} onClick={async () => { if (await confirm({ title: "Excluir publicação?", message: "Ela sai do site e não poderá ser recuperada. As mídias continuam na galeria.", confirmLabel: "Excluir", danger: true })) remove.mutate(p.id); }}><Trash2 size={15} aria-hidden /></Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Async>
      <Editor open={editor.open} post={editor.post} onClose={() => setEditor({ open: false, post: null })} />
      <PreviewModal id={preview} onClose={() => setPreview(null)} />
    </>
  );
}

