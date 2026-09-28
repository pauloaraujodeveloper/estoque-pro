// Sistema de Controle de Estoque Multissegmento — SaaS MULTI-EMPRESA
// Cada empresa tem seu banco isolado: data/tenant_<id>.sqlite (sem ligação entre elas)
// MASTER database.sqlite guarda apenas companies + users
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initMaster, mq, mget, mrun, getTenantDb, tq, tget, trun, deleteTenant } = require('./src/db');
const { hashPass, checkPass, sign, authRequired, requireRole, requireSuperadmin, filterProductByRole } = require('./src/auth');
const { margemPct, markupPct, lucroUnit, precoPorMargem, custoMedioPonderado, auditTdb, diasPara } = require('./src/utils');

initMaster();
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // 10mb p/ upload de logo em base64
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 3000;

function pag(req) {
  let page = Math.max(1, parseInt(req.query.page || '1'));
  let limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20')));
  return { page, limit, offset: (page - 1) * limit };
}
function enrich(p) {
  if (!p) return p;
  return { ...p, margem: margemPct(p.preco_venda, p.custo_medio), markup: markupPct(p.preco_venda, p.custo_medio), lucro: lucroUnit(p.preco_venda, p.custo_medio) };
}
function T(req) { // banco da empresa logada
  if (!req.tdb) throw new Error('Empresa não identificada');
  return req.tdb;
}
function movimentar(tdb, { product_id, tipo, motivo, qtd, custo_unit = 0, user, doc_ref = null }) {
  const prod = tdb.prepare('SELECT * FROM products WHERE id=?').get(product_id);
  if (!prod) throw new Error('Produto não encontrado');
  const antes = prod.estoque_atual;
  let depois = antes;
  if (['entrada', 'compra', 'devolucao_entrada', 'bonificacao'].includes(tipo)) depois = antes + Math.abs(qtd);
  else if (['saida', 'venda', 'perda', 'consumo'].includes(tipo)) depois = antes - Math.abs(qtd);
  else if (tipo === 'ajuste') depois = antes + Number(qtd);
  else depois = antes + Number(qtd);
  if (depois < 0 && ['venda', 'saida'].includes(tipo)) throw new Error(`Estoque insuficiente: ${prod.nome} (tem ${antes})`);
  tdb.prepare("UPDATE products SET estoque_atual=?, updated_at=datetime('now','localtime') WHERE id=?").run(depois, product_id);
  tdb.prepare('INSERT INTO stock_movements(product_id,tipo,motivo,qtd,custo_unit,estoque_antes,estoque_depois,user_id,user_name,doc_ref) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run(product_id, tipo, motivo || null, qtd, custo_unit, antes, depois, user ? user.id : null, user ? user.name : null, doc_ref);
  auditTdb(tdb, user, `${tipo} estoque`, 'estoque', `${prod.nome} (${qtd})`, { estoque: antes }, { estoque: depois }, null);
  return { antes, depois };
}
function baixaPVPS(tdb, product_id, qtdTotal) {
  let restante = Math.abs(qtdTotal);
  const lotes = tdb.prepare('SELECT * FROM lots WHERE product_id=? AND qtd>0 ORDER BY date(validade) ASC').all(product_id);
  for (const l of lotes) {
    if (restante <= 0) break;
    const usar = Math.min(l.qtd, restante);
    tdb.prepare('UPDATE lots SET qtd=qtd-? WHERE id=?').run(usar, l.id);
    restante -= usar;
  }
}

// ============ AUTH + ONBOARDING SaaS ============
app.post('/api/auth/signup-company', async (req, res) => {
  const { company_nome, segmento, user_name, email, password } = req.body || {};
  if (!company_nome || !user_name || !email || !password) return res.status(400).json({ error: 'Empresa, responsável, e-mail e senha são obrigatórios.' });
  const exists = mget('SELECT id FROM users WHERE lower(email)=lower(?)', email);
  if (exists) return res.status(400).json({ error: 'E-mail já cadastrado.' });
  const c = mrun('INSERT INTO companies(nome,segmento) VALUES(?,?)', company_nome, segmento || 'mercado');
  const company_id = Number(c.lastInsertRowid);
  const tdb = getTenantDb(company_id);
  tdb.prepare('INSERT OR IGNORE INTO company_info(id,nome,segmento) VALUES(1,?,?)').run(company_nome, segmento || 'mercado');
  ['UN','KG','G','L','ML','CX','PCT'].forEach(s => { try { tdb.prepare('INSERT OR IGNORE INTO units(sigla,nome) VALUES(?,?)').run(s, s); } catch {} });
  const u = mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', company_id, user_name, String(email).toLowerCase(), await hashPass(password), 'admin');
  const user = { id: Number(u.lastInsertRowid), company_id, role: 'admin', name: user_name, email: String(email).toLowerCase() };
  res.status(201).json({ token: sign(user), user, company_id });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  const u = mget('SELECT u.*, c.nome as company_nome, c.segmento as company_segmento FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE lower(u.email)=lower(?)', String(email));
  if (!u || !u.active) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  const ok = await checkPass(password, u.pass_hash);
  if (!ok) return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  if (u.company_id) {
    const c = mget('SELECT * FROM companies WHERE id=?', u.company_id);
    if (!c || !c.ativa) return res.status(403).json({ error: 'Empresa desativada. Fale com o suporte.' });
  }
  if (u.company_id) auditTdb(getTenantDb(u.company_id), { id: u.id, name: u.name }, 'login', 'auth', u.email, null, null, req.ip);
  const user = { id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, company_nome: u.company_nome, company_segmento: u.company_segmento };
  res.json({ token: sign({ ...user }), user });
});
app.get('/api/me', authRequired, (req, res) => res.json({ user: req.user }));
app.post('/api/auth/recover', (req, res) => res.json({ message: 'Peça ao administrador da sua empresa para redefinir sua senha em Usuários.' }));

// ============ PAINEL DO PROVEDOR SaaS (dono do sistema) ============
app.get('/api/saas/companies', authRequired, requireSuperadmin, (req, res) => {
  const rows = mq('SELECT c.*, (SELECT COUNT(*) FROM users u WHERE u.company_id=c.id) as usuarios FROM companies c ORDER BY c.id DESC');
  res.json(rows);
});
app.post('/api/saas/companies', authRequired, requireSuperadmin, async (req, res) => {
  const { nome, segmento, admin_name, admin_email, admin_pass } = req.body || {};
  if (!nome || !admin_email || !admin_pass) return res.status(400).json({ error: 'Informe empresa, e-mail e senha do admin.' });
  const c = mrun('INSERT INTO companies(nome,segmento) VALUES(?,?)', nome, segmento || 'mercado');
  const cid = Number(c.lastInsertRowid);
  getTenantDb(cid).prepare('INSERT OR IGNORE INTO company_info(id,nome,segmento) VALUES(1,?,?)').run(nome, segmento || 'mercado');
  mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, admin_name || 'Admin', String(admin_email).toLowerCase(), await hashPass(admin_pass), 'admin');
  res.status(201).json({ id: cid });
});
function validLogo(l) {
  if (l === undefined || l === null || l === '') return null; // remover logo
  if (typeof l !== 'string' || !l.startsWith('data:image/')) throw new Error('Logo inválida. Envie uma imagem.');
  if (l.length > 700000) throw new Error('Logo muito grande. Use imagem de até ~500KB.');
  return l;
}
app.put('/api/saas/companies/:id', authRequired, requireSuperadmin, (req, res) => {
  const { nome, segmento, plano, ativa, logo } = req.body || {};
  const c = mget('SELECT * FROM companies WHERE id=?', req.params.id);
  if (!c) return res.status(404).json({ error: 'Empresa não encontrada.' });
  let logoVal;
  try { logoVal = logo === undefined ? c.logo : validLogo(logo); } catch (e) { return res.status(400).json({ error: e.message }); }
  mrun('UPDATE companies SET nome=?, segmento=?, plano=?, ativa=?, logo=? WHERE id=?', nome ?? c.nome, segmento ?? c.segmento, plano ?? c.plano, ativa === undefined ? c.ativa : (ativa ? 1 : 0), logoVal, c.id);
  try { trun(getTenantDb(c.id), 'UPDATE company_info SET nome=?, segmento=?, logo=? WHERE id=1', nome ?? c.nome, segmento ?? c.segmento, logoVal); } catch {}
  res.json({ ok: true });
});
app.delete('/api/saas/companies/:id', authRequired, requireSuperadmin, (req, res) => {
  mrun('DELETE FROM users WHERE company_id=?', req.params.id);
  mrun('DELETE FROM companies WHERE id=?', req.params.id);
  deleteTenant(Number(req.params.id));
  res.json({ ok: true, aviso: 'Banco isolado da empresa excluído. Ação irreversível.' });
});

