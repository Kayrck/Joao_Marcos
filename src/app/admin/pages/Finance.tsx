import { ArrowDownToLine, ArrowUpFromLine, Download, Scale, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PAYMENT_METHOD_LABELS } from "../../../../shared/constants";
import { formatBRL, formatDateBR, formatMonthBR } from "../../../../shared/format";
import type { FinanceSummary, MonthlyFinance } from "../../../../shared/types";
import { Async, Badge, EmptyState, PageHeader, Panel, PeriodFilter, Stat, btn, defaultPeriod, downloadFile, useGet, type PeriodState, Button } from "../ui";

interface LedgerItem { id: string; kind: "in" | "out"; date: string; description: string; counterparty: string | null; amountCents: number; method: string | null }
const axis = { fontSize: 12, fill: "var(--muted-foreground)" };

export default function Finance() {
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod("month"));
  const p = `from=${period.from}&to=${period.to}`;
  const sum = useGet<{ summary: FinanceSummary; monthly: MonthlyFinance[] }>(["finance", "summary", p], `/api/admin/finance/summary?${p}`);
  const led = useGet<LedgerItem[]>(["finance", "ledger", p], `/api/admin/finance/ledger?${p}`);

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Visão consolidada do período. Realizado = dinheiro que de fato entrou e saiu; projetado inclui o que ainda está pendente."
        actions={
          <>
            <Link to="/admin/receber" className={btn("outline")}><ArrowDownToLine size={16} aria-hidden /> A receber</Link>
            <Link to="/admin/pagar" className={btn("outline")}><ArrowUpFromLine size={16} aria-hidden /> A pagar</Link>
          </>
        }
      />
      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>

      <Async q={sum} rows={4}>
        {({ summary: s, monthly }) => (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Total recebido" value={formatBRL(s.receivedCents)} tone="success" icon={<ArrowDownToLine size={17} />} hint="Entradas efetivas" />
              <Stat label="A receber (pendente)" value={formatBRL(s.pendingReceivableCents)} hint="Vence no período" />
              <Stat label="Atrasado a receber" value={formatBRL(s.overdueReceivableCents)} tone={s.overdueReceivableCents ? "danger" : "neutral"} />
              <Stat label="Despesas pagas" value={formatBRL(s.paidExpensesCents)} icon={<ArrowUpFromLine size={17} />} hint="Saídas efetivas" />
              <Stat label="Despesas pendentes" value={formatBRL(s.pendingExpensesCents)} />
              <Stat label="Despesas atrasadas" value={formatBRL(s.overdueExpensesCents)} tone={s.overdueExpensesCents ? "danger" : "neutral"} />
              <Stat label="Saldo realizado" value={formatBRL(s.realizedBalanceCents)} tone={s.realizedBalanceCents < 0 ? "danger" : "success"} icon={<Scale size={17} />} hint="Recebido − pago" />
              <Stat label="Saldo projetado" value={formatBRL(s.projectedBalanceCents)} icon={<TrendingUp size={17} />} hint="Realizado + pendências" />
            </div>

            <Panel title="Receitas, despesas e pendências por mês">
              {monthly.every((m) => !m.receivedCents && !m.paidCents && !m.pendingReceivableCents && !m.pendingExpensesCents) ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum lançamento no período.</p>
              ) : (
                <div className="h-72" role="img" aria-label="Gráfico financeiro mensal">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly.map((m) => ({ mes: formatMonthBR(m.month), Recebido: m.receivedCents / 100, "Despesas pagas": m.paidCents / 100, "A receber": m.pendingReceivableCents / 100, "A pagar": m.pendingExpensesCents / 100 }))} margin={{ left: -8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="mes" tick={axis} tickLine={false} axisLine={false} />
                      <YAxis tick={axis} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(v: number) => formatBRL(v * 100)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Recebido" fill="var(--chart-4)" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="Despesas pagas" fill="var(--chart-2)" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="A receber" fill="var(--chart-3)" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="A pagar" fill="var(--chart-5)" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>
        )}
      </Async>

      <div className="mt-6">
        <Panel title="Movimentações realizadas" pad={false} actions={<Button size="sm" variant="outline" onClick={() => downloadFile(`/api/admin/reports.csv?${p}`, "relatorio-financeiro.csv")}><Download size={15} aria-hidden /> CSV mensal</Button>}>
          <Async q={led} rows={3}>
            {(items) =>
              items.length === 0 ? (
                <EmptyState title="Sem movimentações no período" text="Recebimentos e despesas pagas aparecem aqui assim que forem registrados." />
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((m) => (
                    <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                      <Badge tone={m.kind === "in" ? "success" : "info"}>{m.kind === "in" ? "Entrada" : "Saída"}</Badge>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="truncate font-semibold">{m.description}</p>
                        <p className="truncate text-sm text-muted-foreground">{formatDateBR(m.date)}{m.counterparty ? ` · ${m.counterparty}` : ""}{m.method ? ` · ${PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method}` : ""}</p>
                      </div>
                      <p className={`font-bold tabular-nums ${m.kind === "in" ? "text-success" : ""}`}>{m.kind === "in" ? "+" : "−"} {formatBRL(m.amountCents)}</p>
                    </li>
                  ))}
                </ul>
              )
            }
          </Async>
        </Panel>
      </div>
    </>
  );
}
