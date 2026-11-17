import { Archive, ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { formatBRL, formatDateBR } from "../../../../shared/format";
import type { AdminPlan } from "../../../../shared/types";
import { Async, AreaField, Badge, Button, CheckField, EmptyState, Modal, MoneyField, PageHeader, Panel, TextField, useAction, useConfirm, useGet } from "../ui";

const KEYS = [["plans"], ["promotions"], ["public-site"]];

function PlanModal({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: AdminPlan | null }) {
  const blank = { name: "", durationMonths: 1, regularPriceCents: null as number | null, description: "", features: "", conditions: "", badge: "", isFeatured: false, isActive: true };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setV(plan ? { name: plan.name, durationMonths: plan.durationMonths, regularPriceCents: plan.regularPriceCents, description: plan.description, features: plan.features.join("\n"), conditions: plan.conditions, badge: plan.badge, isFeatured: plan.isFeatured, isActive: plan.isActive } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);
  const save = useAction(
    () => {
      const body = { ...v, features: v.features.split("\n").map((s) => s.trim()).filter(Boolean) };
      return plan ? api.put(`/api/admin/plans/${plan.id}`, body) : api.post("/api/admin/plans", body);
    },
    { invalidate: KEYS, success: "Plano salvo.", onSuccess: onClose },
  );
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal open={open} onClose={onClose} title={plan ? `Editar plano ${plan.name}` : "Novo plano"} wide footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar plano</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Nome do plano" value={v.name} maxLength={80} onChange={(e) => set("name", e.target.value)} error={save.fields.name} placeholder="Ex.: Trimestral" />
        <TextField label="Duração (meses)" type="number" min={1} max={36} value={v.durationMonths} onChange={(e) => set("durationMonths", Number(e.target.value))} error={save.fields.durationMonths} />
      </div>
      <MoneyField label="Preço regular (fora de promoção)" optional value={v.regularPriceCents} onChange={(c) => set("regularPriceCents", c)} error={save.fields.regularPriceCents} hint="Valor cobrado quando NÃO há promoção vigente. Se ficar vazio, o site mostra “Consulte valores” ao fim das promoções. Os preços promocionais são definidos em Promoções." />
      <TextField label="Descrição curta" value={v.description} maxLength={400} onChange={(e) => set("description", e.target.value)} />
      <AreaField label="O que está incluído (um item por linha)" rows={4} value={v.features} onChange={(e) => set("features", e.target.value)} hint="Inclua apenas o que realmente é entregue." />
      <AreaField label="Condições" rows={2} value={v.conditions} onChange={(e) => set("conditions", e.target.value)} hint="Opcional. Aparece em letra pequena no cartão do plano." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Selo de destaque (opcional)" value={v.badge} maxLength={40} onChange={(e) => set("badge", e.target.value)} placeholder="Ex.: Menor valor por mês" hint="Só use se for verdadeiro para os valores atuais." />
        <div className="space-y-2 pt-0.5">
          <CheckField label="Destacar visualmente no site" checked={v.isFeatured} onChange={(c) => set("isFeatured", c)} />
          <CheckField label="Plano ativo (visível no site)" checked={v.isActive} onChange={(c) => set("isActive", c)} />
        </div>
      </div>
    </Modal>
  );
}

