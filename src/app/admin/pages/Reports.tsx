import { Download, Printer } from "lucide-react";
import { useState } from "react";
import { PAYMENT_METHOD_LABELS } from "../../../../shared/constants";
import { formatBRL, formatDateBR, formatMonthBR } from "../../../../shared/format";
import type { FinanceSummary, MonthlyFinance } from "../../../../shared/types";
import { Async, Button, PageHeader, Panel, PeriodFilter, Stat, defaultPeriod, downloadFile, useGet, type PeriodState } from "../ui";

interface Report {
  period: { from: string; to: string };
  summary: FinanceSummary;
  monthly: MonthlyFinance[];
  receivedByMethod: { method: string; cents: number }[];
  expensesByCategory: { category: string; cents: number }[];
  subscriptionsStarted: { planName: string; contracts: number; revenueCents: number }[];
  newClients: number;
  overdue: { description: string; clientName: string | null; dueDate: string; remainingCents: number }[];
}

const Table = ({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) =>
  rows.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p> : (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">{head.map((h, i) => <th key={h} className={`py-2 pr-3 font-bold ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/60 last:border-0">{r.map((c, j) => <td key={j} className={`py-2 pr-3 ${j > 0 ? "text-right tabular-nums" : "font-medium"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

export default function Reports() {
  const [period, setPeriod] = useState<PeriodState>(defaultPeriod("month"));
  const p = `from=${period.from}&to=${period.to}`;
  const q = useGet<Report>(["reports", p], `/api/admin/reports?${p}`);
  return (
    <>
      <PageHeader title="Relatórios" description="Resumo do período para conferência e arquivo. Use Imprimir para salvar em PDF." actions={<><Button variant="outline" onClick={() => downloadFile(`/api/admin/reports.csv?${p}`, "relatorio-financeiro.csv")}><Download size={16} aria-hidden /> CSV</Button><Button onClick={() => window.print()}><Printer size={16} aria-hidden /> Imprimir / PDF</Button></>} />
      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>
      <Async q={q} rows={4}>
        {(r) => (
          <div className="space-y-6">
            <h2 className="hidden font-display text-2xl font-bold print:block">Relatório de {formatDateBR(r.period.from)} a {formatDateBR(r.period.to)}</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="Recebido" value={formatBRL(r.summary.receivedCents)} tone="success" />
              <Stat label="Despesas pagas" value={formatBRL(r.summary.paidExpensesCents)} />
              <Stat label="Saldo realizado" value={formatBRL(r.summary.realizedBalanceCents)} tone={r.summary.realizedBalanceCents < 0 ? "danger" : "success"} />
              <Stat label="Saldo projetado" value={formatBRL(r.summary.projectedBalanceCents)} hint="Inclui pendências" />
              <Stat label="A receber" value={formatBRL(r.summary.pendingReceivableCents)} />
              <Stat label="Em atraso" value={formatBRL(r.summary.overdueReceivableCents)} tone={r.summary.overdueReceivableCents ? "danger" : "neutral"} />
              <Stat label="Despesas pendentes" value={formatBRL(r.summary.pendingExpensesCents + r.summary.overdueExpensesCents)} />
              <Stat label="Novos clientes" value={r.newClients} />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Por mês"><Table empty="Sem lançamentos." head={["Mês", "Recebido", "Pago", "Saldo"]} rows={r.monthly.map((m) => [formatMonthBR(m.month), formatBRL(m.receivedCents), formatBRL(m.paidCents), formatBRL(m.balanceCents)])} /></Panel>
              <Panel title="Recebimentos por forma de pagamento"><Table empty="Sem recebimentos no período." head={["Forma", "Total"]} rows={r.receivedByMethod.map((m) => [PAYMENT_METHOD_LABELS[m.method as keyof typeof PAYMENT_METHOD_LABELS] ?? m.method, formatBRL(m.cents)])} /></Panel>
              <Panel title="Despesas pagas por categoria"><Table empty="Sem despesas pagas no período." head={["Categoria", "Total"]} rows={r.expensesByCategory.map((m) => [m.category, formatBRL(m.cents)])} /></Panel>
              <Panel title="Planos contratados no período"><Table empty="Nenhuma contratação no período." head={["Plano", "Contratos", "Valor"]} rows={r.subscriptionsStarted.map((m) => [m.planName, m.contracts, formatBRL(m.revenueCents)])} /></Panel>
            </div>
            <Panel title="Contas em atraso (hoje)"><Table empty="Nenhuma conta em atraso." head={["Conta", "Vencimento", "Saldo"]} rows={r.overdue.map((o) => [`${o.clientName ? `${o.clientName} — ` : ""}${o.description}`, formatDateBR(o.dueDate), formatBRL(o.remainingCents)])} /></Panel>
          </div>
        )}
      </Async>
    </>
  );
}
