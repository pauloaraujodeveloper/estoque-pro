// EstoquePro SPA — multi-empresa, perfis, tooltips, responsivo
const $ = s => document.querySelector(s);
const api = {
  token: localStorage.getItem('token') || null,
  async req(m, url, body) {
    const acting = (typeof ME !== 'undefined' && ME && ME.role === 'superadmin' && sessionStorage.getItem('cid')) ? { 'x-company-id': sessionStorage.getItem('cid') } : {};
    let r;
    try {
      r = await fetch(url, { method: m, headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}), ...acting }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error('Servidor indisponível (Failed to fetch). Inicie o servidor com start-servidor.bat ou "npm start" e recarregue a página.');
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Erro na operação');
    return j;
  },
  get: function (u) { return this.req('GET', u); },
  post: function (u, b) { return this.req('POST', u, b); },
  put: function (u, b) { return this.req('PUT', u, b); },
};
let ME = null;
const BRL = v => (Number(v || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function toast(m) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = m; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3200); }
function modal(html) { $('#modal-root').innerHTML = `<div class="modal">${html}</div>`; }
function closeModal() { $('#modal-root').innerHTML = ''; }
$('#modal-root').addEventListener('click', e => { if (e.target.id === 'modal-root') closeModal(); });
function confirmDlg(msg, fn) { modal(`<h3>⚠️ Confirmação</h3><p>${msg}</p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn danger" id="cf-ok">Confirmar</button></div>`); window.closeModal = closeModal; $('#cf-ok').onclick = () => { closeModal(); fn(); }; }
window.closeModal = closeModal;
function csv(name, rows) {
  if (!rows.length) return toast('Nada para exportar');
  const cols = Object.keys(rows[0]);
  const out = [cols.join(';')].concat(rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(';'))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + out], { type: 'text/csv' })); a.download = name; a.click();
}
const PAYL = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_credito: 'Crédito', cartao_debito: 'Débito', fiado: 'Fiado', cartao: 'Cartão', multi: 'Múltiplo', cortesia: 'Cortesia' };
function payLabel(m) { return PAYL[m] || m || '-'; }
function statusLabel(s) { return { finalizada: 'Concluída', aguardando_pagamento: 'Aguardando pagto', cancelada: 'Cancelada', aberto: 'Aberto', recebido: 'Recebido', pago: 'Pago', parcial: 'Parcial' }[s] || s || '-'; }
// Exporta .xls que abre no Excel (tabela HTML)
function xls(name, rows) {
  if (!rows || !rows.length) return toast('Nada para exportar');
  const ks = Object.keys(rows[0]);
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><tr>${ks.map(k => `<th>${k}</th>`).join('')}</tr>${rows.map(r => `<tr>${ks.map(k => `<td>${r[k] ?? ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + html], { type: 'application/vnd.ms-excel' })); a.download = name.endsWith('.xls') ? name : name + '.xls'; a.click();
}
// Imprime cupom/relatório em janela de impressão (gera PDF pela impressora do sistema)
function printHtml(title, bodyHtml) {
  const w = window.open('', '_blank', 'width=420');
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,monospace;font-size:12px;max-width:320px;margin:0 auto;padding:8px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px dashed #999;padding:3px;text-align:left;font-size:12px}.c{text-align:center}.r{text-align:right}h2{font-size:15px;margin:4px 0}@media print{button{display:none}}</style></head><body>${bodyHtml}<br><div class="c"><button onclick="window.print()">🖨️ Imprimir / PDF</button></div></body></html>`);
  w.document.close();
}
function receiptHtml(s, co) {
  co = co || {};
  return `<div class="c">${co.logo ? `<img src="${co.logo}" style="max-height:64px;max-width:200px"><br>` : ''}<h2>${co.nome || 'CUPOM'}</h2><small>${[co.street, co.number, co.city, co.uf].filter(Boolean).join(' ')} ${co.telefone || ''}</small><br><small>${co.doc ? ((co.person_type === 'PF' ? 'CPF: ' : 'CNPJ: ') + co.doc) : ''}</small>${co.printer_coupon ? `<br><small>Imp: ${co.printer_coupon} · ${co.paper_width || ''}</small>` : ''}</div><hr>`
    + `<small>Venda #${s.id} · ${s.created_at || ''}<br>Cliente: ${s.cliente || 'Balcão'} · Caixa: ${s.caixa_id || '-'} · Op: ${s.operator_name || s.user_name || ''}</small><hr>`
    + `<table>${(s.itens || []).map(i => `<tr><td>${i.qtd}x ${i.nome}</td><td class="r">${BRL(Number(i.qtd) * Number(i.preco_unit))}</td></tr>`).join('')}</table><hr>`
    + (Number(s.desconto) ? `Desconto: ${BRL(s.desconto)}<br>` : '')
    + `<b>TOTAL: ${BRL(s.total)}</b><br><small>${(s.payments || []).map(p => `${payLabel(p.method)} ${BRL(p.amount)}`).join(' + ')}</small><br><small>Status: ${statusLabel(s.status)}</small><hr>`
    + `<div class="c"><small>${co.receipt_footer || 'Obrigado pela preferência!'}</small></div>`;
}

// ---------- AUTH ----------
$('#tab-login').onclick = () => { $('#tab-login').classList.add('active'); $('#tab-signup').classList.remove('active'); $('#form-login').classList.remove('hidden'); $('#form-signup').classList.add('hidden'); };
$('#tab-signup').onclick = () => { $('#tab-signup').classList.add('active'); $('#tab-login').classList.remove('active'); $('#form-signup').classList.remove('hidden'); $('#form-login').classList.add('hidden'); };
$('#form-login').onsubmit = async e => {
  e.preventDefault(); $('#login-err').textContent = '';
  try {
    const j = await api.post('/api/auth/login', { email: $('#login-email').value.trim(), password: $('#login-pass').value });
    api.token = j.token; localStorage.setItem('token', j.token); ME = j.user; enter();
  } catch (err) { $('#login-err').textContent = err.message; }
};
$('#form-signup').onsubmit = async e => {
  e.preventDefault(); $('#signup-err').textContent = '';
  try {
    const j = await api.post('/api/auth/signup-company', { company_nome: $('#su-company').value.trim(), segmento: $('#su-seg').value, user_name: $('#su-name').value.trim(), email: $('#su-email').value.trim(), password: $('#su-pass').value });
    api.token = j.token; localStorage.setItem('token', j.token); ME = j.user; enter(); toast('Empresa criada com banco isolado!');
  } catch (err) { $('#signup-err').textContent = err.message; }
};
$('#btn-logout').onclick = () => { localStorage.removeItem('token'); location.reload(); };
$('#link-recover').onclick = (e) => {
  e.preventDefault();
  modal(`<h3>Recuperar senha</h3><p class="muted">Informe seu e-mail para receber uma senha temporária.</p><label>E-mail<input id="rc-email" type="email" value="${($('#login-email').value || '').replace(/"/g, '&quot;')}"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="rc-ok">Enviar</button></div>`);
  $('#rc-ok').onclick = async () => {
    try { const j = await api.post('/api/auth/recover', { email: $('#rc-email').value.trim() }); closeModal(); toast(j.message); }
    catch (err) { toast(err.message); }
  };
};
$('#btn-menu').onclick = () => { const s = $('#sidebar'); s.classList.toggle('open'); $('#overlay').classList.toggle('hidden', !s.classList.contains('open')); };
$('#overlay').onclick = () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.add('hidden'); };
$('#bell').onclick = async () => { const a = await api.get('/api/alerts'); modal(`<h3>🔔 Alertas</h3>${a.length ? a.map(x => `<p>${x.nivel === 'critico' ? '🔴' : x.nivel === 'baixo' ? '🟡' : '🟠'} ${x.msg}</p>`).join('') : '<p class="muted">Nenhum alerta. Tudo certo!</p>'}<button class="btn ghost" onclick="closeModal()">Fechar</button>`); };

async function boot() {
  if (!api.token) { $('#auth-view').classList.remove('hidden'); return; }
  try { const j = await api.get('/api/me'); ME = j.user; enter(); }
  catch { localStorage.removeItem('token'); $('#auth-view').classList.remove('hidden'); }
}

function enter() {
  $('#auth-view').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#co-name').textContent = ME.company_nome || 'Painel SaaS';
  $('#co-seg').textContent = ME.company_segmento || ME.role;
  $('#user-line').textContent = `${ME.name} · ${ME.role}`;
  $('#role-badge').textContent = ME.role.toUpperCase();
  buildMenu();
  if (!location.hash) location.hash = '#/dashboard';
  route();
  refreshBell();
  loadCoLogo();
  renderCtxBar();
}
function actingCid() { return (ME && ME.role === 'superadmin' && sessionStorage.getItem('cid')) || null; }
function renderCtxBar() {
  const bar = $('#ctx-bar');
  const cid = actingCid();
  if (!cid) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = `<span>👁️ Vendo dados da empresa #${cid} (modo suporte)</span><button class="btn sm warn" id="ctx-exit" title="Voltar ao Painel SaaS">Sair</button>`;
  $('#ctx-exit').onclick = () => { sessionStorage.removeItem('cid'); location.hash = '#/saas'; route(); renderCtxBar(); buildMenu(); };
}
function setCoLogo(logo) {
  const img = $('#co-logo'), fb = $('#co-logo-fb');
  if (logo) { img.src = logo; img.classList.remove('hidden'); fb.classList.add('hidden'); }
  else { img.removeAttribute('src'); img.classList.add('hidden'); fb.classList.remove('hidden'); }
}
async function loadCoLogo() {
  try {
    if (!ME || ME.role === 'superadmin') { setCoLogo(null); return; }
    const co = await api.get('/api/company');
    setCoLogo(co.logo || (co.info && co.info.logo));
    if (co.nome) $('#co-name').textContent = co.nome;
  } catch {}
}
// Lê imagem, redimensiona p/ no máx 256px e devolve dataURL (leve p/ salvar no banco)
function pickLogo(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Selecione um arquivo de imagem.'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 256, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = url;
  });
}
async function refreshBell() {
  try {
    if (ME.role === 'superadmin') return;
    const a = await api.get('/api/alerts');
    const n = $('#bell-n'); n.textContent = a.length; n.classList.toggle('hidden', !a.length);
  } catch {}
}

