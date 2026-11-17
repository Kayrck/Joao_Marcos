import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  CircleAlert,
  Clock,
  Info,
  Newspaper,
  Star,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router";
import { formatBRL, formatMonthBR } from "../../../../shared/format";
import { isoToLocalParts } from "../../../../shared/dates";
import type { AlertItem, DashboardData } from "../../../../shared/types";
import { Async, Badge, EmptyState, Panel, PageHeader, PeriodFilter, Stat, WhatsAppLink, btn, cx, defaultPeriod, useGet, type PeriodState } from "../ui";

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const reais = (c: number) => c / 100;
const moneyTick = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v));
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)", fontSize: 13 },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
};

function ChartBox({ title, children, empty, height = 260 }: { title: string; children: React.ReactNode; empty: boolean; height?: number }) {
  return (
    <Panel title={title}>
      {empty ? (
        <p className="grid place-items-center py-10 text-center text-sm text-muted-foreground" style={{ minHeight: height - 60 }}>
          Sem dados neste período. Os gráficos são calculados a partir dos lançamentos e cadastros reais.
        </p>
      ) : (
        <div style={{ height }} role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

const SEV = {
  danger: { icon: CircleAlert, cls: "text-destructive bg-brand-soft" },
  warning: { icon: AlertTriangle, cls: "text-warning bg-warning-soft" },
  info: { icon: Info, cls: "text-info bg-info-soft" },
};

function AlertsPanel() {
  const q = useGet<AlertItem[]>(["alerts"], "/api/admin/alerts");
  return (
    <Panel title="Alertas e pendências" pad={false}>
      <Async q={q} rows={3}>
        {(items) =>
          items.length === 0 ? (
            <EmptyState title="Tudo em dia" text="Nenhuma pendência no momento: sem pagamentos atrasados, planos vencendo ou avaliações aguardando." icon={<Clock size={26} />} />
          ) : (
            <ul className="divide-y divide-border">
              {items.map((a) => {
                const S = SEV[a.severity];
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                    <span className={cx("grid size-9 shrink-0 place-items-center rounded-lg", S.cls)}>
                      <S.icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-semibold">{a.title}</p>
                      <p className="text-sm text-muted-foreground">{a.detail}</p>
                    </div>
                    <div className="flex gap-2">
                      {a.whatsapp && <WhatsAppLink number={a.whatsapp.number} message={a.whatsapp.message} />}
                      <Link to={a.href} className={btn("outline", "sm")}>
                        Abrir
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        }
      </Async>
    </Panel>
  );
}

const QUICK = [
  { to: "/admin/clientes?novo=1", label: "Cadastrar cliente", icon: Users },
  { to: "/admin/receber?novo=1", label: "Registrar recebimento", icon: ArrowDownToLine },
  { to: "/admin/pagar?novo=1", label: "Registrar despesa", icon: ArrowUpFromLine },
  { to: "/admin/publicacoes?novo=1", label: "Publicar conteúdo", icon: Newspaper },
  { to: "/admin/agenda", label: "Consultar agenda", icon: CalendarDays },
  { to: "/admin/avaliacoes", label: "Aprovar avaliação", icon: Star },
];

function Charts({ d }: { d: DashboardData }) {
  const monthly = d.monthly.map((m) => ({ mes: formatMonthBR(m.month), Receitas: reais(m.receivedCents), Despesas: reais(m.paidCents) }));
  let acc = 0;
  const evolution = d.monthly.map((m) => ({ mes: formatMonthBR(m.month), "Saldo acumulado": reais((acc += m.balanceCents)) }));
  const clients = d.clientsByMonth.map((m) => ({ mes: formatMonthBR(m.month), "Novos clientes": m.newClients, "Com plano no mês": m.activeAtEnd }));
  const rvp = [
    { name: "Recebido", value: reais(d.receivedVsPending.receivedCents), fill: "var(--chart-4)" },
    { name: "A receber", value: reais(d.receivedVsPending.pendingCents), fill: "var(--chart-2)" },
    { name: "Atrasado", value: reais(d.receivedVsPending.overdueCents), fill: "var(--chart-1)" },
  ].filter((x) => x.value > 0);
  const dist = d.planDistribution.map((p, i) => ({ name: p.planName, value: p.clients, fill: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)"][i % 4] }));
  const fin = d.monthly.some((m) => m.receivedCents || m.paidCents);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartBox title="Receitas × despesas por mês" empty={!fin}>
        <BarChart data={monthly} margin={{ left: -8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
          <Tooltip {...tip} formatter={(v: number) => formatBRL(v * 100)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Receitas" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Despesas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartBox>
      <ChartBox title="Evolução financeira (saldo realizado)" empty={!fin}>
        <LineChart data={evolution} margin={{ left: -8, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} tickFormatter={moneyTick} />
          <Tooltip {...tip} formatter={(v: number) => formatBRL(v * 100)} />
          <Line type="monotone" dataKey="Saldo acumulado" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4, fill: "var(--chart-1)" }} />
        </LineChart>
      </ChartBox>
      <ChartBox title="Clientes por período" empty={!clients.some((c) => c["Novos clientes"] || c["Com plano no mês"])}>
        <ComposedChart data={clients} margin={{ left: -20, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip {...tip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Novos clientes" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
          <Line type="monotone" dataKey="Com plano no mês" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} />
        </ComposedChart>
      </ChartBox>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChartBox title="Clientes por duração do plano" empty={dist.length === 0} height={240}>
          <PieChart>
            <Pie data={dist} dataKey="value" nameKey="name" innerRadius={44} outerRadius={80} paddingAngle={2} stroke="var(--card)">
              {dist.map((e) => (
                <Cell key={e.name} fill={e.fill} />
              ))}
            </Pie>
            <Tooltip {...tip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartBox>
        <ChartBox title="Recebido × pendente" empty={rvp.length === 0} height={240}>
          <PieChart>
            <Pie data={rvp} dataKey="value" nameKey="name" innerRadius={44} outerRadius={80} paddingAngle={2} stroke="var(--card)">
              {rvp.map((e) => (
                <Cell key={e.name} fill={e.fill} />
              ))}
            </Pie>
            <Tooltip {...tip} formatter={(v: number) => formatBRL(v * 100)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ChartBox>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod("month"));
  const q = useGet<DashboardData>(["dashboard", period.from, period.to], `/api/admin/dashboard?from=${period.from}&to=${period.to}`);

  return (
    <>
      <PageHeader title="Visão geral" description="Resumo do negócio com base nos cadastros e lançamentos reais." />
      <div className="mb-6">
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {QUICK.map((a) => (
          <Link key={a.to} to={a.to} className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card p-3 text-center text-sm font-semibold shadow-[var(--shadow-card)] transition-colors hover:border-primary/60 hover:bg-brand-soft">
            <a.icon size={22} className="text-brand" aria-hidden />
            {a.label}
          </Link>
        ))}
      </div>

      <Async q={q} rows={4}>
        {(d) => (
          <div className="space-y-6">
            <section aria-label="Indicadores de clientes">
              <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Clientes</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
                <Stat label="Total de clientes" value={d.kpis.clientsTotal} icon={<Users size={17} />} to="/admin/clientes" />
                <Stat label="Ativos" value={d.kpis.clientsActive} tone="success" to="/admin/clientes" />
                <Stat label="Inativos" value={d.kpis.clientsInactive} />
                <Stat label="Novos no período" value={d.kpis.clientsNewInPeriod} />
                <Stat label="Planos vencendo" value={d.kpis.expiringSoon} tone="warning" to="/admin/clientes" hint="Próximos do vencimento" />
                <Stat label="Planos vencidos" value={d.kpis.expired} tone="danger" to="/admin/clientes" />
              </div>
            </section>

            <section aria-label="Indicadores financeiros">
              <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-wide">Financeiro</h2>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Recebido no período" value={formatBRL(d.kpis.receivedCents)} tone="success" icon={<Wallet size={17} />} to="/admin/financeiro" />
                <Stat label="Contas a receber" value={formatBRL(d.kpis.pendingReceivableCents)} hint={d.kpis.overdueReceivableCents ? `${formatBRL(d.kpis.overdueReceivableCents)} em atraso` : "Nada em atraso"} to="/admin/receber" />
                <Stat label="Contas a pagar" value={formatBRL(d.kpis.pendingExpensesCents)} to="/admin/pagar" />
                <Stat label="Despesas pagas" value={formatBRL(d.kpis.paidExpensesCents)} to="/admin/pagar" />
                <Stat label="Saldo realizado" value={formatBRL(d.kpis.realizedBalanceCents)} tone={d.kpis.realizedBalanceCents < 0 ? "danger" : "success"} hint="Recebido − despesas pagas" />
                <Stat label="Saldo projetado" value={formatBRL(d.kpis.projectedBalanceCents)} hint="Inclui pendências do período" />
                <Stat label="Avaliações pendentes" value={d.kpis.pendingReviews} tone={d.kpis.pendingReviews ? "warning" : "neutral"} icon={<Star size={17} />} to="/admin/avaliacoes" />
                <Stat label="Interessados aguardando" value={d.kpis.leadsWaiting} icon={<UserPlus size={17} />} to="/admin/interessados" hint="Novos contatos" />
              </div>
            </section>

            <Charts d={d} />

            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <AlertsPanel />
              <Panel title="Próximas aulas" actions={<Link to="/admin/agenda" className={btn("outline", "sm")}>Abrir agenda</Link>}>
                {d.upcoming.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma aula agendada. Use a agenda particular para organizar seus horários.</p>
                ) : (
                  <ul className="space-y-3">
                    {d.upcoming.map((a) => {
                      const s = isoToLocalParts(a.startsAt);
                      const e = isoToLocalParts(a.endsAt);
                      return (
                        <li key={a.id} className="flex items-center gap-3">
                          <div className="grid w-16 shrink-0 place-items-center rounded-xl bg-brand-soft py-1.5 text-center text-brand-soft-foreground">
                            <span className="text-xs font-bold">{s.date.slice(8)}/{s.date.slice(5, 7)}</span>
                            <span className="text-sm font-extrabold">{s.time}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{a.clientName}</p>
                            <p className="text-sm text-muted-foreground">até {e.time}</p>
                          </div>
                          <Badge tone="info">{a.kind}</Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </div>
          </div>
        )}
      </Async>
    </>
  );
}
