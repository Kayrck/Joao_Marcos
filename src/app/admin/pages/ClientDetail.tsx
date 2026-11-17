import { Archive, ArrowLeft, CalendarPlus, CreditCard, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { api } from "../../../lib/api";
import { APPOINTMENT_KIND_LABELS, PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../../../shared/constants";
import { addDays, isoToLocalParts, subscriptionEnd, todayLocal } from "../../../../shared/dates";
import { fillTemplate, formatBRL, formatDateBR } from "../../../../shared/format";
import { formatPhone } from "../../../../shared/phone";
import type { AdminPlan, ClientDetail as ClientDetailDto, ReceivableDto, SubscriptionDto } from "../../../../shared/types";
import { AreaField, Async, Badge, Button, CheckField, EmptyState, Modal, MoneyField, PageHeader, Panel, SelectField, Stat, TextField, WhatsAppLink, useAction, useConfirm, useGet } from "../ui";
import { FIN_KEYS, PaymentModal, ReceivableModal, StatusBadge } from "../parts";

const keys = [...FIN_KEYS, ["plans"]];

function EditClientModal({ client, open, onClose }: { client: ClientDetailDto; open: boolean; onClose: () => void }) {
  const [v, setV] = useState({ fullName: "", whatsapp: "", phone: "", email: "", notes: "", isActive: true });
  useEffect(() => {
    if (open) setV({ fullName: client.fullName, whatsapp: client.whatsapp ?? "", phone: client.phone ?? "", email: client.email ?? "", notes: client.notes, isActive: client.isActive });
  }, [open, client]);
  const save = useAction(() => api.put(`/api/admin/clients/${client.id}`, v), { invalidate: keys, success: "Cadastro atualizado.", onSuccess: onClose });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal open={open} onClose={onClose} title="Editar cliente" footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <TextField label="Nome completo" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} error={save.fields.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="WhatsApp" type="tel" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} error={save.fields.whatsapp} />
        <TextField label="Telefone" type="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={save.fields.phone} />
      </div>
      <TextField label="E-mail" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={save.fields.email} />
      <AreaField label="Observações administrativas" value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      <CheckField label="Cliente ativo" hint="Desmarque para marcar como inativo (sem apagar o histórico)." checked={v.isActive} onChange={(c) => set("isActive", c)} />
    </Modal>
  );
}

