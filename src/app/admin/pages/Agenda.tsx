import { CalendarDays, ChevronLeft, ChevronRight, Lock, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ApiRequestError, api } from "../../../lib/api";
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, type AppointmentKind, type AppointmentStatus } from "../../../../shared/constants";
import { addDays, addMonths, endOfMonth, isoToLocalParts, localToIso, startOfMonth, startOfWeek, todayLocal } from "../../../../shared/dates";
import type { AppointmentDto } from "../../../../shared/types";
import { AreaField, Async, Button, Chips, ClientSelectProxy, Modal, PageHeader, Panel, SelectField, TextField, cx, useAction, useConfirm, useGet } from "../ui-agenda";

type View = "month" | "week" | "day";
const KEYS = [["appointments"], ["dashboard"], ["alerts"], ["client"]];
const KIND_CLS: Record<AppointmentKind, string> = {
  aula: "bg-primary text-primary-foreground",
  avaliacao: "bg-info text-background",
  retorno: "bg-success text-background",
  outro: "bg-warning text-background",
};
const DOW = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dayLabel = (d: string) => `${DOW[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${d.slice(8)}/${d.slice(5, 7)}`;
const addMin = (t: string, m: number) => {
  const total = Math.min(23 * 60 + 59, Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + m);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

function AppointmentModal({ open, onClose, item, preset }: { open: boolean; onClose: () => void; item: AppointmentDto | null; preset: { date: string; time?: string } }) {
  const blank = { clientId: null as string | null, clientName: "", kind: "aula" as AppointmentKind, title: "", date: preset.date, start: preset.time ?? "09:00", end: addMin(preset.time ?? "09:00", 60), notes: "", status: "scheduled" as AppointmentStatus };
  const [v, setV] = useState(blank);
  const [conflict, setConflict] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setConflict(null);
    if (item) {
      const s = isoToLocalParts(item.startsAt);
      const e = isoToLocalParts(item.endsAt);
      setV({ clientId: item.clientId, clientName: item.clientName, kind: item.kind, title: item.title, date: s.date, start: s.time, end: e.time, notes: item.notes, status: item.status });
    } else setV({ ...blank, date: preset.date, start: preset.time ?? "09:00", end: addMin(preset.time ?? "09:00", 60) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item, preset]);

  const body = (force: boolean) => ({ clientId: v.clientId, clientName: v.clientName, kind: v.kind, title: v.title, startsAt: localToIso(v.date, v.start), endsAt: localToIso(v.date, v.end), notes: v.notes, status: v.status, force });
  const save = useAction((force: boolean) => (item ? api.put(`/api/admin/appointments/${item.id}`, body(force)) : api.post("/api/admin/appointments", body(force))), {
    invalidate: KEYS,
    success: "Compromisso salvo.",
    silentError: true,
    onSuccess: onClose,
  });
  useEffect(() => {
    const e = save.error;
    setConflict(e instanceof ApiRequestError && e.code === "schedule_conflict" ? e.message : null);
  }, [save.error]);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <Modal open={open} onClose={onClose} title={item ? "Editar compromisso" : "Novo compromisso"} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button>{conflict && <Button variant="soft" onClick={() => save.mutate(true)}>Agendar mesmo assim</Button>}<Button onClick={() => save.mutate(false)} loading={save.isPending}>Salvar</Button></>}>
      {conflict && <p role="alert" className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-soft-foreground">{conflict}</p>}
      {save.isError && !conflict && !Object.keys(save.fields).length && <p role="alert" className="text-sm font-semibold text-destructive">{(save.error as Error).message}</p>}
      <ClientSelectProxy value={v.clientId} onChange={(id, name) => setV((s) => ({ ...s, clientId: id, clientName: id ? name : s.clientName }))} />
      <TextField label="Nome do cliente" value={v.clientName} maxLength={160} onChange={(e) => set("clientName", e.target.value)} error={save.fields.clientName} hint="Preenchido automaticamente ao escolher um cliente cadastrado." />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Tipo" value={v.kind} onChange={(e) => set("kind", e.target.value as AppointmentKind)}>{APPOINTMENT_KINDS.map((k) => <option key={k} value={k}>{APPOINTMENT_KIND_LABELS[k]}</option>)}</SelectField>
        {item && <SelectField label="Situação" value={v.status} onChange={(e) => set("status", e.target.value as AppointmentStatus)}>{APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{APPOINTMENT_STATUS_LABELS[s]}</option>)}</SelectField>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Data" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} className="col-span-3 sm:col-span-1" />
        <TextField label="Início" type="time" value={v.start} onChange={(e) => setV((s) => ({ ...s, start: e.target.value, end: addMin(e.target.value, 60) }))} className="col-span-3 min-[420px]:col-span-3 sm:col-span-1" />
        <TextField label="Fim" type="time" value={v.end} onChange={(e) => set("end", e.target.value)} error={save.fields.endsAt} className="col-span-3 sm:col-span-1" />
      </div>
      <TextField label="Descrição" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Treino de pernas" />
      <AreaField label="Observações" rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
    </Modal>
  );
}

