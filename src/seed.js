// Seed multi-empresa: cria provedor SaaS + 2 empresas isoladas com dados demo
const { initMaster, mrun, mget, getTenantDb } = require('./db');
const { hashPass } = require('./auth');

async function main() {
  initMaster();
  // superadmin (dono do SaaS, vende para empresas)
  if (!mget('SELECT id FROM users WHERE email=?', 'saas@dono.com')) {
    mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(NULL,?,?,?,?)', 'Dono SaaS', 'saas@dono.com', await hashPass('saas123'), 'superadmin');
    console.log('superadmin: saas@dono.com / saas123');
  }
  // superadmin do desenvolvedor via env (opcional, ex: SEED_DEV_EMAIL / SEED_DEV_PASS no .env)
  if (process.env.SEED_DEV_EMAIL && process.env.SEED_DEV_PASS) {
    if (!mget('SELECT id FROM users WHERE email=?', process.env.SEED_DEV_EMAIL)) {
      mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(NULL,?,?,?,?)', 'Desenvolvedor', String(process.env.SEED_DEV_EMAIL).toLowerCase(), await hashPass(process.env.SEED_DEV_PASS), 'superadmin');
      console.log('dev superadmin: ' + process.env.SEED_DEV_EMAIL);
    }
  }
  async function empresa(nome, segmento, adminEmail, produtos) {
    let c = mget('SELECT * FROM companies WHERE nome=?', nome);
    let cid;
    if (!c) { cid = Number(mrun('INSERT INTO companies(nome,segmento) VALUES(?,?)', nome, segmento).lastInsertRowid); }
    else cid = c.id;
    const tdb = getTenantDb(cid);
    tdb.prepare('INSERT OR IGNORE INTO company_info(id,nome,segmento) VALUES(1,?,?)').run(nome, segmento);
    ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT'].forEach(s => { try { tdb.prepare('INSERT OR IGNORE INTO units(sigla,nome) VALUES(?,?)').run(s, s); } catch {} });
    ['Geral', 'Alimentos', 'Bebidas', 'Beleza', 'Limpeza'].forEach(n => { try { tdb.prepare('INSERT OR IGNORE INTO categories(nome) VALUES(?)').run(n); } catch {} });
    if (!mget('SELECT id FROM users WHERE email=?', adminEmail)) {
      mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, `Admin ${nome}`, adminEmail, await hashPass('123456'), 'admin');
    }
    const roles = [['Gerente', 'gerente'], ['Vendedor', 'vendedor'], ['Estoquista', 'estoquista']];
    for (const [suf, role] of roles) {
      const em = `${role}@${adminEmail.split('@')[1]}`;
      if (!mget('SELECT id FROM users WHERE email=? AND company_id=?', em, cid)) {
        mrun('INSERT INTO users(company_id,name,email,pass_hash,role) VALUES(?,?,?,?,?)', cid, `${suf} ${nome}`, em, await hashPass('123456'), role);
      }
    }
    const n = tdb.prepare('SELECT COUNT(*) n FROM products').get()?.n || 0;
    if (n === 0) {
      const un = tdb.prepare("SELECT id FROM units WHERE sigla='UN'").get()?.id;
      const kg = tdb.prepare("SELECT id FROM units WHERE sigla='KG'").get()?.id;
      for (const p of produtos) {
        tdb.prepare('INSERT INTO products(nome,unidade_id,tipo,custo_medio,preco_venda,estoque_atual,estoque_min,ponto_reposicao,status) VALUES(?,?,?,?,?,?,?,?,?)')
          .run(p[0], p[3] === 'kg' ? kg : un, p[4] || 'revenda', p[1], p[2], p[5] ?? 10, p[6] ?? 5, p[6] ?? 5, 'ativo');
      }
      tdb.prepare('INSERT INTO suppliers(razao,fantasia) VALUES(?,?)').run('Atacadão Fornecedor LTDA', 'Atacadão');
      tdb.prepare('INSERT INTO customers(nome,tel) VALUES(?,?)').run('Cliente Balcão', '');
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
