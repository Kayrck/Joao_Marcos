import { ChevronRight, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { api, qs } from "../../../lib/api";
import { formatDateBR, fillTemplate } from "../../../../shared/format";
import { formatPhone } from "../../../../shared/phone";
import type { ClientListItem, Page } from "../../../../shared/types";
import { Async, AreaField, Button, Chips, EmptyState, Modal, PageHeader, Pagination, Panel, SearchBox, TextField, WhatsAppLink, cx, useAction, useDebounced, useGet } from "../ui";
import { StatusBadge } from "../parts";

type Filter = "default" | "active" | "expiring" | "expired" | "pending" | "inactive" | "archived" | "all";
type ListData = Page<ClientListItem> & { counts: Record<string, number> };

export function ClientFormModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const [v, setV] = useState({ fullName: "", whatsapp: "", phone: "", email: "", notes: "" });
  useEffect(() => {
    if (open) setV({ fullName: "", whatsapp: "", phone: "", email: "", notes: "" });
  }, [open]);
  const save = useAction(() => api.post<{ id: string }>("/api/admin/clients", { ...v, isActive: true }), {
    invalidate: [["clients"], ["dashboard"]],
    success: "Cliente cadastrado.",
    onSuccess: (c) => {
      onClose();
      onCreated?.(c.id);
    },
  });
  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo cliente"
      description="Peça só o necessário: nome e um contato bastam."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate(undefined as never)} loading={save.isPending}>
            Cadastrar
          </Button>
        </>
      }
    >
      <TextField label="Nome completo" value={v.fullName} maxLength={160} autoComplete="off" onChange={(e) => set("fullName", e.target.value)} error={save.fields.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="WhatsApp" type="tel" inputMode="tel" placeholder="(85) 99999-9999" value={v.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} error={save.fields.whatsapp} />
        <TextField label="Telefone" type="tel" inputMode="tel" value={v.phone} onChange={(e) => set("phone", e.target.value)} error={save.fields.phone} />
      </div>
      <TextField label="E-mail (opcional)" type="email" value={v.email} onChange={(e) => set("email", e.target.value)} error={save.fields.email} />
      <AreaField label="Observações administrativas" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
    </Modal>
  );
}

export default function Clients() {
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>("default");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get("novo") === "1");
  const term = useDebounced(search);
  const url = `/api/admin/clients${qs({ status: filter === "default" ? undefined : filter, q: term, page, pageSize: 30 })}`;
  const q = useGet<ListData>(["clients", filter, term, page], url);
  const settings = useGet<{ renewalMessage: string }>(["settings"], "/api/admin/settings");
  useEffect(() => {
    if (params.get("novo")) setParams({}, { replace: true });
  }, [params, setParams]);

  const counts = q.data?.counts;
  const chip = (value: Filter, label: string, count?: number) => ({ value, label, count });

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Alunos da consultoria online, seus planos e vencimentos."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden /> Novo cliente
          </Button>
        }
      />
      <div className="mb-4 space-y-3">
        <SearchBox value={search} onChange={(v) => (setSearch(v), setPage(1))} placeholder="Buscar por nome, telefone ou e-mail" />
        <Chips
          label="Filtrar clientes"
          value={filter}
          onChange={(f) => (setFilter(f), setPage(1))}
          options={[
            chip("default", "Todos", counts ? counts.active + counts.inactive + counts.pending + counts.expired : undefined),
            chip("active", "Ativos", counts?.active),
            chip("expiring", "Vencendo"),
            chip("expired", "Vencidos", counts?.expired),
            chip("pending", "Pendentes", counts?.pending),
            chip("inactive", "Inativos", counts?.inactive),
            chip("archived", "Arquivados", counts?.archived),
          ]}
        />
      </div>

      <Panel pad={false}>
        <Async q={q} rows={5}>
          {(d) =>
            d.items.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title={term || filter !== "default" ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                text={term || filter !== "default" ? "Tente outra busca ou outro filtro." : "Cadastre o primeiro aluno para acompanhar planos, vencimentos e pagamentos."}
                action={!term && filter === "default" ? <Button onClick={() => setCreating(true)}>Cadastrar cliente</Button> : undefined}
              />
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {d.items.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                      <Link to={`/admin/clientes/${c.id}`} className="group flex min-w-0 flex-1 basis-60 items-center gap-3">
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-soft-foreground" aria-hidden>
                          {c.fullName.charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold group-hover:text-brand">{c.fullName}</span>
                          <span className="block truncate text-sm text-muted-foreground">{formatPhone(c.whatsapp ?? c.phone) || c.email || "Sem contato"}</span>
                        </span>
                      </Link>
                      <div className="flex flex-1 basis-48 flex-col gap-0.5 text-sm">
                        <span className="font-medium">{c.currentPlanName ?? "Sem plano ativo"}</span>
                        {c.currentEndsOn && (
                          <span className={cx("text-xs", c.expiringSoon || c.status === "expired" ? "font-semibold text-destructive" : "text-muted-foreground")}>
                            {c.status === "expired" ? "Venceu" : "Vence"} em {formatDateBR(c.currentEndsOn)}
                            {c.daysToEnd !== null && c.status === "active" ? ` (${c.daysToEnd === 0 ? "hoje" : `${c.daysToEnd}d`})` : ""}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={c.status} kind="client" />
                      <div className="flex items-center gap-2">
                        {(c.status === "expired" || c.expiringSoon) && (
                          <WhatsAppLink number={c.whatsapp ?? c.phone} label="Renovação" message={fillTemplate(settings.data?.renewalMessage ?? "Olá, {nome}! Seu plano vence em {data}.", { nome: c.fullName.split(" ")[0], data: formatDateBR(c.currentEndsOn) })} />
                        )}
                        <Link to={`/admin/clientes/${c.id}`} aria-label={`Abrir ${c.fullName}`} className="grid size-9 place-items-center rounded-lg hover:bg-muted">
                          <ChevronRight size={18} aria-hidden />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="px-4 pb-4 sm:px-5">
                  <Pagination page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
                </div>
              </>
            )
          }
        </Async>
      </Panel>
      <ClientFormModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