// ============ EMPRESA (dados da própria empresa logada) ============
app.get('/api/company', authRequired, (req, res) => {
  if (req.user.role === 'superadmin') return res.json({ nome: 'Painel SaaS', superadmin: true });
  const c = mget('SELECT * FROM companies WHERE id=?', req.user.company_id);
  const info = tget(T(req), 'SELECT * FROM company_info WHERE id=1');
  res.json({ ...c, info });
});
app.put('/api/company', authRequired, requireRole('admin'), (req, res) => {
  const b = req.body || {};
  const c = mget('SELECT * FROM companies WHERE id=?', req.user.company_id);
  let logoVal;
  try { logoVal = b.logo === undefined ? (c?.logo || null) : validLogo(b.logo); } catch (e) { return res.status(400).json({ error: e.message }); }
  mrun('UPDATE companies SET nome=?, cnpj=?, endereco=?, telefone=?, email=?, segmento=?, margem_minima=?, logo=? WHERE id=?',
    b.nome, b.cnpj, b.endereco, b.telefone, b.email, b.segmento, b.margem_minima ?? 20, logoVal, req.user.company_id);
  try { trun(T(req), 'UPDATE company_info SET nome=?, segmento=?, margem_minima=?, logo=? WHERE id=1', b.nome, b.segmento, b.margem_minima ?? 20, logoVal); } catch {}
  auditTdb(T(req), req.user, 'editar empresa', 'config', 'empresa', null, { ...b, logo: logoVal ? '[logo]' : null }, req.ip);
  res.json({ ok: true });
});

