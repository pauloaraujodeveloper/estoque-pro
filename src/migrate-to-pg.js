require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
// Migra TUDO do SQLite local para o PostgreSQL (Neon/Supabase/local).
// Uso:  $env:DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"; node src/migrate-to-pg.js
// Idempotente: pode rodar de novo (ignora o que já existe).
if (!process.env.DATABASE_URL) { console.error('Defina DATABASE_URL antes.'); process.exit(1); }
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { initMaster, getTenantDb, pool } = require('./db');

const ROOT = path.join(__dirname, '..');
const MASTER = process.env.DB_PATH || path.join(ROOT, 'database.sqlite');
const DATA = path.join(ROOT, 'data');

const SERIAL_TABLES_TENANT = ['categories', 'units', 'products', 'suppliers', 'customers', 'lots', 'stock_movements', 'purchases', 'purchase_items', 'sales', 'sale_items', 'recipes', 'recipe_items', 'professionals', 'services', 'appointments', 'accounts_payable', 'accounts_receivable', 'expenses', 'cash_registers', 'audit_logs', 'notifications'];

async function copyTable(sliteDb, pgClient, table) {
  let cols;
  try { cols = sliteDb.prepare(`SELECT * FROM ${table} LIMIT 0`).columns().map(c => c.name); }
  catch { console.log('  (sem tabela ' + table + ')'); return 0; }
  const rows = sliteDb.prepare(`SELECT * FROM ${table}`).all();
  let n = 0;
  for (const r of rows) {
    const vals = cols.map(c => r[c]);
    const ph = vals.map((_, i) => '$' + (i + 1)).join(',');
    await pgClient.query(`INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${ph}) ON CONFLICT DO NOTHING`, vals);
    n++;
  }
  return n;
}
async function fixSeq(pgClient, table) {
  await pgClient.query(`SELECT setval(pg_get_serial_sequence('"${table}"','id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
}

(async () => {
  if (!fs.existsSync(MASTER)) { console.error('SQLite master não encontrado: ' + MASTER); process.exit(1); }
  console.log('Origem: ' + MASTER);
  await initMaster();
  const lite = new DatabaseSync(MASTER);
  const companies = lite.prepare('SELECT * FROM companies').all();
  const users = lite.prepare('SELECT * FROM users').all();

  // master
  const mc = await pool.connect();
  try {
    for (const t of ['companies', 'users']) {
      const n = await copyTable(lite, mc, t);
      console.log(`master.${t}: ${n} linhas`);
    }
    for (const t of ['companies', 'users']) await fixSeq(mc, t);
  } finally { mc.release(); }

  // tenants
  for (const c of companies) {
    const f = path.join(DATA, `tenant_${c.id}.sqlite`);
    if (!fs.existsSync(f)) { console.log(`tenant ${c.id} (${c.nome}): sem arquivo, criando schema vazio`); await getTenantDb(c.id); continue; }
    const h = await getTenantDb(c.id);
    const ldb = new DatabaseSync(f);
    const tc = await pool.connect();
    try {
      await tc.query(`SET search_path TO "${h.schema}", public`);
      for (const t of ['company_info', ...SERIAL_TABLES_TENANT]) {
        const n = await copyTable(ldb, tc, t);
        if (n) console.log(`tenant ${c.id}.${t}: ${n} linhas`);
      }
      for (const t of SERIAL_TABLES_TENANT) await fixSeq(tc, t);
    } finally { tc.release(); }
    try { ldb.close(); } catch {}
  }
  lite.close();
  console.log('MIGRAÇÃO CONCLUÍDA. Aponte o app com DATABASE_URL e rode npm start.');
  process.exit(0);
})().catch(e => { console.error('FALHA:', e.message); process.exit(1); });
