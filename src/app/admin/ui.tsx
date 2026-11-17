import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, Loader2, MessageCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ApiRequestError, api, errorMessage } from "../../lib/api";
import { periodFromPreset, todayLocal, type PeriodPreset } from "../../../shared/dates";
import { centsToDecimal, parseMoneyToCents } from "../../../shared/format";
import { whatsappUrl } from "../../../shared/phone";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";

// ------------------------------------------------------------------ dados
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function useGet<T>(key: QueryKey, url: string | null, opts: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: key, queryFn: () => api.get<T>(url!), enabled: url !== null && opts.enabled !== false });
}

/** Mutação com toast de sucesso/erro e invalidação de caches. Erros por campo ficam em `fields`. */
export function useAction<TVars, TRes = unknown>(
  fn: (v: TVars) => Promise<TRes>,
  opts: { invalidate?: QueryKey[]; success?: string; onSuccess?: (r: TRes, v: TVars) => void; silentError?: boolean } = {},
) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({});
  const m = useMutation({
    mutationFn: fn,
    onMutate: () => setFields({}),
    onSuccess: async (r, v) => {
      for (const k of opts.invalidate ?? []) await qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => {
      if (e instanceof ApiRequestError && e.fields) setFields(e.fields);
      if (!opts.silentError) toast.error(errorMessage(e));
    },
  });
  return Object.assign(m, { fields });
}

// ------------------------------------------------------------------ estrutura
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between no-print">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-wide">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 [&>*]:whitespace-nowrap">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx("rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
          {actions}
        </header>
      )}
      <div className={pad ? "p-4 sm:p-5" : ""}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-brand-soft text-brand-soft-foreground",
  info: "bg-info-soft text-info",
  brand: "bg-primary text-primary-foreground",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold", TONES[tone])}>{children}</span>;
}

export function Stat({ label, value, hint, tone = "neutral", to, icon }: { label: string; value: ReactNode; hint?: string; tone?: Tone; to?: string; icon?: ReactNode }) {
  const body = (
    <div className={cx("h-full rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors", to && "hover:border-primary/50")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        {icon && <span className={cx("grid size-8 place-items-center rounded-lg", TONES[tone === "neutral" ? "info" : tone])}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight sm:text-[1.7rem]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">{icon ?? <Inbox size={26} aria-hidden />}</span>
      <p className="mt-1 text-lg font-bold">{title}</p>
      {text && <p className="max-w-md text-muted-foreground">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-brand-soft p-4 text-brand-soft-foreground">
      <AlertCircle className="mt-0.5 shrink-0" size={20} aria-hidden />
      <div className="flex-1">
        <p className="font-semibold">Não foi possível carregar.</p>
        <p className="text-sm">{errorMessage(error)}</p>
      </div>
      {retry && (
        <button type="button" className="rounded-lg border border-current px-3 py-1 text-sm font-semibold" onClick={retry}>
          Tentar de novo
        </button>
      )}
    </div>
  );
}

/** Estados padrão de uma consulta: carregando, erro. */
export function Async<T>({ q, children, rows }: { q: { data?: T; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown }; children: (d: T) => ReactNode; rows?: number }) {
  if (q.isLoading) return <Loading rows={rows} />;
  if (q.isError || q.data === undefined) return <ErrorBox error={q.error} retry={() => q.refetch()} />;
  return <>{children(q.data)}</>;
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between gap-3 text-sm" aria-label="Paginação">
      <span className="text-muted-foreground">
        Página {page} de {pages} · {total} registros
      </span>
      <div className="flex gap-2">
        <button type="button" className={btn("outline", "sm")} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <button type="button" className={btn("outline", "sm")} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Próxima página">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  );
}

// ------------------------------------------------------------------ botões
export function btn(variant: "primary" | "outline" | "ghost" | "danger" | "soft" = "primary", size: "md" | "sm" = "md") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2";
  const sizes = { md: "min-h-11 px-4 text-sm", sm: "min-h-9 px-3 text-sm" };
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
    outline: "border border-input bg-card text-foreground hover:bg-muted",
    ghost: "text-foreground hover:bg-muted",
    soft: "bg-brand-soft text-brand-soft-foreground hover:bg-brand-line",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
  };
  return cx(base, sizes[size], variants[variant]);
}

export function Button({ variant = "primary", size = "md", loading, children, className, type = "button", disabled, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Parameters<typeof btn>[0]; size?: "md" | "sm"; loading?: boolean }) {
  return (
    <button type={type} {...p} disabled={disabled || loading} className={cx(btn(variant, size), className)}>
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function WhatsAppLink({ number, message, label = "WhatsApp", size = "sm" }: { number: string | null | undefined; message?: string; label?: string; size?: "md" | "sm" }) {
  if (!number) return null;
  return (
    <a href={whatsappUrl(number, message)} target="_blank" rel="noopener noreferrer" className={btn("soft", size)}>
      <MessageCircle size={16} aria-hidden />
      {label}
    </a>
  );
}

// ------------------------------------------------------------------ formulários
export const fieldCls =
  "w-full min-h-11 rounded-xl border border-input bg-input-background px-3.5 py-2 text-base text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60 aria-[invalid=true]:border-destructive sm:text-sm";

let uid = 0;
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: (id: string, invalid: boolean) => ReactNode; className?: string }) {
  const [id] = useState(() => `f${++uid}`);
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children(id, !!error)}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type FieldProps = { label: string; error?: string; hint?: string; className?: string };

export function TextField({ label, error, hint, className, ...p }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id, bad) => <input id={id} aria-invalid={bad} className={fieldCls} {...p} />}
    </Field>
  );
}

