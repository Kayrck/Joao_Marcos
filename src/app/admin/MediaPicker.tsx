import { Film, ImageIcon, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { errorMessage } from "../../lib/api";
import type { MediaDto, Page } from "../../../shared/types";
import { Async, Button, Chips, Modal, cx, useGet } from "./ui";
import { uploadMedia } from "./media-utils";

export const MediaThumb = ({ m, className }: { m: Pick<MediaDto, "kind" | "thumbnailUrl" | "title" | "altText">; className?: string }) =>
  m.thumbnailUrl ? (
    <img src={m.thumbnailUrl} alt={m.altText || m.title} loading="lazy" className={cx("size-full object-cover", className)} />
  ) : (
    <span className="grid size-full place-items-center bg-ink text-ink-muted">{m.kind === "image" ? <ImageIcon size={26} aria-hidden /> : <Film size={26} aria-hidden />}</span>
  );

/** Escolhe uma mídia da biblioteca (ou envia uma nova) para usar em publicações, seções e configurações. */
export function MediaPicker({ open, onClose, onPick, kind = "any", title = "Escolher mídia" }: { open: boolean; onClose: () => void; onPick: (m: MediaDto) => void; kind?: "image" | "video" | "any"; title?: string }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"" | "image" | "video">(kind === "image" ? "image" : "");
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = useGet<Page<MediaDto>>(["media", "picker", filter], `/api/admin/media?pageSize=60${filter === "image" ? "&kind=image" : ""}`, { enabled: open });

  const items = (q.data?.items ?? []).filter((m) => (kind === "image" ? m.kind === "image" : kind === "video" ? m.kind !== "image" : filter === "video" ? m.kind !== "image" : true));

  async function onFile(file?: File) {
    if (!file) return;
    try {
      setProgress(0);
      const m = await uploadMedia(file, { category: "geral" }, setProgress);
      await qc.invalidateQueries({ queryKey: ["media"] });
      toast.success("Arquivo enviado.");
      onPick(m);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="flex flex-wrap items-center gap-3">
        {kind === "any" && <Chips label="Tipo" value={filter} onChange={setFilter} options={[{ value: "", label: "Tudo" }, { value: "image", label: "Imagens" }, { value: "video", label: "Vídeos" }]} />}
        <div className="ml-auto">
          <input ref={input} type="file" hidden accept={kind === "video" ? "video/*" : kind === "image" ? "image/*" : "image/*,video/*"} onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={progress !== null}>
            {progress !== null ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
            {progress !== null ? `Enviando ${progress}%` : "Enviar novo arquivo"}
          </Button>
        </div>
      </div>
      <Async q={q} rows={2}>
        {() =>
          items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">Nenhuma mídia disponível. Envie um arquivo para começar.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {items.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => onPick(m)} className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-border hover:border-primary focus-visible:outline-2" aria-label={`Selecionar ${m.title || "mídia"}`}>
                    <MediaThumb m={m} />
                    {m.kind !== "image" && <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 text-[0.65rem] font-bold text-white">VÍDEO</span>}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[0.7rem] text-white">{m.title || "Sem título"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </Async>
    </Modal>
  );
}
