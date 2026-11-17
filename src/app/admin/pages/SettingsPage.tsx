import { useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import type { SiteSettings } from "../../../../shared/site-content";
import { formatPhone } from "../../../../shared/phone";
import type { AdminSessionInfo, AuditEntryDto, MediaDto, Page } from "../../../../shared/types";
import { AreaField, Async, Badge, Button, Chips, Panel, PageHeader, TextField, useAction, useConfirm, useGet } from "../ui";
import { MediaPicker, MediaThumb } from "../MediaPicker";

type Tab = "geral" | "mensagens" | "seguranca" | "privacidade" | "sistema";

function General({ s }: { s: SiteSettings }) {
  const [v, setV] = useState(s);
  const [pick, setPick] = useState(false);
  const media = useGet<Page<MediaDto>>(["media", "editor"], "/api/admin/media?pageSize=100");
  useEffect(() => setV(s), [s]);
  const save = useAction(() => api.put("/api/admin/settings", v), { invalidate: [["settings"], ["public-site"]], success: "Configurações salvas." });
  const set = <K extends keyof SiteSettings>(k: K, val: SiteSettings[K]) => setV((x) => ({ ...x, [k]: val }));
  const logo = v.logoMediaId ? media.data?.items.find((m) => m.id === v.logoMediaId) : null;
  const f = save.fields;
  return (
    <div className="space-y-6">
      <Panel title="Negócio e contato" actions={<Button size="sm" onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nome do negócio" value={v.businessName} onChange={(e) => set("businessName", e.target.value)} error={f.businessName} />
          <TextField label="Nome do personal" value={v.trainerName} onChange={(e) => set("trainerName", e.target.value)} error={f.trainerName} />
          <TextField label="WhatsApp (com DDI e DDD)" inputMode="tel" value={v.whatsappNumber} onChange={(e) => set("whatsappNumber", e.target.value)} error={f.whatsappNumber} hint={`Exibido como ${formatPhone(v.whatsappNumber)}. Usado em TODOS os botões de WhatsApp do site.`} />
          <TextField label="E-mail de contato" type="email" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} error={f.contactEmail} hint="Opcional." />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Instagram (link)" type="url" value={v.instagramUrl} onChange={(e) => set("instagramUrl", e.target.value)} error={f.instagramUrl} />
          <TextField label="Facebook (link)" type="url" value={v.facebookUrl} onChange={(e) => set("facebookUrl", e.target.value)} error={f.facebookUrl} />
          <TextField label="YouTube (link)" type="url" value={v.youtubeUrl} onChange={(e) => set("youtubeUrl", e.target.value)} error={f.youtubeUrl} />
          <TextField label="TikTok (link)" type="url" value={v.tiktokUrl} onChange={(e) => set("tiktokUrl", e.target.value)} error={f.tiktokUrl} />
        </div>
        <div className="mt-4">
          <p className="mb-1.5 text-sm font-semibold">Logotipo (opcional)</p>
          <div className="flex items-center gap-3">
            <div className="size-16 overflow-hidden rounded-xl border border-border bg-muted">{logo ? <MediaThumb m={logo} /> : null}</div>
            <Button size="sm" variant="outline" onClick={() => setPick(true)}>{v.logoMediaId ? "Trocar logotipo" : "Escolher logotipo"}</Button>
            {v.logoMediaId && <Button size="sm" variant="ghost" onClick={() => set("logoMediaId", null)}>Remover</Button>}
          </div>
          <MediaPicker open={pick} onClose={() => setPick(false)} kind="image" onPick={(m) => (set("logoMediaId", m.id), setPick(false))} title="Escolher logotipo" />
        </div>
      </Panel>
      <Panel title="Rodapé e buscadores">
        <div className="space-y-4">
          <AreaField label="Texto do rodapé" rows={2} value={v.footerText} onChange={(e) => set("footerText", e.target.value)} error={f.footerText} />
          <TextField label="Título nos buscadores (Google)" value={v.seoTitle} maxLength={120} onChange={(e) => set("seoTitle", e.target.value)} />
          <AreaField label="Descrição nos buscadores" rows={2} value={v.seoDescription} maxLength={300} onChange={(e) => set("seoDescription", e.target.value)} />
        </div>
      </Panel>
    </div>
  );
}

function Messages({ s }: { s: SiteSettings }) {
  const [v, setV] = useState(s);
  useEffect(() => setV(s), [s]);
  const save = useAction(() => api.put("/api/admin/settings", v), { invalidate: [["settings"], ["public-site"]], success: "Mensagens salvas." });
  const f = save.fields;
  return (
    <Panel title="Mensagens de WhatsApp e alertas" actions={<Button size="sm" onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar</Button>}>
      <div className="space-y-4">
        <AreaField label="Mensagem ao contratar um plano (site)" rows={2} value={v.whatsappPlanMessage} onChange={(e) => setV({ ...v, whatsappPlanMessage: e.target.value })} error={f.whatsappPlanMessage} hint="Use {plano} para o nome do plano. Ex.: Olá! Tenho interesse no plano {plano} da consultoria online." />
        <AreaField label="Mensagem do botão geral de WhatsApp (site)" rows={2} value={v.whatsappGeneralMessage} onChange={(e) => setV({ ...v, whatsappGeneralMessage: e.target.value })} error={f.whatsappGeneralMessage} />
        <AreaField label="Mensagem de renovação (painel → cliente)" rows={2} value={v.renewalMessage} onChange={(e) => setV({ ...v, renewalMessage: e.target.value })} error={f.renewalMessage} hint="Use {nome} e {data}." />
        <AreaField label="Mensagem de cobrança (painel → cliente)" rows={2} value={v.overdueMessage} onChange={(e) => setV({ ...v, overdueMessage: e.target.value })} error={f.overdueMessage} hint="Use {nome}, {valor} e {data}." />
        <TextField label="Aviso de vencimento: dias de antecedência" type="number" min={1} max={60} value={v.expiringDays} onChange={(e) => setV({ ...v, expiringDays: Number(e.target.value) })} error={f.expiringDays} hint="Planos que vencem dentro desse prazo aparecem como “próximos do vencimento”." />
      </div>
    </Panel>
  );
}

function Security() {
  const qc = useQueryClient();
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const sessions = useGet<AdminSessionInfo[]>(["sessions"], "/api/admin/auth/sessions");
  const change = useAction(() => {
    if (v.newPassword !== v.confirm) return Promise.reject(new Error("A confirmação não confere com a nova senha."));
    return api.post("/api/admin/auth/change-password", { currentPassword: v.currentPassword, newPassword: v.newPassword });
  }, { success: "Senha alterada. As outras sessões foram encerradas.", onSuccess: () => { setV({ currentPassword: "", newPassword: "", confirm: "" }); qc.invalidateQueries({ queryKey: ["sessions"] }); } });
  const revoke = useAction(() => api.post<{ revoked: number }>("/api/admin/auth/sessions/revoke-others"), { invalidate: [["sessions"]], success: "Outras sessões encerradas." });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Alterar senha">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); change.mutate(undefined as never); }}>
          <TextField label="Senha atual" type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} error={change.fields.currentPassword} />
          <TextField label="Nova senha" type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} error={change.fields.newPassword} hint="Mínimo de 10 caracteres, com letras e números." />
          <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
          <Button type="submit" loading={change.isPending}>Alterar senha</Button>
        </form>
      </Panel>
      <Panel title="Sessões ativas" actions={<Button size="sm" variant="outline" onClick={() => revoke.mutate(undefined as never)} loading={revoke.isPending}>Encerrar as outras</Button>}>
        <Async q={sessions} rows={2}>
          {(items) => <ul className="space-y-2">{items.map((s) => <li key={s.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm"><p className="flex items-center gap-2 font-semibold">{s.current ? <Badge tone="success">Esta sessão</Badge> : "Outra sessão"}</p><p className="text-xs text-muted-foreground">Último acesso: {new Date(s.lastSeenAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}</p><p className="truncate text-xs text-muted-foreground">{s.userAgent ?? "Navegador desconhecido"}</p></li>)}</ul>}
        </Async>
      </Panel>
    </div>
  );
}

interface PersonResult { clients: { id: string; fullName: string; phone: string | null; email: string | null; archivedAt: string | null; anonymizedAt: string | null }[]; leads: { id: string; fullName: string; status: string }[]; reviews: { id: string; authorName: string; status: string }[] }

function Privacy() {
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const q = useGet<PersonResult>(["privacy", submitted], submitted.length >= 3 ? `/api/admin/privacy/search?q=${encodeURIComponent(submitted)}` : null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["privacy"] });
  const anonymize = useAction((id: string) => api.post(`/api/admin/privacy/clients/${id}/anonymize`), { invalidate: [["privacy"], ["clients"], ["client"]], success: "Dados pessoais do cliente anonimizados." });
  const delLead = useAction((id: string) => api.del(`/api/admin/leads/${id}`), { onSuccess: refresh, success: "Interessado excluído." });
  const delReview = useAction((id: string) => api.del(`/api/admin/reviews/${id}`), { onSuccess: refresh, success: "Avaliação excluída." });
  return (
    <Panel title="Pedidos de titulares (LGPD)">
      <p className="mb-4 text-sm text-muted-foreground">Localize uma pessoa pelo nome, e-mail ou telefone para atender pedidos de correção ou exclusão de dados. A anonimização remove nome, contatos e observações do cliente e <strong>preserva o histórico financeiro</strong> (valores e datas).</p>
      <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSubmitted(term.trim()); }}>
        <div className="flex-1"><TextField label="Buscar pessoa" value={term} onChange={(e) => setTerm(e.target.value)} hint="Mínimo de 3 caracteres." /></div>
        <Button type="submit" className="mt-[1.65rem]"><Search size={16} aria-hidden /> Buscar</Button>
      </form>
      {submitted.length >= 3 && (
        <Async q={q} rows={2}>
          {(r) => r.clients.length + r.leads.length + r.reviews.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p> : (
            <div className="space-y-4">
              {r.clients.length > 0 && <div><h3 className="mb-2 font-bold">Clientes</h3><ul className="space-y-2">{r.clients.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="flex-1 font-semibold">{c.fullName} <span className="font-normal text-muted-foreground">{formatPhone(c.phone)} {c.email ?? ""}</span></span>{c.anonymizedAt ? <Badge>Anonimizado</Badge> : <Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: "Anonimizar dados do cliente?", message: "Nome, contatos e observações serão removidos de forma permanente. O histórico financeiro é mantido sem identificação. Esta ação não pode ser desfeita.", confirmLabel: "Anonimizar", danger: true })) anonymize.mutate(c.id); }}>Anonimizar</Button>}</li>)}</ul></div>}
              {r.leads.length > 0 && <div><h3 className="mb-2 font-bold">Interessados</h3><ul className="space-y-2">{r.leads.map((l) => <li key={l.id} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="flex-1 font-semibold">{l.fullName}</span><Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: "Excluir interessado?", message: "Os dados serão apagados.", confirmLabel: "Excluir", danger: true })) delLead.mutate(l.id); }}>Excluir</Button></li>)}</ul></div>}
              {r.reviews.length > 0 && <div><h3 className="mb-2 font-bold">Avaliações</h3><ul className="space-y-2">{r.reviews.map((l) => <li key={l.id} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"><span className="flex-1 font-semibold">{l.authorName} <Badge>{l.status}</Badge></span><Button size="sm" variant="outline" onClick={async () => { if (await confirm({ title: "Excluir avaliação?", message: "Será removida do site e do banco.", confirmLabel: "Excluir", danger: true })) delReview.mutate(l.id); }}>Excluir</Button></li>)}</ul></div>}
            </div>
          )}
        </Async>
      )}
    </Panel>
  );
}

