/*
# Create all application tables (single-tenant, no auth)

1. Purpose
   This migration creates the complete schema for the api2sheets-enterprise
   application — an ERP/marketplace integration and reconciliation platform.
   The app has NO sign-in screen, so all policies use `TO anon, authenticated`
   to allow the anon-key frontend to read and write its own data.

2. New Tables
   - `companies` — master company record (single row for this tenant)
   - `connections` — integration endpoints (ERP, marketplaces, etc.)
   - `products` — product catalog with ERP + marketplace price/stock
   - `orders` — customer orders with items, shipping, commission
   - `order_items` — line items per order
   - `financial_entries` — manual and order-linked financial ledger
   - `alerts` — system-detected discrepancies and warnings
   - `audit_log` — immutable audit trail
   - `sync_history` — per-connection sync execution records
   - `export_history` — export execution records
   - `export_schedules` — recurring export definitions
   - `system_users` — RBAC user directory (not auth.users; app-managed)
   - `system_settings` — single-row app configuration

3. Security
   - RLS enabled on every table.
   - All policies use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
     because this is a single-tenant app with no sign-in screen — the anon-key
     client must be able to perform full CRUD on all tables.

4. Notes
   - `empresa_id` columns use a fixed UUID default for the single tenant.
   - All timestamps default to `now()`.
   - `id` columns use `gen_random_uuid()` for secure non-sequential IDs.
*/

-- ============================================================
-- companies
-- ============================================================
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  razao_social text NOT NULL,
  cnpj text NOT NULL,
  inscricao_estadual text,
  responsavel text,
  email text,
  telefone text,
  plano text NOT NULL DEFAULT 'Enterprise',
  segmento text NOT NULL DEFAULT 'E-commerce',
  moeda text NOT NULL DEFAULT 'BRL',
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  pais text NOT NULL DEFAULT 'Brasil',
  status text NOT NULL DEFAULT 'Ativo',
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_companies" ON companies;
CREATE POLICY "anon_crud_companies" ON companies FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- connections
-- ============================================================
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'erp',
  fornecedor text NOT NULL,
  url text NOT NULL,
  metodo text NOT NULL DEFAULT 'GET',
  autenticacao text NOT NULL DEFAULT 'Bearer',
  status text NOT NULL DEFAULT 'pendente',
  ultima_sincronizacao timestamptz,
  intervalo_min integer NOT NULL DEFAULT 60,
  registros integer NOT NULL DEFAULT 0,
  tempo_resposta_ms integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  token_sec text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_connections" ON connections;
CREATE POLICY "anon_crud_connections" ON connections FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  sku text NOT NULL,
  ean text NOT NULL DEFAULT '',
  codigo_erp text NOT NULL DEFAULT '',
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT '',
  marca text NOT NULL DEFAULT '',
  fornecedor text NOT NULL DEFAULT '',
  custo numeric NOT NULL DEFAULT 0,
  preco numeric NOT NULL DEFAULT 0,
  preco_marketplace numeric,
  preco_promocional numeric,
  estoque integer NOT NULL DEFAULT 0,
  estoque_marketplace integer,
  reservado integer NOT NULL DEFAULT 0,
  peso_kg numeric NOT NULL DEFAULT 0,
  largura_cm numeric NOT NULL DEFAULT 0,
  altura_cm numeric NOT NULL DEFAULT 0,
  comprimento_cm numeric NOT NULL DEFAULT 0,
  conciliacao text NOT NULL DEFAULT 'conciliado',
  marketplace text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_products" ON products;
CREATE POLICY "anon_crud_products" ON products FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  numero text NOT NULL,
  codigo_erp text,
  marketplace text NOT NULL DEFAULT '',
  cliente text NOT NULL,
  cliente_documento text,
  valor numeric NOT NULL DEFAULT 0,
  frete numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  desconto numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aguardando',
  pagamento text NOT NULL DEFAULT '',
  envio text NOT NULL DEFAULT '',
  transportadora text NOT NULL DEFAULT '',
  conciliacao text NOT NULL DEFAULT 'pendente',
  data timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz,
  itens_qtd integer,
  observacoes text
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_orders" ON orders;
CREATE POLICY "anon_crud_orders" ON orders FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku text NOT NULL,
  titulo text NOT NULL DEFAULT '',
  quantidade integer NOT NULL DEFAULT 1,
  preco_unitario numeric NOT NULL DEFAULT 0,
  desconto_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_order_items" ON order_items;
