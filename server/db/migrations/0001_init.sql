-- 0001_init.sql
-- Esquema inicial da plataforma João Marcos.
-- Convenções:
--   * valores monetários em CENTAVOS (integer) -> sem erro de ponto flutuante;
--   * datas de calendário em `date` (fuso America/Fortaleza resolvido na aplicação);
--   * instantes em `timestamptz`;
--   * nada que tenha histórico financeiro é apagado fisicamente (ON DELETE RESTRICT / arquivamento).

create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- acesso
create table administrators (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  password_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index administrators_email_key on administrators (lower(email));

create table admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references administrators(id) on delete cascade,
  token_hash text not null unique,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index admin_sessions_admin_idx on admin_sessions (admin_id);

create table login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  ip text,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_email_idx on login_attempts (email, created_at desc);
create index login_attempts_ip_idx on login_attempts (ip, created_at desc);

create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

create table audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references administrators(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  summary text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on audit_logs (entity, entity_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);

-- ---------------------------------------------------------------- conteúdo do site
create table site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table site_sections (
  key text primary key,
  enabled boolean not null default true,
  sort_order integer not null,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('image', 'video', 'external_video')),
  storage_key text unique,
  url text not null,
  mime_type text,
  size_bytes integer check (size_bytes is null or size_bytes >= 0),
  width integer,
  height integer,
  title text not null default '',
  alt_text text not null default '',
  category text not null default 'geral',
  external_provider text,
  external_id text,
  thumbnail_url text,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index media_kind_idx on media (kind, created_at desc);

create table posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  summary text not null default '',
  category text not null check (category in
    ('treinamentos','execucao','dicas','bastidores','fotografias','videos','educativo','registros','resultados')),
  body jsonb not null default '[]'::jsonb,
  cover_media_id uuid references media(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  sort_order integer not null default 0,
  is_featured boolean not null default false,
  authorization_confirmed boolean not null default false,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'published' or published_at is not null)
);
create index posts_public_idx on posts (status, published_at desc);
create index posts_category_idx on posts (category);

-- ---------------------------------------------------------------- comercial
create table plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_months integer not null check (duration_months between 1 and 36),
  -- preço regular (fora de promoção). NULL = ainda não definido -> o site exibe "consulte valores".
  regular_price_cents integer check (regular_price_cents is null or regular_price_cents >= 0),
  description text not null default '',
  features jsonb not null default '[]'::jsonb,
  conditions text not null default '',
  badge text not null default '',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table promotion_plans (
  promotion_id uuid not null references promotions(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete restrict,
  promo_price_cents integer not null check (promo_price_cents >= 0),
  primary key (promotion_id, plan_id)
);

-- ---------------------------------------------------------------- CRM
create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  whatsapp text,
  email text,
  notes text not null default '',
  is_active boolean not null default true,
  archived_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_name_idx on clients (lower(full_name));

create table client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete restrict,
  plan_id uuid references plans(id) on delete restrict,
  -- "fotografia" do plano no momento da contratação: mudanças futuras no plano não alteram contratos antigos
  plan_name text not null,
  duration_months integer not null check (duration_months >= 1),
  agreed_price_cents integer not null check (agreed_price_cents >= 0),
  starts_on date not null,
  ends_on date not null,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  notes text not null default '',
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index client_subscriptions_client_idx on client_subscriptions (client_id, starts_on desc);
create index client_subscriptions_end_idx on client_subscriptions (ends_on) where status = 'active';

create table leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  whatsapp text,
  source text not null default '',
  interest text not null default '',
  status text not null default 'new' check (status in ('new','in_progress','awaiting','converted','not_converted')),
  first_contact_on date not null,
  consent_given boolean not null default false,
  consent_at timestamptz,
  converted_client_id uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_status_idx on leads (status, created_at desc);

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  body text not null,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now()
);
create index lead_notes_lead_idx on lead_notes (lead_id, created_at desc);

-- ---------------------------------------------------------------- financeiro
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index expense_categories_name_key on expense_categories (lower(name));

create table receivables (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  client_id uuid references clients(id) on delete restrict,
  subscription_id uuid references client_subscriptions(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'received', 'cancelled')),
  notes text not null default '',
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index receivables_due_idx on receivables (due_date) where status = 'pending';
create index receivables_client_idx on receivables (client_id);

create table receivable_payments (
  id uuid primary key default gen_random_uuid(),
  receivable_id uuid not null references receivables(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  paid_on date not null,
  method text not null check (method in ('pix','dinheiro','cartao_credito','cartao_debito','transferencia','boleto','outro')),
  notes text not null default '',
  voided_at timestamptz,
  void_reason text,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now()
);
create index receivable_payments_rec_idx on receivable_payments (receivable_id);
create index receivable_payments_paid_idx on receivable_payments (paid_on) where voided_at is null;

create table payables (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  category_id uuid not null references expense_categories(id) on delete restrict,
  amount_cents integer not null check (amount_cents > 0),
  due_date date not null,
  paid_on date,
  payment_method text check (payment_method is null or payment_method in
    ('pix','dinheiro','cartao_credito','cartao_debito','transferencia','boleto','outro')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  notes text not null default '',
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid references administrators(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'paid' or paid_on is not null)
);
create index payables_due_idx on payables (due_date) where status = 'pending';
create index payables_paid_idx on payables (paid_on) where status = 'paid';

-- ---------------------------------------------------------------- agenda (PRIVADA)
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  client_name text not null,
  kind text not null default 'aula' check (kind in ('aula', 'avaliacao', 'retorno', 'outro')),
  title text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_start_idx on appointments (starts_at);

-- ---------------------------------------------------------------- avaliações
create table reviews (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  rating smallint not null check (rating between 1 and 5),
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  consent_publish boolean not null check (consent_publish),
  consent_at timestamptz not null default now(),
  photo_media_id uuid references media(id) on delete set null,
  display_date date not null,
  ip_hash text,
  moderated_at timestamptz,
  moderated_by uuid references administrators(id) on delete set null,
  rejection_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_status_idx on reviews (status, created_at desc);

-- ---------------------------------------------------------------- updated_at automático
do $$
declare t text;
begin
  foreach t in array array[
    'administrators','site_settings','site_sections','media','posts','plans','promotions',
    'clients','client_subscriptions','leads','expense_categories','receivables','payables',
    'appointments','reviews'
  ] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- RLS
-- A API acessa o banco com o papel dono das tabelas (que ignora RLS). Habilitar RLS SEM políticas
-- bloqueia qualquer outro papel (ex.: `anon`/`authenticated` do PostgREST do Supabase), garantindo que
-- as tabelas financeiras, de clientes e a agenda nunca fiquem acessíveis por chaves públicas.
do $$
declare t text;
begin
  foreach t in array array[
    'administrators','admin_sessions','login_attempts','rate_limits','audit_logs','site_settings',
    'site_sections','media','posts','plans','promotions','promotion_plans','clients',
    'client_subscriptions','leads','lead_notes','expense_categories','receivables',
    'receivable_payments','payables','appointments','reviews'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
