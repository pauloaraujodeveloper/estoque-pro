// Seed multi-empresa: cria provedor SaaS + 2 empresas isoladas com dados demo
// Roda em SQLite (sem DATABASE_URL) ou PostgreSQL (com DATABASE_URL).
const { initMaster, mrun, mget, getTenantDb, tq, tget, trun } = require('./db');
const { hashPass } = require('./auth');

async function main() {
  await initMaster();
  // superadmin (dono do SaaS, vende para empresas)
  if (!await mget('SELECT id FROM users WHERE email=?', 'saas@dono.com')) {
    await mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(NULL,?,?,?,?)', 'Dono SaaS', 'saas@dono.com', await hashPass('saas123'), 'superadmin');
    console.log('superadmin: saas@dono.com / saas123');
  }
  // superadmin do desenvolvedor via env (opcional, ex: SEED_DEV_EMAIL / SEED_DEV_PASS no .env)
  if (process.env.SEED_DEV_EMAIL && process.env.SEED_DEV_PASS) {
    if (!await mget('SELECT id FROM users WHERE email=?', process.env.SEED_DEV_EMAIL)) {
      await mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(NULL,?,?,?,?)', 'Desenvolvedor', String(process.env.SEED_DEV_EMAIL).toLowerCase(), await hashPass(process.env.SEED_DEV_PASS), 'superadmin');
      console.log('dev superadmin: ' + process.env.SEED_DEV_EMAIL);
    }
  }
  async function empresa(nome, segmento, adminEmail, produtos) {
    let c = await mget('SELECT * FROM companies WHERE nome=?', nome);
    let cid;
    if (!c) { cid = Number((await mrun('INSERT INTO companies(nome,segmento) VALUES(?,?)', nome, segmento)).lastInsertRowid); }
    else cid = c.id;
    const tdb = await getTenantDb(cid);
    await trun(tdb, 'INSERT OR IGNORE INTO company_info(id,nome,segmento) VALUES(1,?,?)', nome, segmento);
    for (const s of ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT']) {
      try { await trun(tdb, 'INSERT OR IGNORE INTO units(sigla,nome) VALUES(?,?)', s, s); } catch {}
    }
    for (const n of ['Geral', 'Alimentos', 'Bebidas', 'Beleza', 'Limpeza']) {
      try { await trun(tdb, 'INSERT OR IGNORE INTO categories(nome) VALUES(?)', n); } catch {}
    }
    if (!await mget('SELECT id FROM users WHERE email=?', adminEmail)) {
      await mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, `Admin ${nome}`, adminEmail, await hashPass('123456'), 'admin');
    }
    const roles = [['Gerente', 'gerente'], ['Vendedor', 'vendedor'], ['Estoquista', 'estoquista']];
    for (const [suf, role] of roles) {
      const em = `${role}@${adminEmail.split('@')[1]}`;
      if (!await mget('SELECT id FROM users WHERE email=? AND company_id=?', em, cid)) {
        await mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, `${suf} ${nome}`, em, await hashPass('123456'), role);
      }
    }
    const n = (await tget(tdb, 'SELECT COUNT(*) n FROM products'))?.n || 0;
    if (Number(n) === 0) {
      const un = (await tget(tdb, "SELECT id FROM units WHERE sigla='UN'"))?.id;
      const kg = (await tget(tdb, "SELECT id FROM units WHERE sigla='KG'"))?.id;
      for (const p of produtos) {
        await trun(tdb, 'INSERT INTO products(nome,unidade_id,tipo,custo_medio,preco_venda,estoque_atual,estoque_min,ponto_reposicao,status) VALUES(?,?,?,?,?,?,?,?,?)',
          p[0], p[3] === 'kg' ? kg : un, p[4] || 'revenda', p[1], p[2], p[5] ?? 10, p[6] ?? 5, p[6] ?? 5, 'ativo');
      }
      await trun(tdb, 'INSERT INTO suppliers(razao,fantasia) VALUES(?,?)', 'Atacadão Fornecedor LTDA', 'Atacadão');
      await trun(tdb, 'INSERT INTO customers(nome,tel) VALUES(?,?)', 'Cliente Balcão', '');
      console.log(`seed ${nome}: ${produtos.length} produtos`);
    }
    return cid;
  }

  await empresa('Marmitaria Sabor Caseiro', 'marmitaria', 'admin@marmita.com', [
    ['Arroz 5kg', 12, 22, 'un', 'insumo', 50, 10],
    ['Feijão 1kg', 5, 9, 'un', 'insumo', 40, 10],
    ['Carne kg', 25, 45, 'kg', 'insumo', 20, 5],
    ['Marmita Executiva', 8, 18, 'un', 'acabado', 30, 5],
    ['Embalagem', 0.8, 2, 'un', 'insumo', 200, 50],
  ]);
  await empresa('Salão Beleza Pura', 'salao', 'admin@salao.com', [
    ['Shampoo 500ml', 15, 35, 'un', 'revenda', 20, 5],
    ['Tintura 60g', 18, 40, 'un', 'insumo', 15, 5],
    ['Oxidante 90ml', 8, 18, 'un', 'insumo', 15, 5],
    ['Corte Feminino', 0, 60, 'un', 'servico', 0, 0],
  ]);
  console.log('OK. Logins: admin@marmita.com/123456 | admin@salao.com/123456 | saas@dono.com/saas123');
}
main().catch(e => { console.error(e); process.exit(1); });
