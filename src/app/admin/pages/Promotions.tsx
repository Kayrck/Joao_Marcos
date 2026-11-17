import { CalendarClock, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { isoToLocalParts, localToIso, todayLocal } from "../../../../shared/dates";
import { formatBRL, formatDateBR } from "../../../../shared/format";
import type { AdminPlan, AdminPromotion, PromotionStatus } from "../../../../shared/types";
import { AreaField, Async, Badge, Button, CheckField, EmptyState, Modal, MoneyField, PageHeader, Panel, TextField, useAction, useConfirm, useGet, type Tone } from "../ui";

const KEYS = [["promotions"], ["plans"], ["public-site"]];
const STATUS: Record<PromotionStatus, { label: string; tone: Tone }> = {
  active: { label: "Vigente", tone: "success" },
  scheduled: { label: "Agendada", tone: "info" },
  expired: { label: "Expirada", tone: "neutral" },
  disabled: { label: "Desativada", tone: "warning" },
};

function PromoModal({ open, onClose, promo }: { open: boolean; onClose: () => void; promo: AdminPromotion | null }) {
  const plans = useGet<AdminPlan[]>(["plans", false], "/api/admin/plans");
  const blank = { name: "", description: "", startDate: todayLocal(), startTime: "00:00", endDate: "", endTime: "23:59", isActive: true, prices: {} as Record<string, number | null>, selected: {} as Record<string, boolean> };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (!open) return;
    if (promo) {
      const s = isoToLocalParts(promo.startsAt);
      const prices: Record<string, number | null> = {};
      const selected: Record<string, boolean> = {};
      for (const p of promo.plans) (prices[p.planId] = p.promoPriceCents, (selected[p.planId] = true));
      setV({ name: promo.name, description: promo.description, startDate: s.date, startTime: s.time, endDate: promo.validUntilDate, endTime: promo.validUntilTime, isActive: promo.isActive, prices, selected });
    } else setV(blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, promo]);

  const save = useAction(
    () => {
      const body = {
        name: v.name,
        description: v.description,
        // início: instante exato; fim: o minuto informado é INCLUSIVO, então o limite exclusivo é 1 min depois
        startsAt: localToIso(v.startDate, v.startTime),
        endsAt: new Date(new Date(localToIso(v.endDate || v.startDate, v.endTime)).getTime() + 60_000).toISOString(),
        isActive: v.isActive,
        plans: Object.keys(v.selected).filter((id) => v.selected[id]).map((id) => ({ planId: id, promoPriceCents: v.prices[id] ?? 0 })),
      };
      return promo ? api.put(`/api/admin/promotions/${promo.id}`, body) : api.post("/api/admin/promotions", body);
    },
    { invalidate: KEYS, success: "Promoção salva.", onSuccess: onClose },
  );
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  const list = (plans.data ?? []).filter((p) => !p.archivedAt);
  return (
    <Modal open={open} onClose={onClose} title={promo ? "Editar promoção" : "Nova promoção"} description="Valores promocionais por plano, com início e fim (fuso America/Fortaleza). Expirada, a promoção deixa de aparecer sozinha." wide footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar promoção</Button></>}>
      <TextField label="Nome da campanha" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} error={save.fields.name} placeholder="Ex.: Promoção 2026" />
      <AreaField label="Descrição (interna)" rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid grid-cols-[1fr_6.5rem] gap-2"><TextField label="Início" type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} /><TextField label="Hora" type="time" value={v.startTime} onChange={(e) => set("startTime", e.target.value)} /></div>
        <div className="grid grid-cols-[1fr_6.5rem] gap-2"><TextField label="Válida até (inclusive)" type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} error={save.fields.endsAt} /><TextField label="Hora" type="time" value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /></div>
      </div>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">Planos e preços promocionais</legend>
        {save.fields.plans && <p role="alert" className="text-xs font-semibold text-destructive">{save.fields.plans}</p>}
        {list.map((p) => (
          <div key={p.id} className="grid items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_11rem]">
            <CheckField label={`${p.name} (${p.durationMonths} ${p.durationMonths === 1 ? "mês" : "meses"})`} checked={!!v.selected[p.id]} onChange={(c) => setV((s) => ({ ...s, selected: { ...s.selected, [p.id]: c } }))} />
            <MoneyField label="Preço promocional" value={v.prices[p.id] ?? null} onChange={(c) => setV((s) => ({ ...s, prices: { ...s.prices, [p.id]: c } }))} />
          </div>
        ))}
      </fieldset>
      <CheckField label="Promoção ativa" hint="Desative para pausar sem apagar." checked={v.isActive} onChange={(c) => set("isActive", c)} />
    </Modal>
  );
}

export default function Promotions() {
  const confirm = useConfirm();
  const q = useGet<AdminPromotion[]>(["promotions"], "/api/admin/promotions");
  const [form, setForm] = useState<{ open: boolean; promo: AdminPromotion | null }>({ open: false, promo: null });
  const toggle = useAction((o: { id: string; active: boolean }) => api.post(`/api/admin/promotions/${o.id}/active`, { active: o.active }), { invalidate: KEYS, success: "Promoção atualizada." });
  const remove = useAction((id: string) => api.del(`/api/admin/promotions/${id}`), { invalidate: KEYS, success: "Promoção excluída." });

  return (
    <>
      <PageHeader title="Promoções" description="Campanhas com preço e validade. O site usa sempre o valor vigente; contratos antigos nunca são alterados." actions={<Button onClick={() => setForm({ open: true, promo: null })}><Plus size={18} aria-hidden /> Nova promoção</Button>} />
      <Async q={q} rows={3}>
        {(items) =>
          items.length === 0 ? (
            <Panel><EmptyState icon={<CalendarClock size={26} />} title="Nenhuma promoção" text="Crie uma campanha para definir preços promocionais com data de validade." action={<Button onClick={() => setForm({ open: true, promo: null })}>Criar promoção</Button>} /></Panel>
          ) : (
            <div className="space-y-4">
              {items.map((p) => (
                <Panel key={p.id}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 basis-60">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-2xl font-extrabold uppercase">{p.name}</h2>
                        <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{formatDateBR(isoToLocalParts(p.startsAt).date)} {isoToLocalParts(p.startsAt).time} → válida até {formatDateBR(p.validUntilDate)} {p.validUntilTime}</p>
                      {p.description && <p className="mt-1 text-sm">{p.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setForm({ open: true, promo: p })}><Pencil size={15} aria-hidden /> Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: p.id, active: !p.isActive })}><Power size={15} aria-hidden /> {p.isActive ? "Desativar" : "Ativar"}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Excluir ${p.name}`} onClick={async () => { if (await confirm({ title: "Excluir promoção?", message: "Os contratos já fechados mantêm o valor combinado. Esta ação não pode ser desfeita.", confirmLabel: "Excluir", danger: true })) remove.mutate(p.id); }}><Trash2 size={15} aria-hidden /></Button>
                    </div>
                  </div>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {p.plans.map((pl) => <li key={pl.planId} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-soft-foreground">{pl.planName}: {formatBRL(pl.promoPriceCents)}</li>)}
                  </ul>
                </Panel>
              ))}
            </div>
          )
        }
      </Async>
      <PromoModal open={form.open} promo={form.promo} onClose={() => setForm({ open: false, promo: null })} />
    </>
  );
}