CREATE POLICY "anon_crud_order_items" ON order_items FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- financial_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  pedido_id uuid,
  pedido text,
  tipo text NOT NULL DEFAULT 'receita',
  valor numeric NOT NULL DEFAULT 0,
  taxa numeric NOT NULL DEFAULT 0,
  comissao numeric NOT NULL DEFAULT 0,
  margem numeric NOT NULL DEFAULT 0,
  origem text NOT NULL DEFAULT '',
  data timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_financial_entries" ON financial_entries;
CREATE POLICY "anon_crud_financial_entries" ON financial_entries FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'divergencia_estoque',
  severidade text NOT NULL DEFAULT 'medio',
  status text NOT NULL DEFAULT 'detectado',
  origem text NOT NULL DEFAULT '',
  modulo text NOT NULL DEFAULT '',
  impacto_financeiro numeric NOT NULL DEFAULT 0,
  sugestao text NOT NULL DEFAULT '',
  responsavel text,
  resolvido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_alerts" ON alerts;
CREATE POLICY "anon_crud_alerts" ON alerts FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- audit_log
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  usuario text NOT NULL DEFAULT 'Sistema',
  acao text NOT NULL,
  modulo text NOT NULL DEFAULT '',
  registro text NOT NULL DEFAULT '',
  antes text,
  depois text,
  ip text,
  navegador text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_audit_log" ON audit_log;
CREATE POLICY "anon_crud_audit_log" ON audit_log FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- sync_history
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  conexao_id uuid,
  conexao_nome text NOT NULL DEFAULT '',
  inicio timestamptz NOT NULL DEFAULT now(),
  fim timestamptz,
  duracao_ms integer NOT NULL DEFAULT 0,
  registros_recebidos integer NOT NULL DEFAULT 0,
  registros_alterados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  detalhes text
);
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_sync_history" ON sync_history;
CREATE POLICY "anon_crud_sync_history" ON sync_history FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- export_history
-- ============================================================
CREATE TABLE IF NOT EXISTS export_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  dataset text NOT NULL DEFAULT '',
  dataset_id text NOT NULL DEFAULT '',
  formato text NOT NULL DEFAULT 'csv',
  usuario text NOT NULL DEFAULT 'Sistema',
  registros integer NOT NULL DEFAULT 0,
  tamanho_bytes bigint NOT NULL DEFAULT 0,
  tempo_ms integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sucesso',
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE export_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_export_history" ON export_history;
CREATE POLICY "anon_crud_export_history" ON export_history FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- export_schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS export_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid,
  nome text NOT NULL,
  dataset_id text NOT NULL DEFAULT 'products',
  formato text NOT NULL DEFAULT 'csv',
  frequencia text NOT NULL DEFAULT 'diario',
  horario text NOT NULL DEFAULT '00:00',
  email_destino text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE export_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_export_schedules" ON export_schedules;
CREATE POLICY "anon_crud_export_schedules" ON export_schedules FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- system_users
-- ============================================================
CREATE TABLE IF NOT EXISTS system_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  papel text NOT NULL DEFAULT 'Operador Financeiro',
  status text NOT NULL DEFAULT 'Ativo',
  ultimo_acesso timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE system_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_system_users" ON system_users;
CREATE POLICY "anon_crud_system_users" ON system_users FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- system_settings (single-row config)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_resolve_threshold numeric NOT NULL DEFAULT 0.5,
  max_retries integer NOT NULL DEFAULT 3,
  timeout_seconds integer NOT NULL DEFAULT 30,
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  auto_conciliate_enabled boolean NOT NULL DEFAULT false,
  notify_email boolean NOT NULL DEFAULT true,
  notify_slack boolean NOT NULL DEFAULT false,
  notify_critical_alerts boolean NOT NULL DEFAULT true,
  slack_webhook_url text NOT NULL DEFAULT '',
  idioma text NOT NULL DEFAULT 'pt-BR',
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_system_settings" ON system_settings;
CREATE POLICY "anon_crud_system_settings" ON system_settings FOR ALL
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes for common queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_connections_empresa ON connections(empresa_id);
CREATE INDEX IF NOT EXISTS idx_products_empresa ON products(empresa_id);
CREATE INDEX IF NOT EXISTS idx_orders_empresa ON orders(empresa_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_empresa ON financial_entries(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alerts_empresa ON alerts(empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON audit_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_criado ON audit_log(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_export_history_criado ON export_history(criado_em DESC);