export function AreaField({ label, error, hint, className, ...p }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id, bad) => <textarea id={id} aria-invalid={bad} rows={3} className={fieldCls} {...p} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, className, children, ...p }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(id, bad) => (
        <select id={id} aria-invalid={bad} className={fieldCls} {...p}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function MoneyField({ label, value, onChange, error, hint, className, optional }: FieldProps & { value: number | null; onChange: (c: number | null) => void; optional?: boolean }) {
  const [text, setText] = useState(value === null ? "" : centsToDecimal(value));
  useEffect(() => {
    if (value !== parseMoneyToCents(text)) setText(value === null ? "" : centsToDecimal(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <Field label={label} error={error} hint={hint ?? (optional ? "Opcional" : undefined)} className={className}>
      {(id, bad) => (
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">R$</span>
          <input
            id={id}
            inputMode="decimal"
            aria-invalid={bad}
            className={cx(fieldCls, "pl-10 tabular-nums")}
            value={text}
            placeholder="0,00"
            onChange={(e) => {
              setText(e.target.value);
              onChange(parseMoneyToCents(e.target.value));
            }}
            onBlur={() => value !== null && setText(centsToDecimal(value))}
          />
        </div>
      )}
    </Field>
  );
}

export function CheckField({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

// ------------------------------------------------------------------ modais
export function Modal({ open, onClose, title, description, children, footer, wide }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className={cx("max-h-[92vh] gap-0 overflow-y-auto p-0", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="font-display text-2xl font-extrabold uppercase tracking-wide">{title}</DialogTitle>
          <DialogDescription className={description ? "" : "sr-only"}>{description ?? title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-5">{children}</div>
        {footer && <DialogFooter className="flex-row justify-end gap-2 border-t border-border px-5 py-4">{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

/** Diálogo de confirmação promisificado: `if (await confirm({...})) ...`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title ?? ""}
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              Voltar
            </Button>
            <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)}>
              {state?.confirmLabel ?? "Confirmar"}
            </Button>
          </>
        }
      >
        <p className="text-muted-foreground">{state?.message}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

// ------------------------------------------------------------------ filtros
export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40",
          )}
        >
          {o.label}
          {o.count !== undefined && <span className={cx("rounded-full px-1.5 text-xs", value === o.value ? "bg-white/25" : "bg-muted")}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface PeriodState {
  preset: PeriodPreset;
  from: string;
  to: string;
}
export const defaultPeriod = (preset: PeriodPreset = "month"): PeriodState => ({ preset, ...periodFromPreset(preset, todayLocal()) });

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "prev_month", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export function PeriodFilter({ value, onChange }: { value: PeriodState; onChange: (p: PeriodState) => void }) {
  return (
    <div className="space-y-2 no-print">
      <Chips label="Período" value={value.preset} options={PRESETS} onChange={(p) => onChange(p === "custom" ? { ...value, preset: p } : { preset: p, ...periodFromPreset(p, todayLocal()) })} />
      {value.preset === "custom" && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <TextField label="De" type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <TextField label="Até" type="date" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  const t = useRef<number>(undefined);
  useEffect(() => {
    t.current = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t.current);
  }, [value, ms]);
  return v;
}

export function SearchBox({ value, onChange, placeholder = "Buscar…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <input type="search" aria-label="Buscar" className={cx(fieldCls, "pr-3")} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Baixa um arquivo da API (CSV) respeitando o cookie de sessão. */
export async function downloadFile(url: string, filename: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    toast.error("Não foi possível gerar o arquivo.");
    return;
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
