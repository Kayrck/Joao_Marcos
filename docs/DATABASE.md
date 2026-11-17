# Banco de dados

PostgreSQL. O esquema vive em `server/db/migrations/*.sql` (aplicadas em ordem por `npm run db:migrate`; o controle fica na tabela `schema_migrations`). Dinheiro é guardado em **centavos** (`integer`); datas de calendário em `date`; instantes em `timestamptz`.

## Tabelas

| Grupo | Tabelas |
| --- | --- |
| Acesso | `administrators`, `admin_sessions`, `login_attempts`, `rate_limits`, `audit_logs` |
| Site | `site_settings` (chave/valor), `site_sections` (conteúdo, ordem, visibilidade), `media`, `posts` |
| Comercial | `plans`, `promotions`, `promotion_plans` |
| CRM | `clients`, `client_subscriptions`, `leads`, `lead_notes` |
| Financeiro | `expense_categories`, `receivables`, `receivable_payments`, `payables` |
| Agenda | `appointments` (**privada**) |
| Avaliações | `reviews` |

Decisões de integridade:

- `client_subscriptions` guarda uma **cópia** do nome/duração do plano e o **valor combinado** — mudar o plano depois não altera contratos.
- Histórico financeiro nunca é apagado: chaves estrangeiras com `ON DELETE RESTRICT`; clientes com histórico são **arquivados** (ou **anonimizados** a pedido do titular, mantendo valores e datas).
- Recebimentos são linhas em `receivable_payments` (suporta pagamento parcial); estornos marcam `voided_at` (não apagam).
- `audit_logs` registra quem fez o quê em operações financeiras, contratos, avaliações, planos, promoções e configurações.
- Triggers mantêm `updated_at`. Índices cobrem vencimentos, status, datas de agenda e busca por nome.

## RLS (Row Level Security)

Todas as tabelas têm RLS **habilitada e sem políticas**. A API conecta com o papel dono do banco (que ignora RLS), mas qualquer outro papel — por exemplo as chaves públicas `anon`/`authenticated` do Supabase (PostgREST) — fica **sem acesso** a clientes, financeiro e agenda. Não exponha a *service role key* nem use as chaves do Supabase no frontend; este projeto não as utiliza.

## Operações

- Backup: use o backup do provedor (Supabase/Neon) e exporte CSV pelo painel (Financeiro/Relatórios) para conferência.
- Nova migration: crie `server/db/migrations/0002_nome.sql` e rode `npm run db:migrate`.
- Fuso: regras de data usam `America/Fortaleza` (UTC−3, sem horário de verão).
