import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ApiRequestError, api } from "../../lib/api";

export function PField({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-err`} role="alert" className="mt-1 text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-input bg-input-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive";

function useFormSubmit<T>(url: string, onDone?: () => void) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: (body: T) => api.post(url, body),
    onMutate: () => setFields({}),
    onError: (e) => e instanceof ApiRequestError && setFields(e.fields ?? {}),
    onSuccess: () => onDone?.(),
  });
  return { m, fields };
}

const Success = ({ title, text }: { title: string; text: string }) => (
  <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-5 text-success">
    <CheckCircle2 className="mt-0.5 shrink-0" aria-hidden />
    <div>
      <p className="font-bold">{title}</p>
      <p className="text-sm opacity-90">{text}</p>
    </div>
  </div>
);

const Consent = ({ id, checked, onChange, error, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; error?: string; children: ReactNode }) => (
  <div>
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined} />
      <span className="text-muted-foreground">{children}</span>
    </label>
    {error && (
      <p id={`${id}-err`} role="alert" className="mt-1 text-sm font-medium text-destructive">
        {error}
      </p>
    )}
  </div>
);

/** Formulário público de avaliação (entra como PENDENTE; o administrador aprova antes de publicar). */
export function ReviewForm({ title, intro }: { title: string; intro: string }) {
  const [v, setV] = useState({ name: "", rating: 0, body: "", consent: false, website: "" });
  const [sent, setSent] = useState(false);
  const { m, fields } = useFormSubmit<typeof v>("/api/public/reviews", () => setSent(true));
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  if (sent)
    return <Success title="Obrigado pela sua avaliação!" text="Ela foi enviada e será analisada antes de aparecer no site." />;

  return (
    <form
      className="card-surface space-y-4 p-5 sm:p-7"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(v);
      }}
    >
      <div>
        <h3 className="font-display text-3xl font-extrabold uppercase leading-tight">{title}</h3>
        {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      </div>
      <PField label="Seu nome" htmlFor="rv-name" error={fields.name}>
        <input id="rv-name" className={inputCls} value={v.name} maxLength={80} autoComplete="name" aria-invalid={!!fields.name} onChange={(e) => set("name", e.target.value)} />
      </PField>
      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Sua nota</legend>
        <div className="flex gap-1" role="radiogroup" aria-label="Nota de 1 a 5 estrelas">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={v.rating === n} aria-label={`${n} ${n === 1 ? "estrela" : "estrelas"}`} onClick={() => set("rating", n)} className="rounded-lg p-1.5 transition-transform hover:scale-110 focus-visible:outline-2">
              <Star size={34} aria-hidden className={n <= v.rating ? "fill-primary text-primary" : "text-border"} />
            </button>
          ))}
        </div>
        {fields.rating && (
          <p role="alert" className="mt-1 text-sm font-medium text-destructive">
            {fields.rating}
          </p>
        )}
      </fieldset>
      <PField label="Sua avaliação" htmlFor="rv-body" error={fields.body}>
        <textarea id="rv-body" rows={4} className={inputCls} value={v.body} maxLength={1000} aria-invalid={!!fields.body} onChange={(e) => set("body", e.target.value)} />
      </PField>
      {/* campo-isca anti-robô: invisível para pessoas */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
        </label>
      </div>
      <Consent id="rv-consent" checked={v.consent} onChange={(c) => set("consent", c)} error={fields.consent}>
        Autorizo a publicação do meu nome e da minha avaliação neste site, após análise. Posso pedir a remoção a qualquer momento. Veja a{" "}
        <Link to="/privacidade" className="font-semibold text-brand underline">
          política de privacidade
        </Link>
        .
      </Consent>
      {m.isError && !Object.keys(fields).length && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {(m.error as Error).message}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={m.isPending}>
        {m.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        Enviar avaliação
      </button>
    </form>
  );
}

/** Formulário público de contato: cria um "interessado" no painel (com consentimento). */
export function LeadForm() {
  const [v, setV] = useState({ name: "", whatsapp: "", message: "", consent: false, website: "" });
  const [sent, setSent] = useState(false);
  const { m, fields } = useFormSubmit<typeof v>("/api/public/leads", () => setSent(true));
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((s) => ({ ...s, [k]: val }));

  if (sent) return <Success title="Recebemos seu contato!" text="O João vai chamar você no WhatsApp em breve." />;

  return (
    <form
      noValidate
      className="space-y-4 rounded-[1.5rem] bg-card p-5 text-card-foreground sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate(v);
      }}
    >
      <div>
        <h3 className="font-display text-2xl font-extrabold uppercase leading-tight">Prefere que o João chame você?</h3>
        <p className="mt-1 text-sm text-muted-foreground">Deixe seu nome e WhatsApp.</p>
      </div>
      <PField label="Nome" htmlFor="ld-name" error={fields.name}>
        <input id="ld-name" className={inputCls} value={v.name} maxLength={100} autoComplete="name" aria-invalid={!!fields.name} onChange={(e) => set("name", e.target.value)} />
      </PField>
      <PField label="WhatsApp (com DDD)" htmlFor="ld-wa" error={fields.whatsapp}>
        <input id="ld-wa" type="tel" inputMode="tel" className={inputCls} value={v.whatsapp} maxLength={30} autoComplete="tel" placeholder="(85) 99999-9999" aria-invalid={!!fields.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
      </PField>
      <PField label="Mensagem (opcional)" htmlFor="ld-msg" error={fields.message}>
        <textarea id="ld-msg" rows={2} className={inputCls} value={v.message} maxLength={500} onChange={(e) => set("message", e.target.value)} />
      </PField>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set("website", e.target.value)} />
        </label>
      </div>
      <Consent id="ld-consent" checked={v.consent} onChange={(c) => set("consent", c)} error={fields.consent}>
        Autorizo o contato pelo WhatsApp para falar sobre a consultoria. Usaremos seus dados só para isso. Veja a{" "}
        <Link to="/privacidade" className="font-semibold text-brand underline">
          política de privacidade
        </Link>
        .
      </Consent>
      {m.isError && !Object.keys(fields).length && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {(m.error as Error).message}
        </p>
      )}
      <button type="submit" className="btn btn-ink w-full" disabled={m.isPending}>
        {m.isPending && <Loader2 size={18} className="animate-spin" aria-hidden />}
        Quero receber contato
      </button>
    </form>
  );
}