const MENUS = {
  superadmin: [['SaaS', [['Painel SaaS', '#/saas', 'Gerenciar empresas clientes isoladas'], ['Usuários', '#/usuarios', 'Todos os usuários']]]],
  admin: [['Principal', [['Dashboard', '#/dashboard', 'Visão geral'], ['Alertas', '#/alertas', 'Estoque baixo e vencimentos']]], ['Operação', [['PDV / Vendas', '#/pdv', 'Frente de caixa rápida'], ['Vendas', '#/vendas', 'Histórico'], ['Caixa / Financeiro', '#/financeiro', 'Contas e DRE']]], ['Estoque', [['Produtos', '#/produtos', 'Cadastro e preços'], ['Movimentações', '#/estoque', 'Entradas, saídas, perdas'], ['Lotes', '#/lotes', 'Validade e PVPS'], ['Transferências', '#/transf', 'Entre filiais/lojas'], ['Compras', '#/compras', 'Pedidos e recebimentos']]], ['Cadastros', [['Clientes', '#/clientes', 'Fiado e histórico'], ['Fornecedores', '#/fornecedores', 'Histórico de preços'], ['Ficha técnica', '#/fichas', 'Receitas e consumo auto']]], ['Gestão', [['Relatórios', '#/relatorios', 'Exportar CSV'], ['Segmento', '#/segmento', 'Módulo do seu ramo'], ['Usuários', '#/usuarios', 'Equipe e perfis'], ['Empresa', '#/empresa', 'Dados e segmento'], ['Auditoria', '#/auditoria', 'Quem fez o quê']]]],
  gerente: [['Principal', [['Dashboard', '#/dashboard', ''], ['PDV / Vendas', '#/pdv', ''], ['Produtos', '#/produtos', ''], ['Movimentações', '#/estoque', ''], ['Compras', '#/compras', ''], ['Transferências', '#/transf', ''], ['Clientes', '#/clientes', ''], ['Financeiro', '#/financeiro', ''], ['Relatórios', '#/relatorios', '']]]],
  vendedor: [['Vendas', [['PDV / Vendas', '#/pdv', 'Registrar venda'], ['Produtos', '#/produtos', 'Consultar'], ['Clientes', '#/clientes', 'Consultar']]]],
  estoquista: [['Estoque', [['Dashboard', '#/dashboard', ''], ['Produtos', '#/produtos', ''], ['Movimentações', '#/estoque', 'Entradas e saídas'], ['Lotes', '#/lotes', ''], ['Transferências', '#/transf', ''], ['Compras', '#/compras', 'Receber']]]],
};
function buildMenu() {
  const m = ME.role === 'superadmin' ? (actingCid() ? MENUS.admin : MENUS.superadmin) : (MENUS[ME.role] || MENUS.admin);
  $('#menu').innerHTML = m.map(([g, its]) => `<div class="grp">${g}</div>` + its.map(([n, h, t]) => `<a href="${h}" data-r="${h}" title="${t || n}">${n}</a>`).join('')).join('');
}
window.addEventListener('hashchange', route);
async function route() {
  const h = location.hash || '#/dashboard';
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('active', a.dataset.r === h));
  $('#sidebar').classList.remove('open'); $('#overlay').classList.add('hidden');
  const C = $('#content');
  try {
    if (h === '#/dashboard') return viewDash(C);
    if (h === '#/produtos') return viewProdutos(C);
    if (h === '#/estoque') return viewEstoque(C);
    if (h === '#/compras') return viewCompras(C);
    if (h === '#/pdv') return viewPDV(C);
    if (h === '#/vendas') return viewVendas(C);
    if (h === '#/clientes') return viewClientes(C);
    if (h === '#/fornecedores') return viewFornecedores(C);
    if (h === '#/fichas') return viewFichas(C);
    if (h === '#/lotes') return viewLotes(C);
    if (h === '#/transf') return viewTransf(C);
    if (h === '#/financeiro') return viewFinanceiro(C);
    if (h === '#/relatorios') return viewRelatorios(C);
    if (h === '#/segmento') return viewSegmento(C);
    if (h === '#/usuarios') return viewUsuarios(C);
    if (h === '#/empresa') return viewEmpresa(C);
    if (h === '#/auditoria') return viewAuditoria(C);
    if (h === '#/alertas') return viewAlertas(C);
    if (h === '#/saas') return viewSaaS(C);
    C.innerHTML = '<p>Página não encontrada.</p>';
  } catch (e) { C.innerHTML = `<div class="card"><b>Não foi possível carregar.</b><p class="muted">${e.message}</p></div>`; }
}
function setTitle(t, sub) { $('#page-title').textContent = t; $('#crumbs').textContent = sub || ''; }

// ---------- DASHBOARD ----------
async function viewDash(C) {
  setTitle('Dashboard', 'Visão geral da sua empresa (dados isolados)');
  if (ME.role === 'superadmin' && !actingCid()) { location.hash = '#/saas'; return; }
  const d = await api.get('/api/dashboard');
  const max = Math.max(1, ...d.ticket.map(t => t.t));
  C.innerHTML = `
  <div class="grid g4">
    <div class="card"><h3 title="Vendas de hoje">Vendas hoje</h3><div class="big">${d.vendasHoje.n}</div><small class="muted">${BRL(d.vendasHoje.t)}</small></div>
    ${ME.role !== 'vendedor' ? `<div class="card"><h3 title="Receita total menos custos">Lucro total</h3><div class="big">${BRL(d.lucro)}</div><small class="muted">Margem ${d.margem}%</small></div>` : ''}
    <div class="card"><h3 title="Receita acumulada">Faturamento</h3><div class="big">${BRL(d.receita)}</div></div>
    <div class="card"><h3 title="Produtos abaixo do mínimo">⚠️ Estoque baixo</h3><div class="big">${d.estoqueBaixo.length}</div><small class="muted">${d.estoqueBaixo.slice(0, 2).map(p => p.nome).join(', ')}</small></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Vendas últimos 7 dias</h3>${d.ticket.map(t => `<div style="display:flex;gap:8px;align-items:center;margin:6px 0"><small style="width:70px">${t.d.slice(5)}</small><div class="bar" style="flex:1" title="${BRL(t.t)} em ${t.d}"><i style="width:${Math.round(t.t / max * 100)}%"></i></div><small>${BRL(t.t)}</small></div>`).join('') || '<p class="muted">Sem vendas ainda.</p>'}</div>
    <div class="card"><h3>Mais vendidos</h3>${d.topVendidos.map(p => `<p>📦 <b>${p.nome}</b> — ${p.q} un · ${BRL(p.t)}</p>`).join('') || '<p class="muted">Nenhum produto vendido.</p>'}<h3 style="margin-top:12px">Estoque crítico</h3>${d.estoqueBaixo.map(p => `<p>🟡 ${p.nome} (${p.estoque_atual}/${p.estoque_min})</p>`).join('') || '<p class="muted">Tudo abastecido ✔</p>'}</div>
  </div>`;
}

