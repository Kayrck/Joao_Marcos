import { Check, History, Pencil, Star as StarIcon, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatDateBR } from "../../../../shared/format";
import type { AuditEntryDto, Page, ReviewDto } from "../../../../shared/types";
import { AreaField, Async, Button, Chips, EmptyState, Modal, PageHeader, Panel, TextField, useAction, useConfirm, useGet } from "../ui";
import { StatusBadge } from "../parts";

type ListData = Page<ReviewDto> & { counts: Record<string, number> };
const KEYS = [["reviews"], ["pending-reviews"], ["alerts"], ["dashboard"], ["public-site"]];

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex" role="img" aria-label={`Nota ${n} de 5`}>
    {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} size={16} aria-hidden className={i <= n ? "fill-primary text-primary" : "text-border"} />)}
  </span>
);

function EditModal({ review, onClose }: { review: ReviewDto | null; onClose: () => void }) {
  const [v, setV] = useState({ authorName: "", rating: 5, body: "", displayDate: "" });
  useEffect(() => { if (review) setV({ authorName: review.authorName, rating: review.rating, body: review.body, displayDate: review.displayDate }); }, [review]);
  const save = useAction(() => api.put(`/api/admin/reviews/${review!.id}`, { ...v, photoMediaId: review!.photoMediaId }), { invalidate: KEYS, success: "Avaliação atualizada.", onSuccess: onClose });
  if (!review) return null;
  return (
    <Modal open onClose={onClose} title="Editar avaliação" description="Edite com cuidado: o texto deve refletir o que o cliente escreveu." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <TextField label="Nome exibido" value={v.authorName} maxLength={80} onChange={(e) => setV({ ...v, authorName: e.target.value })} error={save.fields.authorName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nota (1 a 5)" type="number" min={1} max={5} value={v.rating} onChange={(e) => setV({ ...v, rating: Number(e.target.value) })} error={save.fields.rating} />
        <TextField label="Data exibida" type="date" value={v.displayDate} onChange={(e) => setV({ ...v, displayDate: e.target.value })} />
      </div>
      <AreaField label="Texto" rows={5} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} error={save.fields.body} />
    </Modal>
  );
}

function HistoryModal({ review, onClose }: { review: ReviewDto | null; onClose: () => void }) {
  const q = useGet<AuditEntryDto[]>(["reviews", "history", review?.id], review ? `/api/admin/reviews/${review.id}/history` : null);
  if (!review) return null;
  return (
    <Modal open onClose={onClose} title="Histórico da avaliação" description={`Enviada em ${formatDateBR(review.createdAt.slice(0, 10))} · última alteração em ${formatDateBR(review.updatedAt.slice(0, 10))}`}>
      <Async q={q} rows={2}>
        {(items) => items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma ação do administrador ainda: a avaliação está como foi enviada.</p> : (
          <ul className="space-y-2">{items.map((h) => <li key={h.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><p className="font-semibold">{h.summary ?? h.action}</p><p className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}{h.adminName ? ` · ${h.adminName}` : ""}</p></li>)}</ul>
        )}
      </Async>
    </Modal>
  );
}

export default function Reviews() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const q = useGet<ListData>(["reviews", tab], `/api/admin/reviews?status=${tab}&pageSize=50`);
  const counts = q.data?.counts;
  const [edit, setEdit] = useState<ReviewDto | null>(null);
  const [hist, setHist] = useState<ReviewDto | null>(null);
  const moderate = useAction((o: { id: string; status: "approved" | "rejected" | "pending"; note?: string }) => api.post(`/api/admin/reviews/${o.id}/moderate`, { status: o.status, note: o.note }), { invalidate: KEYS, success: "Avaliação atualizada." });
  const remove = useAction((id: string) => api.del(`/api/admin/reviews/${id}`), { invalidate: KEYS, success: "Avaliação excluída." });

  return (
    <>
      <PageHeader title="Avaliações" description="Nada é publicado automaticamente: aprove as avaliações que devem aparecer no site." />
      <div className="mb-4">
        <Chips label="Status das avaliações" value={tab} onChange={setTab} options={[{ value: "pending", label: "Pendentes", count: counts?.pending }, { value: "approved", label: "Aprovadas", count: counts?.approved }, { value: "rejected", label: "Rejeitadas", count: counts?.rejected }]} />
      </div>
      <Async q={q} rows={3}>
        {(d) => d.items.length === 0 ? (
          <Panel><EmptyState title={tab === "pending" ? "Nenhuma avaliação aguardando" : "Nada por aqui"} text={tab === "pending" ? "Quando alguém enviar uma avaliação pelo site, ela aparece aqui para você aprovar ou rejeitar." : undefined} /></Panel>
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {d.items.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{r.authorName}</p>
                  <Stars n={r.rating} />
                  <span className="ml-auto"><StatusBadge status={r.status} kind="review" /></span>
                </div>
                <p className="mt-3 whitespace-pre-line">{r.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">Enviada em {formatDateBR(r.createdAt.slice(0, 10))}{r.rejectionNote ? ` · Motivo: ${r.rejectionNote}` : ""}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status !== "approved" && <Button size="sm" onClick={() => moderate.mutate({ id: r.id, status: "approved" })}><Check size={16} aria-hidden /> Aprovar</Button>}
                  {r.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => moderate.mutate({ id: r.id, status: "rejected" })}><X size={16} aria-hidden /> Rejeitar</Button>}
                  {r.status !== "pending" && <Button size="sm" variant="ghost" onClick={() => moderate.mutate({ id: r.id, status: "pending" })}>Voltar a pendente</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil size={15} aria-hidden /> Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setHist(r)}><History size={15} aria-hidden /> Histórico</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" aria-label="Excluir avaliação" onClick={async () => { if (await confirm({ title: "Excluir avaliação?", message: "A avaliação será removida definitivamente.", confirmLabel: "Excluir", danger: true })) remove.mutate(r.id); }}><Trash2 size={15} aria-hidden /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <EditModal review={edit} onClose={() => setEdit(null)} />
      <HistoryModal review={hist} onClose={() => setHist(null)} />
    </>
  );
}