// ============ USUÁRIOS (somente da própria empresa) ============
app.get('/api/users', authRequired, requireRole('admin'), (req, res) => {
  if (req.user.role === 'superadmin') return res.json(mq('SELECT id,company_id,name,email,role,active FROM users ORDER BY id'));
  res.json(mq('SELECT id,name,email,role,active,created_at FROM users WHERE company_id=? ORDER BY id', req.user.company_id));
});
app.post('/api/users', authRequired, requireRole('admin'), async (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Nome, e-mail e senha obrigatórios.' });
  const cid = req.user.role === 'superadmin' ? req.body.company_id : req.user.company_id;
  if (!cid) return res.status(400).json({ error: 'Empresa obrigatória.' });
  try {
    const r = mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, name, String(email).toLowerCase(), await hashPass(password), role || 'vendedor');
    if (cid && req.tdb) auditTdb(req.tdb, req.user, 'criar usuario', 'usuarios', email, null, { name, role }, req.ip);
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch { res.status(400).json({ error: 'E-mail já cadastrado.' }); }
});
app.put('/api/users/:id', authRequired, requireRole('admin'), async (req, res) => {
  const u = mget('SELECT * FROM users WHERE id=?', req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (req.user.role !== 'superadmin' && u.company_id !== req.user.company_id) return res.status(403).json({ error: 'Usuário de outra empresa.' });
  const { name, role, active, password } = req.body || {};
  if (password) mrun('UPDATE users SET pass_hash=? WHERE id=?', await hashPass(password), u.id);
  mrun('UPDATE users SET name=?, role=?, active=? WHERE id=?', name || u.name, role || u.role, active === undefined ? u.active : (active ? 1 : 0), u.id);
  res.json({ ok: true });
});

// ============ AUXILIARES ============
app.get('/api/categories', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM categories ORDER BY nome')));
app.post('/api/categories', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  if (!req.body?.nome) return res.status(400).json({ error: 'Nome obrigatório.' });
  try { const r = trun(T(req), 'INSERT INTO categories(nome) VALUES(?)', req.body.nome); res.status(201).json({ id: Number(r.lastInsertRowid) }); }
  catch { res.status(400).json({ error: 'Categoria já existe.' }); }
});
app.get('/api/units', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM units ORDER BY sigla')));
app.post('/api/units', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  if (!req.body?.sigla) return res.status(400).json({ error: 'Sigla obrigatória.' });
  try { const r = trun(T(req), 'INSERT INTO units(sigla,nome) VALUES(?,?)', req.body.sigla, req.body.nome || req.body.sigla); res.status(201).json({ id: Number(r.lastInsertRowid) }); }
  catch { res.status(400).json({ error: 'Unidade já existe.' }); }
});

// ============ PRODUTOS ============
app.get('/api/products', authRequired, (req, res) => {
  const { search, categoria, status, estoque } = req.query;
  const { limit, offset } = pag(req);
  let where = 'WHERE 1=1', params = [];
  if (search) { where += ' AND (p.nome LIKE ? OR p.codigo_barras LIKE ? OR p.sku LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (categoria) { where += ' AND p.categoria_id=?'; params.push(categoria); }
  if (status) { where += ' AND p.status=?'; params.push(status); }
  let rows = tq(T(req), `SELECT p.*, c.nome as categoria, u.sigla as unidade FROM products p LEFT JOIN categories c ON c.id=p.categoria_id LEFT JOIN units u ON u.id=p.unidade_id ${where} ORDER BY p.nome LIMIT ? OFFSET ?`, ...params, limit, offset);
  if (estoque === 'baixo') rows = rows.filter(p => p.estoque_atual <= p.estoque_min);
  rows = rows.map(enrich);
  if (req.user.role === 'vendedor') rows = rows.map(p => filterProductByRole(p, 'vendedor'));
  res.json({ data: rows });
});
app.get('/api/products/:id', authRequired, (req, res) => {
  const p = tget(T(req), 'SELECT p.*, c.nome as categoria, u.sigla as unidade FROM products p LEFT JOIN categories c ON c.id=p.categoria_id LEFT JOIN units u ON u.id=p.unidade_id WHERE p.id=?', req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  let out = enrich(p);
  if (req.user.role === 'vendedor') out = filterProductByRole(out, 'vendedor');
  out.lotes = tq(T(req), 'SELECT * FROM lots WHERE product_id=? ORDER BY date(validade)', p.id);
  out.kardex = tq(T(req), 'SELECT * FROM stock_movements WHERE product_id=? ORDER BY id DESC LIMIT 50', p.id);
  res.json(out);
});
app.post('/api/products', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  if (!b.nome) return res.status(400).json({ error: 'Nome é obrigatório.' });
  const r = trun(T(req), `INSERT INTO products(nome,codigo_interno,codigo_barras,sku,categoria_id,marca,unidade_id,tipo,custo_medio,preco_venda,estoque_atual,estoque_min,estoque_max,ponto_reposicao,localizacao,status,margem_min,perecivel) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    b.nome, b.codigo_interno || null, b.codigo_barras || null, b.sku || null, b.categoria_id || null, b.marca || null, b.unidade_id || null,
    b.tipo || 'revenda', b.custo_medio || 0, b.preco_venda || 0, b.estoque_atual || 0, b.estoque_min || 0, b.estoque_max || 0,
    b.ponto_reposicao || 0, b.localizacao || null, b.status || 'ativo', b.margem_min ?? 20, b.perecivel ? 1 : 0);
  const id = Number(r.lastInsertRowid);
  if (b.estoque_atual > 0) T(req).prepare('INSERT INTO stock_movements(product_id,tipo,motivo,qtd,custo_unit,estoque_antes,estoque_depois,user_id,user_name) VALUES(?,?,?,?,?,?,?,?,?)').run(id, 'entrada', 'estoque inicial', b.estoque_atual, b.custo_medio || 0, 0, b.estoque_atual, req.user.id, req.user.name);
  auditTdb(T(req), req.user, 'criar produto', 'produtos', b.nome, null, b, req.ip);
  res.status(201).json({ id });
});
app.put('/api/products/:id', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const tdb = T(req);
  const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const b = req.body || {};
  tdb.prepare(`UPDATE products SET nome=?,codigo_interno=?,codigo_barras=?,sku=?,categoria_id=?,marca=?,unidade_id=?,tipo=?,custo_medio=?,preco_venda=?,estoque_min=?,estoque_max=?,ponto_reposicao=?,localizacao=?,status=?,margem_min=?,perecivel=?,updated_at=datetime('now','localtime') WHERE id=?`).run(
    b.nome ?? p.nome, b.codigo_interno ?? p.codigo_interno, b.codigo_barras ?? p.codigo_barras, b.sku ?? p.sku, b.categoria_id ?? p.categoria_id,
    b.marca ?? p.marca, b.unidade_id ?? p.unidade_id, b.tipo ?? p.tipo, b.custo_medio ?? p.custo_medio, b.preco_venda ?? p.preco_venda,
    b.estoque_min ?? p.estoque_min, b.estoque_max ?? p.estoque_max, b.ponto_reposicao ?? p.ponto_reposicao, b.localizacao ?? p.localizacao,
    b.status ?? p.status, b.margem_min ?? p.margem_min, b.perecivel !== undefined ? (b.perecivel ? 1 : 0) : p.perecivel, p.id);
  auditTdb(tdb, req.user, (b.preco_venda ?? p.preco_venda) !== p.preco_venda ? 'alterar preco' : 'editar produto', 'produtos', p.nome, { preco: p.preco_venda }, { preco: b.preco_venda ?? p.preco_venda }, req.ip);
  res.json({ ok: true });
});
app.delete('/api/products/:id', authRequired, requireRole('admin'), (req, res) => {
  const tdb = T(req);
  const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  tdb.prepare('UPDATE products SET status=? WHERE id=?').run('inativo', p.id);
  auditTdb(tdb, req.user, 'desativar produto', 'produtos', p.nome, null, null, req.ip);
  res.json({ ok: true });
});
app.post('/api/products/preco-sugerido', authRequired, (req, res) => {
  const { custo, margem } = req.body || {};
  res.json({ preco: precoPorMargem(Number(custo || 0), Number(margem || 0)) });
});
app.post('/api/products/import', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Nenhum item.' });
  const erros = [];
  items.forEach((it, i) => { if (!it.nome) erros.push({ linha: i + 1, erro: 'nome obrigatório' }); });
  if (erros.length) return res.status(400).json({ error: 'Validação falhou', erros });
  let ok = 0;
  for (const it of items) { trun(T(req), 'INSERT INTO products(nome,codigo_barras,sku,marca,tipo,custo_medio,preco_venda,estoque_atual,estoque_min,status) VALUES(?,?,?,?,?,?,?,?,?,?)', it.nome, it.codigo_barras || null, it.sku || null, it.marca || null, it.tipo || 'revenda', it.custo_medio || 0, it.preco_venda || 0, it.estoque_atual || 0, it.estoque_min || 0, 'ativo'); ok++; }
  auditTdb(T(req), req.user, 'importar produtos', 'produtos', `${ok} itens`, null, { qtd: ok }, req.ip);
  res.json({ importados: ok });
});

// ============ ESTOQUE ============
app.get('/api/inventory', authRequired, (req, res) => {
  const rows = tq(T(req), "SELECT p.*, c.nome as categoria FROM products p LEFT JOIN categories c ON c.id=p.categoria_id WHERE p.status='ativo' ORDER BY p.nome").map(enrich);
  res.json(req.user.role === 'vendedor' ? rows.map(p => filterProductByRole(p, 'vendedor')) : rows);
});
app.post('/api/inventory/movement', authRequired, requireRole('admin', 'gerente', 'estoquista'), (req, res) => {
  const tdb = T(req);
  const { product_id, tipo, qtd, motivo, custo_unit } = req.body || {};
  if (!product_id || !tipo || qtd === undefined) return res.status(400).json({ error: 'Produto, tipo e quantidade obrigatórios.' });
  if (tipo === 'perda' && !motivo) return res.status(400).json({ error: 'Perdas exigem motivo.' });
  try {
    if (['saida', 'perda'].includes(tipo)) baixaPVPS(tdb, product_id, qtd);
    const r = movimentar(tdb, { product_id, tipo, motivo, qtd: tipo === 'ajuste' ? Number(qtd) : Math.abs(Number(qtd)), custo_unit: custo_unit || 0, user: req.user });
    if (['entrada', 'compra'].includes(tipo) && Number(custo_unit) > 0) {
      const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(product_id);
      tdb.prepare('UPDATE products SET custo_medio=? WHERE id=?').run(custoMedioPonderado(r.antes, p.custo_medio, Math.abs(Number(qtd)), Number(custo_unit)), product_id);
    }
    res.json({ ok: true, ...r });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/api/kardex/:productId', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM stock_movements WHERE product_id=? ORDER BY id DESC LIMIT 200', req.params.productId)));
app.get('/api/movements', authRequired, (req, res) => {
  const { limit, offset } = pag(req);
  res.json(tq(T(req), 'SELECT m.*, p.nome as produto FROM stock_movements m JOIN products p ON p.id=m.product_id ORDER BY m.id DESC LIMIT ? OFFSET ?', limit, offset));
});
app.post('/api/inventory/count', authRequired, requireRole('admin', 'gerente', 'estoquista'), (req, res) => {
  const tdb = T(req);
  const { product_id, fisico } = req.body || {};
  const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(product_id);
  if (!p) return res.status(404).json({ error: 'Produto não encontrado.' });
  const diverg = Number(fisico) - p.estoque_atual;
  movimentar(tdb, { product_id, tipo: 'ajuste', motivo: 'inventario', qtd: diverg, user: req.user, doc_ref: 'inventario' });
  auditTdb(tdb, req.user, 'inventario', 'estoque', p.nome, { sistema: p.estoque_atual }, { fisico, diverg }, req.ip);
  res.json({ ok: true, divergencia: diverg });
});

// ============ LOTES ============
app.get('/api/lots', authRequired, (req, res) => res.json(tq(T(req), 'SELECT l.*, p.nome as produto FROM lots l JOIN products p ON p.id=l.product_id ORDER BY date(l.validade) ASC LIMIT 200')));
app.post('/api/lots', authRequired, requireRole('admin', 'gerente', 'estoquista'), (req, res) => {
  const { product_id, lote, validade, qtd } = req.body || {};
  if (!product_id || !qtd) return res.status(400).json({ error: 'Produto e quantidade obrigatórios.' });
  const r = trun(T(req), 'INSERT INTO lots(product_id,lote,validade,qtd) VALUES(?,?,?,?)', product_id, lote || null, validade || null, qtd);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

// ============ FORNECEDORES / CLIENTES ============
app.get('/api/suppliers', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM suppliers ORDER BY fantasia, razao')));
app.post('/api/suppliers', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  const r = trun(T(req), 'INSERT INTO suppliers(razao,fantasia,doc,tel,email,endereco,cond_pag) VALUES(?,?,?,?,?,?,?)', b.razao || '', b.fantasia || '', b.doc || '', b.tel || '', b.email || '', b.endereco || '', b.cond_pag || '');
  auditTdb(T(req), req.user, 'criar fornecedor', 'compras', b.fantasia || b.razao, null, b, req.ip);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.get('/api/customers', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM customers ORDER BY nome')));
app.post('/api/customers', authRequired, (req, res) => {
  const b = req.body || {};
  if (!b.nome) return res.status(400).json({ error: 'Nome obrigatório.' });
  const r = trun(T(req), 'INSERT INTO customers(nome,doc,tel,email,endereco,obs,limite_fiado) VALUES(?,?,?,?,?,?,?)', b.nome, b.doc || '', b.tel || '', b.email || '', b.endereco || '', b.obs || '', b.limite_fiado || 0);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

// ============ COMPRAS ============
app.get('/api/purchases', authRequired, (req, res) => res.json(tq(T(req), 'SELECT pu.*, s.fantasia as fornecedor FROM purchases pu LEFT JOIN suppliers s ON s.id=pu.supplier_id ORDER BY pu.id DESC LIMIT 100')));
app.post('/api/purchases', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const tdb = T(req);
  const { supplier_id, items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Informe ao menos um item.' });
  const total = items.reduce((s, it) => s + Number(it.qtd) * Number(it.custo_unit), 0);
  const r = tdb.prepare('INSERT INTO purchases(supplier_id,status,total,user_id) VALUES(?,?,?,?)').run(supplier_id || null, 'aberto', total, req.user.id);
  const pid = Number(r.lastInsertRowid);
  for (const it of items) tdb.prepare('INSERT INTO purchase_items(purchase_id,product_id,qtd,custo_unit) VALUES(?,?,?,?)').run(pid, it.product_id, it.qtd, it.custo_unit);
  auditTdb(tdb, req.user, 'criar compra', 'compras', `pedido #${pid}`, null, { total }, req.ip);
  res.status(201).json({ id: pid });
});
app.post('/api/purchases/:id/receive', authRequired, requireRole('admin', 'gerente', 'estoquista'), (req, res) => {
  const tdb = T(req);
  const pur = tdb.prepare('SELECT * FROM purchases WHERE id=?').get(req.params.id);
  if (!pur) return res.status(404).json({ error: 'Pedido não encontrado.' });
  const items = tdb.prepare('SELECT * FROM purchase_items WHERE purchase_id=?').all(pur.id);
  for (const it of items) {
    const aReceber = it.qtd - it.qtd_recebida;
    if (aReceber <= 0) continue;
    const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(it.product_id);
    const novo = custoMedioPonderado(p.estoque_atual, p.custo_medio, aReceber, it.custo_unit);
    tdb.prepare('UPDATE products SET custo_medio=?, estoque_atual=estoque_atual+? WHERE id=?').run(novo, aReceber, it.product_id);
    tdb.prepare('INSERT INTO stock_movements(product_id,tipo,motivo,qtd,custo_unit,estoque_antes,estoque_depois,user_id,user_name,doc_ref) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(it.product_id, 'compra', `pedido #${pur.id}`, aReceber, it.custo_unit, p.estoque_atual, p.estoque_atual + aReceber, req.user.id, req.user.name, `pedido #${pur.id}`);
    tdb.prepare('UPDATE purchase_items SET qtd_recebida=qtd WHERE id=?').run(it.id);
  }
  tdb.prepare("UPDATE purchases SET status=?, recebido_at=datetime('now','localtime') WHERE id=?").run('recebido', pur.id);
  tdb.prepare('INSERT INTO accounts_payable(descricao,supplier_id,valor,vencimento,status) VALUES(?,?,?,?,?)').run(`Compra pedido #${pur.id}`, pur.supplier_id, pur.total, new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), 'aberto');
  auditTdb(tdb, req.user, 'receber compra', 'compras', `pedido #${pur.id}`, null, null, req.ip);
  res.json({ ok: true });
});

// ============ FICHA TÉCNICA ============
app.get('/api/recipes', authRequired, (req, res) => {
  const tdb = T(req);
  const rows = tdb.prepare('SELECT r.*, p.nome as produto FROM recipes r JOIN products p ON p.id=r.produto_acabado_id ORDER BY r.id DESC').all();
  rows.forEach(r => {
    r.itens = tdb.prepare('SELECT ri.*, pr.nome as insumo, pr.custo_medio FROM recipe_items ri JOIN products pr ON pr.id=ri.insumo_id WHERE ri.recipe_id=?').all(r.id);
    r.custo = Number(r.itens.reduce((s, i) => s + i.qtd * (i.custo_medio || 0), 0).toFixed(2));
  });
  res.json(rows);
});
app.post('/api/recipes', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const tdb = T(req);
  const { produto_acabado_id, nome, itens } = req.body || {};
  if (!produto_acabado_id || !nome) return res.status(400).json({ error: 'Produto e nome obrigatórios.' });
  const r = tdb.prepare('INSERT INTO recipes(produto_acabado_id,nome) VALUES(?,?)').run(produto_acabado_id, nome);
  const rid = Number(r.lastInsertRowid);
  for (const it of (itens || [])) tdb.prepare('INSERT INTO recipe_items(recipe_id,insumo_id,qtd) VALUES(?,?,?)').run(rid, it.insumo_id, it.qtd);
  const custo = tdb.prepare('SELECT ri.qtd, pr.custo_medio FROM recipe_items ri JOIN products pr ON pr.id=ri.insumo_id WHERE ri.recipe_id=?').all(rid).reduce((s, i) => s + i.qtd * (i.custo_medio || 0), 0);
  tdb.prepare('UPDATE products SET custo_medio=? WHERE id=?').run(Number(custo.toFixed(4)), produto_acabado_id);
  auditTdb(tdb, req.user, 'criar ficha', 'ficha', nome, null, req.body, req.ip);
  res.status(201).json({ id: rid, custo });
});

// ============ VENDAS / PDV ============
app.get('/api/sales', authRequired, (req, res) => res.json(tq(T(req), 'SELECT s.*, c.nome as cliente FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 100')));
app.post('/api/sales', authRequired, (req, res) => {
  const tdb = T(req);
  const { customer_id, items, desconto = 0, pagamento = 'dinheiro' } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Carrinho vazio.' });
  let total = 0;
  for (const it of items) {
    const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(it.product_id);
    if (!p) return res.status(400).json({ error: 'Produto inexistente.' });
    if (p.estoque_atual < it.qtd && p.tipo !== 'servico') return res.status(400).json({ error: `Estoque insuficiente: ${p.nome} (tem ${p.estoque_atual})` });
    total += Number(it.qtd) * Number(it.preco_unit ?? p.preco_venda);
  }
  total = Number((total - Number(desconto || 0)).toFixed(2));
  const r = tdb.prepare('INSERT INTO sales(customer_id,user_id,user_name,total,desconto,pagamento) VALUES(?,?,?,?,?,?)').run(customer_id || null, req.user.id, req.user.name, total, desconto, pagamento);
  const sid = Number(r.lastInsertRowid);
  for (const it of items) {
    const p = tdb.prepare('SELECT * FROM products WHERE id=?').get(it.product_id);
    const preco = Number(it.preco_unit ?? p.preco_venda);
    tdb.prepare('INSERT INTO sale_items(sale_id,product_id,qtd,preco_unit,custo_unit) VALUES(?,?,?,?,?)').run(sid, it.product_id, it.qtd, preco, p.custo_medio);
    const recipe = tdb.prepare('SELECT * FROM recipes WHERE produto_acabado_id=?').get(it.product_id);
    if (recipe) {
      const insumos = tdb.prepare('SELECT * FROM recipe_items WHERE recipe_id=?').all(recipe.id);
      for (const ins of insumos) {
        const qi = ins.qtd * it.qtd;
        baixaPVPS(tdb, ins.insumo_id, qi);
        movimentar(tdb, { product_id: ins.insumo_id, tipo: 'consumo', motivo: `venda #${sid}`, qtd: qi, user: req.user, doc_ref: `venda #${sid}` });
      }
      if (p.estoque_atual > 0) movimentar(tdb, { product_id: p.id, tipo: 'venda', motivo: `venda #${sid}`, qtd: Math.abs(it.qtd), user: req.user, doc_ref: `venda #${sid}` });
    } else {
      baixaPVPS(tdb, it.product_id, it.qtd);
      movimentar(tdb, { product_id: p.id, tipo: 'venda', motivo: `venda #${sid}`, qtd: Math.abs(it.qtd), user: req.user, doc_ref: `venda #${sid}` });
    }
  }
  if (pagamento === 'fiado') tdb.prepare('INSERT INTO accounts_receivable(descricao,customer_id,sale_id,valor,vencimento) VALUES(?,?,?,?,?)').run(`Venda #${sid} fiado`, customer_id || null, sid, total, new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
  auditTdb(tdb, req.user, 'criar venda', 'vendas', `venda #${sid}`, null, { total, pagamento }, req.ip);
  res.status(201).json({ id: sid, total });
});
app.post('/api/sales/:id/cancel', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const tdb = T(req);
  const s = tdb.prepare('SELECT * FROM sales WHERE id=?').get(req.params.id);
  if (!s || s.status === 'cancelada') return res.status(400).json({ error: 'Venda inexistente ou já cancelada.' });
  const items = tdb.prepare('SELECT * FROM sale_items WHERE sale_id=?').all(s.id);
  for (const it of items) movimentar(tdb, { product_id: it.product_id, tipo: 'entrada', motivo: `cancelamento venda #${s.id}`, qtd: Math.abs(it.qtd), user: req.user, doc_ref: `cancel #${s.id}` });
  tdb.prepare('UPDATE sales SET status=? WHERE id=?').run('cancelada', s.id);
  auditTdb(tdb, req.user, 'cancelar venda', 'vendas', `venda #${s.id}`, null, null, req.ip);
  res.json({ ok: true });
});

// ============ FINANCEIRO ============
app.get('/api/finance/summary', authRequired, (req, res) => {
  const tdb = T(req);
  const pagar = tdb.prepare("SELECT COALESCE(SUM(valor),0) t FROM accounts_payable WHERE status='aberto'").get()?.t || 0;
  const receber = tdb.prepare("SELECT COALESCE(SUM(valor),0) t FROM accounts_receivable WHERE status='aberto'").get()?.t || 0;
  const vendasHoje = tdb.prepare("SELECT COALESCE(SUM(total),0) t FROM sales WHERE date(created_at)=date('now','localtime') AND status='finalizada'").get()?.t || 0;
  res.json({ aPagar: pagar, aReceber: receber, vendasHoje, saldoPrevisto: receber - pagar });
});
app.get('/api/finance/pagar', authRequired, (req, res) => res.json(tq(T(req), 'SELECT a.*, s.fantasia as fornecedor FROM accounts_payable a LEFT JOIN suppliers s ON s.id=a.supplier_id ORDER BY a.vencimento')));
app.post('/api/finance/pagar', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  const r = trun(T(req), 'INSERT INTO accounts_payable(descricao,supplier_id,valor,vencimento,status) VALUES(?,?,?,?,?)', b.descricao || '', b.supplier_id || null, b.valor || 0, b.vencimento || null, 'aberto');
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.post('/api/finance/pagar/:id/baixar', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  trun(T(req), "UPDATE accounts_payable SET status='pago', pago_em=datetime('now','localtime') WHERE id=?", req.params.id);
  res.json({ ok: true });
});
app.get('/api/finance/receber', authRequired, (req, res) => res.json(tq(T(req), 'SELECT a.*, c.nome as cliente FROM accounts_receivable a LEFT JOIN customers c ON c.id=a.customer_id ORDER BY a.vencimento')));
app.post('/api/finance/receber', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  const r = trun(T(req), 'INSERT INTO accounts_receivable(descricao,customer_id,valor,vencimento,status) VALUES(?,?,?,?,?)', b.descricao || '', b.customer_id || null, b.valor || 0, b.vencimento || null, 'aberto');
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.post('/api/finance/receber/:id/baixar', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  trun(T(req), "UPDATE accounts_receivable SET status='recebido', pago_em=datetime('now','localtime') WHERE id=?", req.params.id);
  res.json({ ok: true });
});
app.get('/api/finance/expenses', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM expenses ORDER BY data DESC LIMIT 100')));
app.post('/api/finance/expenses', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const b = req.body || {};
  const r = trun(T(req), 'INSERT INTO expenses(descricao,tipo,valor,data) VALUES(?,?,?,?)', b.descricao || '', b.tipo || 'variavel', b.valor || 0, b.data || new Date().toISOString().slice(0, 10));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.get('/api/finance/dre', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const tdb = T(req);
  const receita = tdb.prepare("SELECT COALESCE(SUM(total),0) t FROM sales WHERE status='finalizada'").get()?.t || 0;
  const cmv = tdb.prepare("SELECT COALESCE(SUM(si.qtd*si.custo_unit),0) t FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.status='finalizada'").get()?.t || 0;
  const desp = tdb.prepare('SELECT COALESCE(SUM(valor),0) t FROM expenses').get()?.t || 0;
  const lucro = receita - cmv - desp;
  res.json({ receita, custos: cmv, despesas: desp, lucro, margem: receita ? Number(((lucro / receita) * 100).toFixed(2)) : 0 });
});

// ============ SEGMENTOS ============
app.get('/api/segments/professionals', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM professionals ORDER BY nome')));
app.post('/api/segments/professionals', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const r = trun(T(req), 'INSERT INTO professionals(nome,comissao_pct) VALUES(?,?)', req.body.nome, req.body.comissao_pct || 0);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.get('/api/segments/services', authRequired, (req, res) => res.json(tq(T(req), 'SELECT * FROM services ORDER BY nome')));
app.post('/api/segments/services', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const r = trun(T(req), 'INSERT INTO services(nome,preco,comissao_pct) VALUES(?,?,?)', req.body.nome, req.body.preco || 0, req.body.comissao_pct || 0);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.get('/api/segments/appointments', authRequired, (req, res) => res.json(tq(T(req), 'SELECT a.*, pr.nome as profissional, s.nome as servico FROM appointments a LEFT JOIN professionals pr ON pr.id=a.professional_id LEFT JOIN services s ON s.id=a.service_id ORDER BY a.datahora DESC LIMIT 100')));
app.post('/api/segments/appointments', authRequired, (req, res) => {
  const b = req.body || {};
  const r = trun(T(req), 'INSERT INTO appointments(professional_id,service_id,customer_id,datahora,status) VALUES(?,?,?,?,?)', b.professional_id || null, b.service_id || null, b.customer_id || null, b.datahora || new Date().toISOString(), b.status || 'agendado');
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});

// ============ DASHBOARD / ALERTAS / RELATÓRIOS / AUDIT ============
app.get('/api/dashboard', authRequired, (req, res) => {
  const tdb = T(req);
  const vendasHoje = tdb.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) t FROM sales WHERE date(created_at)=date('now','localtime') AND status='finalizada'").get() || { n: 0, t: 0 };
  const ticket = tdb.prepare("SELECT date(created_at) d, COALESCE(SUM(total),0) t FROM sales WHERE status='finalizada' GROUP BY d ORDER BY d DESC LIMIT 7").all().reverse();
  const top = tdb.prepare("SELECT p.nome, SUM(si.qtd) q, SUM(si.qtd*si.preco_unit) t FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.status='finalizada' GROUP BY p.id ORDER BY q DESC LIMIT 5").all();
  const baixo = tdb.prepare("SELECT id,nome,estoque_atual,estoque_min FROM products WHERE status='ativo' AND estoque_atual<=estoque_min ORDER BY nome LIMIT 10").all();
  const receita = tdb.prepare("SELECT COALESCE(SUM(total),0) t FROM sales WHERE status='finalizada'").get()?.t || 0;
  const cmv = tdb.prepare("SELECT COALESCE(SUM(si.qtd*si.custo_unit),0) t FROM sale_items si JOIN sales s ON s.id=si.sale_id WHERE s.status='finalizada'").get()?.t || 0;
  res.json({ vendasHoje, ticket, topVendidos: top, estoqueBaixo: baixo, receita, lucro: receita - cmv, margem: receita ? Number(((receita - cmv) / receita * 100).toFixed(2)) : 0 });
});
app.get('/api/alerts', authRequired, (req, res) => {
  const tdb = T(req);
  const alerts = [];
  tdb.prepare("SELECT nome,estoque_atual,estoque_min FROM products WHERE status='ativo' AND estoque_atual<=estoque_min").all().forEach(p => alerts.push({ nivel: p.estoque_atual <= 0 ? 'critico' : 'baixo', msg: `${p.nome} abaixo do mínimo (${p.estoque_atual}/${p.estoque_min})` }));
  tdb.prepare('SELECT l.*, p.nome FROM lots l JOIN products p ON p.id=l.product_id WHERE l.qtd>0 AND l.validade IS NOT NULL').all().forEach(l => {
    const d = diasPara(l.validade);
    if (d !== null && d < 0) alerts.push({ nivel: 'critico', msg: `${l.nome} VENCIDO` });
    else if (d !== null && d <= 30) alerts.push({ nivel: 'aviso', msg: `${l.nome} vence em ${d} dias` });
  });
  res.json(alerts);
});
app.get('/api/reports/:tipo', authRequired, (req, res) => {
  const tdb = T(req);
  const t = req.params.tipo;
  if (t === 'estoque') return res.json(tdb.prepare('SELECT p.*, c.nome as categoria FROM products p LEFT JOIN categories c ON c.id=p.categoria_id ORDER BY p.nome').all().map(enrich));
  if (t === 'vendas') return res.json(tdb.prepare('SELECT s.*, c.nome as cliente FROM sales s LEFT JOIN customers c ON c.id=s.customer_id ORDER BY s.id DESC LIMIT 500').all());
  if (t === 'margens') return res.json(tdb.prepare('SELECT * FROM products ORDER BY nome').all().map(enrich));
  if (t === 'perdas') return res.json(tdb.prepare("SELECT m.*, p.nome as produto FROM stock_movements m JOIN products p ON p.id=m.product_id WHERE m.tipo='perda' ORDER BY m.id DESC LIMIT 200").all());
  if (t === 'curva-abc') {
    const rows = tdb.prepare("SELECT p.nome, SUM(si.qtd*si.preco_unit) t FROM sale_items si JOIN products p ON p.id=si.product_id JOIN sales s ON s.id=si.sale_id WHERE s.status='finalizada' GROUP BY p.id ORDER BY t DESC").all();
    const total = rows.reduce((s, r) => s + r.t, 0) || 1;
    let acc = 0;
    return res.json(rows.map(r => { acc += r.t; const pct = acc / total * 100; return { ...r, classe: pct <= 80 ? 'A' : pct <= 95 ? 'B' : 'C' }; }));
  }
  res.status(404).json({ error: 'Relatório inexistente.' });
});
app.get('/api/audit', authRequired, requireRole('admin', 'gerente'), (req, res) => {
  const { limit, offset } = pag(req);
  res.json(tq(T(req), 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?', limit, offset));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Rota não encontrada.' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Controle de Estoque MULTI-EMPRESA em http://localhost:${PORT}`));
module.exports = app;
