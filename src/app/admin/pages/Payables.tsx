import { Download, Plus, Receipt, Settings2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { api, qs } from "../../../lib/api";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from "../../../../shared/constants";
import { todayLocal } from "../../../../shared/dates";
import { formatBRL, formatDateBR } from "../../../../shared/format";
import type { ExpenseCategoryDto, Page, PayableDto } from "../../../../shared/types";
import { Async, AreaField, Button, CheckField, Chips, EmptyState, Modal, MoneyField, PageHeader, Pagination, Panel, SearchBox, SelectField, TextField, downloadFile, useAction, useConfirm, useDebounced, useGet } from "../ui";
import { FIN_KEYS, METHOD_OPTIONS, StatusBadge } from "../parts";

type Filter = "" | "pending" | "overdue" | "paid" | "cancelled";
type ListData = Page<PayableDto> & { totalAmountCents: number };
type Category = ExpenseCategoryDto & { usage: number };

function PayableModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: PayableDto | null }) {
  const cats = useGet<Category[]>(["payables", "categories"], "/api/admin/expense-categories");
  const blank = { description: "", categoryId: "", amountCents: null as number | null, dueDate: todayLocal(), notes: "", alreadyPaid: false, paidOn: todayLocal(), method: "pix" as PaymentMethod };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (!open) return;
    setV(item ? { ...blank, description: item.description, categoryId: item.categoryId, amountCents: item.amountCents, dueDate: item.dueDate, notes: item.notes } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);
  const save = useAction(
    () => {
      const body = { description: v.description, categoryId: v.categoryId, amountCents: v.amountCents, dueDate: v.dueDate, notes: v.notes };
      return item ? api.put(`/api/admin/payables/${item.id}`, body) : api.post("/api/admin/payables", { ...body, ...(v.alreadyPaid ? { paid: { paidOn: v.paidOn, method: v.method } } : {}) });
    },
    { invalidate: FIN_KEYS, success: item ? "Despesa atualizada." : "Despesa cadastrada.", onSuccess: onClose },
  );
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal open={open} onClose={onClose} title={item ? "Editar despesa" : "Nova despesa"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <TextField label="Descrição" value={v.description} maxLength={200} onChange={(e) => set("description", e.target.value)} error={save.fields.description} placeholder="Ex.: Anilhas e halteres" />
      <SelectField label="Categoria" value={v.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={save.fields.categoryId}>
        <option value="">Selecione…</option>
        {cats.data?.filter((c) => c.isActive || c.id === v.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField label="Valor" value={v.amountCents} onChange={(c) => set("amountCents", c)} error={save.fields.amountCents} />
        <TextField label="Vencimento" type="date" value={v.dueDate} onChange={(e) => set("dueDate", e.target.value)} error={save.fields.dueDate} />
      </div>
      {!item && <CheckField label="Já está paga" checked={v.alreadyPaid} onChange={(c) => set("alreadyPaid", c)} />}
      {!item && v.alreadyPaid && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Pago em" type="date" value={v.paidOn} onChange={(e) => set("paidOn", e.target.value)} />
          <SelectField label="Forma de pagamento" value={v.method} onChange={(e) => set("method", e.target.value as PaymentMethod)}>{METHOD_OPTIONS}</SelectField>
        </div>
      )}
      <AreaField label="Observações" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
    </Modal>
  );
}

function PayModal({ item, onClose }: { item: PayableDto | null; onClose: () => void }) {
  const [paidOn, setPaidOn] = useState(todayLocal());
  const [method, setMethod] = useState<PaymentMethod>("pix");
  useEffect(() => setPaidOn(todayLocal()), [item]);
  const pay = useAction(() => api.post(`/api/admin/payables/${item!.id}/pay`, { paidOn, method }), { invalidate: FIN_KEYS, success: "Pagamento registrado.", onSuccess: onClose });
  if (!item) return null;
  return (
    <Modal open onClose={onClose} title="Registrar pagamento" description={`${item.description} — ${formatBRL(item.amountCents)}`} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => pay.mutate(undefined as never)} loading={pay.isPending}>Confirmar pagamento</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Pago em" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} error={pay.fields.paidOn} />
        <SelectField label="Forma de pagamento" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}</SelectField>
      </div>
    </Modal>
  );
}

function CategoriesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const confirm = useConfirm();
  const q = useGet<Category[]>(["payables", "categories"], "/api/admin/expense-categories");
  const [name, setName] = useState("");
  const keys = [["payables"]];
  const add = useAction(() => api.post("/api/admin/expense-categories", { name, isActive: true }), { invalidate: keys, success: "Categoria criada.", onSuccess: () => setName("") });
  const rename = useAction((c: { id: string; name: string; isActive: boolean }) => api.put(`/api/admin/expense-categories/${c.id}`, { name: c.name, isActive: c.isActive }), { invalidate: keys, success: "Categoria atualizada." });
  const remove = useAction((id: string) => api.del(`/api/admin/expense-categories/${id}`), { invalidate: keys, success: "Categoria excluída." });
  return (
    <Modal open={open} onClose={onClose} title="Categorias de despesa" description="Crie, renomeie ou desative categorias. Categorias com lançamentos não podem ser excluídas (apenas desativadas).">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) add.mutate(undefined as never); }}>
        <div className="flex-1"><TextField label="Nova categoria" value={name} onChange={(e) => setName(e.target.value)} error={add.fields.name} /></div>
        <Button type="submit" className="mt-[1.65rem]" loading={add.isPending}><Plus size={16} aria-hidden /> Adicionar</Button>
      </form>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {q.data?.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-3 py-2">
            <input aria-label={`Nome da categoria ${c.name}`} defaultValue={c.name} className="min-h-10 flex-1 rounded-lg border border-transparent bg-transparent px-2 hover:border-input focus:border-ring focus:outline-none" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && rename.mutate({ id: c.id, name: e.target.value, isActive: c.isActive })} />
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={c.isActive} className="accent-[var(--primary)]" onChange={(e) => rename.mutate({ id: c.id, name: c.name, isActive: e.target.checked })} /> ativa</label>
            <span className="w-8 text-center text-xs text-muted-foreground" title="Lançamentos">{c.usage}</span>
            <button type="button" aria-label={`Excluir ${c.name}`} className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-muted" onClick={async () => { if (await confirm({ title: "Excluir categoria?", message: `A categoria "${c.name}" será removida.`, confirmLabel: "Excluir", danger: true })) remove.mutate(c.id); }}><Trash2 size={16} aria-hidden /></button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function Payables() {
  const [params, setParams] = useSearchParams();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Filter>("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<{ open: boolean; item: PayableDto | null }>({ open: params.get("novo") === "1", item: null });
  const [pay, setPay] = useState<PayableDto | null>(null);
  const [cats, setCats] = useState(false);
  const term = useDebounced(search);
  const query = qs({ status, q: term, from, to });
  const q = useGet<ListData>(["payables", query, page], `/api/admin/payables${qs({ status, q: term, from, to, page, pageSize: 30 })}`);
  useEffect(() => {
    if (params.get("novo")) setParams({}, { replace: true });
  }, [params, setParams]);
  const unpay = useAction((id: string) => api.post(`/api/admin/payables/${id}/unpay`), { invalidate: FIN_KEYS, success: "Pagamento estornado." });
  const cancel = useAction((id: string) => api.post(`/api/admin/payables/${id}/cancel`, {}), { invalidate: FIN_KEYS, success: "Conta cancelada." });

  return (
    <>
      <PageHeader
        title="Contas a pagar"
        description="Despesas do negócio. Somente as efetivamente pagas entram no saldo realizado."
        actions={<><Button variant="outline" onClick={() => setCats(true)}><Settings2 size={16} aria-hidden /> Categorias</Button><Button variant="outline" onClick={() => downloadFile(`/api/admin/payables.csv${query}`, "contas-a-pagar.csv")}><Download size={16} aria-hidden /> CSV</Button><Button onClick={() => setForm({ open: true, item: null })}><Plus size={18} aria-hidden /> Nova despesa</Button></>}
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <SearchBox value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Buscar descrição" />
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <TextField label="Vencimento de" type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} />
            <TextField label="até" type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} />
          </div>
        </div>
        <Chips label="Status" value={status} onChange={(s) => (setStatus(s), setPage(1))} options={[{ value: "", label: "Todas" }, { value: "pending", label: "Pendentes" }, { value: "overdue", label: "Atrasadas" }, { value: "paid", label: "Pagas" }, { value: "cancelled", label: "Canceladas" }]} />
      </div>
      <Async q={q} rows={4}>
        {(d) => (
          <>
            <p className="mb-3 text-sm text-muted-foreground">Total listado (sem canceladas): <strong className="text-foreground">{formatBRL(d.totalAmountCents)}</strong></p>
            <Panel pad={false}>
              {d.items.length === 0 ? (
                <EmptyState icon={<Receipt size={26} />} title="Nenhuma despesa encontrada" text="Registre equipamentos, transporte, software e outros gastos para acompanhar o saldo." action={<Button onClick={() => setForm({ open: true, item: null })}>Nova despesa</Button>} />
              ) : (
                <ul className="divide-y divide-border">
                  {d.items.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                      <div className="min-w-0 flex-1 basis-56">
                        <p className="truncate font-semibold">{p.description}</p>
                        <p className="truncate text-sm text-muted-foreground">{p.categoryName} · vence {formatDateBR(p.dueDate)}{p.paidOn ? ` · pago ${formatDateBR(p.paidOn)}` : ""}</p>
                      </div>
                      <p className="font-bold tabular-nums">{formatBRL(p.amountCents)}</p>
                      <StatusBadge status={p.status} kind="payable" />
                      <div className="flex flex-wrap gap-2">
                        {(p.status === "pending" || p.status === "overdue") && (<><Button size="sm" onClick={() => setPay(p)}>Pagar</Button><Button size="sm" variant="outline" onClick={() => setForm({ open: true, item: p })}>Editar</Button><Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Cancelar despesa?", message: `${p.description} será cancelada e não entrará nos totais.`, confirmLabel: "Cancelar despesa", danger: true })) cancel.mutate(p.id); }}>Cancelar</Button></>)}
                        {p.status === "paid" && <Button size="sm" variant="ghost" onClick={async () => { if (await confirm({ title: "Estornar pagamento?", message: "A despesa volta a ficar pendente e deixa de contar como paga.", confirmLabel: "Estornar", danger: true })) unpay.mutate(p.id); }}>Estornar</Button>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
          </>
        )}
      </Async>
      <PayableModal open={form.open} item={form.item} onClose={() => setForm({ open: false, item: null })} />
      <PayModal item={pay} onClose={() => setPay(null)} />
      <CategoriesModal open={cats} onClose={() => setCats(false)} />
    </>
  );
}
