// Camada de banco DUAL: PostgreSQL (DATABASE_URL) ou SQLite local (fallback sem config).
// PG: 1 database, 1 SCHEMA isolado por empresa (tenant_<id>) — mesmo isolamento do modelo SQLite.
// Sem DATABASE_URL o sistema roda 100% em SQLite como antes.
// Uso: export DATABASE_URL=postgresql://user:pass@host:5432/db  (Neon/Supabase/local)
const path = require('path');
const fs = require('fs');

const USE_PG = !!process.env.DATABASE_URL;
let pool = null;
if (USE_PG) {
  const { Pool, types } = require('pg');
  // DATE como string 'YYYY-MM-DD' (evita deslocamento de fuso no front)
  try { types.setTypeParser(types.builtins.DATE, v => v); } catch {}
  let url = process.env.DATABASE_URL;
  // Neon pooler (modo transação) não preserva SET search_path por sessão:
  // converte automaticamente para o endpoint DIRETO (padrão documentado do Neon).
  if (/-pooler\./.test(url)) {
    url = url.replace(/-pooler\./, '.');
    console.log('Neon pooler detectado: usando endpoint direto para conexões estáveis.');
  }
  pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 5, connectionTimeoutMillis: 20000, query_timeout: 25000 });
}
// Executa SEMPRE com search_path + timezone explícitos (nunca confia em estado anterior da conexão)
async function pgExec(searchPath, text, params) {
  const c = await pool.connect();
  try {
    await c.query(`SET search_path TO "${searchPath}", public`);
    await c.query(`SET TIME ZONE 'America/Sao_Paulo'`);
    return await c.query(text, params);
  } finally { c.release(); }
}

// Converte SQL escrito com placeholders SQLite (?) para Postgres ($1, $2...)
// e INSERT OR IGNORE para ON CONFLICT DO NOTHING.
function toPg(sql) {
  let ignore = false;
  let out = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, () => { ignore = true; return 'INSERT INTO'; });
  let i = 0;
  out = out.replace(/\?/g, () => '$' + (++i));
  if (ignore) out += ' ON CONFLICT DO NOTHING';
  return { text: out, ignore };
}
function needsReturning(sql) {
  return /^\s*insert\b/i.test(sql) && !/returning\b/i.test(sql);
}

// ================= DDL =================
const MASTER_DDL_PG = `
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
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS person_type TEXT DEFAULT 'PJ';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS doc TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS ie TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS im TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS cep TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS street TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS number TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS district TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS city TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS uf TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pix_key TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pix_key_type TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pix_name TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pix_city TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_name TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_agency TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS bank_account TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS holder_type TEXT DEFAULT 'PJ';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_regime TEXT DEFAULT 'simples';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS icms_default DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pis_default DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS cofins_default DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS printer_coupon TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS printer_nfe TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS paper_width TEXT DEFAULT '80mm';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS receipt_footer TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS reorder_mode TEXT DEFAULT 'min';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS commission_pct DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS commission_base TEXT DEFAULT 'faturamento';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pt2_name TEXT DEFAULT 'Atacado';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pt2_mult DOUBLE PRECISION DEFAULT 1;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pt3_name TEXT DEFAULT 'Delivery';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS pt3_mult DOUBLE PRECISION DEFAULT 1;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS csc_id TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS csc_token TEXT;
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS sefaz_env TEXT DEFAULT 'homologacao';
  ALTER TABLE companies ADD COLUMN IF NOT EXISTS discount_max_pct DOUBLE PRECISION DEFAULT 10;
`;