interface Info { environment: string; database: string; storage: string; siteUrl: string; migrations: number; node: string }

function System() {
  const info = useGet<Info>(["app-info"], "/api/admin/app-info");
  const audit = useGet<AuditEntryDto[]>(["audit"], "/api/admin/audit?limit=40");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Informações da aplicação">
        <Async q={info} rows={2}>
          {(i) => <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">{[["Ambiente", i.environment], ["Banco de dados", i.database], ["Armazenamento de arquivos", i.storage], ["Endereço do site", i.siteUrl], ["Migrations aplicadas", String(i.migrations)], ["Node.js", i.node]].map(([k, val]) => <><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{val}</dd></>)}</dl>}
        </Async>
        {info.data?.storage === "local" && <p role="note" className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">Armazenamento em disco local: use apenas em desenvolvimento. Em produção configure o armazenamento S3 (ver README).</p>}
      </Panel>
      <Panel title="Atividade recente (auditoria)" pad={false}>
        <Async q={audit} rows={3}>
          {(items) => items.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Sem atividade registrada.</p> : <ul className="divide-y divide-border">{items.map((a) => <li key={a.id} className="px-4 py-2.5 text-sm"><p className="font-medium">{a.summary ?? a.action}</p><p className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString("pt-BR", { timeZone: "America/Fortaleza" })}{a.adminName ? ` · ${a.adminName}` : ""} · {a.action}</p></li>)}</ul>}
        </Async>
      </Panel>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("geral");
  const q = useGet<SiteSettings>(["settings"], "/api/admin/settings");
  return (
    <>
      <PageHeader title="Configurações" description="Dados do negócio, mensagens, segurança e privacidade." />
      <div className="mb-5"><Chips label="Seções" value={tab} onChange={setTab} options={[{ value: "geral", label: "Geral" }, { value: "mensagens", label: "Mensagens" }, { value: "seguranca", label: "Segurança" }, { value: "privacidade", label: "Privacidade" }, { value: "sistema", label: "Sistema" }]} /></div>
      {tab === "geral" && <Async q={q}>{(s) => <General s={s} />}</Async>}
      {tab === "mensagens" && <Async q={q}>{(s) => <Messages s={s} />}</Async>}
      {tab === "seguranca" && <Security />}
      {tab === "privacidade" && <Privacy />}
      {tab === "sistema" && <System />}
      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={14} aria-hidden /> Todas as alterações são registradas na auditoria.</p>
    </>
  );
}
