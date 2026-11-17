import { ArrowDown, ArrowUp, ExternalLink, ImageIcon, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { ICON_OPTIONS } from "../../../lib/icons";
import { LOCKED_SECTIONS, SECTION_LABELS, type SectionKey } from "../../../../shared/constants";
import type { AdminSection, MediaDto, Page } from "../../../../shared/types";
import { AreaField, Async, Badge, Button, PageHeader, Panel, SelectField, TextField, cx, useAction, useGet } from "../ui";
import { MediaPicker, MediaThumb } from "../MediaPicker";

type FieldKind = "text" | "area" | "lines" | "items" | "image";
interface Spec { name: string; label: string; kind: FieldKind; hint?: string; max?: number }

const ACCENT = "Dica: envolva uma palavra com *asteriscos* para destacá-la em vermelho, ex.: Treine *melhor*.";
const SPEC: Record<SectionKey, Spec[]> = {
  hero: [
    { name: "eyebrow", label: "Chamada pequena (acima do título)", kind: "text" },
    { name: "titleLine", label: "Título — linha 1", kind: "text", hint: ACCENT },
    { name: "titleAccent", label: "Título — linha em destaque (vermelha)", kind: "text" },
    { name: "subtitle", label: "Descrição da consultoria online", kind: "area" },
    { name: "primaryCtaLabel", label: "Botão principal (leva aos planos)", kind: "text" },
    { name: "secondaryCtaLabel", label: "Botão secundário (WhatsApp)", kind: "text" },
    { name: "highlights", label: "Destaques curtos (um por linha, até 4)", kind: "lines" },
    { name: "imageMediaId", label: "Fotografia principal", kind: "image" },
    { name: "imageAlt", label: "Descrição da foto (acessibilidade)", kind: "text" },
  ],
  about: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "role", label: "Profissão / cargo", kind: "text" },
    { name: "bio", label: "Biografia", kind: "area", hint: "Escreva apenas informações verdadeiras e confirmadas." },
    { name: "experience", label: "Experiência e formação", kind: "area", hint: "Ex.: formação, registro profissional (CREF), tempo de atuação. Se ficar vazio, o bloco não aparece no site." },
    { name: "methodology", label: "Metodologia", kind: "area" },
    { name: "followUp", label: "Forma de acompanhamento", kind: "area" },
    { name: "highlights", label: "Informações relevantes (um por linha)", kind: "lines" },
    { name: "imageMediaId", label: "Fotografia", kind: "image" },
    { name: "imageAlt", label: "Descrição da foto", kind: "text" },
  ],
  how_it_works: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    { name: "steps", label: "Etapas", kind: "items", hint: "Descreva somente processos que você realmente adota." },
  ],
  benefits: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    { name: "items", label: "Diferenciais", kind: "items" },
  ],
  gallery: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
  ],
  plans: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    { name: "footnote", label: "Observação abaixo dos planos", kind: "text" },
  ],
  reviews: [
    { name: "eyebrow", label: "Chamada pequena", kind: "text" },
    { name: "title", label: "Título", kind: "text" },
    { name: "subtitle", label: "Subtítulo", kind: "text" },
    { name: "formTitle", label: "Título do formulário de avaliação", kind: "text" },
    { name: "formIntro", label: "Texto do formulário", kind: "text" },
  ],
  final_cta: [
    { name: "title", label: "Título", kind: "text" },
    { name: "text", label: "Texto", kind: "area" },
    { name: "buttonLabel", label: "Texto do botão (WhatsApp)", kind: "text" },
    { name: "imageMediaId", label: "Fotografia de fundo", kind: "image" },
    { name: "imageAlt", label: "Descrição da foto", kind: "text" },
  ],
};

interface Item { icon: string; title: string; text: string }

