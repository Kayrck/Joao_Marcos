import { MessageSquarePlus, Plus, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api, qs } from "../../../lib/api";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "../../../../shared/constants";
import { formatDateBR } from "../../../../shared/format";
import { formatPhone } from "../../../../shared/phone";
import type { LeadDto, Page } from "../../../../shared/types";
import { Async, Button, Chips, EmptyState, Modal, PageHeader, Panel, SearchBox, SelectField, TextField, AreaField, WhatsAppLink, useAction, useConfirm, useDebounced, useGet } from "../ui";
import { StatusBadge } from "../parts";

type ListData = Page<LeadDto> & { counts: Record<string, number> };
const KEYS = [["leads"], ["dashboard"], ["alerts"], ["clients"]];

function LeadModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: LeadDto | null }) {
  const blank = { fullName: "", whatsapp: "", phone: "", source: "", interest: "", status: "new" as LeadStatus };
  const [v, setV] = useState(blank);
  useEffect(() => {
    if (open) setV(lead ? { fullName: lead.fullName, whatsapp: lead.whatsapp ?? "", phone: lead.phone ?? "", source: lead.source, interest: lead.interest, status: lead.status } : blank);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead]);
  const save = useAction(() => (lead ? api.put(`/api/admin/leads/${lead.id}`, v) : api.post("/api/admin/leads", v)), { invalidate: KEYS, success: "Interessado salvo.", onSuccess: onClose });
  return (
    <Modal open={open} onClose={onClose} title={lead ? "Editar interessado" : "Novo interessado"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button></>}>
      <TextField label="Nome" value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} error={save.fields.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="WhatsApp" type="tel" value={v.whatsapp} onChange={(e) => setV({ ...v, whatsapp: e.target.value })} error={save.fields.whatsapp} />
        <TextField label="Telefone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} error={save.fields.phone} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Origem do contato" value={v.source} placeholder="Instagram, indicação, site…" onChange={(e) => setV({ ...v, source: e.target.value })} />
        <SelectField label="Status" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as LeadStatus })} disabled={!!lead?.convertedClientId}>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
        </SelectField>
      </div>
      <TextField label="Interesse" value={v.interest} placeholder="Ex.: emagrecimento, ganho de massa" onChange={(e) => setV({ ...v, interest: e.target.value })} />
    </Modal>
  );
}

function NotesModal({ lead, onClose }: { lead: LeadDto | null; onClose: () => void }) {
  const q = useGet<LeadDto>(["leads", "detail", lead?.id], lead ? `/api/admin/leads/${lead.id}` : null);
  const [body, setBody] = useState("");
  const add = useAction(() => api.post(`/api/admin/leads/${lead!.id}/notes`, { body }), { invalidate: [["leads"]], onSuccess: () => setBody("") });
  if (!lead) return null;
  return (
    <Modal open onClose={onClose} title={`Observações — ${lead.fullName}`} description="Registre o andamento do atendimento.">
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(undefined as never); }}>
        <AreaField label="Nova observação" rows={2} value={body} onChange={(e) => setBody(e.target.value)} error={add.fields.body} />
        <Button type="submit" size="sm" loading={add.isPending}>Registrar</Button>
      </form>
      <Async q={q} rows={2}>
        {(d) => (d.notes?.length ? <ul className="space-y-2">{d.notes.map((n) => <li key={n.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><p className="whitespace-pre-line">{n.body}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhuma observação ainda.</p>)}
      </Async>
    </Modal>
  );
}

export default function Leads() {
  const nav = useNavigate();
  const confirm = useConfirm();
  const [status, setStatus] = useState<"" | LeadStatus>("");
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const q = useGet<ListData>(["leads", status, term], `/api/admin/leads${qs({ status, q: term, pageSize: 100 })}`);
  const [form, setForm] = useState<{ open: boolean; lead: LeadDto | null }>({ open: false, lead: null });
  const [notes, setNotes] = useState<LeadDto | null>(null);
  const setLeadStatus = useAction((o: { id: string; status: LeadStatus }) => api.post(`/api/admin/leads/${o.id}/status`, { status: o.status }), { invalidate: KEYS });
  const convert = useAction((id: string) => api.post<{ client: { id: string } }>(`/api/admin/leads/${id}/convert`), { invalidate: KEYS, success: "Convertido em cliente.", onSuccess: (r) => nav(`/admin/clientes/${r.client.id}`) });
  const remove = useAction((id: string) => api.del(`/api/admin/leads/${id}`), { invalidate: KEYS, success: "Interessado excluído." });
  const counts = q.data?.counts;

  return (
    <>
      <PageHeader title="Interessados" description="Pessoas que demonstraram interesse na consultoria. Converta em cliente sem digitar tudo de novo." actions={<Button onClick={() => setForm({ open: true, lead: null })}><Plus size={18} aria-hidden /> Novo interessado</Button>} />
      <div className="mb-4 space-y-3">
        <SearchBox value={search} onChange={setSearch} placeholder="Buscar por nome, telefone ou interesse" />
        <Chips label="Status" value={status} onChange={setStatus} options={[{ value: "", label: "Todos" }, ...LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s], count: counts?.[s] }))]} />
      </div>
      <Async q={q} rows={3}>
        {(d) => d.items.length === 0 ? (
          <Panel><EmptyState title="Nenhum interessado" text="Contatos enviados pelo formulário do site aparecem aqui automaticamente, e você também pode cadastrar manualmente." action={<Button onClick={() => setForm({ open: true, lead: null })}>Cadastrar interessado</Button>} /></Panel>
        ) : (
          <Panel pad={false}>
            <ul className="divide-y divide-border">
              {d.items.map((l) => (
                <li key={l.id} className="px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-semibold">{l.fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">{formatPhone(l.whatsapp ?? l.phone) || "Sem telefone"} · 1º contato {formatDateBR(l.firstContactOn)}{l.source ? ` · ${l.source}` : ""}</p>
                      {l.interest && <p className="truncate text-sm">{l.interest}</p>}
                    </div>
                    {l.convertedClientId ? <StatusBadge status="converted" kind="lead" /> : (
                      <select aria-label={`Status de ${l.fullName}`} className="min-h-10 rounded-lg border border-input bg-input-background px-2 text-sm font-semibold" value={l.status} onChange={(e) => setLeadStatus.mutate({ id: l.id, status: e.target.value as LeadStatus })}>
                        {LEAD_STATUSES.filter((s) => s !== "converted").map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                      </select>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <WhatsAppLink number={l.whatsapp ?? l.phone} />
                      <Button size="sm" variant="outline" onClick={() => setNotes(l)}><MessageSquarePlus size={15} aria-hidden /> Notas</Button>
                      {l.convertedClientId ? <Button size="sm" variant="outline" onClick={() => nav(`/admin/clientes/${l.convertedClientId}`)}>Ver cliente</Button> : <Button size="sm" onClick={async () => { if (await confirm({ title: "Converter em cliente?", message: `${l.fullName} será cadastrado como cliente com os mesmos dados.`, confirmLabel: "Converter" })) convert.mutate(l.id); }}><UserCheck size={15} aria-hidden /> Converter</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, lead: l })}>Editar</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (await confirm({ title: "Excluir interessado?", message: "Os dados e observações deste contato serão apagados.", confirmLabel: "Excluir", danger: true })) remove.mutate(l.id); }}>Excluir</Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Async>
      <LeadModal open={form.open} lead={form.lead} onClose={() => setForm({ open: false, lead: null })} />
      <NotesModal lead={notes} onClose={() => setNotes(null)} />
    </>
  );
}