const TENANT_DDL_PG = `
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
  CREATE TABLE IF NOT EXISTS branches(id SERIAL PRIMARY KEY, nome TEXT NOT NULL, cnpj TEXT, endereco TEXT, active INTEGER DEFAULT 1, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS transfers(id SERIAL PRIMARY KEY, from_branch_id INTEGER, to_branch_id INTEGER, status TEXT DEFAULT 'concluida', notes TEXT, user_id INTEGER, user_name TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS transfer_items(id SERIAL PRIMARY KEY, transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd DOUBLE PRECISION NOT NULL);
  CREATE TABLE IF NOT EXISTS sale_payments(id SERIAL PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, method TEXT NOT NULL, amount DOUBLE PRECISION NOT NULL, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS cash_movements(id SERIAL PRIMARY KEY, caixa_id INTEGER NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE, tipo TEXT NOT NULL, valor DOUBLE PRECISION NOT NULL, motivo TEXT, user_id INTEGER, user_name TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS orcamentos(id SERIAL PRIMARY KEY, customer_id INTEGER, user_id INTEGER, user_name TEXT, total DOUBLE PRECISION DEFAULT 0, desconto DOUBLE PRECISION DEFAULT 0, status TEXT DEFAULT 'aberto', validade TEXT, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS orcamento_items(id SERIAL PRIMARY KEY, orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd DOUBLE PRECISION NOT NULL, preco_unit DOUBLE PRECISION NOT NULL);
  ALTER TABLE products ADD COLUMN IF NOT EXISTS cfop TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS ncm TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS cest TEXT;
  ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_rate DOUBLE PRECISION DEFAULT 0;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS caixa_id INTEGER;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS operator_name TEXT;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_uuid TEXT;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_contingency INTEGER DEFAULT 0;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfce_number TEXT;
  ALTER TABLE sales ADD COLUMN IF NOT EXISTS nfce_key TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_uuid ON sales(client_uuid);
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS nf_number TEXT;
  ALTER TABLE purchases ADD COLUMN IF NOT EXISTS nf_key TEXT;
  ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS operator_name TEXT;
  ALTER TABLE cash_registers ADD COLUMN IF NOT EXISTS terminal TEXT;
`;

const MASTER_DDL_LITE = `
  CREATE TABLE IF NOT EXISTS companies(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL, cnpj TEXT, endereco TEXT, telefone TEXT, email TEXT,
    segmento TEXT DEFAULT 'mercado', plano TEXT DEFAULT 'basico',
    margem_minima REAL DEFAULT 20, ativa INTEGER DEFAULT 1, logo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, email TEXT NOT NULL, pass_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin', active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(email, company_id));
  CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
`;

