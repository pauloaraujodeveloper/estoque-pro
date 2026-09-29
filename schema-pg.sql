-- ============================================================
-- EstoquePro — Schema PostgreSQL (SaaS multi-empresa)
-- Pode colar e rodar no OneCompiler (postgresql) para visualizar,
-- ou rodar no Neon/Supabase. O app cria tudo sozinho ao iniciar.
-- Modelo: tabelas globais (public) + 1 SCHEMA isolado por empresa.
-- ============================================================

-- ---------- GLOBAL (schema public) ----------
CREATE TABLE IF NOT EXISTS companies(
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL, cnpj TEXT, endereco TEXT, telefone TEXT, email TEXT,
  segmento TEXT DEFAULT 'mercado', plano TEXT DEFAULT 'basico',
  margem_minima DOUBLE PRECISION DEFAULT 20, ativa INTEGER DEFAULT 1, logo TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS users(
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, email TEXT NOT NULL, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin', active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(email, company_id));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ---------- TENANT (1 schema por empresa; exemplo tenant_1) ----------
CREATE SCHEMA IF NOT EXISTS tenant_1;
SET search_path TO tenant_1, public;

CREATE TABLE IF NOT EXISTS company_info(id INTEGER PRIMARY KEY CHECK(id=1), nome TEXT, segmento TEXT, margem_minima DOUBLE PRECISION DEFAULT 20, logo TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS categories(id SERIAL PRIMARY KEY, nome TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS units(id SERIAL PRIMARY KEY, sigla TEXT UNIQUE NOT NULL, nome TEXT);
CREATE TABLE IF NOT EXISTS products(
  id SERIAL PRIMARY KEY, nome TEXT NOT NULL, codigo_interno TEXT, codigo_barras TEXT, sku TEXT,
  categoria_id INTEGER, marca TEXT, unidade_id INTEGER, tipo TEXT DEFAULT 'revenda',
  custo_medio DOUBLE PRECISION DEFAULT 0, preco_venda DOUBLE PRECISION DEFAULT 0, estoque_atual DOUBLE PRECISION DEFAULT 0,
  estoque_min DOUBLE PRECISION DEFAULT 0, estoque_max DOUBLE PRECISION DEFAULT 0, ponto_reposicao DOUBLE PRECISION DEFAULT 0,
  localizacao TEXT, status TEXT DEFAULT 'ativo', margem_min DOUBLE PRECISION DEFAULT 20, perecivel INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS suppliers(id SERIAL PRIMARY KEY, razao TEXT, fantasia TEXT, doc TEXT, tel TEXT, email TEXT, endereco TEXT, cond_pag TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS customers(id SERIAL PRIMARY KEY, nome TEXT NOT NULL, doc TEXT, tel TEXT, email TEXT, endereco TEXT, obs TEXT, limite_fiado DOUBLE PRECISION DEFAULT 0, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lots(id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, lote TEXT, validade DATE, qtd DOUBLE PRECISION DEFAULT 0, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stock_movements(id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL, tipo TEXT NOT NULL, motivo TEXT, qtd DOUBLE PRECISION NOT NULL, custo_unit DOUBLE PRECISION DEFAULT 0, estoque_antes DOUBLE PRECISION, estoque_depois DOUBLE PRECISION, user_id INTEGER, user_name TEXT, doc_ref TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS purchases(id SERIAL PRIMARY KEY, supplier_id INTEGER, status TEXT DEFAULT 'aberto', total DOUBLE PRECISION DEFAULT 0, user_id INTEGER, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, recebido_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS purchase_items(id SERIAL PRIMARY KEY, purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd DOUBLE PRECISION NOT NULL, custo_unit DOUBLE PRECISION NOT NULL, qtd_recebida DOUBLE PRECISION DEFAULT 0);
CREATE TABLE IF NOT EXISTS sales(id SERIAL PRIMARY KEY, customer_id INTEGER, user_id INTEGER, user_name TEXT, total DOUBLE PRECISION DEFAULT 0, desconto DOUBLE PRECISION DEFAULT 0, pagamento TEXT DEFAULT 'dinheiro', status TEXT DEFAULT 'finalizada', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sale_items(id SERIAL PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd DOUBLE PRECISION NOT NULL, preco_unit DOUBLE PRECISION NOT NULL, custo_unit DOUBLE PRECISION DEFAULT 0);
CREATE TABLE IF NOT EXISTS recipes(id SERIAL PRIMARY KEY, produto_acabado_id INTEGER NOT NULL, nome TEXT NOT NULL, rendimento DOUBLE PRECISION DEFAULT 1);
CREATE TABLE IF NOT EXISTS recipe_items(id SERIAL PRIMARY KEY, recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, insumo_id INTEGER NOT NULL, qtd DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS professionals(id SERIAL PRIMARY KEY, nome TEXT NOT NULL, comissao_pct DOUBLE PRECISION DEFAULT 0);
CREATE TABLE IF NOT EXISTS services(id SERIAL PRIMARY KEY, nome TEXT NOT NULL, preco DOUBLE PRECISION DEFAULT 0, comissao_pct DOUBLE PRECISION DEFAULT 0);
CREATE TABLE IF NOT EXISTS appointments(id SERIAL PRIMARY KEY, professional_id INTEGER, service_id INTEGER, customer_id INTEGER, datahora TIMESTAMPTZ, status TEXT DEFAULT 'agendado', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS accounts_payable(id SERIAL PRIMARY KEY, descricao TEXT, supplier_id INTEGER, valor DOUBLE PRECISION NOT NULL, vencimento DATE, pago_em TIMESTAMPTZ, status TEXT DEFAULT 'aberto', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS accounts_receivable(id SERIAL PRIMARY KEY, descricao TEXT, customer_id INTEGER, sale_id INTEGER, valor DOUBLE PRECISION NOT NULL, vencimento DATE, pago_em TIMESTAMPTZ, status TEXT DEFAULT 'aberto', created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS expenses(id SERIAL PRIMARY KEY, descricao TEXT, tipo TEXT DEFAULT 'variavel', valor DOUBLE PRECISION NOT NULL, data DATE DEFAULT CURRENT_DATE);
CREATE TABLE IF NOT EXISTS cash_registers(id SERIAL PRIMARY KEY, user_id INTEGER, saldo_inicial DOUBLE PRECISION DEFAULT 0, saldo_final DOUBLE PRECISION, status TEXT DEFAULT 'aberto', aberto_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, fechado_em TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS audit_logs(id SERIAL PRIMARY KEY, user_id INTEGER, user_name TEXT, acao TEXT, modulo TEXT, registro TEXT, antes TEXT, depois TEXT, ip TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id SERIAL PRIMARY KEY, tipo TEXT, mensagem TEXT, lida INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);

-- Para a empresa 2, 3...: repita com tenant_2, tenant_3 (o app faz sozinho).
-- Regras de negócio (iguais em qualquer banco):
-- Margem % = (preco_venda - custo_medio) / preco_venda * 100
-- Custo médio ponderado = (estoque*custo + qtd_entrada*custo_entrada) / (estoque + qtd_entrada)
-- Alerta compra: estoque_atual <= ponto_reposicao
-- PVPS: consumir lots ORDER BY validade ASC
