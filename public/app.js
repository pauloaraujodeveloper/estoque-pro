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
  admin: [['Principal', [['Dashboard', '#/dashboard', 'Visão geral'], ['Alertas', '#/alertas', 'Estoque baixo e vencimentos']]], ['Operação', [['PDV / Vendas', '#/pdv', 'Frente de caixa rápida'], ['Vendas', '#/vendas', 'Histórico'], ['Orçamentos', '#/orc', 'Orçamentos e pedidos'], ['Caixa / Financeiro', '#/financeiro', 'Contas e DRE']]], ['Estoque', [['Produtos', '#/produtos', 'Cadastro e preços'], ['Movimentações', '#/estoque', 'Entradas, saídas, perdas'], ['Lotes', '#/lotes', 'Validade e PVPS'], ['Transferências', '#/transf', 'Entre filiais/lojas'], ['Compras', '#/compras', 'Pedidos e recebimentos']]], ['Cadastros', [['Clientes', '#/clientes', 'Fiado e histórico'], ['Fornecedores', '#/fornecedores', 'Histórico de preços'], ['Ficha técnica', '#/fichas', 'Receitas e consumo auto']]], ['Gestão', [['Relatórios', '#/relatorios', 'Exportar CSV'], ['Segmento', '#/segmento', 'Módulo do seu ramo'], ['Usuários', '#/usuarios', 'Equipe e perfis'], ['Empresa', '#/empresa', 'Dados e segmento'], ['Auditoria', '#/auditoria', 'Quem fez o quê']]]],
  gerente: [['Principal', [['Dashboard', '#/dashboard', ''], ['PDV / Vendas', '#/pdv', ''], ['Orçamentos', '#/orc', ''], ['Produtos', '#/produtos', ''], ['Movimentações', '#/estoque', ''], ['Compras', '#/compras', ''], ['Transferências', '#/transf', ''], ['Clientes', '#/clientes', ''], ['Financeiro', '#/financeiro', ''], ['Relatórios', '#/relatorios', '']]]],
  vendedor: [['Vendas', [['PDV / Vendas', '#/pdv', 'Registrar venda'], ['Orçamentos', '#/orc', 'Orçar'], ['Produtos', '#/produtos', 'Consultar'], ['Clientes', '#/clientes', 'Consultar']]]],
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
    if (h === '#/orc') return viewOrc(C);
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
    <div class="card"><h3 title="Ticket médio por venda">🎯 Ticket médio</h3><div class="big">${BRL(d.ticketMedio)}</div><small class="muted">${d.vendasQtd || 0} vendas</small></div>
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
  <div class="row"><label>NCM<input id="f-ncm" value="${p.ncm || ''}" title="Nomenclatura fiscal"></label><label>CEST<input id="f-cest" value="${p.cest || ''}"></label><label>CFOP<input id="f-cfop" value="${p.cfop || ''}" title="Ex: 5102"></label><label>Alíquota %<input id="f-tax" type="number" step="0.01" value="${p.tax_rate || 0}"></label></div>
  <p><button class="btn sm ghost" id="btn-sug" title="Calcular preço pela margem desejada">💡 Sugerir preço por margem</button></p>
  <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="btn-save">Salvar</button></div>`);
  $('#btn-sug').onclick = async () => {
    const m = prompt('Margem desejada % (ex 40):', '40'); if (!m) return;
    const j = await api.post('/api/products/preco-sugerido', { custo: Number($('#f-custo').value), margem: Number(m) });
    $('#f-preco').value = j.preco; toast('Preço sugerido: ' + BRL(j.preco));
  };
  $('#btn-save').onclick = async () => {
    const body = { nome: $('#f-nome').value.trim(), custo_medio: Number($('#f-custo').value), preco_venda: Number($('#f-preco').value), categoria_id: $('#f-cat2').value || null, unidade_id: $('#f-un').value || null, estoque_atual: Number($('#f-est').value), estoque_min: Number($('#f-min').value), ponto_reposicao: Number($('#f-min').value), codigo_barras: $('#f-cb').value, tipo: $('#f-tipo').value, ncm: $('#f-ncm').value, cest: $('#f-cest').value, cfop: $('#f-cfop').value, tax_rate: Number($('#f-tax').value) };
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
  let prods = [], clis = [], cats = [], cfg = {}, offmode = false, catSel = '';
  try {
    prods = (await api.get('/api/products?limit=100')).data.filter(p => p.status === 'ativo');
    clis = await api.get('/api/customers');
    try { cats = await api.get('/api/categories'); } catch {}
    cfg = await api.get('/api/company').catch(() => ({}));
    localStorage.setItem('pdv_cache', JSON.stringify({ prods, clis, ts: Date.now() }));
  } catch (e) {
    // contingência offline: usa último catálogo em cache
    try { const c = JSON.parse(localStorage.getItem('pdv_cache') || '{}'); prods = c.prods || []; clis = c.clis || []; offmode = true; } catch {}
    if (!prods.length) throw e;
  }
  let abertos = [];
  try { abertos = (await api.get('/api/cash')).filter(c => c.status === 'aberto'); } catch {}
  let caixaSel = localStorage.getItem('caixa') || (abertos[0] && abertos[0].id) || '';
  C.innerHTML = `
  <div class="card pdv-topbar">
    <label title="Caixa/terminal em uso">Caixa<select id="pdv-cx"><option value="">Sem caixa</option>${abertos.map(c => `<option value="${c.id}" ${String(c.id) === String(caixaSel) ? 'selected' : ''}>${c.terminal} · ${c.operator_name || ''}</option>`).join('')}</select></label>
    <label title="Funcionário operador">Operador<input id="pdv-op" value="${ME.name}"></label>
    <button class="btn sm ghost" id="pdv-open" title="Abrir novo turno de caixa">🧾 Abrir</button>
    <label style="min-width:110px" title="Tabela de preço aplicada aos itens">Tabela<select id="pdv-pt"><option value="1">Balcão</option><option value="${cfg.pt2_mult || 1}">${cfg.pt2_name || 'Atacado'}${Number(cfg.pt2_mult) !== 1 && cfg.pt2_mult ? ' ×' + cfg.pt2_mult : ''}</option><option value="${cfg.pt3_mult || 1}">${cfg.pt3_name || 'Delivery'}${Number(cfg.pt3_mult) !== 1 && cfg.pt3_mult ? ' ×' + cfg.pt3_mult : ''}</option></select></label>
    <span class="sp"></span>
    ${offmode ? '<span class="tag t-bad" title="Sem internet: vendas serão enfileiradas e sincronizadas">🔴 OFFLINE</span>' : ''}
    <button class="btn sm ghost" id="pdv-sync" title="Sincronizar vendas offline agora">☁ Sinc<span id="sync-n"></span></button>
    <button class="btn sm ghost" id="pdv-hold" title="Segurar venda atual e liberar o caixa">⏸ Segurar</button>
    <button class="btn sm ghost" id="pdv-held" title="Ver vendas seguradas">📋 Espera</button>
    <button class="btn sm danger" id="pdv-clear" title="Limpar carrinho atual">✕</button>
  </div>
  <div class="grid g2 pdv-fit"><div class="card"><div class="row scan-row"><label style="flex:0 0 84px" title="Quantidade (ex: 15) ou use 15*CODIGO no campo ao lado">Qtd<input id="pdv-n" type="number" value="1" min="0" step="any"></label><label style="flex:1" title="Bipe o produto, digite código de barras/SKU/código ou nome + Enter">Bipar / código<input id="pdv-code" placeholder="🔫 Bipe ou código + Enter" autocomplete="off"></label><button class="btn sm ghost" id="pdv-keys-btn" style="align-self:end" title="Teclado numérico touch">⌨</button></div><div id="pdv-keys" class="keypad hidden"></div><input id="pdv-q" placeholder="🔎 Buscar produto..." title="Digite para filtrar"><div id="pdv-cats" class="chips"></div><div id="pdv-list" class="pdv-list-scroll tiles"></div></div>
  <div class="card"><h3>🧾 Carrinho <small id="cart-count" class="muted"></small></h3><div class="pdv-cart-scroll"><div id="cart"></div><div class="row" style="align-items:end"><label style="flex:1">Cliente<select id="cart-cli"><option value="">Balcão</option>${clis.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></label><button class="btn sm ghost" id="cli-add" title="Cadastrar cliente rápido">+</button></div>
  <div class="row" style="align-items:end"><label style="flex:1" title="CPF/CNPJ p/ programas de incentivo — vincula ou cadastra">CPF/CNPJ<input id="pdv-doc" inputmode="numeric" placeholder="Só números"></label><button class="btn sm ghost" id="pdv-docgo" title="Vincular cliente pelo documento">OK</button></div>
  <label>Desconto<input id="cart-desc" type="number" value="0" min="0"></label>
  <h3>Pagamento</h3><div class="pay-quick"><button class="btn pq-din" data-pq="dinheiro" title="Tudo em dinheiro">💵 Dinheiro</button><button class="btn pq-pix" data-pq="pix" title="Tudo no Pix">⚡ Pix</button><button class="btn pq-cc" data-pq="cartao_credito" title="Tudo no crédito">💳 Crédito</button><button class="btn pq-cd" data-pq="cartao_debito" title="Tudo no débito">💳 Débito</button><button class="btn pq-fi" data-pq="fiado" title="Tudo fiado (exige cliente)">📒 Fiado</button></div><div id="pays"></div>
  <p><button class="btn sm ghost" id="pay-add" title="Adicionar outra forma (ex: parte dinheiro + parte crédito)">+ Forma de pagamento</button></p></div>
  <div class="pdv-foot"><h2 id="cart-total" class="pdv-total-big">Total: R$ 0,00</h2><p id="pay-rest" class="muted"></p>
  <label><input type="checkbox" id="cart-wait" style="width:auto"> Deixar aguardando pagamento</label>
  <button class="btn primary" id="cart-fin" title="Finalizar venda">Finalizar venda</button></div></div></div>`;
  let cart = [];
  let pays = [{ method: 'dinheiro', amount: 0 }];
  function beep(ok = true) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = ok ? 880 : 220; o.type = 'sine';
      g.gain.value = 0.08; o.start(); o.stop(ctx.currentTime + 0.09);
    } catch {}
  }
  // aceita "15*789..." ou "15x789..." ou código puro; procura por barras/SKU/interno/id/nome
  // balança: 2 + PLU(4) + valor(5) — ex 200123001500 (PLU 0123, 1.500kg ou R$15,00)
  function findProduct(raw) {
    let qtd = Number($('#pdv-n').value) || 1;
    let code = String(raw || '').trim();
    const mx = code.match(/^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/);
    if (mx) { qtd = Number(mx[1].replace(',', '.')) * qtd; code = mx[2].trim(); }
    if (!code) return { qtd, p: null };
    const digits = code.replace(/\D/g, '');
    // balança (EAN peso/preço 10-13 dígitos iniciando em 2): tenta PLU 5 e 4 dígitos
    if (/^2\d{9,12}$/.test(digits) && !mx) {
      const cands = [
        { plu: digits.slice(1, 6), val: digits.slice(6, 11) },
        { plu: digits.slice(1, 5), val: digits.slice(5, 10) },
      ];
      for (const cd of cands) {
        const p = prods.find(x => [x.codigo_barras, x.sku, x.codigo_interno].some(v => v && String(v).replace(/\D/g, '').endsWith(cd.plu)));
        if (p && /^\d+$/.test(cd.val)) {
          const val = Number(cd.val);
          const isKg = String(p.unidade || 'UN').toUpperCase() === 'KG';
          qtd = Number(((isKg ? val / 1000 : val / 100 / Number(p.preco_venda || 1)) * qtd).toFixed(3));
          if (qtd > 0) return { qtd, p };
        }
      }
    }
    const low = code.toLowerCase();
    let p = prods.find(x => [x.codigo_barras, x.sku, x.codigo_interno, String(x.id)].some(v => v && String(v).toLowerCase() === low));
    if (!p) p = prods.find(x => x.nome.toLowerCase().includes(low));
    return { qtd, p: p || null };
  }
  function ptMult() { return Number($('#pdv-pt') ? $('#pdv-pt').value : 1) || 1; }
  function addToCart(product_id, qty) {
    const p = prods.find(x => x.id == product_id);
    if (!p || !(qty > 0)) return false;
    const pv = Number((Number(p.preco_venda) * ptMult()).toFixed(2));
    const line = cart.find(i => i.product_id == product_id && i.preco_unit === pv);
    if (line) line.qtd = Number((line.qtd + qty).toFixed(3));
    else cart.push({ product_id: p.id, nome: p.nome, qtd: qty, preco_unit: pv });
    return true;
  }
  function holdGet() { try { return JSON.parse(localStorage.getItem('pdv_hold') || '[]'); } catch { return []; } }
  function holdSet(h) { localStorage.setItem('pdv_hold', JSON.stringify(h)); }
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
    const ehTroco = pays.length === 1 && pays[0].method === 'dinheiro' && rest < 0 && t > 0;
    if (rest > 0) $('#pay-rest').textContent = `Faltam ${BRL(rest)} — clique em Completar`;
    else if (ehTroco) $('#pay-rest').textContent = `Troco: ${BRL(-rest)}`;
    else if (rest < 0) $('#pay-rest').textContent = `Ultrapassou ${BRL(-rest)}`;
    else $('#pay-rest').textContent = '✓ Pagamento confere';
    $('#pay-rest').innerHTML += rest > 0 ? ` <button class="btn sm ghost" id="pay-fill">Completar</button>` : '';
    const f = $('#pay-fill'); if (f) f.onclick = () => { pays[pays.length - 1].amount = Number((Number(pays[pays.length - 1].amount || 0) + rest).toFixed(2)); drawPays(); drawRest(); };
  }
  function drawList() {
    const q = ($('#pdv-q').value || '').toLowerCase();
    const rows = prods.filter(p => (!q || p.nome.toLowerCase().includes(q)) && (!catSel || String(p.categoria_id) === catSel)).slice(0, 60);
    $('#pdv-list').innerHTML = rows.map(p => `<button class="tile" data-a="${p.id}" title="${p.nome} — adicionar (usa a Qtd)"><span class="tname">${p.nome}</span><span class="tprice">${BRL(Number(p.preco_venda) * ptMult())}</span><small>est ${p.estoque_atual}</small></button>`).join('') || '<p class="muted">Nada encontrado.</p>';
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (addToCart(b.dataset.a, Number($('#pdv-n').value) || 1)) { beep(true); drawCart(); } else { beep(false); toast('Produto/quantidade inválidos'); } });
  }
  function drawCats() {
    $('#pdv-cats').innerHTML = `<button class="chip${!catSel ? ' active' : ''}" data-c="">Todas</button>` + cats.map(c => `<button class="chip${String(c.id) === catSel ? ' active' : ''}" data-c="${c.id}" title="Filtrar ${c.nome}">${c.nome}</button>`).join('');
    document.querySelectorAll('#pdv-cats [data-c]').forEach(b => b.onclick = () => { catSel = b.dataset.c; drawCats(); drawList(); });
  }
  function drawCart() {
    $('#cart').innerHTML = cart.map((i, idx) => {
      const p = prods.find(x => x.id == i.product_id);
      const over = p && p.tipo !== 'servico' && Number(i.qtd) > Number(p.estoque_atual);
      return `<div class="cart-row"><button class="btn sm ghost" data-m="${idx}" title="Diminuir">−</button><input data-q="${idx}" type="number" min="0" step="any" value="${i.qtd}" title="Quantidade"><button class="btn sm ghost" data-p="${idx}" title="Aumentar">+</button><span class="nm"><b>${i.nome}</b><br><small class="muted">${BRL(i.preco_unit)} un${over ? ' · <b style="color:var(--bad)">acima do estoque!</b>' : ''}</small></span><span class="ln">${BRL(Number(i.qtd) * Number(i.preco_unit))}</span><button class="btn sm danger" data-d="${idx}" title="Remover item">×</button></div>`;
    }).join('') || '<p class="muted">Carrinho vazio — bipe o primeiro item.</p>';
    const n = cart.reduce((s, i) => s + Number(i.qtd || 0), 0);
    $('#cart-count').textContent = cart.length ? `(${cart.length} itens · ${n} un)` : '';
    document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { cart.splice(b.dataset.d, 1); drawCart(); });
    document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { const i = cart[b.dataset.m]; i.qtd = Number((Number(i.qtd) - 1).toFixed(3)); if (i.qtd <= 0) cart.splice(b.dataset.m, 1); drawCart(); });
    document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cart[b.dataset.p].qtd = Number((Number(cart[b.dataset.p].qtd) + 1).toFixed(3)); drawCart(); });
    document.querySelectorAll('[data-q]').forEach(inp => inp.onchange = () => { const v = Number(inp.value); if (!(v > 0)) cart.splice(inp.dataset.q, 1); else cart[inp.dataset.q].qtd = v; drawCart(); });
    if (pays.length === 1 && !pays[0].amount) pays[0].amount = tot();
    drawPays(); drawRest();
  }
  $('#pdv-q').oninput = drawList; $('#cart-desc').oninput = drawCart;
  $('#pay-add').onclick = () => { pays.push({ method: 'cartao_credito', amount: 0 }); drawPays(); };
  document.querySelectorAll('[data-pq]').forEach(b => b.onclick = () => {
    pays = [{ method: b.dataset.pq, amount: tot() }];
    document.querySelectorAll('[data-pq]').forEach(x => x.classList.toggle('sel', x === b));
    drawPays(); drawRest();
  });
  $('#pdv-keys-btn').onclick = () => {
    const k = $('#pdv-keys');
    if (!k.innerHTML) {
      k.innerHTML = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'C', '⌫'].map(x => `<button data-k="${x}">${x}</button>`).join('');
      k.querySelectorAll('[data-k]').forEach(btn => btn.onclick = () => {
        const inp = $('#pdv-n'); const v = btn.dataset.k;
        if (v === 'C') inp.value = '';
        else if (v === '⌫') inp.value = String(inp.value).slice(0, -1);
        else inp.value = String(inp.value || '') + v;
        inp.focus();
      });
    }
    k.classList.toggle('hidden');
  };
  $('#pdv-cx').onchange = e => { caixaSel = e.target.value; localStorage.setItem('caixa', caixaSel); };
  $('#pdv-code').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const { qtd, p } = findProduct($('#pdv-code').value);
    if (p && addToCart(p.id, qtd)) { beep(true); drawCart(); }
    else { beep(false); toast('Produto não encontrado para esse código.'); }
    $('#pdv-code').value = ''; $('#pdv-code').focus();
  });
  $('#cli-add').onclick = () => {
    modal(`<h3>Novo cliente</h3><label>Nome*<input id="x-n"></label><label>Telefone<input id="x-t"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="x-ok">Salvar</button></div>`);
    $('#x-ok').onclick = async () => {
      const nm = $('#x-n').value.trim(), tl = $('#x-t').value;
      if (!nm) return toast('Nome obrigatório');
      try {
        const j = await api.post('/api/customers', { nome: nm, tel: tl });
        closeModal(); toast('✓ Cliente salvo!');
        const sel = $('#cart-cli');
        if (sel) { const op = document.createElement('option'); op.value = j.id; op.textContent = nm; sel.appendChild(op); sel.value = j.id; }
      } catch (err) { toast(err.message); }
    };
  };
  $('#pdv-clear').onclick = () => confirmDlg('Limpar carrinho atual?', () => { cart = []; pays = [{ method: 'dinheiro', amount: 0 }]; $('#cart-desc').value = 0; drawCart(); $('#pdv-code').focus(); });
  $('#pdv-hold').onclick = () => {
    if (!cart.length) return toast('Carrinho vazio.');
    const h = holdGet();
    h.push({ ts: new Date().toLocaleString('pt-BR'), cli: $('#cart-cli').value, desc: Number($('#cart-desc').value), cart });
    holdSet(h); cart = []; pays = [{ method: 'dinheiro', amount: 0 }]; $('#cart-desc').value = 0; drawCart();
    toast('⏸ Venda segurada.'); $('#pdv-code').focus();
  };
  $('#pdv-held').onclick = () => {
    const h = holdGet();
    if (!h.length) return toast('Nenhuma venda em espera.');
    modal(`<h3>📋 Vendas seguradas</h3>${h.map((s, i) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid var(--line)"><span><b>${s.cart.reduce((a, it) => a + Number(it.qtd), 0)} un</b> · ${s.ts}</span><span class="nowrap"><button class="btn sm primary" data-h="${i}">Recuperar</button> <button class="btn sm danger" data-hd="${i}" title="Descartar">×</button></span></div>`).join('')}<br><button class="btn ghost" onclick="closeModal()">Fechar</button>`);
    document.querySelectorAll('[data-h]').forEach(b => b.onclick = () => {
      if (cart.length && !confirm('Substituir o carrinho atual?')) return;
      const s = holdGet()[b.dataset.h];
      cart = s.cart; $('#cart-cli').value = s.cli || ''; $('#cart-desc').value = s.desc || 0;
      pays = [{ method: 'dinheiro', amount: 0 }];
      const hh = holdGet(); hh.splice(b.dataset.h, 1); holdSet(hh);
      closeModal(); drawCart(); toast('✓ Venda recuperada.');
    });
    document.querySelectorAll('[data-hd]').forEach(b => b.onclick = () => { const hh = holdGet(); hh.splice(b.dataset.hd, 1); holdSet(hh); closeModal(); toast('Removida.'); });
  };
  async function linkDocByCpf() {
    const raw = $('#pdv-doc').value.replace(/\D/g, '');
    if (!raw) return toast('Digite o CPF/CNPJ.');
    try {
      const all = await api.get('/api/customers');
      let c = all.find(x => (x.doc || '').replace(/\D/g, '') === raw);
      if (!c) {
        const j = await api.post('/api/customers', { nome: 'Cliente ' + raw, doc: $('#pdv-doc').value });
        c = { id: j.id, nome: 'Cliente ' + raw };
        toast('✓ Cliente cadastrado!');
        const sel = $('#cart-cli');
        if (sel) { const op = document.createElement('option'); op.value = c.id; op.textContent = c.nome; sel.appendChild(op); }
      } else toast('Vinculado: ' + c.nome);
      $('#cart-cli').value = c.id;
    } catch (e) { toast(e.message); }
  }
  function queueGet() { try { return JSON.parse(localStorage.getItem('pdv_queue') || '[]'); } catch { return []; } }
  function updSyncBadge() {
    const q = queueGet().filter(x => !x.err);
    const el = $('#sync-n');
    if (el) el.textContent = q.length ? ` (${q.length})` : '';
  }
  let syncing = false;
  async function trySync(silent) {
    if (syncing || !navigator.onLine) return;
    const q = queueGet().filter(x => !x.err);
    if (!q.length) return;
    syncing = true;
    let ok = 0;
    try {
      for (const item of q) {
        try {
          await api.post('/api/sales', { ...item.payload, is_contingency: 1 });
          ok++;
          const all = queueGet().filter(x => x.uuid !== item.uuid);
          localStorage.setItem('pdv_queue', JSON.stringify(all));
        } catch (e) {
          if (/indisponível|Failed to fetch|NetworkError/i.test(e.message || '')) break;
          const all = queueGet(); const it = all.find(x => x.uuid === item.uuid);
          if (it) { it.err = e.message; localStorage.setItem('pdv_queue', JSON.stringify(all)); }
        }
      }
      if (ok && !silent) toast(`☁ ${ok} venda(s) sincronizada(s)!`);
    } finally { syncing = false; updSyncBadge(); }
  }
  setTimeout(() => { const c = $('#pdv-code'); if (c) c.focus(); }, 150);
  $('#pdv-sync').onclick = () => trySync(false);
  updSyncBadge(); trySync(true);
  $('#pdv-open').onclick = () => {
    modal(`<h3>🧾 Abrir caixa</h3><div class="row"><label>Caixa/terminal<input id="o-t" value="1" title="Ex: 1 ou 2"></label><label>Funcionário<input id="o-o" value="${ME.name}" title="Ex: Bianca"></label></div><label>Saldo inicial<input id="o-s" type="number" value="0"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="o-ok">Abrir</button></div>`);
    $('#o-ok').onclick = async () => { try { const j = await api.post('/api/cash/open', { terminal: $('#o-t').value, operator_name: $('#o-o').value, saldo_inicial: Number($('#o-s').value) }); closeModal(); localStorage.setItem('caixa', j.id); toast('✓ Caixa aberto!'); route(); } catch (e) { toast(e.message); } };
  };
  drawCats(); drawList(); drawCart();
  async function ensureDiscountOk() {
    const sub = cart.reduce((s, i) => s + Number(i.qtd) * Number(i.preco_unit), 0);
    const d = Number($('#cart-desc').value || 0);
    const pct = sub > 0 ? d / sub * 100 : 0;
    const max = Number(cfg.discount_max_pct ?? 10);
    if (!(pct > max) || ['admin', 'gerente', 'superadmin'].includes(ME.role)) return true;
    return new Promise(resolve => {
      modal(`<h3>🔐 Desconto acima da alçada (${pct.toFixed(0)}% &gt; ${max}%)</h3><p class="muted">Peça a aprovação de gerente/admin com a senha.</p><label>E-mail do aprovador<input id="ap-e"></label><label>Senha<input id="ap-p" type="password"></label><div class="row"><button class="btn ghost" id="ap-no">Negar</button><button class="btn ok" id="ap-ok">Aprovar</button></div>`);
      $('#ap-no').onclick = () => { closeModal(); resolve(false); };
      $('#ap-ok').onclick = async () => {
        try { const j = await api.post('/api/sales/approve-discount', { email: $('#ap-e').value, password: $('#ap-p').value, percentual: pct }); closeModal(); toast('✓ Aprovado por ' + j.aprovado_por); resolve(true); }
        catch (e) { toast(e.message); resolve(false); }
      };
    });
  }
  function queueSale(payload) {
    const q = queueGet();
    q.push({ uuid: payload.client_uuid, ts: new Date().toISOString(), payload, err: null });
    localStorage.setItem('pdv_queue', JSON.stringify(q));
    updSyncBadge();
  }
  async function saleSuccess(j, troco) {
      const det = await api.get('/api/sales/' + j.id).catch(() => null);
      const co = await api.get('/api/company').catch(() => ({}));
      const hasPix = (paysToSendRef.list || []).some(p => p.method === 'pix');
      modal(`<h3>✓ Venda #${j.id} — ${BRL(j.total)}</h3><p class="muted">Status: ${statusLabel(j.status)}${j.duplicate ? ' · (já sincronizada)' : ''}${troco > 0 ? ` · <b>Troco: ${BRL(troco)}</b>` : ''}</p>
      <div class="row"><button class="btn ghost" id="m-cup" title="Imprimir cupom (impressora padrão)">🧾 Cupom</button>${hasPix ? '<button class="btn primary" id="m-qr" title="Exibir QR Code PIX da venda">PIX QR</button>' : ''}<button class="btn ghost" onclick="closeModal()">Fechar</button></div><div id="m-qrbox" style="text-align:center;margin-top:10px"></div>`);
      $('#m-cup').onclick = () => printHtml('Cupom #' + j.id, receiptHtml(det || { id: j.id, itens: cart.map(i => ({ ...i, nome: i.nome })), total: j.total, payments: paysToSendRef.list }, co));
      const qr = $('#m-qr');
      if (qr) qr.onclick = async () => { try { const px = await api.post(`/api/sales/${j.id}/pix`); $('#m-qrbox').innerHTML = `<img src="${px.qr}" style="max-width:220px"><p class="muted">Escaneie para pagar ${BRL(j.total)}</p><small class="break">${px.brcode}</small>`; } catch (e) { toast(e.message); } };
      cart = []; pays = [{ method: 'dinheiro', amount: 0 }]; drawCart();
  }
  const paysToSendRef = { list: [] };
  $('#cart-fin').onclick = async () => {
    if (!cart.length) return toast('Carrinho vazio.');
    if (!await ensureDiscountOk()) return;
    let troco = 0;
    let paysToSend = (tot() === 0 ? [] : pays.map(p => ({ method: p.method, amount: Number(p.amount) })));
    if (paysToSend.length === 1 && paysToSend[0].method === 'dinheiro') {
      const diff = Number((paysToSend[0].amount - tot()).toFixed(2));
      if (diff > 0 && tot() > 0) { troco = diff; paysToSend[0].amount = tot(); }
    }
    paysToSendRef.list = paysToSend;
    const payload = { customer_id: $('#cart-cli').value || null, items: cart, desconto: Number($('#cart-desc').value), payments: paysToSend, caixa_id: caixaSel || null, operator_name: $('#pdv-op').value, awaiting: $('#cart-wait').checked, client_uuid: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())), is_contingency: navigator.onLine ? 0 : 1 };
    try {
      const j = await api.post('/api/sales', payload);
      await saleSuccess(j, troco);
    } catch (e) {
      if (/indisponível|Failed to fetch|NetworkError|Load failed/i.test(e.message || '')) {
        queueSale(payload);
        toast('🔴 Sem internet: venda enfileirada p/ sincronizar.');
        cart = []; pays = [{ method: 'dinheiro', amount: 0 }]; drawCart();
      } else toast(e.message);
    }
  };
  $('#pdv-docgo').onclick = linkDocByCpf;
}
async function viewOrc(C) {
  setTitle('Orçamentos', 'Orçar, aprovar e converter em venda');
  const ors = await api.get('/api/budgets');
  const prods = (await api.get('/api/products?limit=100')).data.filter(p => p.status === 'ativo');
  const clis = await api.get('/api/customers');
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="o-new" title="Novo orçamento">+ Novo orçamento</button></div>
  <div class="table-wrap card-pad0"><table><thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${ors.map(o => `<tr><td><b>#${o.id}</b></td><td>${o.cliente || '—'}</td><td>${BRL(o.total)}</td><td><span class="tag ${o.status === 'convertido' ? 't-ok' : o.status === 'cancelado' ? 't-bad' : 't-info'}">${statusLabel(o.status)}</span></td><td class="nowrap">${o.status === 'aberto' ? `<button class="btn sm ok" data-cv="${o.id}" title="Aprovar: baixa estoque e cria venda">Converter</button> <button class="btn sm danger" data-cc="${o.id}">Cancelar</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  document.querySelectorAll('[data-cv]').forEach(b => b.onclick = () => confirmDlg('Converter em venda? Baixa o estoque.', async () => { try { const j = await api.post(`/api/budgets/${b.dataset.cv}/convert`); toast(`✓ Venda #${j.id} criada!`); route(); } catch (e) { toast(e.message); } }));
  document.querySelectorAll('[data-cc]').forEach(b => b.onclick = async () => { await api.post(`/api/budgets/${b.dataset.cc}/cancel`); route(); });
  $('#o-new').onclick = () => {
    let items = [];
    modal(`<h3>Novo orçamento</h3><label>Cliente<select id="ob-c"><option value="">—</option>${clis.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></label>
    <div class="row"><select id="ob-p">${prods.map(p => `<option value="${p.id}">${p.nome} · ${BRL(p.preco_venda)}</option>`).join('')}</select><input id="ob-q" type="number" value="1" style="max-width:80px"></div>
    <p><button class="btn sm ghost" id="ob-add">+ item</button> <span id="ob-l" class="muted"></span></p>
    <label>Desconto<input id="ob-d" type="number" value="0"></label>
    <div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="ob-ok">Salvar</button></div>`);
    $('#ob-add').onclick = () => { const p = prods.find(x => x.id == $('#ob-p').value); items.push({ product_id: p.id, qtd: Number($('#ob-q').value), preco_unit: p.preco_venda }); $('#ob-l').textContent = items.length + ' item(ns)'; };
    $('#ob-ok').onclick = async () => { try { await api.post('/api/budgets', { customer_id: $('#ob-c').value || null, items, desconto: Number($('#ob-d').value) }); closeModal(); toast('✓ Orçamento salvo!'); route(); } catch (e) { toast(e.message); } };
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
  C.innerHTML = `<div class="toolbar"><button class="btn sm primary" id="n" title="Novo cliente">+ Novo</button></div><div class="table-wrap card-pad0"><table><thead><tr><th>Nome</th><th>Tel</th><th>Limite fiado</th><th></th></tr></thead><tbody>${r.map(c => `<tr><td>${c.nome}</td><td>${c.tel || ''}</td><td>${BRL(c.limite_fiado)}</td><td><button class="btn sm ghost" data-h="${c.id}" title="Histórico de compras e fiado">📜</button></td></tr>`).join('')}</tbody></table></div><p class="muted">Toque em 📜 para ver histórico, ticket médio e saldo fiado.</p>`;
  document.querySelectorAll('[data-h]').forEach(b => b.onclick = async () => {
    const d = await api.get('/api/customers/' + b.dataset.h);
    modal(`<h3>${d.nome}</h3><p class="muted">${d.tel || ''} · Compras: ${d.compras.length} · Ticket médio: ${BRL(d.ticket_medio)} · Fiado aberto: ${BRL(d.fiado_aberto)}</p>
    ${(d.compras || []).slice(0, 15).map(v => `<small>#${v.id} · ${String(v.created_at || '').slice(0, 10)} · ${BRL(v.total)} · ${statusLabel(v.status)}</small><br>`).join('') || '<p class="muted">Sem compras.</p>'}
    <br><button class="btn ghost" onclick="closeModal()">Fechar</button>`);
  });
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
  <div class="card" style="margin-top:12px"><h3>🧾 Caixas (turnos)</h3><div class="toolbar"><button class="btn sm primary" id="cx-open" title="Abrir turno: terminal + funcionário + saldo inicial">+ Abrir caixa</button><button class="btn sm ghost" id="cx-ofx" title="Importar extrato OFX para conciliação">🏦 OFX</button></div>
  ${cx.map(c => `<small><b>Caixa ${c.terminal || '-'}</b> · ${c.operator_name || ''} · inicial ${BRL(c.saldo_inicial)} · vendido ${BRL(c.total_vendido)} · <span class="tag ${c.status === 'aberto' ? 't-ok' : 't-info'}">${statusLabel(c.status)}</span> ${c.status === 'aberto' ? `<button class="btn sm ghost" data-sg="${c.id}" title="Sangria: retirada de valores">− Sangria</button> <button class="btn sm ghost" data-sp="${c.id}" title="Suprimento: entrada de troco">+ Suprimento</button> <button class="btn sm warn" data-cx="${c.id}" title="Fechar turno informando saldo final">Fechar</button>` : `<span class="muted">final ${BRL(c.saldo_final)}</span>`}</small><br>`).join('') || '<p class="muted">Nenhum caixa.</p>'}</div>
  <div class="card" style="margin-top:12px"><h3>💧 Fluxo de caixa — previsto × realizado</h3><div id="cf-out" class="muted">Carregando...</div></div>
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
  const movCx = (id, tipo) => {
    modal(`<h3>${tipo === 'sangria' ? '− Sangria (retirada)' : '+ Suprimento (troco)'}</h3><label>Valor<input id="mv-v" type="number" min="0" step="0.01"></label><label>Motivo<input id="mv-m" placeholder="Ex: recolhimento / troco"></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="mv-ok">Confirmar</button></div>`);
    $('#mv-ok').onclick = async () => { try { await api.post(`/api/cash/${id}/move`, { tipo, valor: Number($('#mv-v').value), motivo: $('#mv-m').value }); closeModal(); toast('✓ Registrado!'); route(); } catch (e) { toast(e.message); } };
  };
  document.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => movCx(b.dataset.sg, 'sangria'));
  document.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => movCx(b.dataset.sp, 'suprimento'));
  try {
    const cf = await api.get('/api/finance/cashflow?days=30');
    const last = cf.slice(-14);
    const max = Math.max(1, ...last.flatMap(r => [r.recebido + r.a_receber, r.pago + r.a_pagar]));
    $('#cf-out').innerHTML = last.map(r => `<div style="display:flex;gap:6px;align-items:center;margin:3px 0"><small style="width:56px">${String(r.data || '').slice(5)}</small><div class="bar" style="flex:1" title="Recebido ${BRL(r.recebido)} + a receber ${BRL(r.a_receber)}"><i style="width:${Math.round((r.recebido + r.a_receber) / max * 100)}%;background:var(--ok)"></i></div><div class="bar" style="flex:1" title="Pago ${BRL(r.pago)} + a pagar ${BRL(r.a_pagar)}"><i style="width:${Math.round((r.pago + r.a_pagar) / max * 100)}%;background:var(--bad)"></i></div></div>`).join('') + '<p class="muted">Verde = entradas (realizado+previsto) · Vermelho = saídas</p>';
  } catch { $('#cf-out').textContent = 'Sem dados.'; }
  $('#cx-ofx').onclick = () => {
    modal(`<h3>🏦 Conciliação OFX</h3><p class="muted">Cole o conteúdo do arquivo .ofx do banco. O sistema lista os lançamentos e sugere baixas por valor+data.</p><label>Conteúdo OFX<textarea id="ofx-t" rows="6" placeholder="<OFX>..."></textarea></label><div class="row"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn ok" id="ofx-ok">Analisar</button></div><div id="ofx-out"></div>`);
    $('#ofx-ok').onclick = async () => {
      try {
        const j = await api.post('/api/finance/ofx', { content: $('#ofx-t').value });
        const match = (v, d) => {
          const all = [...pg.map(p => ({ ...p, k: 'pagar', id: p.id })), ...rc.map(p => ({ ...p, k: 'receber', id: p.id }))].filter(x => x.status === 'aberto' && Math.abs(Number(x.valor) - Math.abs(Number(v))) < 0.01);
          return all[0];
        };
        $('#ofx-out').innerHTML = `<p class="muted">${j.total} lançamentos:</p>` + j.data.slice(0, 30).map((t, i) => {
          const m = match(t.valor, t.data);
          return `<div style="display:flex;gap:6px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line)"><small style="flex:1">${t.data} · ${t.descricao} · <b>${BRL(t.valor)}</b>${m ? `<br><span class="tag t-ok">sugestão: ${m.descricao}</span>` : ''}</small>${m ? `<button class="btn sm ok" data-ofx="${i}">Baixar</button>` : ''}</div>`;
        }).join('');
        window._ofx = j.data;
        document.querySelectorAll('[data-ofx]').forEach(b => b.onclick = async () => {
          const t = window._ofx[b.dataset.ofx];
          const m = match(t.valor, t.data);
          if (!m) return;
          try {
            await api.post(m.k === 'pagar' ? `/api/finance/pagar/${m.id}/baixar` : `/api/finance/receber/${m.id}/baixar`);
            toast('✓ Baixado e conciliado!'); b.disabled = true;
          } catch (e) { toast(e.message); }
        });
      } catch (e) { toast(e.message); }
    };
  };
}
async function viewRelatorios(C) {
  setTitle('Relatórios', 'Filtráveis e exportáveis em CSV, Excel e PDF');
  const co = await api.get('/api/company').catch(() => ({}));
  const TNAMES = { estoque: 'Posição de estoque', vendas: 'Vendas', margens: 'Margens e lucros', perdas: 'Perdas', 'curva-abc': 'Curva ABC', giro: 'Giro de estoque', filiais: 'Movimento por filial', comissoes: 'Comissões' };
  C.innerHTML = `<div class="toolbar"><select id="r-t"><option value="estoque">Posição de estoque</option><option value="vendas">Vendas</option><option value="margens">Margens e lucros</option><option value="perdas">Perdas</option><option value="curva-abc">Curva ABC</option><option value="giro">Giro de estoque</option><option value="filiais">Movimento por filial</option><option value="comissoes">Comissões</option></select><button class="btn sm primary" id="r-go" title="Gerar relatório">Gerar</button><button class="btn sm ghost" id="r-csv" title="Exportar CSV">📊 CSV</button><button class="btn sm ghost" id="r-xls" title="Exportar Excel">📗 Excel</button><button class="btn sm ghost" id="r-pdf" title="Imprimir / salvar PDF formatado">🖨️ PDF</button></div><div id="r-out"></div>`;
  let last = [], lastTipo = 'estoque';
  $('#r-go').onclick = async () => {
    lastTipo = $('#r-t').value;
    try {
      const j = await api.get('/api/reports/' + lastTipo);
      last = Array.isArray(j) ? j : (j.data || []);
      if (j.pct !== undefined) toast(`Comissão ${j.pct}% sobre ${j.base}`);
    } catch (e) { toast(e.message); return; }
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
  <div class="row"><label>CSC ID (NFC-e)<input id="e-csc" value="${v('csc_id')}" title="Código de Segurança do Contribuinte (integração SEFAZ futura)"></label><label>CSC Token<input id="e-csct" value="${v('csc_token')}"></label><label>Ambiente SEFAZ<select id="e-sef"><option value="homologacao" ${e.sefaz_env !== 'producao' ? 'selected' : ''}>Homologação</option><option value="producao" ${e.sefaz_env === 'producao' ? 'selected' : ''}>Produção</option></select></label></div>
  <p class="muted">Emissão NFC-e/NF-e real (SEFAZ, SAT/MFE) no roadmap — campos acima preparam a integração.</p>
  <h3>Comissões e tabelas de preço</h3>
  <div class="row"><label>Comissão %<input id="e-cp" type="number" step="0.01" value="${e.commission_pct || 0}" title="Usada no relatório de comissões"></label><label>Base<select id="e-cb"><option value="faturamento" ${e.commission_base !== 'margem' ? 'selected' : ''}>Faturamento</option><option value="margem" ${e.commission_base === 'margem' ? 'selected' : ''}>Margem</option></select></label><label>Desconto máx sem alçada %<input id="e-dm" type="number" value="${e.discount_max_pct ?? 10}" title="Acima disso o PDV pede senha de gerente"></label></div>
  <div class="row"><label>Tabela 2 nome<input id="e-t2n" value="${v('pt2_name') || 'Atacado'}"></label><label>Multiplicador<input id="e-t2m" type="number" step="0.01" value="${e.pt2_mult ?? 1}" title="Ex: 0.9 = 10% abaixo do balcão"></label></div>
  <div class="row"><label>Tabela 3 nome<input id="e-t3n" value="${v('pt3_name') || 'Delivery'}"></label><label>Multiplicador<input id="e-t3m" type="number" step="0.01" value="${e.pt3_mult ?? 1}"></label></div>
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
        reorder_mode: $('#e-rm').value, segmento: $('#e-s').value,
        csc_id: $('#e-csc').value, csc_token: $('#e-csct').value, sefaz_env: $('#e-sef').value,
        commission_pct: Number($('#e-cp').value), commission_base: $('#e-cb').value, discount_max_pct: Number($('#e-dm').value),
        pt2_name: $('#e-t2n').value, pt2_mult: Number($('#e-t2m').value), pt3_name: $('#e-t3n').value, pt3_mult: Number($('#e-t3m').value)
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

function netUpd() {
  const el = $('#net-status');
  if (!el) return;
  const on = navigator.onLine;
  el.textContent = on ? '🟢 Online' : '🔴 OFFLINE';
  el.classList.toggle('off', !on);
}
window.addEventListener('online', () => { netUpd(); toast('🟢 Internet de volta: sincronizando...'); });
window.addEventListener('offline', netUpd);
setInterval(netUpd, 30000);
netUpd();

boot();