const TENANT_DDL_LITE = `
  CREATE TABLE IF NOT EXISTS company_info(id INTEGER PRIMARY KEY CHECK(id=1), nome TEXT, segmento TEXT, margem_minima REAL DEFAULT 20, logo TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT UNIQUE NOT NULL);
  CREATE TABLE IF NOT EXISTS units(id INTEGER PRIMARY KEY AUTOINCREMENT, sigla TEXT UNIQUE NOT NULL, nome TEXT);
  CREATE TABLE IF NOT EXISTS products(
    id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, codigo_interno TEXT, codigo_barras TEXT, sku TEXT,
    categoria_id INTEGER, marca TEXT, unidade_id INTEGER, tipo TEXT DEFAULT 'revenda',
    custo_medio REAL DEFAULT 0, preco_venda REAL DEFAULT 0, estoque_atual REAL DEFAULT 0,
    estoque_min REAL DEFAULT 0, estoque_max REAL DEFAULT 0, ponto_reposicao REAL DEFAULT 0,
    localizacao TEXT, status TEXT DEFAULT 'ativo', margem_min REAL DEFAULT 20, perecivel INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT, razao TEXT, fantasia TEXT, doc TEXT, tel TEXT, email TEXT, endereco TEXT, cond_pag TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, doc TEXT, tel TEXT, email TEXT, endereco TEXT, obs TEXT, limite_fiado REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS lots(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, lote TEXT, validade TEXT, qtd REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS stock_movements(id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER NOT NULL, tipo TEXT NOT NULL, motivo TEXT, qtd REAL NOT NULL, custo_unit REAL DEFAULT 0, estoque_antes REAL, estoque_depois REAL, user_id INTEGER, user_name TEXT, doc_ref TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS purchases(id INTEGER PRIMARY KEY AUTOINCREMENT, supplier_id INTEGER, status TEXT DEFAULT 'aberto', total REAL DEFAULT 0, user_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')), recebido_at TEXT);
  CREATE TABLE IF NOT EXISTS purchase_items(id INTEGER PRIMARY KEY AUTOINCREMENT, purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd REAL NOT NULL, custo_unit REAL NOT NULL, qtd_recebida REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, user_id INTEGER, user_name TEXT, total REAL DEFAULT 0, desconto REAL DEFAULT 0, pagamento TEXT DEFAULT 'dinheiro', status TEXT DEFAULT 'finalizada', created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS sale_items(id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd REAL NOT NULL, preco_unit REAL NOT NULL, custo_unit REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS recipes(id INTEGER PRIMARY KEY AUTOINCREMENT, produto_acabado_id INTEGER NOT NULL, nome TEXT NOT NULL, rendimento REAL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS recipe_items(id INTEGER PRIMARY KEY AUTOINCREMENT, recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE, insumo_id INTEGER NOT NULL, qtd REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS professionals(id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, comissao_pct REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, preco REAL DEFAULT 0, comissao_pct REAL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY AUTOINCREMENT, professional_id INTEGER, service_id INTEGER, customer_id INTEGER, datahora TEXT, status TEXT DEFAULT 'agendado', created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS accounts_payable(id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT, supplier_id INTEGER, valor REAL NOT NULL, vencimento TEXT, pago_em TEXT, status TEXT DEFAULT 'aberto', created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS accounts_receivable(id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT, customer_id INTEGER, sale_id INTEGER, valor REAL NOT NULL, vencimento TEXT, pago_em TEXT, status TEXT DEFAULT 'aberto', created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY AUTOINCREMENT, descricao TEXT, tipo TEXT DEFAULT 'variavel', valor REAL NOT NULL, data TEXT DEFAULT (date('now','localtime')));
  CREATE TABLE IF NOT EXISTS cash_registers(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, saldo_inicial REAL DEFAULT 0, saldo_final REAL, status TEXT DEFAULT 'aberto', aberto_em TEXT DEFAULT (datetime('now','localtime')), fechado_em TEXT);
  CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, acao TEXT, modulo TEXT, registro TEXT, antes TEXT, depois TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT, tipo TEXT, mensagem TEXT, lida INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS branches(id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, cnpj TEXT, endereco TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS transfers(id INTEGER PRIMARY KEY AUTOINCREMENT, from_branch_id INTEGER, to_branch_id INTEGER, status TEXT DEFAULT 'concluida', notes TEXT, user_id INTEGER, user_name TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS transfer_items(id INTEGER PRIMARY KEY AUTOINCREMENT, transfer_id INTEGER NOT NULL REFERENCES transfers(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd REAL NOT NULL);
  CREATE TABLE IF NOT EXISTS sale_payments(id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, method TEXT NOT NULL, amount REAL NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS cash_movements(id INTEGER PRIMARY KEY AUTOINCREMENT, caixa_id INTEGER NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE, tipo TEXT NOT NULL, valor REAL NOT NULL, motivo TEXT, user_id INTEGER, user_name TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS orcamentos(id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, user_id INTEGER, user_name TEXT, total REAL DEFAULT 0, desconto REAL DEFAULT 0, status TEXT DEFAULT 'aberto', validade TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
  CREATE TABLE IF NOT EXISTS orcamento_items(id INTEGER PRIMARY KEY AUTOINCREMENT, orcamento_id INTEGER NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE, product_id INTEGER NOT NULL, qtd REAL NOT NULL, preco_unit REAL NOT NULL);
`;

// ================= SQLite (fallback local) =================
const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const MASTER_PATH = process.env.DB_PATH || path.join(ROOT, 'database.sqlite');
let liteMaster = null;
const liteTenants = new Map();
function dbLiteMaster() {
  if (!liteMaster) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    liteMaster = new DatabaseSync(MASTER_PATH);
    liteMaster.exec('PRAGMA journal_mode=WAL;');
  }
  return liteMaster;
}
function tenantPath(companyId) { return path.join(DATA_DIR, `tenant_${companyId}.sqlite`); }