function ImageField({ id, onChange, label }: { id: string | null; onChange: (id: string | null) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const media = useGet<Page<MediaDto>>(["media", "editor"], "/api/admin/media?pageSize=100");
  const m = id ? media.data?.items.find((x) => x.id === id) : null;
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">{label}</p>
      <div className="flex items-center gap-3">
        <div className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-xl border border-border bg-muted">{m ? <MediaThumb m={m} /> : <span className="grid size-full place-items-center text-muted-foreground"><ImageIcon size={22} aria-hidden /></span>}</div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{id ? m?.title || "Imagem selecionada" : "Usando a foto padrão do site"}</p>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setOpen(true)}>{id ? "Trocar foto" : "Escolher foto"}</Button>{id && <Button size="sm" variant="ghost" onClick={() => onChange(null)}>Usar padrão</Button>}</div>
        </div>
      </div>
      <MediaPicker open={open} onClose={() => setOpen(false)} kind="image" onPick={(x) => (onChange(x.id), setOpen(false))} title="Escolher fotografia" />
    </div>
  );
}

function ItemsField({ label, hint, value, onChange }: { label: string; hint?: string; value: Item[]; onChange: (v: Item[]) => void }) {
  const move = (i: number, d: -1 | 1) => {
    const a = [...value];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    onChange(a);
  };
  const upd = (i: number, p: Partial<Item>) => onChange(value.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div>
      <p className="mb-1 text-sm font-semibold">{label}</p>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <ul className="space-y-3">
        {value.map((it, i) => (
          <li key={i} className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <span className="ml-auto flex gap-1">
                <button type="button" aria-label="Mover para cima" disabled={i === 0} className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(i, -1)}><ArrowUp size={15} aria-hidden /></button>
                <button type="button" aria-label="Mover para baixo" disabled={i === value.length - 1} className="grid size-8 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(i, 1)}><ArrowDown size={15} aria-hidden /></button>
                <button type="button" aria-label="Remover" className="grid size-8 place-items-center rounded text-destructive hover:bg-muted" onClick={() => onChange(value.filter((_, k) => k !== i))}><Trash2 size={15} aria-hidden /></button>
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <SelectField label="Ícone" value={it.icon} onChange={(e) => upd(i, { icon: e.target.value })}>{ICON_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}</SelectField>
              <TextField label="Título" value={it.title} maxLength={120} onChange={(e) => upd(i, { title: e.target.value })} />
            </div>
            <AreaField label="Texto" rows={2} value={it.text} maxLength={400} onChange={(e) => upd(i, { text: e.target.value })} />
          </li>
        ))}
      </ul>
      <Button size="sm" variant="outline" className="mt-2" onClick={() => onChange([...value, { icon: "check-circle", title: "", text: "" }])}><Plus size={15} aria-hidden /> Adicionar</Button>
    </div>
  );
}

function SectionEditor({ section }: { section: AdminSection }) {
  const [draft, setDraft] = useState<Record<string, unknown>>(section.content as unknown as Record<string, unknown>);
  useEffect(() => setDraft(section.content as unknown as Record<string, unknown>), [section]);
  const save = useAction(
    () => {
      const content = { ...draft };
      for (const f of SPEC[section.key]) if (f.kind === "lines") content[f.name] = (content[f.name] as string[]).map((s) => s.trim()).filter(Boolean);
      return api.put(`/api/admin/site/sections/${section.key}`, { content });
    },
    { invalidate: [["site-sections"], ["public-site"]], success: "Seção salva. A alteração já está no site." },
  );
  const set = (name: string, v: unknown) => setDraft((d) => ({ ...d, [name]: v }));
  return (
    <Panel title={`Editar: ${SECTION_LABELS[section.key]}`} actions={<Button size="sm" onClick={() => save.mutate(undefined as never)} loading={save.isPending}>Salvar seção</Button>}>
      <div className="space-y-4">
        {SPEC[section.key].map((f) => {
          const err = save.fields[f.name];
          if (f.kind === "text") return <TextField key={f.name} label={f.label} hint={f.hint} value={(draft[f.name] as string) ?? ""} error={err} onChange={(e) => set(f.name, e.target.value)} />;
          if (f.kind === "area") return <AreaField key={f.name} label={f.label} hint={f.hint} rows={4} value={(draft[f.name] as string) ?? ""} error={err} onChange={(e) => set(f.name, e.target.value)} />;
          if (f.kind === "lines") return <AreaField key={f.name} label={f.label} rows={3} value={((draft[f.name] as string[]) ?? []).join("\n")} onChange={(e) => set(f.name, e.target.value.split("\n"))} />;
          if (f.kind === "items") return <ItemsField key={f.name} label={f.label} hint={f.hint} value={(draft[f.name] as Item[]) ?? []} onChange={(v) => set(f.name, v)} />;
          return <ImageField key={f.name} label={f.label} id={(draft[f.name] as string | null) ?? null} onChange={(v) => set(f.name, v)} />;
        })}
        {Object.keys(save.fields).length > 0 && <p role="alert" className="text-sm font-semibold text-destructive">Corrija os campos destacados: {Object.values(save.fields).join(" ")}</p>}
      </div>
    </Panel>
  );
}