// ---------- PRODUTOS ----------
async function viewProdutos(C) {
  setTitle('Produtos', 'Cadastro, custo, preço e margem');
  const cats = await api.get('/api/categories');
  const j = await api.get('/api/products?limit=100');
  const canCost = ME.role !== 'vendedor';
  C.innerHTML = `
  <div class="toolbar">
    <input id="q" placeholder="🔎 Buscar produto..." title="Busca por nome, código de barras ou SKU">
    <select id="f-cat" title="Filtrar por categoria"><option value="">Todas categorias</option>${cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select>
    <button class="btn sm ghost" id="btn-exp" title="Exportar lista em CSV">📊 CSV</button>
    ${(ME.role === 'admin' || ME.role === 'gerente') ? '<button class="btn sm ghost" id="btn-aux" title="Criar categorias e unidades">⚙ Cadastros</button><button class="btn sm primary" id="btn-new" title="Cadastrar novo produto">+ Novo produto</button>' : ''}
  </div>
  <div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Produto</th><th>Estoque</th>${canCost ? '<th>Custo</th><th>Preço</th><th>Margem</th>' : '<th>Preço</th>'}<th></th></tr></thead><tbody id="tb"></tbody></table></div>
  <p class="muted" id="empty"></p>`;
  let data = j.data;
  function draw() {
    const q = ($('#q').value || '').toLowerCase(), fc = $('#f-cat').value;
    const rows = data.filter(p => (!q || p.nome.toLowerCase().includes(q)) && (!fc || String(p.categoria_id) === fc));
    $('#tb').innerHTML = rows.map(p => `<tr>
      <td><b>${p.nome}</b><br><small class="muted">${p.categoria || ''} · ${p.sku || ''} ${p.estoque_atual <= p.estoque_min ? '<span class="tag t-warn" title="Abaixo do mínimo — sugestão de compra">baixo</span>' : ''}</small></td>
      <td>${p.estoque_atual}</td>
      ${canCost ? `<td>${BRL(p.custo_medio)}</td><td>${BRL(p.preco_venda)}</td><td>${p.margem}%</td>` : `<td>${BRL(p.preco_venda)}</td>`}
      <td><button class="btn sm ghost" data-v="${p.id}" title="Visualizar detalhes e Kardex">👁️</button>
      ${(ME.role === 'admin' || ME.role === 'gerente') ? `<button class="btn sm ghost" data-e="${p.id}" title="Editar produto">✏️</button>` : ''}</td></tr>`).join('');
    $('#empty').textContent = rows.length ? '' : 'Nenhum produto encontrado.';
    document.querySelectorAll('[data-v]').forEach(b => b.onclick = () => verProduto(b.dataset.v));
    document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => formProduto(b.dataset.e));
  }
  $('#q').oninput = draw; $('#f-cat').onchange = draw;
  $('#btn-exp').onclick = () => csv('produtos.csv', data);
  const nb = $('#btn-new'); if (nb) nb.onclick = () => formProduto(null);
  const ab = $('#btn-aux');
  if (ab) ab.onclick = async () => {
    const cats = await api.get('/api/categories'); const units = await api.get('/api/units');
    modal(`<h3>⚙ Cadastros auxiliares</h3>
    <div class="row"><div><h3>Categorias</h3>${cats.map(c => `<small>• ${c.nome}</small><br>`).join('')}<div class="row"><input id="nc-n" placeholder="Nova categoria"><button class="btn sm ok" id="nc-ok">+</button></div></div>
    <div><h3>Unidades</h3>${units.map(u => `<small>• ${u.sigla} (${u.nome})</small><br>`).join('')}<div class="row"><input id="nu-s" placeholder="Sigla" style="max-width:80px"><button class="btn sm ok" id="nu-ok">+</button></div></div></div>
    <br><button class="btn ghost" onclick="closeModal();route();">Concluir</button>`);
    $('#nc-ok').onclick = async () => { try { await api.post('/api/categories', { nome: $('#nc-n').value }); toast('✓ Categoria criada!'); $('#nc-n').value = ''; } catch (e) { toast(e.message); } };
    $('#nu-ok').onclick = async () => { try { await api.post('/api/units', { sigla: $('#nu-s').value }); toast('✓ Unidade criada!'); $('#nu-s').value = ''; } catch (e) { toast(e.message); } };
  };
  draw();
}
async function verProduto(id) {
  const p = await api.get('/api/products/' + id);
  modal(`<h3>👁️ ${p.nome}</h3><p class="muted">${p.categoria || ''} · Estoque ${p.estoque_atual} (mín ${p.estoque_min}) · Local: ${p.localizacao || '-'}</p>
  ${ME.role !== 'vendedor' ? `<p>Custo ${BRL(p.custo_medio)} · Preço ${BRL(p.preco_venda)} · Margem ${p.margem}% · Markup ${p.markup}% · Lucro ${BRL(p.lucro)}</p>` : `<p>Preço ${BRL(p.preco_venda)}</p>`}
  <h4>Kardex (últimas)</h4>${(p.kardex || []).slice(0, 10).map(k => `<small>${k.created_at} · ${k.tipo} · ${k.qtd} (${k.estoque_antes}→${k.estoque_depois})</small><br>`).join('') || '<small class="muted">Sem movimentações.</small>'}
  <br><button class="btn ghost" onclick="closeModal()">Fechar</button>`);
}
async function formProduto(id) {
  const cats = await api.get('/api/categories'); const units = await api.get('/api/units');
  let p = id ? await api.get('/api/products/' + id) : { nome: '', preco_venda: 0, custo_medio: 0, estoque_atual: 0, estoque_min: 0, ponto_reposicao: 0 };
  modal(`<h3>${id ? '✏️ Editar' : '＋ Novo'} produto</h3>
  <label>Nome*<input id="f-nome" value="${p.nome || ''}"></label>
  <div class="row"><label>Custo<input id="f-custo" type="number" step="0.01" value="${p.custo_medio || 0}" title="Custo médio. Atualizado nas compras."></label>
  <label>Preço<input id="f-preco" type="number" step="0.01" value="${p.preco_venda || 0}"></label></div>
  <div class="row"><label>Categoria<select id="f-cat2"><option value="">—</option>${cats.map(c => `<option value="${c.id}" ${p.categoria_id == c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}</select></label>
  <label>Unidade<select id="f-un">${units.map(u => `<option value="${u.id}" ${p.unidade_id == u.id ? 'selected' : ''}>${u.sigla}</option>`).join('')}</select></label></div>
  <div class="row"><label>Estoque atual<input id="f-est" type="number" step="0.01" value="${p.estoque_atual || 0}"></label><label>Estoque mín<input id="f-min" type="number" step="0.01" value="${p.estoque_min || 0}" title="Ponto que dispara alerta e sugestão de compra"></label></div>
  <div class="row"><label>Código barras<input id="f-cb" value="${p.codigo_barras || ''}"></label><label>Tipo<select id="f-tipo"><option ${p.tipo === 'revenda' ? 'selected' : ''}>revenda</option><option value="insumo" ${p.tipo === 'insumo' ? 'selected' : ''}>insumo</option><option value="acabado" ${p.tipo === 'acabado' ? 'selected' : ''}>acabado</option><option value="servico" ${p.tipo === 'servico' ? 'selected' : ''}>servico</option></select></label></div>
  <div class="row"><label>NCM<input id="f-ncm" value="${p.ncm || ''}" title="Nomenclatura fiscal"></label><label>CEST<input id="f-cest" value="${p.cest || ''}"></label><label>Alíquota %<input id="f-tax" type="number" step="0.01" value="${p.tax_rate || 0}"></label></div>
  <p><button class="btn sm ghost" id="btn-sug" title="Calcular preço pela margem desejada">💡 Sugerir preço por margem</button></p>
  <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="btn-save">Salvar</button></div>`);
  $('#btn-sug').onclick = async () => {
    const m = prompt('Margem desejada % (ex 40):', '40'); if (!m) return;
    const j = await api.post('/api/products/preco-sugerido', { custo: Number($('#f-custo').value), margem: Number(m) });
    $('#f-preco').value = j.preco; toast('Preço sugerido: ' + BRL(j.preco));
  };
  $('#btn-save').onclick = async () => {
    const body = { nome: $('#f-nome').value.trim(), custo_medio: Number($('#f-custo').value), preco_venda: Number($('#f-preco').value), categoria_id: $('#f-cat2').value || null, unidade_id: $('#f-un').value || null, estoque_atual: Number($('#f-est').value), estoque_min: Number($('#f-min').value), ponto_reposicao: Number($('#f-min').value), codigo_barras: $('#f-cb').value, tipo: $('#f-tipo').value, ncm: $('#f-ncm').value, cest: $('#f-cest').value, tax_rate: Number($('#f-tax').value) };
    if (!body.nome) return toast('Nome obrigatório');
    try { id ? await api.put('/api/products/' + id, body) : await api.post('/api/products', body); closeModal(); toast('✓ Produto salvo!'); route(); } catch (e) { toast(e.message); }
  };
}

// ---------- ESTOQUE ----------
async function viewEstoque(C) {
  setTitle('Movimentações', 'Entradas, saídas, ajustes, perdas e inventário');
  const inv = await api.get('/api/inventory');
  const movs = await api.get('/api/movements?limit=50');
  C.innerHTML = `
  <div class="toolbar"><button class="btn sm ok" id="m-in" title="Registrar entrada (compra, devolução, bonificação)">＋ Entrada</button>
  <button class="btn sm warn" id="m-out" title="Registrar saída, perda ou ajuste">− Saída / Perda</button>
  <button class="btn sm ghost" id="m-inv" title="Contagem física x sistema">📋 Inventário</button></div>
  <div class="grid g2"><div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Produto</th><th>Est.</th><th>Mín</th></tr></thead><tbody>${inv.map(p => `<tr><td>${p.nome}</td><td>${p.estoque_atual} ${p.estoque_atual <= p.estoque_min ? '🟡' : ''}</td><td>${p.estoque_min}</td></tr>`).join('')}</tbody></table></div>
  <div class="card"><h3>Últimas movimentações (Kardex)</h3>${movs.map(m => `<small>${m.created_at} · <b>${m.produto}</b> · ${m.tipo} ${m.qtd} <span class="muted">(${m.user_name || ''}) ${m.motivo || ''}</span></small><br>`).join('') || '<p class="muted">Sem movimentos.</p>'}</div></div>`;
  $('#m-in').onclick = () => movForm('entrada', inv);
  $('#m-out').onclick = () => movForm('saida', inv);
  $('#m-inv').onclick = () => {
    modal(`<h3>📋 Inventário</h3><label>Produto<select id="i-p">${inv.map(p => `<option value="${p.id}">${p.nome} (sistema: ${p.estoque_atual})</option>`).join('')}</select></label><label>Contagem física<input id="i-f" type="number" step="0.01"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="i-ok">Ajustar</button></div>`);
    $('#i-ok').onclick = async () => { try { const j = await api.post('/api/inventory/count', { product_id: $('#i-p').value, fisico: Number($('#i-f').value) }); closeModal(); toast('✓ Estoque atualizado. Divergência: ' + j.divergencia); route(); } catch (e) { toast(e.message); } };
  };
}
function movForm(tipo0, inv) {
  modal(`<h3>${tipo0 === 'entrada' ? '＋ Entrada' : '− Saída / Perda'}</h3>
  <label>Produto<select id="mv-p">${inv.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></label>
  <div class="row"><label>Tipo<select id="mv-t">${tipo0 === 'entrada' ? '<option>entrada</option><option>compra</option><option>bonificacao</option>' : '<option>saida</option><option>perda</option><option>ajuste</option>'}</select></label>
  <label>Qtd<input id="mv-q" type="number" step="0.01" value="1"></label></div>
  <label>Motivo${tipo0 !== 'entrada' ? ' (obrigatório p/ perda)' : ''}<input id="mv-m" placeholder="Ex: compra, quebra, vencimento"></label>
  <label>Custo unit (p/ entrada)<input id="mv-c" type="number" step="0.01" value="0"></label>
  <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="mv-ok">Confirmar</button></div>`);
  $('#mv-ok').onclick = async () => {
    try { await api.post('/api/inventory/movement', { product_id: $('#mv-p').value, tipo: $('#mv-t').value, qtd: Number($('#mv-q').value), motivo: $('#mv-m').value, custo_unit: Number($('#mv-c').value) }); closeModal(); toast('✓ Estoque atualizado.'); route(); }
    catch (e) { toast(e.message); }
  };
}

// ---------- COMPRAS ----------
async function viewTransf(C) {
  setTitle('Transferências', 'Entre filiais/lojas da empresa (com NF de transferência quando houver)');
  const branches = await api.get('/api/branches');
  const prods = (await api.get('/api/products?limit=100')).data;
  const trs = await api.get('/api/transfers');
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="t-new" title="Nova transferência">+ Transferir</button><button class="btn sm ghost" id="b-new" title="Cadastrar filial/loja (CNPJ)">+ Filial</button></div>
  <div class="grid g2"><div class="card"><h3>🏪 Filiais/lojas</h3>${branches.map(b => `<p><b>${b.nome}</b><br><small class="muted">${b.cnpj || 'sem CNPJ'} · ${b.active ? 'ativa' : 'inativa'}</small></p>`).join('') || '<p class="muted">Cadastre Matriz + filiais com CNPJ.</p>'}</div>
  <div class="card"><h3>🚚 Últimas transferências</h3>${trs.slice(0, 15).map(t => `<small>#${t.id} ${t.origem || '?'} → ${t.destino || '?'} · ${t.created_at || ''}</small><br>`).join('') || '<p class="muted">Nenhuma.</p>'}</div></div>`;
  $('#b-new').onclick = () => {
    modal(`<h3>Nova filial/loja</h3><label>Nome*<input id="x-n" placeholder="Ex: Matriz / Loja Centro"></label><label>CNPJ<input id="x-c" placeholder="00.000.000/0001-00"></label><label>Endereço<input id="x-e"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`);
    $('#x-ok').onclick = async () => { try { await api.post('/api/branches', { nome: $('#x-n').value, cnpj: $('#x-c').value, endereco: $('#x-e').value }); closeModal(); toast('✓ Filial salva!'); route(); } catch (e) { toast(e.message); } };
  };
  $('#t-new').onclick = () => {
    if (branches.length < 2) return toast('Cadastre ao menos 2 filiais.');
    let items = [];
    const opts = branches.map(b => `<option value="${b.id}">${b.nome}</option>`).join('');
    modal(`<h3>Nova transferência</h3><div class="row"><label>Origem<select id="tf">${opts}</select></label><label>Destino<select id="tt">${opts}</select></label></div>
    <div class="row"><select id="ti-p">${prods.map(p => `<option value="${p.id}">${p.nome} (est ${p.estoque_atual})</option>`).join('')}</select><input id="ti-q" type="number" value="1" style="max-width:90px"></div>
    <p><button class="btn sm ghost" id="ti-add">+ item</button> <span id="ti-l" class="muted"></span></p>
    <label>Obs / NF<input id="ti-n" placeholder="Nº NF de transferência (se houver)"></label>
    <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="ti-ok">Transferir</button></div>`);
    $('#ti-add').onclick = () => { items.push({ product_id: $('#ti-p').value, qtd: Number($('#ti-q').value) }); $('#ti-l').textContent = items.length + ' item(ns)'; };
    $('#ti-ok').onclick = async () => { try { await api.post('/api/transfers', { from_branch_id: $('#tf').value, to_branch_id: $('#tt').value, items, notes: $('#ti-n').value }); closeModal(); toast('✓ Transferência concluída!'); route(); } catch (e) { toast(e.message); } };
  };
}
async function viewCompras(C) {
  setTitle('Compras', 'Pedidos, recebimento por NF, solicitações e transferências');
  const sups = await api.get('/api/suppliers');
  const prods = (await api.get('/api/products?limit=100')).data;
  const purs = await api.get('/api/purchases');
  const sug = await api.get('/api/purchase-suggestions').catch(() => ({ data: [] }));
  C.innerHTML = `
  <div class="toolbar">
    <button class="btn sm primary" id="c-new" title="Criar pedido de compra">+ Novo pedido</button>
    <button class="btn sm ok" id="c-rec" title="Digitar o nº do pedido: puxa os itens para conferir e editar">📦 Receber pedido/NF</button>
    <button class="btn sm ghost" id="c-sug" title="Sugestões automáticas de compra (estoque baixo)">🛒 Solicitações (${sug.data.length})</button>
    <button class="btn sm ghost" id="c-tr" title="Transferir produtos entre filiais/lojas">🚚 Transferências</button>
  </div>
  <div class="table-wrap card-pad0"><table><thead><tr><th>#</th><th>Fornecedor</th><th>NF</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
  ${purs.map(p => `<tr><td>#${p.id}</td><td>${p.fornecedor || '-'}</td><td>${p.nf_number || '-'}</td><td>${BRL(p.total)}</td><td><span class="tag ${p.status === 'recebido' ? 't-ok' : p.status === 'parcial' ? 't-warn' : 't-info'}">${statusLabel(p.status)}</span></td><td>${p.status !== 'recebido' ? `<button class="btn sm ok" data-r="${p.id}" title="Conferir itens e dar entrada">Receber</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  const openReceive = async (presetId) => {
    const pid = presetId || prompt('Nº do pedido:');
    if (!pid) return;
    let pur;
    try { pur = await api.get('/api/purchases/' + pid); }
    catch { return toast('Pedido não encontrado.'); }
    if (pur.status === 'recebido') return toast('Pedido já totalmente recebido.');
    modal(`<h3>📦 Receber pedido #${pur.id} ${pur.fornecedor ? '· ' + pur.fornecedor : ''}</h3>
    <div class="row"><label>NF número<input id="rc-nf" value="${pur.nf_number || ''}" title="Número da Nota Fiscal"></label><label>Chave NF-e<input id="rc-key" value="${pur.nf_key || ''}" title="Chave de acesso de 44 dígitos"></label></div>
    <p class="muted">Confira e <b>edite as quantidades recebidas</b> (aceita parcial):</p>
    ${pur.itens.map(it => { const rest = Number(it.qtd) - Number(it.qtd_recebida); return `<div class="row" style="align-items:end"><span style="flex:2"><b>${it.produto}</b><br><small class="muted">pedido ${it.qtd} · recebido ${it.qtd_recebida} · restam ${rest}</small></span><input data-ri="${it.product_id}" type="number" step="0.01" value="${rest}" min="0" max="${rest}" style="max-width:110px" title="Quantidade recebida agora"></div>`; }).join('')}
    <br><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="rc-ok">Confirmar recebimento</button></div>`);
    $('#rc-ok').onclick = async () => {
      const items = [...document.querySelectorAll('[data-ri]')].map(el => ({ product_id: el.dataset.ri, qtd: Number(el.value) }));
      try {
        const j = await api.post(`/api/purchases/${pur.id}/receive`, { items, nf_number: $('#rc-nf').value, nf_key: $('#rc-key').value });
        closeModal(); toast(`🟢 Recebido ${BRL(j.recebido)} (${j.status})!`); route();
      } catch (e) { toast(e.message); }
    };
  };
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = () => openReceive(b.dataset.r));
  $('#c-rec').onclick = () => openReceive(null);
  $('#c-sug').onclick = async () => {
    const s2 = await api.get('/api/purchase-suggestions');
    if (!s2.data.length) return toast('Nenhuma solicitação: estoque OK.');
    modal(`<h3>🛒 Solicitações de compra</h3><p class="muted">Regra: ${s2.mode === 'reorder' ? 'ponto de reposição' : 'estoque mínimo'} (Empresa → Estoque).</p>
    ${s2.data.map((p, i) => `<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-sg="${i}" checked style="width:auto"><span style="flex:1"><b>${p.nome}</b><br><small class="muted">est ${p.estoque_atual} · mín ${p.minimo} · sugerido ${p.sugerido}</small></span><input data-sq="${i}" type="number" value="${p.sugerido}" style="max-width:100px"></label>`).join('')}
    <label>Fornecedor<select id="sg-s">${sups.map(x => `<option value="${x.id}">${x.fantasia || x.razao}</option>`).join('')}</select></label>
    <div class="row"><button class="btn ghost" onclick="closeModal()">Fechar</button><button class="btn ok" id="sg-ok">Criar pedido</button></div>`);
    window._sug = s2.data;
    $('#sg-ok').onclick = async () => {
      const items = [...document.querySelectorAll('[data-sg]:checked')].map(cb => {
        const p = window._sug[cb.dataset.sg];
        const q = Number(document.querySelector(`[data-sq="${cb.dataset.sg}"]`).value);
        return { product_id: p.product_id, qtd: q, custo_unit: p.custo_medio };
      }).filter(i => i.qtd > 0);
      if (!items.length) return toast('Selecione ao menos um item.');
      try { const j = await api.post('/api/purchases', { supplier_id: $('#sg-s').value, items }); closeModal(); toast(`Pedido #${j.id} criado!`); route(); } catch (e) { toast(e.message); }
    };
  };
  $('#c-tr').onclick = () => { location.hash = '#/transf'; route(); };
  $('#c-new').onclick = () => {
    let items = [];
    modal(`<h3>Novo pedido</h3><label>Fornecedor<select id="pc-s">${sups.map(s => `<option value="${s.id}">${s.fantasia || s.razao}</option>`).join('')}</select></label>
    <div class="row"><select id="pc-p">${prods.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select><input id="pc-q" type="number" value="10" style="max-width:90px" title="Quantidade"><input id="pc-c" type="number" step="0.01" placeholder="Custo" style="max-width:110px"></div>
    <p><button class="btn sm ghost" id="pc-add">+ item</button></p><div id="pc-list" class="muted">Nenhum item</div><br>
    <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="pc-ok">Salvar pedido</button></div>`);
    $('#pc-add').onclick = () => { items.push({ product_id: $('#pc-p').value, qtd: Number($('#pc-q').value), custo_unit: Number($('#pc-c').value) }); $('#pc-list').textContent = items.length + ' item(ns)'; };
    $('#pc-ok').onclick = async () => { try { await api.post('/api/purchases', { supplier_id: $('#pc-s').value, items }); closeModal(); toast('Pedido criado!'); route(); } catch (e) { toast(e.message); } };
  };
}