async function initMaster() {
  if (USE_PG) { await pgExec('public', MASTER_DDL_PG, []); return; }
  const m = dbLiteMaster();
  m.exec(MASTER_DDL_LITE);
  try {
    const cols = m.prepare('SELECT * FROM users LIMIT 0').columns().map(c => c.name);
    if (!cols.includes('company_id')) m.exec('ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id)');
  } catch {}
  try {
    const ccols = m.prepare('SELECT * FROM companies LIMIT 0').columns().map(c => c.name);
    if (!ccols.includes('logo')) m.exec('ALTER TABLE companies ADD COLUMN logo TEXT');
    for (const [col, def] of [['person_type', "TEXT DEFAULT 'PJ'"], ['doc', 'TEXT'], ['ie', 'TEXT'], ['im', 'TEXT'], ['cep', 'TEXT'], ['street', 'TEXT'], ['number', 'TEXT'], ['district', 'TEXT'], ['city', 'TEXT'], ['uf', 'TEXT'], ['pix_key', 'TEXT'], ['pix_key_type', 'TEXT'], ['pix_name', 'TEXT'], ['pix_city', 'TEXT'], ['bank_name', 'TEXT'], ['bank_agency', 'TEXT'], ['bank_account', 'TEXT'], ['holder_type', "TEXT DEFAULT 'PJ'"], ['tax_regime', "TEXT DEFAULT 'simples'"], ['icms_default', 'REAL DEFAULT 0'], ['pis_default', 'REAL DEFAULT 0'], ['cofins_default', 'REAL DEFAULT 0'], ['printer_coupon', 'TEXT'], ['printer_nfe', 'TEXT'], ['paper_width', "TEXT DEFAULT '80mm'"], ['receipt_footer', 'TEXT'], ['reorder_mode', "TEXT DEFAULT 'min'"], ['commission_pct', 'REAL DEFAULT 0'], ['commission_base', "TEXT DEFAULT 'faturamento'"], ['pt2_name', "TEXT DEFAULT 'Atacado'"], ['pt2_mult', 'REAL DEFAULT 1'], ['pt3_name', "TEXT DEFAULT 'Delivery'"], ['pt3_mult', 'REAL DEFAULT 1'], ['csc_id', 'TEXT'], ['csc_token', 'TEXT'], ['sefaz_env', "TEXT DEFAULT 'homologacao'"], ['discount_max_pct', 'REAL DEFAULT 10']]) {
      if (!ccols.includes(col)) { try { m.exec(`ALTER TABLE companies ADD COLUMN ${col} ${def}`); } catch {} }
    }
  } catch {}
}

function tenantSchemaName(companyId) { return `tenant_${Number(companyId)}`; }

