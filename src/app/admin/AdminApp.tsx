import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgePercent,
  CalendarDays,
  ExternalLink,
  FileBarChart,
  Images,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Newspaper,
  PanelTop,
  Settings,
  Star,
  Tags,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router";
import { ApiRequestError, api } from "../../lib/api";
import { ThemeToggle } from "../../lib/theme";
import type { AdminMe } from "../../../shared/types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../components/ui/sheet";
import { Button, ConfirmProvider, TextField, cx, useAction, useGet } from "./ui";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Leads = lazy(() => import("./pages/Leads"));
const Finance = lazy(() => import("./pages/Finance"));
const Receivables = lazy(() => import("./pages/Receivables"));
const Payables = lazy(() => import("./pages/Payables"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Reviews = lazy(() => import("./pages/Reviews"));
const Posts = lazy(() => import("./pages/Posts"));
const MediaLibrary = lazy(() => import("./pages/MediaLibrary"));
const Plans = lazy(() => import("./pages/Plans"));
const Promotions = lazy(() => import("./pages/Promotions"));
const SiteContent = lazy(() => import("./pages/SiteContent"));
const Reports = lazy(() => import("./pages/Reports"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

const meKey = ["me"] as const;

function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => api.get<{ admin: AdminMe }>("/api/admin/auth/me"), retry: false, staleTime: 60_000 });
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const loc = useLocation();
  useEffect(() => {
    const on = () => qc.invalidateQueries({ queryKey: meKey });
    window.addEventListener("jm:unauthorized", on);
    return () => window.removeEventListener("jm:unauthorized", on);
  }, [qc]);
  if (me.isLoading) return <FullSpinner />;
  if (me.isError) {
    if (me.error instanceof ApiRequestError && me.error.status === 401) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <p className="text-lg font-bold">Não foi possível conectar ao servidor.</p>
          <Button className="mt-4" onClick={() => me.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

const FullSpinner = () => (
  <div className="grid min-h-[60vh] place-items-center text-muted-foreground" role="status" aria-label="Carregando">
    <Loader2 className="animate-spin" aria-hidden />
  </div>
);

// ------------------------------------------------------------------ login
function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const qc = useQueryClient();
  const me = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useAction(() => api.post<{ admin: AdminMe }>("/api/admin/auth/login", { email, password }), {
    silentError: true,
    onSuccess: async (r) => {
      qc.setQueryData(meKey, r);
      nav((loc.state as { from?: string } | null)?.from ?? "/admin", { replace: true });
    },
  });
  useEffect(() => {
    document.title = "Entrar | Painel João Marcos";
  }, []);
  if (me.data) return <Navigate to="/admin" replace />;

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <main className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <svg viewBox="0 0 64 64" className="size-8" fill="currentColor" aria-hidden>
              <path d="M14 44V20h6v24zM44 44V20h6v24zM20 30h24v4H20zM9 26h5v12H9zM50 26h5v12h-5z" />
            </svg>
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">Painel administrativo</h1>
          <p className="mt-1 text-muted-foreground">Acesso restrito ao João.</p>
        </div>
        <form
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(undefined as never);
          }}
        >
          <TextField label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} error={login.fields.email} />
          <TextField label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} error={login.fields.password} />
          {login.isError && !Object.keys(login.fields).length && (
            <p role="alert" className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-semibold text-brand-soft-foreground">
              {(login.error as Error).message}
            </p>
          )}
          <Button type="submit" className="w-full" loading={login.isPending}>
            Entrar
          </Button>
        </form>
        <p className="mt-5 text-center text-sm">
          <Link to="/" className="font-semibold text-brand">
            ← Voltar ao site
          </Link>
        </p>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------ layout
interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badge?: number;
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pending = useGet<{ count: number }>(["pending-reviews"], "/api/admin/reviews/pending-count");
  const groups: { title: string; items: NavEntry[] }[] = [
    { title: "Principal", items: [{ to: "/admin", label: "Visão geral", icon: LayoutDashboard, end: true }] },
    {
      title: "Relacionamento",
      items: [
        { to: "/admin/clientes", label: "Clientes", icon: Users },
        { to: "/admin/interessados", label: "Interessados", icon: UserPlus },
        { to: "/admin/agenda", label: "Agenda particular", icon: CalendarDays },
        { to: "/admin/avaliacoes", label: "Avaliações", icon: Star, badge: pending.data?.count },
      ],
    },
    {
      title: "Financeiro",
      items: [
        { to: "/admin/financeiro", label: "Financeiro", icon: Wallet },
        { to: "/admin/receber", label: "Contas a receber", icon: ArrowDownToLine },
        { to: "/admin/pagar", label: "Contas a pagar", icon: ArrowUpFromLine },
        { to: "/admin/relatorios", label: "Relatórios", icon: FileBarChart },
      ],
    },
    {
      title: "Site e vendas",
      items: [
        { to: "/admin/planos", label: "Planos", icon: Tags },
        { to: "/admin/promocoes", label: "Promoções", icon: BadgePercent },
        { to: "/admin/site", label: "Conteúdo do site", icon: PanelTop },
        { to: "/admin/publicacoes", label: "Publicações", icon: Newspaper },
        { to: "/admin/midias", label: "Galeria de mídias", icon: Images },
      ],
    },
    { title: "Sistema", items: [{ to: "/admin/configuracoes", label: "Configurações", icon: Settings }] },
  ];
  return (
    <nav aria-label="Menu do painel" className="space-y-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cx(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.94rem] font-semibold transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground/85 hover:bg-muted",
                    )
                  }
                >
                  <it.icon size={19} aria-hidden />
                  <span className="flex-1">{it.label}</span>
                  {it.badge ? <span className="grid min-w-5 place-items-center rounded-full bg-brand-soft px-1.5 text-xs font-bold text-brand-soft-foreground ring-1 ring-brand-line">{it.badge}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Layout() {
  const [open, setOpen] = useState(false);
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const logout = useAction(() => api.post("/api/admin/auth/logout"), {
    onSuccess: () => {
      qc.clear();
      nav("/admin/login", { replace: true });
    },
  });
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    document.title = "Painel | João Marcos";
  }, []);

  const brand = (
    <Link to="/admin" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 64 64" className="size-6" fill="currentColor" aria-hidden>
          <path d="M14 44V20h6v24zM44 44V20h6v24zM20 30h24v4H20zM9 26h5v12H9zM50 26h5v12h-5z" />
        </svg>
      </span>
      <span className="font-display text-xl font-extrabold uppercase leading-none tracking-wide">
        João <span className="text-brand">Marcos</span>
        <span className="block text-[0.62rem] font-semibold tracking-[0.2em] text-muted-foreground">PAINEL</span>
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-surface">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 flex-col overflow-y-auto border-r border-border bg-sidebar px-4 py-5 lg:flex">
        <div className="px-1 pb-6">{brand}</div>
        <NavList />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-xs overflow-y-auto bg-sidebar px-4 py-5">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do painel administrativo</SheetDescription>
          <div className="pb-5">{brand}</div>
          <NavList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-72">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
          <button type="button" className="inline-flex size-11 items-center justify-center rounded-xl border border-border lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={20} aria-hidden />
          </button>
          <span className="flex-1 truncate text-sm text-muted-foreground">
            Olá, <strong className="text-foreground">{me.data?.admin.name}</strong>
          </span>
          <a href="/" target="_blank" rel="noopener noreferrer" className="hidden min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold hover:bg-muted sm:inline-flex">
            <ExternalLink size={16} aria-hidden /> Ver site
          </a>
          <ThemeToggle />
          <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-muted" onClick={() => logout.mutate(undefined as never)} aria-label="Sair">
            <LogOut size={17} aria-hidden />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Suspense fallback={<FullSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function AdminApp() {
  useEffect(() => {
    // o painel nunca deve ser indexado
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex, nofollow";
    document.head.appendChild(m);
    return () => m.remove();
  }, []);
  return (
    <ConfirmProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route
          element={
            <RequireAdmin>
              <Layout />
            </RequireAdmin>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="clientes/:id" element={<ClientDetail />} />
          <Route path="interessados" element={<Leads />} />
          <Route path="financeiro" element={<Finance />} />
          <Route path="receber" element={<Receivables />} />
          <Route path="pagar" element={<Payables />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="avaliacoes" element={<Reviews />} />
          <Route path="publicacoes" element={<Posts />} />
          <Route path="midias" element={<MediaLibrary />} />
          <Route path="planos" element={<Plans />} />
          <Route path="promocoes" element={<Promotions />} />
          <Route path="site" element={<SiteContent />} />
          <Route path="relatorios" element={<Reports />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </ConfirmProvider>
  );
}