// ---------- PDV ----------
async function viewPDV(C) {
  setTitle('PDV', 'Venda rápida: caixa, multi-pagamento e PIX QR');
  const prods = (await api.get('/api/products?limit=100')).data.filter(p => p.status === 'ativo');
  const clis = await api.get('/api/customers');
  let abertos = [];
  try { abertos = (await api.get('/api/cash')).filter(c => c.status === 'aberto'); } catch {}
  let caixaSel = localStorage.getItem('caixa') || (abertos[0] && abertos[0].id) || '';
  let coPDV = {};
  try { coPDV = await api.get('/api/company'); } catch {}
  C.innerHTML = `
  <div class="grid g2 pdv-top">
  <div class="card pdv-brand" style="margin:0">${coPDV.logo ? `<img class="co-logo lg" src="${coPDV.logo}" alt="Logo">` : '<span class="logo">🧾</span>'}<div><h2>PDV ${coPDV.nome ? '· ' + coPDV.nome : ''}</h2><p class="muted">Frente de caixa rápida com baixa automática</p></div></div>
  <div class="card" style="margin:0"><div class="row">
    <label title="Caixa/terminal em uso. Ex: caixa 1">Caixa<select id="pdv-cx"><option value="">Sem caixa</option>${abertos.map(c => `<option value="${c.id}" ${String(c.id) === String(caixaSel) ? 'selected' : ''}>Caixa ${c.terminal} · ${c.operator_name || ''}</option>`).join('')}</select></label>
    <label title="Funcionário operador do caixa">Operador<input id="pdv-op" value="${ME.name}"></label>
  </div><button class="btn sm ghost" id="pdv-open" title="Abrir novo turno de caixa">🧾 Abrir caixa</button></div>
  </div>
  <div class="grid g2 pdv-fit"><div class="card"><input id="pdv-q" placeholder="🔎 Buscar produto..." title="Digite para filtrar"><div id="pdv-list" class="pdv-list-scroll"></div></div>
  <div class="card"><h3>🧾 Carrinho</h3><div class="pdv-cart-scroll"><div id="cart"></div><label>Cliente<select id="cart-cli"><option value="">Balcão</option>${clis.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></label>
  <label>Desconto<input id="cart-desc" type="number" value="0" min="0"></label>
  <h3>Pagamento (pode dividir)</h3><div id="pays"></div>
  <p><button class="btn sm ghost" id="pay-add" title="Adicionar outra forma (ex: parte dinheiro + parte crédito)">+ Forma de pagamento</button></p></div>
  <div class="pdv-foot"><h2 id="cart-total">Total: R$ 0,00</h2><p id="pay-rest" class="muted"></p>
  <label><input type="checkbox" id="cart-wait" style="width:auto"> Deixar aguardando pagamento</label>
  <button class="btn primary" id="cart-fin" title="Finalizar: baixa estoque, financeiro e auditoria">Finalizar venda</button></div></div></div>`;
  let cart = [];
  let pays = [{ method: 'dinheiro', amount: 0 }];
  const PM = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao_credito', 'Crédito'], ['cartao_debito', 'Débito'], ['fiado', 'Fiado']];
  const tot = () => Math.max(0, cart.reduce((s, i) => s + i.qtd * i.preco_unit, 0) - Number($('#cart-desc').value || 0));
  function drawPays() {
    $('#pays').innerHTML = pays.map((p, i) => `<div class="row" style="align-items:end"><label style="flex:2">Forma<select data-pm="${i}">${PM.map(([v, n]) => `<option value="${v}" ${p.method === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Valor<input data-pv="${i}" type="number" min="0" step="0.01" value="${p.amount}"></label>${pays.length > 1 ? `<button class="btn sm danger" data-px="${i}" title="Remover forma">×</button>` : ''}</div>`).join('');
    document.querySelectorAll('[data-pm]').forEach(s => s.onchange = () => { pays[s.dataset.pm].method = s.value; });
    document.querySelectorAll('[data-pv]').forEach(s => s.oninput = () => { pays[s.dataset.pv].amount = Number(s.value); drawRest(); });
    document.querySelectorAll('[data-px]').forEach(b => b.onclick = () => { pays.splice(b.dataset.px, 1); drawPays(); drawRest(); });
  }
  function drawRest() {
    const t = tot(), sum = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
    $('#cart-total').textContent = 'Total: ' + BRL(t);
    const rest = Number((t - sum).toFixed(2));
    $('#pay-rest').textContent = rest > 0 ? `Faltam ${BRL(rest)} — clique em Completar` : (rest < 0 ? `Ultrapassou ${BRL(-rest)}` : '✓ Pagamento confere');
    $('#pay-rest').innerHTML += rest > 0 ? ` <button class="btn sm ghost" id="pay-fill">Completar</button>` : '';
    const f = $('#pay-fill'); if (f) f.onclick = () => { pays[pays.length - 1].amount = Number((Number(pays[pays.length - 1].amount || 0) + rest).toFixed(2)); drawPays(); drawRest(); };
  }
  function drawList() {
    const q = ($('#pdv-q').value || '').toLowerCase();
    $('#pdv-list').innerHTML = prods.filter(p => p.nome.toLowerCase().includes(q)).slice(0, 50).map(p => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--line)"><span><b>${p.nome}</b><br><small class="muted">${BRL(p.preco_venda)} · est ${p.estoque_atual}</small></span><button class="btn sm primary" data-a="${p.id}" title="Adicionar ao carrinho">+</button></div>`).join('');
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const p = prods.find(x => x.id == b.dataset.a); cart.push({ product_id: p.id, nome: p.nome, qtd: 1, preco_unit: p.preco_venda }); drawCart(); });
  }
  function drawCart() {
    $('#cart').innerHTML = cart.map((i, idx) => `<div style="display:flex;gap:6px;align-items:center;margin:4px 0"><span style="flex:1">${i.nome} x${i.qtd}</span><button class="btn sm ghost" data-d="${idx}">−</button></div>`).join('') || '<p class="muted">Carrinho vazio.</p>';
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { cart.splice(b.dataset.d, 1); drawCart(); });
    if (pays.length === 1 && !pays[0].amount) pays[0].amount = tot();
    drawPays(); drawRest();
  }
  $('#pdv-q').oninput = drawList; $('#cart-desc').oninput = drawCart;
  $('#pay-add').onclick = () => { pays.push({ method: 'cartao_credito', amount: 0 }); drawPays(); };
  $('#pdv-cx').onchange = e => { caixaSel = e.target.value; localStorage.setItem('caixa', caixaSel); };
  $('#pdv-open').onclick = () => {
    modal(`<h3>🧾 Abrir caixa</h3><div class="row"><label>Caixa/terminal<input id="o-t" value="1" title="Ex: 1 ou 2"></label><label>Funcionário<input id="o-o" value="${ME.name}" title="Ex: Bianca"></label></div><label>Saldo inicial<input id="o-s" type="number" value="0"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="o-ok">Abrir</button></div>`);
    $('#o-ok').onclick = async () => { try { const j = await api.post('/api/cash/open', { terminal: $('#o-t').value, operator_name: $('#o-o').value, saldo_inicial: Number($('#o-s').value) }); closeModal(); localStorage.setItem('caixa', j.id); toast('✓ Caixa aberto!'); route(); } catch (e) { toast(e.message); } };
  };
  drawList(); drawCart();
  $('#cart-fin').onclick = async () => {
    try {
      const j = await api.post('/api/sales', { customer_id: $('#cart-cli').value || null, items: cart, desconto: Number($('#cart-desc').value), payments: (tot() === 0 ? [] : pays), caixa_id: caixaSel || null, operator_name: $('#pdv-op').value, awaiting: $('#cart-wait').checked });
      const det = await api.get('/api/sales/' + j.id);
      const co = await api.get('/api/company').catch(() => ({}));
      const hasPix = pays.some(p => p.method === 'pix');
      modal(`<h3>✓ Venda #${j.id} — ${BRL(j.total)}</h3><p class="muted">Status: ${statusLabel(j.status)}</p>
      <div class="row"><button class="btn ghost" id="m-cup" title="Imprimir cupom (impressora padrão)">🧾 Cupom</button>${hasPix ? '<button class="btn primary" id="m-qr" title="Exibir QR Code PIX da venda">PIX QR</button>' : ''}<button class="btn ghost" onclick="closeModal()">Fechar</button></div><div id="m-qrbox" style="text-align:center;margin-top:10px"></div>`);
      $('#m-cup').onclick = () => printHtml('Cupom #' + j.id, receiptHtml(det, co));
      const qr = $('#m-qr');
      if (qr) qr.onclick = async () => { try { const px = await api.post(`/api/sales/${j.id}/pix`); $('#m-qrbox').innerHTML = `<img src="${px.qr}" style="max-width:220px"><p class="muted">Escaneie para pagar ${BRL(det.total)}</p><small class="break">${px.brcode}</small>`; } catch (e) { toast(e.message); } };
      cart = []; pays = [{ method: 'dinheiro', amount: 0 }]; drawCart();
    } catch (e) { toast(e.message); }
  };
}
async function viewVendas(C) {
  setTitle('Vendas', 'Código, cliente, produtos, pagamento e status');
  const s = await api.get('/api/sales');
  const can = ME.role === 'admin' || ME.role === 'gerente' || ME.role === 'superadmin';
  C.innerHTML = `<div class="toolbar"><button class="btn sm ghost" id="v-csv" title="Exportar CSV">📊 CSV</button><button class="btn sm ghost" id="v-xls" title="Exportar Excel">📗 Excel</button></div>
  <div class="table-wrap card-pad0"><table><thead><tr><th>Cód</th><th>Cliente</th><th>Produtos</th><th>Total</th><th>Desc.</th><th>Pagamento</th><th>Status</th><th></th></tr></thead><tbody>${s.map(v => `<tr>
  <td><b>#${v.id}</b><br><small class="muted">${(v.created_at || '').slice(0, 10)}</small></td>
  <td>${v.cliente || 'Balcão'}</td>
  <td><small>${(v.itens || []).map(i => `${i.qtd}x ${i.nome}`).join('<br>')}</small></td>
  <td>${BRL(v.total)}</td><td>${BRL(v.desconto)}</td>
  <td><small>${(v.payments || []).map(p => `${payLabel(p.method)} ${BRL(p.amount)}`).join('<br>') || payLabel(v.pagamento)}</small></td>
  <td><span class="tag ${v.status === 'finalizada' ? 't-ok' : v.status === 'cancelada' ? 't-bad' : 't-warn'}">${statusLabel(v.status)}</span></td>
  <td class="nowrap"><button class="btn sm ghost" data-v="${v.id}" title="Ver cupom / imprimir">🧾</button>
  ${v.status === 'aguardando_pagamento' && can ? `<button class="btn sm ok" data-ok="${v.id}" title="Confirmar recebimento e concluir">✓ Receber</button>` : ''}
  ${v.status !== 'cancelada' && can ? `<button class="btn sm danger" data-c="${v.id}" title="Cancelar e devolver ao estoque">Cancelar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#v-csv').onclick = () => csv('vendas.csv', s.map(v => ({ codigo: v.id, data: v.created_at, cliente: v.cliente, total: v.total, desconto: v.desconto, pagamento: (v.payments || []).map(p => payLabel(p.method) + ' ' + p.amount).join(' + '), status: v.status })));
  $('#v-xls').onclick = () => xls('vendas', s.map(v => ({ codigo: v.id, data: v.created_at, cliente: v.cliente, total: v.total, desconto: v.desconto, pagamento: (v.payments || []).map(p => payLabel(p.method) + ' ' + p.amount).join(' + '), status: statusLabel(v.status) })));
  document.querySelectorAll('[data-v]').forEach(b => b.onclick = async () => {
    const det = await api.get('/api/sales/' + b.dataset.v);
    const co = await api.get('/api/company').catch(() => ({}));
    modal(`<h3>Cupom #${det.id}</h3><div style="border:1px solid var(--line);border-radius:10px;padding:10px">${receiptHtml(det, co)}</div><br><div class="row"><button class="btn ghost" onclick="closeModal()">Fechar</button><button class="btn primary" id="v-print" title="Imprimir cupom">🖨️ Imprimir</button></div>`);
    $('#v-print').onclick = () => printHtml('Cupom #' + det.id, receiptHtml(det, co));
  });
  document.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => confirmDlg('Confirmar recebimento e concluir a venda?', async () => { try { await api.post(`/api/sales/${b.dataset.ok}/receber`); toast('✓ Venda concluída!'); route(); } catch (e) { toast(e.message); } }));
  document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => confirmDlg('Cancelar esta venda e devolver itens ao estoque?', async () => { try { await api.post(`/api/sales/${b.dataset.c}/cancel`); toast('Venda cancelada.'); route(); } catch (e) { toast(e.message); } }));
}

