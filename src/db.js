// Multi-empresa SaaS: 1 banco MASTER + 1 banco SQLite por EMPRESA (isolamento total)
// MASTER database.sqlite -> companies + users (com company_id)
// TENANT data/tenant_<companyId>.sqlite -> todo o resto (produtos, vendas, etc)
// Cada empresa NÃO enxerga dados da outra. Pronto p/ migrar p/ Postgres (1 schema por tenant).
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const MASTER_PATH = process.env.DB_PATH || path.join(ROOT, 'database.sqlite');

const master = new DatabaseSync(MASTER_PATH);
master.exec('PRAGMA journal_mode=WAL;');

function initMaster() {
  master.exec(`
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
  `);
  // garante coluna company_id em bancos antigos
  try {
    const cols = master.prepare("SELECT * FROM users LIMIT 0").columns().map(c => c.name);
    if (!cols.includes('company_id')) master.exec('ALTER TABLE users ADD COLUMN company_id INTEGER REFERENCES companies(id)');
  } catch {}
  // logo da empresa (SaaS: cada cliente tem a sua)
  try {
    const ccols = master.prepare("SELECT * FROM companies LIMIT 0").columns().map(c => c.name);
    if (!ccols.includes('logo')) master.exec('ALTER TABLE companies ADD COLUMN logo TEXT');
  } catch {}
}

const tenantCache = new Map();
function tenantPath(companyId) { return path.join(DATA_DIR, `tenant_${companyId}.sqlite`); }

function getTenantDb(companyId) {
  if (!companyId) throw new Error('Empresa não identificada');
  if (tenantCache.has(companyId)) return tenantCache.get(companyId);
  const tdb = new DatabaseSync(tenantPath(companyId));
  tdb.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  tdb.exec(`
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
  `);
  // migração: logo em tenants antigos
  try {
    const cols = tdb.prepare("SELECT * FROM company_info LIMIT 0").columns().map(c => c.name);
    if (!cols.includes('logo')) tdb.exec('ALTER TABLE company_info ADD COLUMN logo TEXT');
  } catch {}
  tenantCache.set(companyId, tdb);
  return tdb;
}

// helpers master
function mq(sql, ...p) { return master.prepare(sql).all(...p); }
function mget(sql, ...p) { return master.prepare(sql).get(...p); }
function mrun(sql, ...p) { return master.prepare(sql).run(...p); }

// helpers tenant (retornam funcoes vinculadas ao banco da empresa do request)
function tq(tdb, sql, ...p) { return tdb.prepare(sql).all(...p); }
function tget(tdb, sql, ...p) { return tdb.prepare(sql).get(...p); }
function trun(tdb, sql, ...p) { return tdb.prepare(sql).run(...p); }

function deleteTenant(companyId) {
  try { tenantCache.get(companyId)?.close(); } catch {}
  tenantCache.delete(companyId);
  const f = tenantPath(companyId);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  try { fs.unlinkSync(f + '-wal'); } catch {}
  try { fs.unlinkSync(f + '-shm'); } catch {}
}

module.exports = { initMaster, master, mq, mget, mrun, getTenantDb, tq, tget, trun, deleteTenant, DATA_DIR, MASTER_PATH };