export default function Plans() {
  const confirm = useConfirm();
  const [showArchived, setShowArchived] = useState(false);
  const q = useGet<AdminPlan[]>(["plans", showArchived], `/api/admin/plans${showArchived ? "?archived=1" : ""}`);
  const [form, setForm] = useState<{ open: boolean; plan: AdminPlan | null }>({ open: false, plan: null });
  const archive = useAction((o: { id: string; archive: boolean }) => api.post(`/api/admin/plans/${o.id}/${o.archive ? "archive" : "restore"}`), { invalidate: KEYS, success: "Plano atualizado." });
  const remove = useAction((id: string) => api.del(`/api/admin/plans/${id}`), { invalidate: KEYS, success: "Plano excluído." });
  const reorder = useAction((ids: string[]) => api.put("/api/admin/plans/order", { ids }), { invalidate: KEYS });
  const toggle = useAction((p: AdminPlan) => api.put(`/api/admin/plans/${p.id}`, { ...p, features: p.features, isActive: !p.isActive }), { invalidate: KEYS, success: "Plano atualizado." });

  const move = (list: AdminPlan[], i: number, d: -1 | 1) => {
    const ids = list.filter((p) => !p.archivedAt).map((p) => p.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  };

  return (
    <>
      <PageHeader title="Planos" description="Os períodos de contratação da consultoria online. Alterar preços aqui não muda contratos já fechados." actions={<Button onClick={() => setForm({ open: true, plan: null })}><Plus size={18} aria-hidden /> Novo plano</Button>} />
      <Async q={q} rows={3}>
        {(plans) => {
          const missing = plans.filter((p) => !p.archivedAt && p.isActive && p.regularPriceCents === null);
          const active = plans.filter((p) => !p.archivedAt);
          return (
            <div className="space-y-4">
              {missing.length > 0 && (
                <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-warning">
                  <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden />
                  <p className="text-sm">
                    <strong>{missing.map((p) => p.name).join(", ")}</strong> {missing.length === 1 ? "não tem" : "não têm"} preço regular. Quando a promoção terminar, o site passará a exibir “Consulte valores”. Defina o preço regular para manter o valor visível.
                  </p>
                </div>
              )}
              <Panel pad={false}>
                {plans.length === 0 ? (
                  <EmptyState title="Nenhum plano cadastrado" action={<Button onClick={() => setForm({ open: true, plan: null })}>Criar plano</Button>} />
                ) : (
                  <ul className="divide-y divide-border">
                    {plans.map((p, i) => (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
                        {!p.archivedAt && (
                          <div className="flex flex-col">
                            <button type="button" aria-label="Mover para cima" disabled={i === 0} className="grid size-7 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(plans, i, -1)}><ArrowUp size={15} aria-hidden /></button>
                            <button type="button" aria-label="Mover para baixo" disabled={i === active.length - 1} className="grid size-7 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(plans, i, 1)}><ArrowDown size={15} aria-hidden /></button>
                          </div>
                        )}
                        <div className="min-w-0 flex-1 basis-60">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-display text-2xl font-extrabold uppercase">{p.name}</p>
                            <span className="text-sm text-muted-foreground">{p.durationMonths} {p.durationMonths === 1 ? "mês" : "meses"}</span>
                            {p.isFeatured && <Badge tone="brand">Destaque</Badge>}
                            {p.archivedAt ? <Badge>Arquivado</Badge> : !p.isActive ? <Badge tone="warning">Oculto no site</Badge> : <Badge tone="success">Ativo</Badge>}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{p.description || "Sem descrição"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Preço em vigor hoje</p>
                          <p className="text-lg font-extrabold tabular-nums">{p.currentPrice.cents !== null ? formatBRL(p.currentPrice.cents) : "Sob consulta"}</p>
                          {p.currentPrice.kind === "promo" && p.currentPrice.validUntilDate && <p className="text-xs font-semibold text-brand">Promoção até {formatDateBR(p.currentPrice.validUntilDate)}</p>}
                          <p className="text-xs text-muted-foreground">Regular: {p.regularPriceCents !== null ? formatBRL(p.regularPriceCents) : "não definido"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!p.archivedAt ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => setForm({ open: true, plan: p })}><Pencil size={15} aria-hidden /> Editar</Button>
                              <Button size="sm" variant="ghost" onClick={() => toggle.mutate(p)}>{p.isActive ? "Ocultar" : "Mostrar"}</Button>
                              <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Arquivar plano?", message: "O plano sai do site e das novas contratações. Contratos existentes continuam intactos.", confirmLabel: "Arquivar" })) archive.mutate({ id: p.id, archive: true }); }}><Archive size={15} aria-hidden /></Button>
                            </>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => archive.mutate({ id: p.id, archive: false })}><RotateCcw size={15} aria-hidden /> Restaurar</Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir ${p.name}`} onClick={async () => { if (await confirm({ title: "Excluir plano?", message: "Só é possível excluir planos sem contratações nem promoções. Caso contrário, arquive.", confirmLabel: "Excluir", danger: true })) remove.mutate(p.id); }}><Trash2 size={15} aria-hidden /></Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Mostrar planos arquivados
              </label>
            </div>
          );
        }}
      </Async>
      <PlanModal open={form.open} plan={form.plan} onClose={() => setForm({ open: false, plan: null })} />
    </>
  );
}
