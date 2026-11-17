import { Film, Link2, Loader2, Pencil, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api, errorMessage, qs } from "../../../lib/api";
import type { MediaDto, Page } from "../../../../shared/types";
import { Async, Badge, Button, Chips, EmptyState, Modal, PageHeader, Panel, SearchBox, TextField, useAction, useConfirm, useDebounced, useGet } from "../ui";
import { MediaThumb } from "../MediaPicker";
import { formatBytes, uploadMedia } from "../media-utils";

const KEYS = [["media"], ["posts"]];

function EditModal({ media, onClose }: { media: MediaDto | null; onClose: () => void }) {
  const [v, setV] = useState({ title: "", altText: "", category: "geral" });
  useEffect(() => { if (media) setV({ title: media.title, altText: media.altText, category: media.category }); }, [media]);
  const save = useAction(() => api.put(`/api/admin/media/${media!.id}`, v), { invalidate: KEYS, success: "Mídia atualizada.", onSuccess: onClose });
  if (!media) return null;
  return (
    <Modal open onClose={onClose} title="Editar mídia" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <div className="mx-auto aspect-video max-h-44 overflow-hidden rounded-xl border border-border bg-muted"><MediaThumb m={media} /></div>
      <TextField label="Título" value={v.title} maxLength={160} onChange={(e) => setV({ ...v, title: e.target.value })} />
      <TextField label="Texto alternativo (acessibilidade)" value={v.altText} maxLength={300} onChange={(e) => setV({ ...v, altText: e.target.value })} hint="Descreva a imagem para quem usa leitor de tela." />
      <TextField label="Categoria" value={v.category} maxLength={60} onChange={(e) => setV({ ...v, category: e.target.value })} />
    </Modal>
  );
}

function ExternalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState({ url: "", title: "", category: "videos" });
  useEffect(() => { if (open) setV({ url: "", title: "", category: "videos" }); }, [open]);
  const save = useAction(() => api.post("/api/admin/media/external", v), { invalidate: KEYS, success: "Vídeo adicionado.", onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} title="Vídeo do YouTube ou Vimeo" description="Vídeos hospedados fora do site economizam armazenamento e carregam sob demanda." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Adicionar</Button></>}>
      <TextField label="Link do vídeo" type="url" value={v.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setV({ ...v, url: e.target.value })} error={save.fields.url} />
      <TextField label="Título" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
    </Modal>
  );
}

export default function MediaLibrary() {
  const confirm = useConfirm();
  const [kind, setKind] = useState<"" | "image" | "video" | "external_video">("");
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const q = useGet<Page<MediaDto>>(["media", kind, term], `/api/admin/media${qs({ kind, q: term, pageSize: 60 })}`);
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null);
  const [edit, setEdit] = useState<MediaDto | null>(null);
  const [ext, setExt] = useState(false);
  const remove = useAction((id: string) => api.del(`/api/admin/media/${id}`), { invalidate: KEYS, success: "Mídia excluída." });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      try {
        setUploading({ name: f.name, pct: 0 });
        await uploadMedia(f, { category: f.type.startsWith("video/") ? "videos" : "geral" }, (pct) => setUploading({ name: f.name, pct }));
        toast.success(`${f.name} enviado.`);
      } catch (e) {
        toast.error(`${f.name}: ${errorMessage(e)}`);
      }
    }
    setUploading(null);
    if (input.current) input.current.value = "";
    await q.refetch();
  }

  return (
    <>
      <PageHeader title="Galeria de mídias" description="Fotos e vídeos do seu trabalho. Enviar um arquivo não o publica: ele só aparece no site quando usado em uma publicação ou seção publicada." actions={<><input ref={input} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime" onChange={(e) => onFiles(e.target.files)} /><Button variant="outline" onClick={() => setExt(true)}><Link2 size={16} aria-hidden /> Vídeo do YouTube</Button><Button onClick={() => input.current?.click()} disabled={!!uploading}>{uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Upload size={16} aria-hidden />} Enviar arquivos</Button></>} />
      {uploading && <p role="status" className="mb-4 rounded-xl bg-brand-soft px-4 py-3 text-sm font-semibold text-brand-soft-foreground">Enviando {uploading.name}… {uploading.pct}%</p>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por título" />
        <Chips label="Tipo" value={kind} onChange={setKind} options={[{ value: "", label: "Tudo" }, { value: "image", label: "Imagens" }, { value: "video", label: "Vídeos enviados" }, { value: "external_video", label: "YouTube/Vimeo" }]} />
      </div>
      <Async q={q} rows={3}>
        {(d) => d.items.length === 0 ? (
          <Panel><EmptyState icon={<Film size={26} />} title="Nenhuma mídia" text="Envie fotos (JPG, PNG, WebP) e vídeos (MP4, WebM) ou adicione um link do YouTube. As imagens são otimizadas automaticamente." action={<Button onClick={() => input.current?.click()}>Enviar arquivos</Button>} /></Panel>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {d.items.map((m) => (
              <li key={m.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                <div className="relative aspect-square bg-muted"><MediaThumb m={m} />{m.kind !== "image" && <span className="absolute left-2 top-2"><Badge tone="brand">{m.kind === "external_video" ? m.externalProvider ?? "Vídeo" : "Vídeo"}</Badge></span>}</div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{m.title || "Sem título"}</p>
                  <p className="text-xs text-muted-foreground">{m.category}{m.sizeBytes ? ` · ${formatBytes(m.sizeBytes)}` : ""}</p>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEdit(m)} aria-label={`Editar ${m.title}`}><Pencil size={14} aria-hidden /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir ${m.title}`} onClick={async () => { if (await confirm({ title: "Excluir mídia?", message: "O arquivo será removido do armazenamento. Se estiver em uso em alguma publicação ou seção, a exclusão será bloqueada.", confirmLabel: "Excluir", danger: true })) remove.mutate(m.id); }}><Trash2 size={14} aria-hidden /></Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <EditModal media={edit} onClose={() => setEdit(null)} />
      <ExternalModal open={ext} onClose={() => setExt(false)} />
    </>
  );
}