function RescheduleModal({ item, onClose }: { item: AppointmentDto | null; onClose: () => void }) {
  const [v, setV] = useState({ date: "", start: "", end: "" });
  const [conflict, setConflict] = useState<string | null>(null);
  useEffect(() => {
    if (item) {
      setConflict(null);
      setV({ date: isoToLocalParts(item.startsAt).date, start: isoToLocalParts(item.startsAt).time, end: isoToLocalParts(item.endsAt).time });
    }
  }, [item]);
  const save = useAction((force: boolean) => api.post(`/api/admin/appointments/${item!.id}/reschedule`, { startsAt: localToIso(v.date, v.start), endsAt: localToIso(v.date, v.end), force }), { invalidate: KEYS, success: "Compromisso reagendado.", silentError: true, onSuccess: onClose });
  useEffect(() => setConflict(save.error instanceof ApiRequestError && save.error.code === "schedule_conflict" ? save.error.message : null), [save.error]);
  if (!item) return null;
  return (
    <Modal open onClose={onClose} title={`Reagendar — ${item.clientName}`} footer={<><Button variant="outline" onClick={onClose}>Cancelar</Button>{conflict && <Button variant="soft" onClick={() => save.mutate(true)}>Reagendar mesmo assim</Button>}<Button onClick={() => save.mutate(false)} loading={save.isPending}>Reagendar</Button></>}>
      {conflict && <p role="alert" className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-soft-foreground">{conflict}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Nova data" type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />
        <TextField label="Início" type="time" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value, end: addMin(e.target.value, 60) })} />
        <TextField label="Fim" type="time" value={v.end} onChange={(e) => setV({ ...v, end: e.target.value })} />
      </div>
    </Modal>
  );
}

function AppointmentCard({ a, onEdit, onReschedule }: { a: AppointmentDto; onEdit: () => void; onReschedule: () => void }) {
  const confirm = useConfirm();
  const s = isoToLocalParts(a.startsAt);
  const e = isoToLocalParts(a.endsAt);
  const setStatus = useAction((status: AppointmentStatus) => api.post(`/api/admin/appointments/${a.id}/status`, { status }), { invalidate: KEYS, success: "Situação atualizada." });
  const remove = useAction(() => api.del(`/api/admin/appointments/${a.id}`), { invalidate: KEYS, success: "Compromisso excluído." });
  const dim = a.status === "cancelled" || a.status === "no_show";
  return (
    <li className={cx("rounded-xl border border-border bg-card p-3", dim && "opacity-60")}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cx("mt-1 h-10 w-1.5 shrink-0 rounded-full", KIND_CLS[a.kind].split(" ")[0])} />
        <div className="min-w-0 flex-1">
          <p className={cx("font-semibold", dim && "line-through")}>{s.time}–{e.time} · {a.clientName}</p>
          <p className="text-sm text-muted-foreground">{APPOINTMENT_KIND_LABELS[a.kind]}{a.title ? ` · ${a.title}` : ""} · {APPOINTMENT_STATUS_LABELS[a.status]}</p>
          {a.notes && <p className="mt-1 text-sm">{a.notes}</p>}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={onEdit}>Editar</Button>
        <Button size="sm" variant="outline" onClick={onReschedule}>Reagendar</Button>
        {a.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("completed")}>Realizada</Button>}
        {a.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("no_show")}>Faltou</Button>}
        {a.status === "scheduled" && <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("cancelled")}>Cancelar</Button>}
        <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (await confirm({ title: "Excluir compromisso?", message: `${a.clientName} — ${s.time}. Esta ação não pode ser desfeita.`, confirmLabel: "Excluir", danger: true })) remove.mutate(undefined as never); }}>Excluir</Button>
      </div>
    </li>
  );
}