async function getTenantDb(companyId) {
  if (!companyId) throw new Error('Empresa não identificada');
  if (USE_PG) {
    const schema = tenantSchemaName(companyId);
    await pgExec('public', `CREATE SCHEMA IF NOT EXISTS "${schema}"`, []);
    await pgExec(schema, TENANT_DDL_PG, []);
    return { pg: true, schema };
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (liteTenants.has(companyId)) return liteTenants.get(companyId);
  const { DatabaseSync } = require('node:sqlite');
  const tdb = new DatabaseSync(tenantPath(companyId));
  tdb.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  tdb.exec(TENANT_DDL_LITE);
  try {
    const cols = tdb.prepare('SELECT * FROM company_info LIMIT 0').columns().map(c => c.name);
    if (!cols.includes('logo')) tdb.exec('ALTER TABLE company_info ADD COLUMN logo TEXT');
  } catch {}
  try { // fiscal/pagamentos/filiais/NF em tenants antigos
    const pc = tdb.prepare('SELECT * FROM products LIMIT 0').columns().map(c => c.name);
    if (!pc.includes('ncm')) tdb.exec('ALTER TABLE products ADD COLUMN ncm TEXT');
    if (!pc.includes('cest')) tdb.exec('ALTER TABLE products ADD COLUMN cest TEXT');
    if (!pc.includes('tax_rate')) tdb.exec('ALTER TABLE products ADD COLUMN tax_rate REAL DEFAULT 0');
    const sc = tdb.prepare('SELECT * FROM sales LIMIT 0').columns().map(c => c.name);
    if (!sc.includes('caixa_id')) tdb.exec('ALTER TABLE sales ADD COLUMN caixa_id INTEGER');
    if (!sc.includes('operator_name')) tdb.exec('ALTER TABLE sales ADD COLUMN operator_name TEXT');
    const puc = tdb.prepare('SELECT * FROM purchases LIMIT 0').columns().map(c => c.name);
    if (!puc.includes('nf_number')) tdb.exec('ALTER TABLE purchases ADD COLUMN nf_number TEXT');
    if (!puc.includes('nf_key')) tdb.exec('ALTER TABLE purchases ADD COLUMN nf_key TEXT');
    const cc = tdb.prepare('SELECT * FROM cash_registers LIMIT 0').columns().map(c => c.name);
    if (!cc.includes('operator_name')) tdb.exec('ALTER TABLE cash_registers ADD COLUMN operator_name TEXT');
    if (!cc.includes('terminal')) tdb.exec('ALTER TABLE cash_registers ADD COLUMN terminal TEXT');
    const sc2 = tdb.prepare('SELECT * FROM sales LIMIT 0').columns().map(c => c.name);
    if (!sc2.includes('client_uuid')) tdb.exec('ALTER TABLE sales ADD COLUMN client_uuid TEXT');
    if (!sc2.includes('is_contingency')) tdb.exec('ALTER TABLE sales ADD COLUMN is_contingency INTEGER DEFAULT 0');
    if (!sc2.includes('nfce_number')) tdb.exec('ALTER TABLE sales ADD COLUMN nfce_number TEXT');
    if (!sc2.includes('nfce_key')) tdb.exec('ALTER TABLE sales ADD COLUMN nfce_key TEXT');
    try { tdb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_uuid ON sales(client_uuid)'); } catch {}
    const pc2 = tdb.prepare('SELECT * FROM products LIMIT 0').columns().map(c => c.name);
    if (!pc2.includes('cfop')) tdb.exec('ALTER TABLE products ADD COLUMN cfop TEXT');
  } catch {}
  const h = { pg: false, db: tdb };
  liteTenants.set(companyId, h);
  return h;
}

// ================= API unificada (async) =================
async function mq(sql, ...p) {
  if (USE_PG) return (await pgExec('public', toPg(sql).text, p)).rows;
  return dbLiteMaster().prepare(sql).all(...p);
}
async function mget(sql, ...p) {
  if (USE_PG) { const r = await pgExec('public', toPg(sql).text, p); return r.rows[0]; }
  return dbLiteMaster().prepare(sql).get(...p);
}
async function mrun(sql, ...p) {
  if (USE_PG) {
    const t = toPg(sql);
    const ret = !t.ignore && needsReturning(sql) ? ' RETURNING id' : '';
    const r = await pgExec('public', t.text + ret, p);
    return { lastInsertRowid: r.rows[0] ? r.rows[0].id : undefined, changes: r.rowCount };
  }
  return dbLiteMaster().prepare(sql).run(...p);
}
async function tq(h, sql, ...p) {
  if (h.pg) return (await pgExec(h.schema, toPg(sql).text, p)).rows;
  return h.db.prepare(sql).all(...p);
}
async function tget(h, sql, ...p) {
  if (h.pg) { const r = await pgExec(h.schema, toPg(sql).text, p); return r.rows[0]; }
  return h.db.prepare(sql).get(...p);
}
async function trun(h, sql, ...p) {
  if (h.pg) {
    const t = toPg(sql);
    const ret = !t.ignore && needsReturning(sql) ? ' RETURNING id' : '';
    const r = await pgExec(h.schema, t.text + ret, p);
    return { lastInsertRowid: r.rows[0] ? r.rows[0].id : undefined, changes: r.rowCount };
  }
  return h.db.prepare(sql).run(...p);
}

async function deleteTenant(companyId) {
  if (USE_PG) { await pgExec('public', `DROP SCHEMA IF EXISTS "${tenantSchemaName(companyId)}" CASCADE`, []); return; }
  try { liteTenants.get(companyId)?.db.close(); } catch {}
  liteTenants.delete(companyId);
  const f = tenantPath(companyId);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  try { fs.unlinkSync(f + '-wal'); } catch {}
  try { fs.unlinkSync(f + '-shm'); } catch {}
}

// "Hoje" no fuso correto de cada backend (SQLite grava local, PG grava no TZ da sessão)
const TODAY = USE_PG ? 'CURRENT_DATE' : "date('now','localtime')";
module.exports = { USE_PG, pool, initMaster, master: null, mq, mget, mrun, getTenantDb, tq, tget, trun, deleteTenant, DATA_DIR, MASTER_PATH, TENANT_DDL_PG, MASTER_DDL_PG, TODAY };