/** Contratar ou renovar um plano — a renovação é sempre confirmada manualmente por aqui. */
function SubscriptionModal({ client, open, onClose }: { client: ClientDetailDto; open: boolean; onClose: () => void }) {
  const plans = useGet<AdminPlan[]>(["plans"], "/api/admin/plans");
  const lastEnd = client.subscriptions.filter((s) => s.status === "active").map((s) => s.endsOn).sort().pop();
  const suggestStart = lastEnd && lastEnd >= todayLocal() ? addDays(lastEnd, 1) : todayLocal();
  const [v, setV] = useState({ planId: "", startsOn: suggestStart, endsOn: "", price: null as number | null, notes: "", charge: true, dueDate: suggestStart, paid: false, paidOn: todayLocal(), method: "pix" as PaymentMethod });
  const active = (plans.data ?? []).filter((p) => p.isActive);
  const plan = active.find((p) => p.id === v.planId);

  useEffect(() => {
    if (open) setV((s) => ({ ...s, planId: "", startsOn: suggestStart, endsOn: "", price: null, notes: "", charge: true, dueDate: suggestStart, paid: false, paidOn: todayLocal() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (plan) setV((s) => ({ ...s, price: plan.currentPrice.cents ?? s.price, endsOn: subscriptionEnd(s.startsOn, plan.durationMonths) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.planId]);
  useEffect(() => {
    if (plan) setV((s) => ({ ...s, endsOn: subscriptionEnd(s.startsOn, plan.durationMonths), dueDate: s.startsOn }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.startsOn]);

  const save = useAction(
    () =>
      api.post(`/api/admin/clients/${client.id}/subscriptions`, {
        planId: v.planId,
        startsOn: v.startsOn,
        endsOn: v.endsOn || undefined,
        agreedPriceCents: v.price ?? undefined,
        notes: v.notes,
        charge: v.charge && (v.price ?? 0) > 0 ? { dueDate: v.dueDate, ...(v.paid ? { paid: { paidOn: v.paidOn, method: v.method } } : {}) } : undefined,
      }),
    { invalidate: keys, success: "Plano registrado.", onSuccess: onClose },
  );

  return (
    <Modal open={open} onClose={onClose} title={client.subscriptions.length ? "Renovar / novo plano" : "Contratar plano"} description="O valor combinado fica gravado neste contrato e não muda se o preço do plano for alterado depois." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending} disabled={!v.planId}>Confirmar contratação</Button></>}>
      <SelectField label="Plano" value={v.planId} onChange={(e) => setV((s) => ({ ...s, planId: e.target.value }))} error={save.fields.planId}>
        <option value="">Selecione…</option>
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {p.durationMonths} {p.durationMonths === 1 ? "mês" : "meses"} {p.currentPrice.cents !== null ? `(${formatBRL(p.currentPrice.cents)}${p.currentPrice.kind === "promo" ? " promo" : ""})` : "(sem preço definido)"}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Início" type="date" value={v.startsOn} onChange={(e) => setV((s) => ({ ...s, startsOn: e.target.value }))} error={save.fields.startsOn} />
        <TextField label="Término (último dia)" type="date" value={v.endsOn} onChange={(e) => setV((s) => ({ ...s, endsOn: e.target.value }))} error={save.fields.endsOn} />
      </div>
      <MoneyField label="Valor combinado" value={v.price} onChange={(c) => setV((s) => ({ ...s, price: c }))} error={save.fields.agreedPriceCents} hint={plan?.currentPrice.kind === "promo" ? `Preço promocional vigente de ${plan.name}. Pode ser ajustado.` : undefined} />
      <CheckField label="Gerar cobrança (conta a receber)" checked={v.charge} onChange={(c) => setV((s) => ({ ...s, charge: c }))} />
      {v.charge && (
        <div className="space-y-3 rounded-xl bg-muted/60 p-3">
          <TextField label="Vencimento da cobrança" type="date" value={v.dueDate} onChange={(e) => setV((s) => ({ ...s, dueDate: e.target.value }))} />
          <CheckField label="Já recebi este valor" checked={v.paid} onChange={(c) => setV((s) => ({ ...s, paid: c }))} />
          {v.paid && (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Recebido em" type="date" value={v.paidOn} onChange={(e) => setV((s) => ({ ...s, paidOn: e.target.value }))} />
              <SelectField label="Forma" value={v.method} onChange={(e) => setV((s) => ({ ...s, method: e.target.value as PaymentMethod }))}>
                {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
              </SelectField>
            </div>
          )}
        </div>
      )}
      <AreaField label="Observações do contrato" rows={2} value={v.notes} onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))} />
    </Modal>
  );
}

function EditSubscriptionModal({ sub, onClose }: { sub: SubscriptionDto | null; onClose: () => void }) {
  const [v, setV] = useState({ startsOn: "", endsOn: "", price: null as number | null, notes: "" });
  useEffect(() => {
    if (sub) setV({ startsOn: sub.startsOn, endsOn: sub.endsOn, price: sub.agreedPriceCents, notes: sub.notes });
  }, [sub]);
  const save = useAction(() => api.put(`/api/admin/subscriptions/${sub!.id}`, { startsOn: v.startsOn, endsOn: v.endsOn, agreedPriceCents: v.price ?? 0, notes: v.notes }), { invalidate: keys, success: "Contratação atualizada.", onSuccess: onClose });
  if (!sub) return null;
  return (
    <Modal open onClose={onClose} title={`Editar plano ${sub.planName}`} description="Alterar datas atualiza imediatamente os indicadores de vencimento." footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Início" type="date" value={v.startsOn} onChange={(e) => setV((s) => ({ ...s, startsOn: e.target.value }))} error={save.fields.startsOn} />
        <TextField label="Término" type="date" value={v.endsOn} onChange={(e) => setV((s) => ({ ...s, endsOn: e.target.value }))} error={save.fields.endsOn} />
      </div>
      <MoneyField label="Valor combinado" value={v.price} onChange={(c) => setV((s) => ({ ...s, price: c }))} />
      <AreaField label="Observações" rows={2} value={v.notes} onChange={(e) => setV((s) => ({ ...s, notes: e.target.value }))} />
    </Modal>
  );
}

const PHASE: Record<SubscriptionDto["phase"], { label: string; tone: "success" | "danger" | "info" | "neutral" }> = {
  current: { label: "Vigente", tone: "success" },
  expired: { label: "Encerrado", tone: "neutral" },
  upcoming: { label: "Futuro", tone: "info" },
  cancelled: { label: "Cancelado", tone: "neutral" },
};

export default function ClientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirm();
  const q = useGet<ClientDetailDto>(["client", id], `/api/admin/clients/${id}`);
  const settings = useGet<{ renewalMessage: string; overdueMessage: string }>(["settings"], "/api/admin/settings");
  const [editing, setEditing] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [editSub, setEditSub] = useState<SubscriptionDto | null>(null);
  const [pay, setPay] = useState<ReceivableDto | null>(null);
  const [charge, setCharge] = useState(false);

  const archive = useAction((a: boolean) => api.post(`/api/admin/clients/${id}/${a ? "archive" : "restore"}`), { invalidate: keys, success: "Cadastro atualizado." });
  const remove = useAction(() => api.del(`/api/admin/clients/${id}`), { invalidate: keys, success: "Cliente excluído.", onSuccess: () => nav("/admin/clientes") });
  const cancelSub = useAction((o: { id: string; cancelOpenCharges: boolean }) => api.post(`/api/admin/subscriptions/${o.id}/cancel`, { cancelOpenCharges: o.cancelOpenCharges }), { invalidate: keys, success: "Contratação cancelada." });

  return (
    <>
      <Link to="/admin/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
        <ArrowLeft size={16} aria-hidden /> Clientes
      </Link>
      <Async q={q} rows={4}>
        {(c) => {
          const wa = c.whatsapp ?? c.phone;
          const current = c.subscriptions.find((s) => s.phase === "current");
          return (
            <>
              <PageHeader
                title={c.fullName}
                description={[formatPhone(wa), c.email].filter(Boolean).join(" · ") || "Sem contato cadastrado"}
                actions={
                  <>
                    <WhatsAppLink number={wa} size="md" label="Conversar" />
                    {!c.anonymizedAt && (
                      <Button variant="outline" onClick={() => setEditing(true)}>
                        <Pencil size={16} aria-hidden /> Editar
                      </Button>
                    )}
                  </>
                }
              />
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <StatusBadge status={c.status} kind="client" />
                {c.anonymizedAt && <Badge tone="neutral">Dados anonimizados</Badge>}
                <span className="text-sm text-muted-foreground">Cliente desde {formatDateBR(c.createdAt.slice(0, 10))}</span>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Plano atual" value={current?.planName ?? "—"} hint={current ? `até ${formatDateBR(current.endsOn)}` : "Sem plano vigente"} tone={c.expiringSoon ? "warning" : "neutral"} />
                <Stat label="Total recebido" value={formatBRL(c.totals.receivedCents)} tone="success" />
                <Stat label="A receber" value={formatBRL(c.totals.pendingCents)} />
                <Stat label="Em atraso" value={formatBRL(c.totals.overdueCents)} tone={c.totals.overdueCents ? "danger" : "neutral"} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Planos e contratações" actions={<Button size="sm" onClick={() => setSubOpen(true)} disabled={!!c.anonymizedAt}><CalendarPlus size={16} aria-hidden /> {c.subscriptions.length ? "Renovar / novo plano" : "Contratar plano"}</Button>} pad={false}>
                  {c.subscriptions.length === 0 ? (
                    <EmptyState title="Nenhum plano contratado" text="Registre a contratação para acompanhar o vencimento e gerar a cobrança." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {c.subscriptions.map((s) => (
                        <li key={s.id} className="px-4 py-3 sm:px-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{s.planName}</p>
                            <Badge tone={PHASE[s.phase].tone}>{PHASE[s.phase].label}</Badge>
                            <span className="ml-auto font-bold tabular-nums">{formatBRL(s.agreedPriceCents)}</span>
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {formatDateBR(s.startsOn)} a {formatDateBR(s.endsOn)}
                            {s.phase === "current" && ` · ${s.daysToEnd === 0 ? "termina hoje" : `faltam ${s.daysToEnd} dia(s)`}`}
                          </p>
                          {s.notes && <p className="mt-1 text-sm">{s.notes}</p>}
                          {s.status === "active" && (
                            <div className="mt-2 flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setEditSub(s)}>Editar</Button>
                              <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Cancelar contratação?", message: `O plano ${s.planName} será marcado como cancelado. Cobranças em aberto sem nenhum recebimento também serão canceladas.`, confirmLabel: "Cancelar plano", danger: true })) cancelSub.mutate({ id: s.id, cancelOpenCharges: true }); }}>Cancelar plano</Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Financeiro do cliente" actions={<Button size="sm" variant="outline" onClick={() => setCharge(true)} disabled={!!c.anonymizedAt}><CreditCard size={16} aria-hidden /> Nova cobrança</Button>} pad={false}>
                  {c.receivables.length === 0 ? (
                    <EmptyState title="Sem lançamentos" text="As cobranças e pagamentos deste cliente aparecem aqui." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {c.receivables.map((r) => (
                        <li key={r.id} className="px-4 py-3 sm:px-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 truncate font-semibold">{r.description}</p>
                            <StatusBadge status={r.status} kind="receivable" />
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            Vence {formatDateBR(r.dueDate)} · {formatBRL(r.amountCents)}
                            {r.receivedCents > 0 && r.status !== "cancelled" && ` · recebido ${formatBRL(r.receivedCents)}`}
                          </p>
                          {r.payments.filter((p) => !p.voidedAt).map((p) => (
                            <p key={p.id} className="text-xs text-muted-foreground">↳ {formatBRL(p.amountCents)} em {formatDateBR(p.paidOn)} ({PAYMENT_METHOD_LABELS[p.method]})</p>
                          ))}
                          {(r.status === "pending" || r.status === "overdue") && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => setPay(r)}>Registrar recebimento</Button>
                              {r.status === "overdue" && <WhatsAppLink number={wa} label="Cobrar" message={fillTemplate(settings.data?.overdueMessage ?? "", { nome: c.fullName.split(" ")[0], valor: formatBRL(r.remainingCents), data: formatDateBR(r.dueDate) })} />}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Observações">
                  <p className="whitespace-pre-line text-sm">{c.notes || <span className="text-muted-foreground">Nenhuma observação.</span>}</p>
                </Panel>

                <Panel title="Últimos compromissos" pad={false}>
                  {c.appointments.length === 0 ? (
                    <p className="p-5 text-center text-sm text-muted-foreground">Nenhum compromisso vinculado a este cliente.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {c.appointments.map((a) => {
                        const s = isoToLocalParts(a.startsAt);
                        return (
                          <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                            <span className="font-semibold">{formatDateBR(s.date)} {s.time}</span>
                            <span className="text-muted-foreground">{APPOINTMENT_KIND_LABELS[a.kind]}</span>
                            <span className="ml-auto"><StatusBadge status={a.status} kind="appointment" /></span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
                {c.archivedAt ? (
                  <Button variant="outline" onClick={() => archive.mutate(false)}><RotateCcw size={16} aria-hidden /> Restaurar cadastro</Button>
                ) : (
                  <Button variant="outline" onClick={async () => { if (await confirm({ title: "Arquivar cliente?", message: "O cadastro sai da lista principal, mas todo o histórico de planos e pagamentos é preservado. Você pode restaurar depois.", confirmLabel: "Arquivar" })) archive.mutate(true); }}><Archive size={16} aria-hidden /> Arquivar</Button>
                )}
                <Button variant="ghost" className="text-destructive" onClick={async () => { if (await confirm({ title: "Excluir cliente?", message: "A exclusão só é permitida para cadastros sem histórico de planos ou financeiro. Esta ação não pode ser desfeita.", confirmLabel: "Excluir", danger: true })) remove.mutate(undefined as never); }}><Trash2 size={16} aria-hidden /> Excluir</Button>
              </div>

              <EditClientModal client={c} open={editing} onClose={() => setEditing(false)} />
              <SubscriptionModal client={c} open={subOpen} onClose={() => setSubOpen(false)} />
              <EditSubscriptionModal sub={editSub} onClose={() => setEditSub(null)} />
              <PaymentModal receivable={pay} onClose={() => setPay(null)} />
              <ReceivableModal open={charge} onClose={() => setCharge(false)} defaultClientId={c.id} />
            </>
          );
        }}
      </Async>
    </>
  );
}