export default function SiteContent() {
  const q = useGet<AdminSection[]>(["site-sections"], "/api/admin/site/sections");
  const [selected, setSelected] = useState<SectionKey>("hero");
  const keys = [["site-sections"], ["public-site"]];
  const reorder = useAction((order: SectionKey[]) => api.put("/api/admin/site/sections/order", { keys: order }), { invalidate: keys, success: "Ordem atualizada." });
  const toggle = useAction((o: { key: SectionKey; enabled: boolean }) => api.put(`/api/admin/site/sections/${o.key}`, { enabled: o.enabled }), { invalidate: keys, success: "Visibilidade atualizada." });

  return (
    <>
      <PageHeader title="Conteúdo do site" description="Edite os textos e fotos da página inicial. As alterações aparecem no site na hora, sem precisar publicar o código de novo." actions={<a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-input px-4 text-sm font-semibold hover:bg-muted"><ExternalLink size={16} aria-hidden /> Ver site</a>} />
      <Async q={q} rows={4}>
        {(sections) => {
          const current = sections.find((s) => s.key === selected) ?? sections[0];
          const order = sections.map((s) => s.key);
          const move = (k: SectionKey, d: -1 | 1) => {
            const a = [...order];
            const i = a.indexOf(k);
            const j = i + d;
            if (j < 1 || j >= a.length) return; // posição 0 é a seção hero (fixa)
            [a[i], a[j]] = [a[j], a[i]];
            reorder.mutate(a);
          };
          return (
            <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
              <Panel title="Seções da página" pad={false} className="self-start">
                <ul className="divide-y divide-border">
                  {sections.map((s, i) => {
                    const locked = LOCKED_SECTIONS.includes(s.key);
                    return (
                      <li key={s.key} className={cx("flex items-center gap-2 px-3 py-2", current.key === s.key && "bg-brand-soft")}>
                        <div className="flex flex-col">
                          <button type="button" aria-label="Mover para cima" disabled={locked || i <= 1} className="grid size-6 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(s.key, -1)}><ArrowUp size={13} aria-hidden /></button>
                          <button type="button" aria-label="Mover para baixo" disabled={locked || i === sections.length - 1} className="grid size-6 place-items-center rounded hover:bg-muted disabled:opacity-30" onClick={() => move(s.key, 1)}><ArrowDown size={13} aria-hidden /></button>
                        </div>
                        <button type="button" className="min-h-11 flex-1 text-left text-sm font-semibold" onClick={() => setSelected(s.key)}>
                          {SECTION_LABELS[s.key]}
                          {!s.enabled && <span className="ml-2"><Badge tone="warning">Oculta</Badge></span>}
                        </button>
                        {locked ? <span title="Sempre visível" className="text-muted-foreground"><Lock size={15} aria-hidden /></span> : (
                          <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                            <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={s.enabled} onChange={(e) => toggle.mutate({ key: s.key, enabled: e.target.checked })} aria-label={`Mostrar ${SECTION_LABELS[s.key]}`} />
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">A galeria só aparece no site quando existir ao menos uma publicação publicada. Para os textos do rodapé, WhatsApp e redes sociais, use Configurações.</p>
              </Panel>
              <SectionEditor key={current.key} section={current} />
            </div>
          );
        }}
      </Async>
    </>
  );
}