export default function Agenda() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(todayLocal());
  const [modal, setModal] = useState<{ open: boolean; item: AppointmentDto | null; date: string; time?: string }>({ open: false, item: null, date: todayLocal() });
  const [resched, setResched] = useState<AppointmentDto | null>(null);

  const range = useMemo(() => {
    if (view === "day") return { from: cursor, to: cursor };
    if (view === "week") {
      const f = startOfWeek(cursor);
      return { from: f, to: addDays(f, 6) };
    }
    const f = startOfWeek(startOfMonth(cursor));
    return { from: f, to: addDays(f, 41) };
  }, [view, cursor]);
  const q = useGet<AppointmentDto[]>(["appointments", range.from, range.to], `/api/admin/appointments?from=${range.from}&to=${range.to}`);
  const free = useGet<{ freeStarts: string[] }>(["appointments", "free", cursor], view === "day" ? `/api/admin/appointments/availability?date=${cursor}&duration=60` : null);

  const byDay = useMemo(() => {
    const m = new Map<string, AppointmentDto[]>();
    for (const a of q.data ?? []) {
      const d = isoToLocalParts(a.startsAt).date;
      m.set(d, [...(m.get(d) ?? []), a]);
    }
    return m;
  }, [q.data]);

  const step = (dir: -1 | 1) => setCursor((c) => (view === "month" ? addMonths(startOfMonth(c), dir) : addDays(c, dir * (view === "week" ? 7 : 1))));
  const title = view === "month" ? `${MONTHS[Number(cursor.slice(5, 7)) - 1]} de ${cursor.slice(0, 4)}` : view === "week" ? `${dayLabel(range.from)} a ${dayLabel(range.to)}` : `${dayLabel(cursor)}/${cursor.slice(0, 4)}`;
  const openNew = (date = cursor, time?: string) => setModal({ open: true, item: null, date, time });
  const today = todayLocal();

  const list = (d: string) => (byDay.get(d) ?? []).map((a) => <AppointmentCard key={a.id} a={a} onEdit={() => setModal({ open: true, item: a, date: d })} onReschedule={() => setResched(a)} />);

  return (
    <>
      <PageHeader
        title="Agenda particular"
        description="Organização pessoal das suas aulas particulares. Esta agenda é privada: não aparece no site nem é acessível publicamente."
        actions={<Button onClick={() => openNew()}><Plus size={18} aria-hidden /> Novo compromisso</Button>}
      />
      <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground"><Lock size={13} aria-hidden /> Área privada do administrador</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" aria-label="Anterior" onClick={() => step(-1)}><ChevronLeft size={17} aria-hidden /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(todayLocal())}>Hoje</Button>
          <Button variant="outline" size="sm" aria-label="Próximo" onClick={() => step(1)}><ChevronRight size={17} aria-hidden /></Button>
        </div>
        <h2 className="flex-1 font-display text-2xl font-extrabold">{title.charAt(0).toUpperCase() + title.slice(1)}</h2>
        <Chips label="Visualização" value={view} onChange={setView} options={[{ value: "month", label: "Mês" }, { value: "week", label: "Semana" }, { value: "day", label: "Dia" }]} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {APPOINTMENT_KINDS.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cx("size-3 rounded-full", KIND_CLS[k].split(" ")[0])} />{APPOINTMENT_KIND_LABELS[k]}</span>)}
      </div>

      <Async q={q} rows={4}>
        {() => (
          <>
            {view === "month" && (
              <Panel pad={false}>
                <div className="grid grid-cols-7 border-b border-border text-center text-xs font-bold uppercase text-muted-foreground">
                  {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: 42 }).map((_, i) => {
                    const d = addDays(range.from, i);
                    const items = byDay.get(d) ?? [];
                    const inMonth = d >= startOfMonth(cursor) && d <= endOfMonth(cursor);
                    return (
                      <button key={d} type="button" onClick={() => (setCursor(d), setView("day"))} aria-label={`${dayLabel(d)}: ${items.length} compromisso(s)`} className={cx("min-h-[4.5rem] border-b border-r border-border p-1 text-left align-top transition-colors hover:bg-muted/60 sm:min-h-24 sm:p-1.5", !inMonth && "bg-muted/40 text-muted-foreground")}>
                        <span className={cx("inline-grid size-6 place-items-center rounded-full text-xs font-bold", d === today && "bg-primary text-primary-foreground")}>{Number(d.slice(8))}</span>
                        <span className="mt-0.5 hidden flex-col gap-0.5 sm:flex">
                          {items.slice(0, 3).map((a) => <span key={a.id} className={cx("truncate rounded px-1 text-[0.68rem] font-semibold leading-4", KIND_CLS[a.kind], (a.status === "cancelled" || a.status === "no_show") && "line-through opacity-50")}>{isoToLocalParts(a.startsAt).time} {a.clientName}</span>)}
                          {items.length > 3 && <span className="text-[0.68rem] font-semibold text-muted-foreground">+{items.length - 3}</span>}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-0.5 sm:hidden">{items.slice(0, 6).map((a) => <span key={a.id} className={cx("size-2 rounded-full", KIND_CLS[a.kind].split(" ")[0])} />)}</span>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}
            {view === "week" && (
              <div className="space-y-4">
                {Array.from({ length: 7 }).map((_, i) => {
                  const d = addDays(range.from, i);
                  return (
                    <Panel key={d} title={<span className={d === today ? "text-brand" : ""}>{dayLabel(d)}{d === today ? " · hoje" : ""}</span>} actions={<Button size="sm" variant="ghost" onClick={() => openNew(d)}><Plus size={15} aria-hidden /> Adicionar</Button>}>
                      {(byDay.get(d) ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Dia livre.</p> : <ul className="space-y-2">{list(d)}</ul>}
                    </Panel>
                  );
                })}
              </div>
            )}
            {view === "day" && (
              <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <Panel title="Compromissos do dia">
                  {(byDay.get(cursor) ?? []).length === 0 ? <p className="py-6 text-center text-muted-foreground"><CalendarDays className="mx-auto mb-2" aria-hidden /> Nenhum compromisso neste dia.</p> : <ul className="space-y-2">{list(cursor)}</ul>}
                </Panel>
                <Panel title="Horários livres (1h)">
                  {free.data?.freeStarts.length ? (
                    <div className="flex flex-wrap gap-2">{free.data.freeStarts.map((t) => <button key={t} type="button" className="min-h-10 rounded-lg border border-input px-3 text-sm font-semibold hover:border-primary hover:bg-brand-soft" onClick={() => openNew(cursor, t)}>{t}</button>)}</div>
                  ) : <p className="text-sm text-muted-foreground">Sem horários livres de 1h neste dia.</p>}
                </Panel>
              </div>
            )}
          </>
        )}
      </Async>
      <AppointmentModal open={modal.open} item={modal.item} preset={{ date: modal.date, time: modal.time }} onClose={() => setModal((m) => ({ ...m, open: false }))} />
      <RescheduleModal item={resched} onClose={() => setResched(null)} />
    </>
  );
}