// ---------- CADASTROS SIMPLES ----------
async function viewClientes(C) {
  setTitle('Clientes', 'Cadastro e fiado');
  const r = await api.get('/api/customers');
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Novo cliente">+ Novo</button></div><div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Nome</th><th>Tel</th><th>Limite fiado</th></tr></thead><tbody>${r.map(c => `<tr><td>${c.nome}</td><td>${c.tel || ''}</td><td>${BRL(c.limite_fiado)}</td></tr>`).join('')}</tbody></table></div>`;
  $('#n').onclick = () => { modal(`<h3>Novo cliente</h3><label>Nome*<input id="x-n"></label><label>Telefone<input id="x-t"></label><label>Limite fiado<input id="x-l" type="number" value="0"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/customers', { nome: $('#x-n').value, tel: $('#x-t').value, limite_fiado: Number($('#x-l').value) }); closeModal(); toast('✓ Cliente salvo!'); route(); }; };
}
async function viewFornecedores(C) {
  setTitle('Fornecedores', 'Cadastro e condições');
  const r = await api.get('/api/suppliers');
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Novo fornecedor">+ Novo</button></div><div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Nome</th><th>Tel</th><th>Doc</th></tr></thead><tbody>${r.map(c => `<tr><td>${c.fantasia || c.razao}</td><td>${c.tel || ''}</td><td>${c.doc || ''}</td></tr>`).join('')}</tbody></table></div>`;
  $('#n').onclick = () => { modal(`<h3>Novo fornecedor</h3><label>Nome fantasia<input id="x-n"></label><label>Telefone<input id="x-t"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/suppliers', { fantasia: $('#x-n').value, tel: $('#x-t').value }); closeModal(); toast('✓ Salvo!'); route(); }; };
}
async function viewFichas(C) {
  setTitle('Ficha técnica', 'Receita → consumo automático dos insumos');
  const recs = await api.get('/api/recipes');
  const prods = (await api.get('/api/products?limit=100')).data;
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Nova ficha técnica">+ Nova ficha</button></div>${recs.map(r => `<div class="card"><b>${r.nome}</b> <span class="muted">→ ${r.produto} · custo ${BRL(r.custo)}</span><br><small>${r.itens.map(i => `${i.insumo} ${i.qtd}`).join(' · ')}</small></div>`).join('') || '<p class="muted">Ex: Marmita Executiva → arroz 200g + feijão 150g + carne 120g.</p>'}`;
  $('#n').onclick = () => {
    let itens = [];
    modal(`<h3>Nova ficha</h3><label>Produto acabado<select id="fx-p">${prods.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></label><label>Nome da receita<input id="fx-n" value="Receita padrão"></label><div class="row"><select id="fx-i">${prods.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select><input id="fx-q" type="number" step="0.01" value="1" style="max-width:90px"></div><p><button class="btn sm ghost" id="fx-add">+ insumo</button> <span id="fx-l" class="muted"></span></p><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="fx-ok">Salvar</button></div>`);
    $('#fx-add').onclick = () => { itens.push({ insumo_id: $('#fx-i').value, qtd: Number($('#fx-q').value) }); $('#fx-l').textContent = itens.length + ' insumos'; };
    $('#fx-ok').onclick = async () => { await api.post('/api/recipes', { produto_acabado_id: $('#fx-p').value, nome: $('#fx-n').value, itens }); closeModal(); toast('✓ Ficha salva! Custo recalculado.'); route(); };
  };
}
async function viewLotes(C) {
  setTitle('Lotes e validade', 'PVPS: primeiro que vence, primeiro que sai');
  const lots = await api.get('/api/lots');
  const prods = (await api.get('/api/products?limit=100')).data;
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Novo lote">+ Novo lote</button></div><div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Qtd</th></tr></thead><tbody>${lots.map(l => `<tr><td>${l.produto}</td><td>${l.lote || '-'}</td><td>${l.validade || '-'}</td><td>${l.qtd}</td></tr>`).join('')}</tbody></table></div>`;
  $('#n').onclick = () => { modal(`<h3>Novo lote</h3><label>Produto<select id="x-p">${prods.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></label><div class="row"><label>Lote<input id="x-l"></label><label>Validade<input id="x-v" type="date"></label></div><label>Qtd<input id="x-q" type="number" value="1"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/lots', { product_id: $('#x-p').value, lote: $('#x-l').value, validade: $('#x-v').value, qtd: Number($('#x-q').value) }); closeModal(); toast('✓ Lote salvo!'); route(); }; };
}

// ---------- FINANCEIRO / RELATÓRIOS / OUTROS ----------
async function viewFinanceiro(C) {
  setTitle('Financeiro', 'Contas, fluxo de caixa e DRE');
  const s = await api.get('/api/finance/summary');
  const dre = (ME.role === 'admin' || ME.role === 'gerente') ? await api.get('/api/finance/dre') : null;
  const pg = await api.get('/api/finance/pagar'); const rc = await api.get('/api/finance/receber');
  const cx = await api.get('/api/cash').catch(() => []);
  C.innerHTML = `<div class="grid g4"><div class="card"><h3>A pagar</h3><div class="big">${BRL(s.aPagar)}</div></div><div class="card"><h3>A receber</h3><div class="big">${BRL(s.aReceber)}</div></div><div class="card"><h3>Vendas hoje</h3><div class="big">${BRL(s.vendasHoje)}</div></div><div class="card"><h3>Saldo previsto</h3><div class="big">${BRL(s.saldoPrevisto)}</div></div></div>
  ${dre ? `<div class="card" style="margin-top:12px"><b>DRE:</b> Receita ${BRL(dre.receita)} − Custos ${BRL(dre.custos)} − Despesas ${BRL(dre.despesas)} = <b>Lucro ${BRL(dre.lucro)}</b> (${dre.margem}%) <button class="btn sm ghost" id="dre-print" title="Imprimir DRE / salvar PDF">🖨️</button></div>` : ''}
  <div class="card" style="margin-top:12px"><h3>🧾 Caixas (turnos)</h3><div class="toolbar"><button class="btn sm primary" id="cx-open" title="Abrir turno: terminal + funcionário + saldo inicial">+ Abrir caixa</button></div>
  ${cx.map(c => `<small><b>Caixa ${c.terminal || '-'}</b> · ${c.operator_name || ''} · inicial ${BRL(c.saldo_inicial)} · vendido ${BRL(c.total_vendido)} · <span class="tag ${c.status === 'aberto' ? 't-ok' : 't-info'}">${statusLabel(c.status)}</span> ${c.status === 'aberto' ? `<button class="btn sm warn" data-cx="${c.id}" title="Fechar turno informando saldo final">Fechar</button>` : `<span class="muted">final ${BRL(c.saldo_final)}</span>`}</small><br>`).join('') || '<p class="muted">Nenhum caixa.</p>'}</div>
  <div class="grid g2" style="margin-top:12px"><div class="card"><h3>Contas a pagar</h3><div class="toolbar"><button class="btn sm ghost" data-exp="pg-csv" title="Exportar CSV">CSV</button><button class="btn sm ghost" data-exp="pg-xls" title="Exportar Excel">Excel</button></div>${pg.slice(0, 8).map(p => `<small>${p.descricao} · ${BRL(p.valor)} · ${statusLabel(p.status)} ${p.status === 'aberto' ? `<button class="btn sm ok" data-p="${p.id}">Baixar</button>` : ''}</small><br>`).join('')}</div>
  <div class="card"><h3>Contas a receber</h3><div class="toolbar"><button class="btn sm ghost" data-exp="rc-csv" title="Exportar CSV">CSV</button><button class="btn sm ghost" data-exp="rc-xls" title="Exportar Excel">Excel</button></div>${rc.slice(0, 8).map(p => `<small>${p.descricao} · ${BRL(p.valor)} · ${statusLabel(p.status)} ${p.status === 'aberto' ? `<button class="btn sm ok" data-r="${p.id}">Baixar</button>` : ''}</small><br>`).join('')}</div></div>`;
  document.querySelectorAll('[data-p]').forEach(b => b.onclick = async () => { try { await api.post(`/api/finance/pagar/${b.dataset.p}/baixar`); toast('Conta paga!'); route(); } catch (e) { toast(e.message); } });
  document.querySelectorAll('[data-r]').forEach(b => b.onclick = async () => { try { await api.post(`/api/finance/receber/${b.dataset.r}/baixar`); toast('Conta recebida!'); route(); } catch (e) { toast(e.message); } });
  document.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => {
    const isPg = b.dataset.exp.startsWith('pg');
    const rows = (isPg ? pg : rc).map(x => ({ descricao: x.descricao, valor: x.valor, vencimento: x.vencimento, status: x.status }));
    if (b.dataset.exp.endsWith('csv')) csv('contas.csv', rows); else xls('contas', rows);
  });
  const dp = $('#dre-print'); if (dp) dp.onclick = () => printHtml('DRE', `<div class="c"><h2>DRE Simplificado</h2></div><hr>Receita: ${BRL(dre.receita)}<br>Custos: ${BRL(dre.custos)}<br>Despesas: ${BRL(dre.despesas)}<br><b>Lucro: ${BRL(dre.lucro)} (${dre.margem}%)</b>`);
  document.querySelectorAll('[data-cx]').forEach(b => b.onclick = () => {
    modal(`<h3>Fechar caixa</h3><label>Saldo final contado<input id="cx-f" type="number" step="0.01"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="cx-ok">Fechar</button></div>`);
    $('#cx-ok').onclick = async () => { try { const j = await api.post(`/api/cash/${b.dataset.cx}/close`, { saldo_final: Number($('#cx-f').value) }); closeModal(); toast(`✓ Fechado! Vendido ${BRL(j.vendido)}`); route(); } catch (e) { toast(e.message); } };
  });
  $('#cx-open').onclick = () => {
    modal(`<h3>Abrir caixa</h3><div class="row"><label>Caixa/terminal<input id="o-t" value="1"></label><label>Funcionário<input id="o-o" value="${ME.name}"></label></div><label>Saldo inicial<input id="o-s" type="number" value="0"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="o-ok">Abrir</button></div>`);
    $('#o-ok').onclick = async () => { try { await api.post('/api/cash/open', { terminal: $('#o-t').value, operator_name: $('#o-o').value, saldo_inicial: Number($('#o-s').value) }); closeModal(); toast('✓ Caixa aberto!'); route(); } catch (e) { toast(e.message); } };
  };
}
async function viewRelatorios(C) {
  setTitle('Relatórios', 'Filtráveis e exportáveis em CSV, Excel e PDF');
  const co = await api.get('/api/company').catch(() => ({}));
  const TNAMES = { estoque: 'Posição de estoque', vendas: 'Vendas', margens: 'Margens e lucros', perdas: 'Perdas', 'curva-abc': 'Curva ABC' };
  C.innerHTML = `<div class="toolbar"><select id="r-t"><option value="estoque">Posição de estoque</option><option value="vendas">Vendas</option><option value="margens">Margens e lucros</option><option value="perdas">Perdas</option><option value="curva-abc">Curva ABC</option></select><button class="btn sm primary" id="r-go" title="Gerar relatório">Gerar</button><button class="btn sm ghost" id="r-csv" title="Exportar CSV">📊 CSV</button><button class="btn sm ghost" id="r-xls" title="Exportar Excel">📗 Excel</button><button class="btn sm ghost" id="r-pdf" title="Imprimir / salvar PDF formatado">🖨️ PDF</button></div><div id="r-out"></div>`;
  let last = [], lastTipo = 'estoque';
  $('#r-go').onclick = async () => {
    lastTipo = $('#r-t').value; last = await api.get('/api/reports/' + lastTipo);
    $('#r-out').innerHTML = `<div class="table-wrap card-pad0"><table><tbody>${last.slice(0, 100).map(r => `<tr>${Object.values(r).slice(0, 5).map(v => `<td>${v ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="muted">${last.length} registros · ${TNAMES[lastTipo]} · ${co.nome || ''}</p>`;
  };
  $('#r-csv').onclick = () => csv('relatorio.csv', last);
  $('#r-xls').onclick = () => xls('relatorio', last);
  $('#r-pdf').onclick = () => {
    if (!last.length) return toast('Gere o relatório primeiro.');
    const ks = Object.keys(last[0]).slice(0, 5);
    printHtml(TNAMES[lastTipo], `<div class="c"><h2>${co.nome || ''}</h2><small>${TNAMES[lastTipo]} · ${new Date().toLocaleString('pt-BR')} · ${last.length} registros</small></div><hr><table><thead><tr>${ks.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody>${last.map(r => `<tr>${ks.map(k => `<td>${r[k] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
  };
}
async function viewSegmento(C) {
  const seg = ME.company_segmento || 'mercado';
  setTitle('Segmento: ' + seg, 'Recursos específicos do seu ramo');
  if (seg === 'salao') {
    const profs = await api.get('/api/segments/professionals'); const servs = await api.get('/api/segments/services'); const ages = await api.get('/api/segments/appointments');
    C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="s-ag" title="Novo agendamento">+ Agendar</button></div><div class="grid g2"><div class="card"><h3>Serviços</h3>${servs.map(s => `<p>${s.nome} · ${BRL(s.preco)}</p>`).join('')}<button class="btn sm ghost" id="s-sv">+ Serviço</button></div><div class="card"><h3>Agenda</h3>${ages.slice(0, 10).map(a => `<small>${a.datahora} · ${a.servico} · ${a.profissional}</small><br>`).join('') || '<p class="muted">Sem agendamentos.</p>'}<br><button class="btn sm ghost" id="s-pf">+ Profissional</button></div></div>`;
    $('#s-sv').onclick = () => { modal(`<h3>Novo serviço</h3><label>Nome<input id="x-n"></label><label>Preço<input id="x-p" type="number" value="50"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/segments/services', { nome: $('#x-n').value, preco: Number($('#x-p').value) }); closeModal(); route(); }; };
    $('#s-pf').onclick = () => { modal(`<h3>Novo profissional</h3><label>Nome<input id="x-n"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/segments/professionals', { nome: $('#x-n').value }); closeModal(); route(); }; };
    $('#s-ag').onclick = () => { modal(`<h3>Agendar</h3><label>Profissional<select id="x-pf">${profs.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></label><label>Serviço<select id="x-sv">${servs.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}</select></label><label>Data/hora<input id="x-d" type="datetime-local"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Agendar</button></div>`); $('#x-ok').onclick = async () => { await api.post('/api/segments/appointments', { professional_id: $('#x-pf').value, service_id: $('#x-sv').value, datahora: $('#x-d').value }); closeModal(); toast('✓ Agendado!'); route(); }; };
  } else if (seg === 'marmitaria') {
    C.innerHTML = `<div class="card"><h3>🍱 Marmitaria</h3><p>Use <b>Ficha técnica</b> para cadastrar a receita da marmita (arroz 200g + feijão 150g + carne 120g + embalagem). Ao vender 1 marmita, os insumos baixam sozinhos e o custo é recalculado.</p><a href="#/fichas" class="btn sm primary">Abrir fichas técnicas</a></div>`;
  } else if (seg === 'peixaria') {
    C.innerHTML = `<div class="card"><h3>🐟 Peixaria</h3><p>Venda por <b>kg</b> no PDV (quantidade fracionada, ex 1.5). Cadastre rendimento em <b>Ficha técnica</b>: 10kg peixe inteiro → 6,5kg filé (65%). Controle validade e temperatura em <b>Lotes</b>.</p><a href="#/pdv" class="btn sm primary">Abrir PDV por peso</a></div>`;
  } else {
    const abc = await api.get('/api/reports/curva-abc').catch(() => []);
    C.innerHTML = `<div class="card"><h3>🏪 Mercado / Loja</h3><p>Curva ABC, código de barras e promoções.</p>${abc.map(r => `<small><span class="tag ${r.classe === 'A' ? 't-ok' : r.classe === 'B' ? 't-warn' : 't-info'}">${r.classe}</span> ${r.nome} · ${BRL(r.t)}</small><br>`).join('') || '<p class="muted">Sem vendas para ABC.</p>'}</div>`;
  }
}
async function viewUsuarios(C) {
  const isSaaS = ME.role === 'superadmin';
  setTitle('Usuários', isSaaS ? 'Todos os usuários de todas as empresas' : 'Equipe da SUA empresa (isolada das outras)');
  const u = await api.get('/api/users');
  let coMap = {};
  if (isSaaS) { try { (await api.get('/api/saas/companies')).forEach(c => coMap[c.id] = c.nome); } catch {} }
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Convidar usuário${isSaaS ? ' (escolha a empresa)' : ' para esta empresa'}">+ Novo usuário</button></div>
  <div class="table-wrap card-pad0"><table><thead><tr>${isSaaS ? '<th>Empresa</th>' : ''}<th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th><th></th></tr></thead><tbody>${u.map(x => `<tr>${isSaaS ? `<td>${coMap[x.company_id] || '—'}(#${x.company_id ?? '–'})</td>` : ''}<td>${x.name}</td><td class="break">${x.email}</td><td><span class="tag t-info">${x.role}</span></td><td>${x.active ? 'sim' : 'não'}</td><td class="nowrap"><button class="btn sm ghost" data-pw="${x.id}" title="Redefinir senha deste usuário">🔑</button> <button class="btn sm ghost" data-tg="${x.id}" title="Ativar/desativar acesso">⏸</button></td></tr>`).join('')}</tbody></table></div><p class="muted">Perfis: admin (tudo), gerente, vendedor (sem custo), estoquista.</p>`;
  document.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => {
    const usr = u.find(x => x.id == b.dataset.pw);
    modal(`<h3>🔑 Redefinir senha</h3><p>${usr.name} (${usr.email})</p><label>Nova senha<input id="pw-n" type="password" minlength="4"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="pw-ok">Salvar</button></div>`);
    $('#pw-ok').onclick = async () => { try { if (($('#pw-n').value || '').length < 4) return toast('Mínimo 4 caracteres'); await api.put('/api/users/' + usr.id, { password: $('#pw-n').value }); closeModal(); toast('✓ Senha redefinida!'); } catch (e) { toast(e.message); } };
  });
  document.querySelectorAll('[data-tg]').forEach(b => b.onclick = async () => {
    const usr = u.find(x => x.id == b.dataset.tg);
    try { await api.put('/api/users/' + usr.id, { active: !usr.active }); toast('✓ Atualizado!'); route(); } catch (e) { toast(e.message); }
  });
  $('#n').onclick = () => { modal(`<h3>Novo usuário</h3><label>Nome<input id="x-n"></label><label>E-mail<input id="x-e"></label><label>Senha<input id="x-s" type="password"></label><label>Perfil<select id="x-r"><option>admin</option><option>gerente</option><option>vendedor</option><option>estoquista</option></select></label>${isSaaS ? `<label>ID da empresa<input id="x-c" type="number" min="1" title="Veja o ID no Painel SaaS"></label>` : ''}<div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Criar</button></div>`); $('#x-ok').onclick = async () => { try { const body = { name: $('#x-n').value, email: $('#x-e').value, password: $('#x-s').value, role: $('#x-r').value }; if (isSaaS) body.company_id = Number($('#x-c').value); await api.post('/api/users', body); closeModal(); toast('✓ Usuário criado!'); route(); } catch (e) { toast(e.message); } }; };
}
async function viewEmpresa(C) {
  setTitle('Empresa', 'Dados, fiscal, impressoras, banco e regras');
  const e = await api.get('/api/company');
  const logo = e.logo || (e.info && e.info.logo) || '';
  const v = k => (e[k] ?? '').toString().replace(/"/g, '&quot;');
  C.innerHTML = `<div class="card">
  <h3>Logo</h3><div class="logo-row"><img id="e-prev" class="logo-prev" src="${logo}" alt="Logo"><div>
  <label class="btn sm ghost" style="cursor:pointer" title="Enviar PNG/JPG da marca">📷 Escolher logo<input id="e-file" type="file" accept="image/*" class="hidden"></label>
  <button class="btn sm ghost" id="e-rm" title="Remover logo atual">Remover</button></div></div>
  <h3>Dados (Empresa ou Pessoa Física)</h3>
  <div class="row"><label>Tipo<select id="e-pt"><option value="PJ" ${e.person_type !== 'PF' ? 'selected' : ''}>Pessoa Jurídica</option><option value="PF" ${e.person_type === 'PF' ? 'selected' : ''}>Pessoa Física</option></select></label><label>Nome/Razão<input id="e-n" value="${v('nome')}"></label></div>
  <div class="row"><label>CNPJ/CPF<input id="e-doc" value="${v('doc') || v('cnpj')}" title="Documento principal"></label><label>IE/RG<input id="e-ie" value="${v('ie')}"></label></div>
  <div class="row"><label>CEP<input id="e-cep" value="${v('cep')}"></label><label>Endereço<input id="e-st" value="${v('endereco') || ((v('street') + ' ' + v('number')).trim())}"></label></div>
  <div class="row"><label>Cidade<input id="e-city" value="${v('city')}"></label><label>UF<input id="e-uf" value="${v('uf')}" maxlength="2"></label></div>
  <div class="row"><label>Telefone<input id="e-tel" value="${v('telefone')}"></label><label>E-mail<input id="e-mail" value="${v('email')}"></label></div>
  <h3>Pagamentos / Conta bancária / PIX</h3>
  <div class="row"><label>Titular<select id="e-ht"><option value="PJ" ${e.holder_type !== 'PF' ? 'selected' : ''}>Empresa</option><option value="PF" ${e.holder_type === 'PF' ? 'selected' : ''}>Pessoa Física</option></select></label><label>Banco<input id="e-bank" value="${v('bank_name')}" placeholder="Ex: Banco do Brasil"></label></div>
  <div class="row"><label>Agência<input id="e-ag" value="${v('bank_agency')}"></label><label>Conta<input id="e-ac" value="${v('bank_account')}"></label></div>
  <div class="row"><label>Tipo chave PIX<select id="e-pxt"><option value="">—</option>${['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Aleatória'].map(t => `<option ${e.pix_key_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Chave PIX<input id="e-px" value="${v('pix_key')}" title="Usada para gerar o QR Code no PDV"></label></div>
  <h3>Fiscal e impostos</h3>
  <div class="row"><label>Regime<select id="e-tr"><option value="simples" ${e.tax_regime !== 'presumido' && e.tax_regime !== 'real' ? 'selected' : ''}>Simples Nacional</option><option value="presumido" ${e.tax_regime === 'presumido' ? 'selected' : ''}>Lucro Presumido</option><option value="real" ${e.tax_regime === 'real' ? 'selected' : ''}>Lucro Real</option></select></label><label>Margem mínima %<input id="e-m" type="number" value="${e.margem_minima || 20}"></label></div>
  <div class="row"><label>ICMS %<input id="e-icms" type="number" step="0.01" value="${e.icms_default || 0}"></label><label>PIS %<input id="e-pis" type="number" step="0.01" value="${e.pis_default || 0}"></label><label>COFINS %<input id="e-cof" type="number" step="0.01" value="${e.cofins_default || 0}"></label></div>
  <h3>Impressoras</h3>
  <div class="row"><label>Cupom (não fiscal)<input id="e-pc" value="${v('printer_coupon')}" placeholder="Ex: Bematech MP-4200"></label><label>NF-e/NFC-e<input id="e-pn" value="${v('printer_nfe')}" placeholder="Ex: Epson TM-T20"></label></div>
  <div class="row"><label>Largura papel<select id="e-pw"><option ${e.paper_width !== '58mm' ? 'selected' : ''}>80mm</option><option ${e.paper_width === '58mm' ? 'selected' : ''}>58mm</option></select></label><label>Rodapé cupom<input id="e-rf" value="${v('receipt_footer')}"></label></div>
  <h3>Regra de estoque baixo</h3>
  <label title="Quando gerar solicitação de compra">Regra<select id="e-rm"><option value="min" ${e.reorder_mode !== 'reorder' ? 'selected' : ''}>Estoque mínimo</option><option value="reorder" ${e.reorder_mode === 'reorder' ? 'selected' : ''}>Ponto de reposição</option></select></label>
  <label>Segmento<select id="e-s"><option ${e.segmento === 'mercado' ? 'selected' : ''}>mercado</option><option value="marmitaria" ${e.segmento === 'marmitaria' ? 'selected' : ''}>marmitaria</option><option value="salao" ${e.segmento === 'salao' ? 'selected' : ''}>salao</option><option value="peixaria" ${e.segmento === 'peixaria' ? 'selected' : ''}>peixaria</option></select></label>
  <button class="btn ok" id="e-ok">Salvar tudo</button><p class="muted">ID: ${e.id} · /data/tenant_${e.id}.sqlite · Emissão fiscal completa (SEFAZ) no roadmap.</p></div>`;
  let newLogo = undefined;
  const prev = $('#e-prev');
  if (!logo) prev.classList.add('hidden');
  $('#e-file').onchange = async ev => { try { newLogo = await pickLogo(ev.target.files[0]); prev.src = newLogo; prev.classList.remove('hidden'); } catch (err) { toast(err.message); } };
  $('#e-rm').onclick = () => { newLogo = ''; prev.removeAttribute('src'); prev.classList.add('hidden'); };
  $('#e-ok').onclick = async () => {
    try {
      const body = {
        person_type: $('#e-pt').value, nome: $('#e-n').value, doc: $('#e-doc').value, ie: $('#e-ie').value,
        cep: $('#e-cep').value, endereco: $('#e-st').value, city: $('#e-city').value, uf: $('#e-uf').value,
        telefone: $('#e-tel').value, email: $('#e-mail').value,
        holder_type: $('#e-ht').value, bank_name: $('#e-bank').value, bank_agency: $('#e-ag').value, bank_account: $('#e-ac').value,
        pix_key_type: $('#e-pxt').value, pix_key: $('#e-px').value, pix_name: $('#e-n').value, pix_city: $('#e-city').value,
        tax_regime: $('#e-tr').value, margem_minima: Number($('#e-m').value),
        icms_default: Number($('#e-icms').value), pis_default: Number($('#e-pis').value), cofins_default: Number($('#e-cof').value),
        printer_coupon: $('#e-pc').value, printer_nfe: $('#e-pn').value, paper_width: $('#e-pw').value, receipt_footer: $('#e-rf').value,
        reorder_mode: $('#e-rm').value, segmento: $('#e-s').value
      };
      if (newLogo !== undefined) body.logo = newLogo || null;
      await api.put('/api/company', body);
      toast('✓ Empresa atualizada!'); loadCoLogo();
    } catch (err) { toast(err.message); }
  };
}
async function viewAuditoria(C) {
  setTitle('Auditoria', 'Quem alterou preço, estoque, vendas...');
  const a = await api.get('/api/audit?limit=100');
  C.innerHTML = `<div class="card" style="padding:0;overflow:auto"><table><thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Registro</th></tr></thead><tbody>${a.map(x => `<tr><td>${x.created_at}</td><td>${x.user_name || ''}</td><td>${x.acao}</td><td>${x.registro || ''}</td></tr>`).join('')}</tbody></table></div>`;
}
async function viewAlertas(C) {
  setTitle('Alertas', 'Central de notificações');
  const a = await api.get('/api/alerts');
  C.innerHTML = a.map(x => `<div class="card" style="border-left:5px solid ${x.nivel === 'critico' ? 'var(--bad)' : 'var(--warn)'}">${x.nivel === 'critico' ? '🔴' : '🟡'} ${x.msg}</div>`).join('') || '<p class="muted">Nenhum alerta.</p>';
}
async function viewSaaS(C) {
  setTitle('Painel SaaS', 'Suas empresas clientes — 100% isoladas');
  const comps = await api.get('/api/saas/companies');
  C.innerHTML = `<div class="grid g4">${comps.map(c => `<div class="card co-card">${c.logo ? `<img class="logo-prev sm" src="${c.logo}" alt="">` : '<span class="logo">🏢</span>'}<div><h3>${c.nome}</h3><small class="muted">#${c.id} · ${c.segmento} · ${c.plano} · ${c.usuarios} usuários · ${c.ativa ? 'ativa' : 'inativa'}</small></div></div>`).join('')}</div>
  <div class="toolbar"><button class="btn sm primary" id="s-new" title="Vender para nova empresa: cria banco isolado">+ Nova empresa cliente</button></div>
  <div class="table-wrap card-pad0"><table><thead><tr><th></th><th>ID</th><th>Empresa</th><th>Segmento</th><th>Usuários</th><th>Status</th><th></th></tr></thead><tbody>${comps.map(c => `<tr><td>${c.logo ? `<img class="logo-prev xs" src="${c.logo}" alt="">` : '🏢'}</td><td>${c.id}</td><td>${c.nome}</td><td>${c.segmento}</td><td>${c.usuarios}</td><td>${c.ativa ? 'ativa' : 'inativa'}</td><td class="nowrap"><button class="btn sm ghost" data-see="${c.id}" title="Abrir dashboard e dados desta empresa (modo suporte)">📂</button> <button class="btn sm ghost" data-ed="${c.id}" title="Editar dados e logo da empresa">✏️</button> <button class="btn sm warn" data-t="${c.id}" title="Ativar/desativar acesso da empresa">On/Off</button></td></tr>`).join('')}</tbody></table></div>
  <p class="muted">Cada empresa tem seu arquivo <b>data/tenant_ID.sqlite</b> — excluir a empresa apaga só o banco dela. Backup por empresa = copiar o arquivo.</p>`;
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = async () => { const c = comps.find(x => x.id == b.dataset.t); await api.req('PUT', '/api/saas/companies/' + c.id, { ativa: !c.ativa }); route(); });
  document.querySelectorAll('[data-see]').forEach(b => b.onclick = () => { sessionStorage.setItem('cid', b.dataset.see); buildMenu(); renderCtxBar(); location.hash = '#/dashboard'; route(); });
  document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editCompany(comps.find(x => x.id == b.dataset.ed)));
  $('#s-new').onclick = () => { modal(`<h3>Nova empresa cliente</h3><label>Empresa<input id="x-n"></label><label>Segmento<select id="x-s"><option>mercado</option><option>marmitaria</option><option>salao</option><option>peixaria</option></select></label><label>Admin nome<input id="x-a"></label><label>Admin e-mail<input id="x-e"></label><label>Senha<input id="x-p" type="password"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Criar</button></div>`); $('#x-ok').onclick = async () => { try { await api.post('/api/saas/companies', { nome: $('#x-n').value, segmento: $('#x-s').value, admin_name: $('#x-a').value, admin_email: $('#x-e').value, admin_pass: $('#x-p').value }); closeModal(); toast('Empresa criada!'); route(); } catch (e) { toast(e.message); } }; };
}
async function editCompany(c) {
  let newLogo = undefined;
  modal(`<h3>✏️ ${c.nome}</h3>
  <div class="logo-row"><img id="c-prev" class="logo-prev" ${c.logo ? `src="${c.logo}"` : 'style="display:none"'} alt="Logo"><div>
  <label class="btn sm ghost" style="cursor:pointer" title="Trocar a logo desta empresa">📷 Trocar logo<input id="c-file" type="file" accept="image/*" class="hidden"></label>
  <button class="btn sm ghost" id="c-rm" title="Remover logo">Remover</button></div></div>
  <label>Nome<input id="c-n" value="${(c.nome || '').replace(/"/g, '&quot;')}"></label>
  <div class="row"><label>Segmento<select id="c-s"><option ${c.segmento === 'mercado' ? 'selected' : ''}>mercado</option><option value="marmitaria" ${c.segmento === 'marmitaria' ? 'selected' : ''}>marmitaria</option><option value="salao" ${c.segmento === 'salao' ? 'selected' : ''}>salao</option><option value="peixaria" ${c.segmento === 'peixaria' ? 'selected' : ''}>peixaria</option></select></label>
  <label>Plano<select id="c-p"><option ${c.plano === 'basico' ? 'selected' : ''}>basico</option><option value="pro" ${c.plano === 'pro' ? 'selected' : ''}>pro</option><option value="premium" ${c.plano === 'premium' ? 'selected' : ''}>premium</option></select></label></div>
  <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="c-ok">Salvar</button></div>`);
  $('#c-file').onchange = async ev => { try { newLogo = await pickLogo(ev.target.files[0]); const p = $('#c-prev'); p.src = newLogo; p.style.display = ''; } catch (e) { toast(e.message); } };
  $('#c-rm').onclick = () => { newLogo = ''; const p = $('#c-prev'); p.removeAttribute('src'); p.style.display = 'none'; };
  $('#c-ok').onclick = async () => {
    try {
      const body = { nome: $('#c-n').value, segmento: $('#c-s').value, plano: $('#c-p').value };
      if (newLogo !== undefined) body.logo = newLogo || null;
      await api.req('PUT', '/api/saas/companies/' + c.id, body);
      closeModal(); toast('✓ Empresa atualizada!'); route();
    } catch (e) { toast(e.message); }
  };
}

boot();
