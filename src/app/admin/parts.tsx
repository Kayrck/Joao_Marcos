import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import {
  APPOINTMENT_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  PAYABLE_STATUS_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  RECEIVABLE_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type PaymentMethod,
} from "../../../shared/constants";
import { todayLocal } from "../../../shared/dates";
import { formatBRL } from "../../../shared/format";
import type { ClientListItem, Page, ReceivableDto } from "../../../shared/types";
import { AreaField, Badge, Button, MoneyField, Modal, SelectField, TextField, useAction, useGet, type Tone } from "./ui";

export const FIN_KEYS = [["receivables"], ["payables"], ["client"], ["clients"], ["dashboard"], ["finance"], ["alerts"], ["reports"]];

const T: Record<string, Tone> = {
  active: "success",
  inactive: "neutral",
  pending: "warning",
  expired: "danger",
  archived: "neutral",
  overdue: "danger",
  received: "success",
  paid: "success",
  cancelled: "neutral",
  new: "info",
  in_progress: "warning",
  awaiting: "warning",
  converted: "success",
  not_converted: "neutral",
  approved: "success",
  rejected: "neutral",
  scheduled: "info",
  completed: "success",
  no_show: "danger",
};

const LABELS: Record<string, string> = {
  ...CLIENT_STATUS_LABELS,
  ...LEAD_STATUS_LABELS,
  ...REVIEW_STATUS_LABELS,
  ...APPOINTMENT_STATUS_LABELS,
  ...RECEIVABLE_STATUS_LABELS,
  ...PAYABLE_STATUS_LABELS,
};

export function StatusBadge({ status, kind }: { status: string; kind?: "client" | "receivable" | "payable" | "lead" | "review" | "appointment" }) {
  // "pending" muda de rótulo conforme o módulo
  const label =
    kind === "client" ? CLIENT_STATUS_LABELS[status as keyof typeof CLIENT_STATUS_LABELS]
    : kind === "receivable" ? RECEIVABLE_STATUS_LABELS[status as keyof typeof RECEIVABLE_STATUS_LABELS]
    : kind === "payable" ? PAYABLE_STATUS_LABELS[status as keyof typeof PAYABLE_STATUS_LABELS]
    : kind === "review" ? REVIEW_STATUS_LABELS[status as keyof typeof REVIEW_STATUS_LABELS]
    : kind === "lead" ? LEAD_STATUS_LABELS[status as keyof typeof LEAD_STATUS_LABELS]
    : kind === "appointment" ? APPOINTMENT_STATUS_LABELS[status as keyof typeof APPOINTMENT_STATUS_LABELS]
    : LABELS[status];
  const tone = kind === "client" && status === "pending" ? "info" : (T[status] ?? "neutral");
  return <Badge tone={tone}>{label ?? status}</Badge>;
}

export const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => (
  <option key={m} value={m}>
    {PAYMENT_METHOD_LABELS[m]}
  </option>
));

/** Registrar recebimento (total ou parcial) de uma conta a receber. */
export function PaymentModal({ receivable, onClose }: { receivable: ReceivableDto | null; onClose: () => void }) {
  const [amount, setAmount] = useState<number | null>(null);
  const [paidOn, setPaidOn] = useState(todayLocal());
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (receivable) {
      setAmount(receivable.remainingCents);
      setPaidOn(todayLocal());
      setNotes("");
    }
  }, [receivable]);
  const save = useAction(() => api.post(`/api/admin/receivables/${receivable!.id}/payments`, { amountCents: amount, paidOn, method, notes }), {
    invalidate: FIN_KEYS,
    success: "Recebimento registrado.",
    onSuccess: onClose,
  });
  if (!receivable) return null;
  const partial = amount !== null && amount < receivable.remainingCents;
  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar recebimento"
      description={`${receivable.description} — saldo a receber: ${formatBRL(receivable.remainingCents)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending} disabled={!amount}>
            {partial ? "Registrar parcial" : "Confirmar recebimento"}
          </Button>
        </>
      }
    >
      <MoneyField label="Valor recebido" value={amount} onChange={setAmount} error={save.fields.amountCents} hint={partial ? "Recebimento parcial: o restante continua a receber." : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Data do recebimento" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={save.fields.paidOn} />
        <SelectField label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {METHOD_OPTIONS}
        </SelectField>
      </div>
      <AreaField label="Observações" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </Modal>
  );
}

/** Seletor de cliente (carrega a lista completa de clientes não arquivados). */
export function ClientSelect({ value, onChange, label = "Cliente", error, optional = true }: { value: string | null; onChange: (id: string | null) => void; label?: string; error?: string; optional?: boolean }) {
  const q = useGet<Page<ClientListItem>>(["clients", "select"], "/api/admin/clients?pageSize=200");
  return (
    <SelectField label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} error={error}>
      <option value="">{optional ? "— Sem cliente vinculado —" : "Selecione…"}</option>
      {q.data?.items.map((c) => (
        <option key={c.id} value={c.id}>
          {c.fullName}
        </option>
      ))}
    </SelectField>
  );
}

/** Criar/editar uma conta a receber. */
export function ReceivableModal({ open, onClose, initial, defaultClientId }: { open: boolean; onClose: () => void; initial?: ReceivableDto | null; defaultClientId?: string | null }) {
  const blank = { description: "", clientId: (defaultClientId ?? null) as string | null, amountCents: null as number | null, dueDate: todayLocal(), notes: "" };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setV(initial ? { description: initial.description, clientId: initial.clientId, amountCents: initial.amountCents, dueDate: initial.dueDate, notes: initial.notes } : { ...blank, clientId: defaultClientId ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);
  const save = useAction(
    () => {
      const body = { ...v, subscriptionId: initial?.subscriptionId ?? null };
      return initial ? api.put(`/api/admin/receivables/${initial.id}`, body) : api.post("/api/admin/receivables", body);
    },
    { invalidate: FIN_KEYS, success: initial ? "Conta atualizada." : "Conta cadastrada.", onSuccess: onClose },
  );
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Editar conta a receber" : "Nova conta a receber"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>
            Salvar
          </Button>
        </>
      }
    >
      <TextField label="Descrição" value={v.description} maxLength={200} onChange={(e) => set("description", e.target.value)} error={save.fields.description} placeholder="Ex.: Mensalidade de dezembro" />
      <ClientSelect value={v.clientId} onChange={(id) => set("clientId", id)} error={save.fields.clientId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField label="Valor" value={v.amountCents} onChange={(c) => set("amountCents", c)} error={save.fields.amountCents} />
        <TextField label="Vencimento" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={save.fields.dueDate} />
      </div>
      <AreaField label="Observações" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
    </Modal>
  );
}
