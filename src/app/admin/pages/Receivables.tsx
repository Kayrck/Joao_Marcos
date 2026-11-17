import { ChevronDown, Download, Plus, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, qs } from "../../../lib/api";
import { PAYMENT_METHOD_LABELS } from "../../../../shared/constants";
import { fillTemplate, formatBRL, formatDateBR } from "../../../../shared/format";
import type { Page, ReceivableDto } from "../../../../shared/types";
import { Async, AreaField, Button, Chips, EmptyState, Modal, PageHeader, Pagination, Panel, SearchBox, TextField, WhatsAppLink, cx, downloadFile, useAction, useConfirm, useDebounced, useGet } from "../ui";
import { FIN_KEYS, PaymentModal, ReceivableModal, StatusBadge } from "../parts";

type Filter = "" | "pending" | "overdue" | "received" | "cancelled";
type ListData = Page<ReceivableDto> & { totals: { amountCents: number; receivedCents: number; remainingCents: number } };

function CancelModal({ item, onClose }: { item: ReceivableDto | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [item]);
  const cancel = useAction(() => api.post(`/api/admin/receivables/${item!.id}/cancel`, { reason }), { invalidate: FIN_KEYS, success: "Conta cancelada.", onSuccess: onClose });
  if (!item) return null;
  return (
    <Modal open onClose={onClose} title="Cancelar conta" description={`${item.description} — ${formatBRL(item.amountCents)}. Cancelamentos não entram nos totais, mas ficam no histórico.`} footer={<><Button variant="outline" onClick={onClose}>Voltar</Button><Button variant="danger" onClick={() => cancel.mutate(undefined as never)} loading={cancel.isPending}>Cancelar conta</Button></>}>
      <AreaField label="Motivo (opcional)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}

function Row({ r, onPay, onEdit, onCancel, overdueMessage }: { r: ReceivableDto; onPay: () => void; onEdit: () => void; onCancel: () => void; overdueMessage: string }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const reopen = useAction(() => api.post(`/api/admin/receivables/${r.id}/reopen`), { invalidate: FIN_KEYS, success: "Conta reaberta." });
  const voidPay = useAction((id: string) => api.post(`/api/admin/payments/${id}/void`, { reason: "Estornado pelo administrador" }), { invalidate: FIN_KEYS, success: "Pagamento estornado." });
  const isOpen = r.status === "pending" || r.status === "overdue";
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="truncate font-semibold">{r.description}</p>
          <p className="truncate text-sm text-muted-foreground">{r.clientName ?? "Sem cliente"} · vence {formatDateBR(r.dueDate)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums">{formatBRL(r.amountCents)}</p>
          {r.receivedCents > 0 && r.status !== "cancelled" && <p className="text-xs text-muted-foreground">recebido {formatBRL(r.receivedCents)}</p>}
        </div>
        <StatusBadge status={r.status} kind="receivable" />
        <div className="flex flex-wrap items-center gap-2">
          {isOpen && <Button size="sm" onClick={onPay}>Receber</Button>}
          {r.status === "overdue" && <WhatsAppLink number={r.clientWhatsapp} label="Cobrar" message={fillTemplate(overdueMessage, { nome: (r.clientName ?? "").split(" ")[0], valor: formatBRL(r.remainingCents), data: formatDateBR(r.dueDate) })} />}
          <button type="button" className="grid size-9 place-items-center rounded-lg hover:bg-muted" aria-expanded={open} aria-label="Detalhes" onClick={() => setOpen(!open)}>
            <ChevronDown size={18} className={cx("transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2 rounded-xl bg-muted/60 p-3 text-sm">
          {r.notes && <p>{r.notes}</p>}
          {r.cancelReason && <p className="text-muted-foreground">Motivo do cancelamento: {r.cancelReason}</p>}
          {r.payments.length === 0 ? <p className="text-muted-foreground">Nenhum recebimento registrado.</p> : (
            <ul className="space-y-1.5">
              {r.payments.map((p) => (
                <li key={p.id} className={cx("flex flex-wrap items-center gap-2", p.voidedAt && "text-muted-foreground line-through")}>
                  <span>{formatBRL(p.amountCents)} em {formatDateBR(p.paidOn)} · {PAYMENT_METHOD_LABELS[p.method]}{p.voidedAt ? " (estornado)" : ""}</span>
                  {!p.voidedAt && r.status !== "cancelled" && (
                    <button type="button" className="font-semibold text-destructive underline no-underline-offset-0" onClick={async () => { if (await confirm({ title: "Estornar pagamento?", message: `O recebimento de ${formatBRL(p.amountCents)} deixa de contar nos totais e o saldo volta a ficar em aberto.`, confirmLabel: "Estornar", danger: true })) voidPay.mutate(p.id); }}>estornar</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {r.status !== "cancelled" && <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>}
            {isOpen && r.receivedCents === 0 && <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar conta</Button>}
            {r.status === "cancelled" && <Button size="sm" variant="outline" onClick={() => reopen.mutate(undefined as never)}>Reabrir</Button>}
          </div>
        </div>
      )}
    </li>
  );
}

export default function Receivables() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<Filter>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; item: ReceivableDto | null }>({ open: params.get("novo") === "1", item: null });
  const [pay, setPay] = useState<ReceivableDto | null>(null);
  const [cancel, setCancel] = useState<ReceivableDto | null>(null);
  const term = useDebounced(search);
  const query = qs({ status, q: term, from, to });
  const q = useGet<ListData>(["receivables", query, page], `/api/admin/receivables${qs({ status, q: term, from, to, page, pageSize: 30 })}`);
  const settings = useGet<{ overdueMessage: string }>(["settings"], "/api/admin/settings");
  useEffect(() => {
    if (params.get("novo")) setParams({}, { replace: true });
  }, [params, setParams]);

  return (
    <>
      <PageHeader
        title="Contas a receber"
        description="Cobranças de planos e outros recebimentos. Somente valores efetivamente recebidos entram no saldo realizado."
        actions={<><Button variant="outline" onClick={() => downloadFile(`/api/admin/receivables.csv${query}`, "contas-a-receber.csv")}><Download size={16} aria-hidden /> CSV</Button><Button onClick={() => setForm({ open: true, item: null })}><Plus size={18} aria-hidden /> Nova conta</Button></>}
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchBox value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Buscar descrição ou cliente" />
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <TextField label="Vencimento de" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
            <TextField label="até" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
          </div>
        </div>
        <Chips label="Status" value={status} onChange={(s) => (setStatus(s), setPage(1))} options={[{ value: "", label: "Todas" }, { value: "pending", label: "Pendentes" }, { value: "overdue", label: "Atrasadas" }, { value: "received", label: "Recebidas" }, { value: "cancelled", label: "Canceladas" }]} />
      </div>

      <Async q={q} rows={4}>
        {(d) => (
          <>
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Total listado</p><p className="font-bold tabular-nums">{formatBRL(d.totals.amountCents)}</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">Recebido</p><p className="font-bold tabular-nums text-success">{formatBRL(d.totals.receivedCents)}</p></div>
              <div className="rounded-xl border border-border bg-card p-3"><p className="text-xs text-muted-foreground">A receber</p><p className="font-bold tabular-nums">{formatBRL(d.totals.remainingCents)}</p></div>
            </div>
            <Panel pad={false}>
              {d.items.length === 0 ? (
                <EmptyState icon={<Wallet size={26} />} title="Nenhuma conta encontrada" text="Cadastre uma cobrança ou contrate um plano para um cliente (a cobrança pode ser gerada automaticamente)." action={<Button onClick={() => setForm({ open: true, item: null })}>Nova conta a receber</Button>} />
              ) : (
                <ul className="divide-y divide-border">
                  {d.items.map((r) => (
                    <Row key={r.id} r={r} onPay={() => setPay(r)} onEdit={() => setForm({ open: true, item: r })} onCancel={() => setCancel(r)} overdueMessage={settings.data?.overdueMessage ?? ""} />
                  ))}
                </ul>
              )}
            </Panel>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
          </>
        )}
      </Async>
      <ReceivableModal open={form.open} initial={form.item} onClose={() => setForm({ open: false, item: null })} />
      <PaymentModal receivable={pay} onClose={() => setPay(null)} />
      <CancelModal item={cancel} onClose={() => setCancel(null)} />
    </>
  );
}
