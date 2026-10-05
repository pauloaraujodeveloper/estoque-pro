/* ============================================================
   EstoquePro — Frontend v2.0
   SPA modular com Design System próprio
   ============================================================ */

// ---------- Estado Global ---
const state = {
  user: null,
  token: localStorage.getItem('token') || null,
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
  currentRoute: '#/dashboard',
  products: [],
  customers: [],
  categories: [],
  cart: [],
  payments: [{ method: 'dinheiro', amount: 0 }],
  pdvCache: null,
  offlineMode: false,
  commandPaletteOpen: false,
  searchQuery: '',
};

// ---------- API Client ---
const api = {
  async req(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

    const actingCid = sessionStorage.getItem('cid');
    if (actingCid) headers['x-company-id'] = actingCid;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Servidor indisponível. Verifique sua conexão.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro na operação');
    return data;
  },
  get: (url) => api.req('GET', url),
  post: (url, body) => api.req('POST', url, body),
  put: (url, body) => api.req('PUT', url, body),
  delete: (url) => api.req('DELETE', url),
};

// ---------- Utilities ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const BRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('pt-BR') : '-';
const truncate = (str, len = 50) => str ? (str.length > len ? str.slice(0, len) + '...' : str) : '';

const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_credito: 'Crédito',
  cartao_debito: 'Débito',
  fiado: 'Fiado',
  multi: 'Múltiplo',
  cortesia: 'Cortesia',
};

const STATUS_LABELS = {
  finalizada: 'Concluída',
  aguardando_pagamento: 'Aguardando pagamento',
  cancelada: 'Cancelada',
  aberto: 'Aberto',
  recebido: 'Recebido',
  pago: 'Pago',
  parcial: 'Parcial',
};

const ROLE_LABELS = {
  admin: 'Administrador',
  gerente: 'Gerente',
  vendedor: 'Vendedor',
  estoquista: 'Estoquista',
  superadmin: 'Super Admin',
};

// ---------- Toast System ---
function toast(message, type = 'info', duration = 3500) {
  const container = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(24px)';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ---------- Modal System ---
function modal(html) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal">${html}</div>
    </div>
  `;
}

function closeModal() {
  $('#modal-root').innerHTML = '';
}

function confirmDialog(message, onConfirm) {
  modal(`
    <div class="modal-header">
      <h3 class="modal-title">Confirmar ação</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <p>${message}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="confirm-ok">Confirmar</button>
    </div>
  `);
  $('#confirm-ok').onclick = () => { closeModal(); onConfirm(); };
}

// ---------- Loading State ---
function showLoading(container) {
  container.innerHTML = `
    <div class="grid grid-4">
      ${Array(4).fill('<div class="card card-padded"><div class="skeleton" style="height:20px;width:60%"></div><div class="skeleton" style="height:32px;width:80%;margin-top:12px"></div></div>').join('')}
    </div>
  `;
}

function showError(container, message, onRetry) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">⚠</div>
      <div class="empty-state-title">Erro ao carregar</div>
      <div class="empty-state-description">${message}</div>
      ${onRetry ? '<button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">Tentar novamente</button>' : ''}
    </div>
  `;
}

function showEmpty(container, title, description, actionText, actionFn) {
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📦</div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-description">${description}</div>
      ${actionText ? `<button class="btn btn-primary" style="margin-top:16px" id="empty-action">${actionText}</button>` : ''}
    </div>
  `;
  if (actionText) $('#empty-action').onclick = actionFn;
}

// ---------- Auth Module ---
async function initAuth() {
  if (!state.token) {
    $('#auth-view').classList.remove('hidden');
    return;
  }
  try {
    const res = await api.get('/api/me');
    state.user = res.user;
    showApp();
  } catch {
    localStorage.removeItem('token');
    state.token = null;
    $('#auth-view').classList.remove('hidden');
  }
}

function showApp() {
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  updateUserInfo();
  buildSidebar();
  navigate();
}

function updateUserInfo() {
  if (!state.user) return;
  $('#co-name').textContent = state.user.company_nome || 'EstoquePro';
  $('#co-seg').textContent = state.user.company_segmento || state.user.role;
  $('#user-name').textContent = state.user.name;
  $('#user-role').textContent = ROLE_LABELS[state.user.role] || state.user.role;
  $('#user-avatar').textContent = state.user.name.charAt(0).toUpperCase();
}

// ---------- Sidebar Module ---
const MENU_CONFIG = {
  superadmin: [
    { section: 'SaaS', items: [
      { label: 'Painel SaaS', route: '#/saas', icon: '🏢' },
      { label: 'Usuários', route: '#/usuarios', icon: '👥' },
    ]},
  ],
  admin: [
    { section: 'Principal', items: [
      { label: 'Dashboard', route: '#/dashboard', icon: '📊' },
      { label: 'Alertas', route: '#/alertas', icon: '🔔' },
    ]},
    { section: 'Operação', items: [
      { label: 'PDV / Vendas', route: '#/pdv', icon: '🛒' },
      { label: 'Vendas', route: '#/vendas', icon: '📋' },
      { label: 'Orçamentos', route: '#/orc', icon: '📝' },
      { label: 'Financeiro', route: '#/financeiro', icon: '💰' },
    ]},
    { section: 'Estoque', items: [
      { label: 'Produtos', route: '#/produtos', icon: '📦' },
      { label: 'Movimentações', route: '#/estoque', icon: '🔄' },
      { label: 'Lotes', route: '#/lotes', icon: '📅' },
      { label: 'Transferências', route: '#/transf', icon: '🚚' },
      { label: 'Compras', route: '#/compras', icon: '🛍' },
    ]},
    { section: 'Cadastros', items: [
      { label: 'Clientes', route: '#/clientes', icon: '👤' },
      { label: 'Fornecedores', route: '#/fornecedores', icon: '🏭' },
      { label: 'Ficha técnica', route: '#/fichas', icon: '📖' },
    ]},
    { section: 'Gestão', items: [
      { label: 'Relatórios', route: '#/relatorios', icon: '📈' },
      { label: 'Segmento', route: '#/segmento', icon: '⚙' },
      { label: 'Usuários', route: '#/usuarios', icon: '👥' },
      { label: 'Empresa', route: '#/empresa', icon: '🏢' },
      { label: 'Auditoria', route: '#/auditoria', icon: '🔍' },
    ]},
  ],
  gerente: [
    { section: 'Principal', items: [
      { label: 'Dashboard', route: '#/dashboard', icon: '📊' },
      { label: 'PDV / Vendas', route: '#/pdv', icon: '🛒' },
      { label: 'Orçamentos', route: '#/orc', icon: '📝' },
      { label: 'Produtos', route: '#/produtos', icon: '📦' },
      { label: 'Movimentações', route: '#/estoque', icon: '🔄' },
      { label: 'Compras', route: '#/compras', icon: '🛍' },
      { label: 'Transferências', route: '#/transf', icon: '🚚' },
      { label: 'Clientes', route: '#/clientes', icon: '👤' },
      { label: 'Financeiro', route: '#/financeiro', icon: '💰' },
      { label: 'Relatórios', route: '#/relatorios', icon: '📈' },
    ]},
  ],
  vendedor: [
    { section: 'Vendas', items: [
      { label: 'PDV / Vendas', route: '#/pdv', icon: '🛒' },
      { label: 'Orçamentos', route: '#/orc', icon: '📝' },
      { label: 'Produtos', route: '#/produtos', icon: '📦' },
      { label: 'Clientes', route: '#/clientes', icon: '👤' },
    ]},
  ],
  estoquista: [
    { section: 'Estoque', items: [
      { label: 'Dashboard', route: '#/dashboard', icon: '📊' },
      { label: 'Produtos', route: '#/produtos', icon: '📦' },
      { label: 'Movimentações', route: '#/estoque', icon: '🔄' },
      { label: 'Lotes', route: '#/lotes', icon: '📅' },
      { label: 'Transferências', route: '#/transf', icon: '🚚' },
      { label: 'Compras', route: '#/compras', icon: '🛍' },
    ]},
  ],
};

function buildSidebar() {
  const role = state.user?.role || 'admin';
  const menu = MENU_CONFIG[role] || MENU_CONFIG.admin;
  const nav = $('#sidebar-nav');

  nav.innerHTML = menu.map(group => `
    <div class="sidebar-section">
      <div class="sidebar-section-title sidebar-label">${group.section}</div>
      ${group.items.map(item => `
        <a href="${item.route}" class="sidebar-link" data-route="${item.route}">
          <span class="sidebar-link-icon">${item.icon}</span>
          <span class="sidebar-link-label sidebar-label">${item.label}</span>
        </a>
      `).join('')}
    </div>
  `).join('');

  if (state.sidebarCollapsed) {
    $('#sidebar').classList.add('collapsed');
  }
}

// ---------- Navigation Module ---
function navigate() {
  const hash = location.hash || '#/dashboard';
  state.currentRoute = hash;

  $$('.sidebar-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === hash);
  });

  const content = $('#content');
  showLoading(content);

  const routeMap = {
    '#/dashboard': renderDashboard,
    '#/produtos': renderProdutos,
    '#/estoque': renderEstoque,
    '#/compras': renderCompras,
    '#/pdv': renderPDV,
    '#/vendas': renderVendas,
    '#/orc': renderOrcamentos,
    '#/clientes': renderClientes,
    '#/fornecedores': renderFornecedores,
    '#/fichas': renderFichas,
    '#/lotes': renderLotes,
    '#/transf': renderTransferencias,
    '#/financeiro': renderFinanceiro,
    '#/relatorios': renderRelatorios,
    '#/segmento': renderSegmento,
    '#/usuarios': renderUsuarios,
    '#/empresa': renderEmpresa,
    '#/auditoria': renderAuditoria,
    '#/alertas': renderAlertas,
    '#/saas': renderSaaS,
  };

  const handler = routeMap[hash];
  if (handler) {
    handler(content).catch(err => showError(content, err.message));
  } else {
    content.innerHTML = '<div class="empty-state"><div class="empty-state-title">Página não encontrada</div></div>';
  }
}

function setPageTitle(title, subtitle = '') {
  $('#page-title').textContent = title;
  $('#page-subtitle').textContent = subtitle;
}

// ---------- Dashboard Module ----------
async function renderDashboard(container) {
  setPageTitle('Dashboard', 'Visão geral da sua empresa');

  if (state.user.role === 'superadmin' && !sessionStorage.getItem('cid')) {
    location.hash = '#/saas';
    return;
  }

  const data = await api.get('/api/dashboard');
  const maxTicket = Math.max(1, ...data.ticket.map(t => t.t));

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Vendas hoje</span>
          <div class="stat-card-icon success">💰</div>
        </div>
        <div class="stat-card-value">${data.vendasHoje.n}</div>
        <div class="stat-card-change">${BRL(data.vendasHoje.t)}</div>
      </div>
      ${state.user.role !== 'vendedor' ? `
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Lucro total</span>
          <div class="stat-card-icon primary">📈</div>
        </div>
        <div class="stat-card-value">${BRL(data.lucro)}</div>
        <div class="stat-card-change">Margem ${data.margem}%</div>
      </div>` : ''}
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Faturamento</span>
          <div class="stat-card-icon primary">💵</div>
        </div>
        <div class="stat-card-value">${BRL(data.receita)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Ticket médio</span>
          <div class="stat-card-icon warning">🎯</div>
        </div>
        <div class="stat-card-value">${BRL(data.ticketMedio)}</div>
        <div class="stat-card-change">${data.vendasQtd || 0} vendas</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <span class="stat-card-label">Estoque baixo</span>
          <div class="stat-card-icon danger">⚠</div>
        </div>
        <div class="stat-card-value">${data.estoqueBaixo.length}</div>
        <div class="stat-card-change">${data.estoqueBaixo.slice(0, 2).map(p => p.nome).join(', ') || 'Tudo OK'}</div>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card card-padded">
        <h3 style="margin-bottom:16px">Vendas últimos 7 dias</h3>
        ${data.ticket.map(t => `
          <div style="display:flex;align-items:center;gap:12px;margin:8px 0">
            <span style="width:60px;font-size:12px;color:var(--c-text-muted)">${t.d.slice(5)}</span>
            <div class="progress" style="flex:1">
              <div class="progress-bar" style="width:${Math.round(t.t / maxTicket * 100)}%"></div>
            </div>
            <span style="font-size:12px;font-weight:600">${BRL(t.t)}</span>
          </div>
        `).join('') || '<p class="text-muted">Sem vendas ainda.</p>'}
      </div>
      <div class="card card-padded">
        <h3 style="margin-bottom:16px">Mais vendidos</h3>
        ${data.topVendidos.map(p => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)">
            <span>${p.nome}</span>
            <span style="font-weight:600">${p.q} un · ${BRL(p.t)}</span>
          </div>
        `).join('') || '<p class="text-muted">Nenhum produto vendido.</p>'}
        <h3 style="margin:20px 0 12px">Estoque crítico</h3>
        ${data.estoqueBaixo.map(p => `
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)">
            <span>${p.nome}</span>
            <span class="tag tag-warning">${p.estoque_atual}/${p.estoque_min}</span>
          </div>
        `).join('') || '<p class="text-muted">Tudo abastecido</p>'}
      </div>
    </div>
  `;
}

// ---------- Produtos Module ----------
async function renderProdutos(container) {
  setPageTitle('Produtos', 'Cadastro, custo, preço e margem');

  const [cats, productsRes] = await Promise.all([
    api.get('/api/categories'),
    api.get('/api/products?limit=100'),
  ]);

  state.categories = cats;
  state.products = productsRes.data;
  const canCost = state.user.role !== 'vendedor';
  const canEdit = ['admin', 'gerente'].includes(state.user.role);

  container.innerHTML = `
    <div class="toolbar">
      <div class="toolbar-search">
        <svg class="toolbar-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" id="search-prod" class="input" placeholder="Buscar produto...">
      </div>
      <select id="filter-cat" class="select" style="width:auto">
        <option value="">Todas categorias</option>
        ${cats.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
      </select>
      <button class="btn btn-secondary" id="btn-export">Exportar CSV</button>
      ${canEdit ? '<button class="btn btn-primary" id="btn-new-prod">+ Novo produto</button>' : ''}
    </div>
    <div class="table-container">
      <table class="table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Estoque</th>
            ${canCost ? '<th>Custo</th><th>Preço</th><th>Margem</th>' : '<th>Preço</th>'}
            <th></th>
          </tr>
        </thead>
        <tbody id="prod-tbody"></tbody>
      </table>
    </div>
    <p id="prod-empty" class="text-muted" style="margin-top:12px"></p>
  `;

  function drawProducts() {
    const q = ($('#search-prod')?.value || '').toLowerCase();
    const fc = $('#filter-cat')?.value || '';
    const rows = state.products.filter(p =>
      (!q || p.nome.toLowerCase().includes(q)) &&
      (!fc || String(p.categoria_id) === fc)
    );

    $('#prod-tbody').innerHTML = rows.map(p => `
      <tr>
        <td>
          <strong>${p.nome}</strong><br>
          <small class="text-muted">${p.categoria || ''} · ${p.sku || ''} ${p.estoque_atual <= p.estoque_min ? '<span class="tag tag-warning">baixo</span>' : ''}</small>
        </td>
        <td>${p.estoque_atual}</td>
        ${canCost ? `<td>${BRL(p.custo_medio)}</td><td>${BRL(p.preco_venda)}</td><td>${p.margem}%</td>` : `<td>${BRL(p.preco_venda)}</td>`}
        <td>
          <button class="btn btn-ghost btn-sm" data-view="${p.id}">Ver</button>
          ${canEdit ? `<button class="btn btn-ghost btn-sm" data-edit="${p.id}">Editar</button>` : ''}
        </td>
      </tr>
    `).join('');

    $('#prod-empty').textContent = rows.length ? '' : 'Nenhum produto encontrado.';

    $$('#prod-tbody [data-view]').forEach(b => b.onclick = () => viewProduct(b.dataset.view));
    $$('#prod-tbody [data-edit]').forEach(b => b.onclick = () => formProduct(b.dataset.edit));
  }

  $('#search-prod').oninput = drawProducts;
  $('#filter-cat').onchange = drawProducts;
  $('#btn-export').onclick = () => exportCSV('produtos.csv', state.products);
  if (canEdit) $('#btn-new-prod').onclick = () => formProduct(null);

  drawProducts();
}

async function viewProduct(id) {
  const p = await api.get('/api/products/' + id);
  const canCost = state.user.role !== 'vendedor';

  modal(`
    <div class="modal-header">
      <h3 class="modal-title">${p.nome}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <p class="text-muted">${p.categoria || ''} · Estoque ${p.estoque_atual} (mín ${p.estoque_min}) · Local: ${p.localizacao || '-'}</p>
      ${canCost ? `<p>Custo ${BRL(p.custo_medio)} · Preço ${BRL(p.preco_venda)} · Margem ${p.margem}% · Markup ${p.markup}% · Lucro ${BRL(p.lucro)}</p>` : `<p>Preço ${BRL(p.preco_venda)}</p>`}
      <h4 style="margin-top:20px">Kardex (últimas)</h4>
      ${(p.kardex || []).slice(0, 10).map(k => `
        <small style="display:block;padding:4px 0">${k.created_at} · ${k.tipo} · ${k.qtd} (${k.estoque_antes}→${k.estoque_depois})</small>
      `).join('') || '<p class="text-muted">Sem movimentações.</p>'}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Fechar</button>
    </div>
  `);
}

async function formProduct(id) {
  const cats = await api.get('/api/categories');
  const units = await api.get('/api/units');
  const p = id ? await api.get('/api/products/' + id) : { nome: '', preco_venda: 0, custo_medio: 0, estoque_atual: 0, estoque_min: 0 };

  modal(`
    <div class="modal-header">
      <h3 class="modal-title">${id ? 'Editar' : 'Novo'} produto</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label>Nome*</label>
          <input type="text" id="f-nome" class="input" value="${p.nome || ''}">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label>Custo</label>
            <input type="number" id="f-custo" class="input" step="0.01" value="${p.custo_medio || 0}">
          </div>
          <div>
            <label>Preço</label>
            <input type="number" id="f-preco" class="input" step="0.01" value="${p.preco_venda || 0}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label>Categoria</label>
            <select id="f-cat" class="select">
              <option value="">—</option>
              ${cats.map(c => `<option value="${c.id}" ${p.categoria_id == c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Unidade</label>
            <select id="f-un" class="select">
              ${units.map(u => `<option value="${u.id}" ${p.unidade_id == u.id ? 'selected' : ''}>${u.sigla}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label>Estoque atual</label>
            <input type="number" id="f-est" class="input" step="0.01" value="${p.estoque_atual || 0}">
          </div>
          <div>
            <label>Estoque mínimo</label>
            <input type="number" id="f-min" class="input" step="0.01" value="${p.estoque_min || 0}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label>Código barras</label>
            <input type="text" id="f-cb" class="input" value="${p.codigo_barras || ''}">
          </div>
          <div>
            <label>Tipo</label>
            <select id="f-tipo" class="select">
              <option value="revenda" ${p.tipo === 'revenda' ? 'selected' : ''}>Revenda</option>
              <option value="insumo" ${p.tipo === 'insumo' ? 'selected' : ''}>Insumo</option>
              <option value="acabado" ${p.tipo === 'acabado' ? 'selected' : ''}>Acabado</option>
              <option value="servico" ${p.tipo === 'servico' ? 'selected' : ''}>Serviço</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-prod">Salvar</button>
    </div>
  `);

  $('#btn-save-prod').onclick = async () => {
    const body = {
      nome: $('#f-nome').value.trim(),
      custo_medio: Number($('#f-custo').value),
      preco_venda: Number($('#f-preco').value),
      categoria_id: $('#f-cat').value || null,
      unidade_id: $('#f-un').value || null,
      estoque_atual: Number($('#f-est').value),
      estoque_min: Number($('#f-min').value),
      ponto_reposicao: Number($('#f-min').value),
      codigo_barras: $('#f-cb').value,
      tipo: $('#f-tipo').value,
    };
    if (!body.nome) return toast('Nome obrigatório', 'error');
    try {
      if (id) await api.put('/api/products/' + id, body);
      else await api.post('/api/products', body);
      closeModal();
      toast('Produto salvo!', 'success');
      navigate();
    } catch (e) {
      toast(e.message, 'error');
    }
  };
}

// ---------- Estoque Module ----------
async function renderEstoque(container) {
  setPageTitle('Movimentações', 'Entradas, saídas, ajustes, perdas e inventário');

  const [inv, movs] = await Promise.all([
    api.get('/api/inventory'),
    api.get('/api/movements?limit=50'),
  ]);

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-success" id="m-in">+ Entrada</button>
      <button class="btn btn-danger" id="m-out">− Saída / Perda</button>
      <button class="btn btn-secondary" id="m-inv">Inventário</button>
    </div>
    <div class="grid grid-2">
      <div class="table-container">
        <table class="table">
          <thead><tr><th>Produto</th><th>Est.</th><th>Mín</th></tr></thead>
          <tbody>
            ${inv.map(p => `
              <tr>
                <td>${p.nome}</td>
                <td>${p.estoque_atual} ${p.estoque_atual <= p.estoque_min ? '<span class="tag tag-warning">baixo</span>' : ''}</td>
                <td>${p.estoque_min}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="card card-padded">
        <h3 style="margin-bottom:16px">Últimas movimentações (Kardex)</h3>
        ${movs.map(m => `
          <small style="display:block;padding:6px 0;border-bottom:1px solid var(--c-border-light)">
            ${m.created_at} · <strong>${m.produto}</strong> · ${m.tipo} ${m.qtd}
            <span class="text-muted">(${m.user_name || ''}) ${m.motivo || ''}</span>
          </small>
        `).join('') || '<p class="text-muted">Sem movimentos.</p>'}
      </div>
    </div>
  `;

  $('#m-in').onclick = () => movementForm('entrada', inv);
  $('#m-out').onclick = () => movementForm('saida', inv);
  $('#m-inv').onclick = () => {
    modal(`
      <div class="modal-header">
        <h3 class="modal-title">Inventário</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div>
            <label>Produto</label>
            <select id="i-p" class="select">
              ${inv.map(p => `<option value="${p.id}">${p.nome} (sistema: ${p.estoque_atual})</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Contagem física</label>
            <input type="number" id="i-f" class="input" step="0.01">
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="i-ok">Ajustar</button>
      </div>
    `);
    $('#i-ok').onclick = async () => {
      try {
        const j = await api.post('/api/inventory/count', { product_id: $('#i-p').value, fisico: Number($('#i-f').value) });
        closeModal();
        toast('Estoque atualizado. Divergência: ' + j.divergencia, 'success');
        navigate();
      } catch (e) { toast(e.message, 'error'); }
    };
  };
}

function movementForm(tipo0, inv) {
  modal(`
    <div class="modal-header">
      <h3 class="modal-title">${tipo0 === 'entrada' ? 'Entrada' : 'Saída / Perda'}</h3>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;flex-direction:column;gap:16px">
        <div>
          <label>Produto</label>
          <select id="mv-p" class="select">
            ${inv.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')}
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label>Tipo</label>
            <select id="mv-t" class="select">
              ${tipo0 === 'entrada'
                ? '<option>entrada</option><option>compra</option><option>bonificacao</option>'
                : '<option>saida</option><option>perda</option><option>ajuste</option>'}
            </select>
          </div>
          <div>
            <label>Qtd</label>
            <input type="number" id="mv-q" class="input" step="0.01" value="1">
          </div>
        </div>
        <div>
          <label>Motivo${tipo0 !== 'entrada' ? ' (obrigatório p/ perda)' : ''}</label>
          <input type="text" id="mv-m" class="input" placeholder="Ex: compra, quebra, vencimento">
        </div>
        <div>
          <label>Custo unit (p/ entrada)</label>
          <input type="number" id="mv-c" class="input" step="0.01" value="0">
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="mv-ok">Confirmar</button>
    </div>
  `);
  $('#mv-ok').onclick = async () => {
    try {
      await api.post('/api/inventory/movement', {
        product_id: $('#mv-p').value,
        tipo: $('#mv-t').value,
        qtd: Number($('#mv-q').value),
        motivo: $('#mv-m').value,
        custo_unit: Number($('#mv-c').value),
      });
      closeModal();
      toast('Estoque atualizado.', 'success');
      navigate();
    } catch (e) { toast(e.message, 'error'); }
  };
}

// ---------- PDV Module ----------
async function renderPDV(container) {
  setPageTitle('PDV', 'Venda rápida com multi-pagamento');

  let prods = [], clis = [], cats = [], cfg = {};
  try {
    const [pRes, cRes, catRes, cfgRes] = await Promise.all([
      api.get('/api/products?limit=100'),
      api.get('/api/customers'),
      api.get('/api/categories').catch(() => []),
      api.get('/api/company').catch(() => ({})),
    ]);
    prods = pRes.data.filter(p => p.status === 'ativo');
    clis = cRes;
    cats = catRes;
    cfg = cfgRes;
    state.pdvCache = { prods, clis, ts: Date.now() };
    localStorage.setItem('pdv_cache', JSON.stringify(state.pdvCache));
  } catch (e) {
    try {
      const c = JSON.parse(localStorage.getItem('pdv_cache') || '{}');
      prods = c.prods || [];
      clis = c.clis || [];
      state.offlineMode = true;
    } catch {}
    if (!prods.length) throw e;
  }

  let abertos = [];
  try { abertos = (await api.get('/api/cash')).filter(c => c.status === 'aberto'); } catch {}

  container.innerHTML = `
    <div class="pdv-layout">
      <div class="pdv-products">
        <div class="pdv-search">
          <div class="pdv-search-row">
            <input type="number" id="pdv-qty" class="input" style="width:80px" value="1" min="0" step="any" title="Quantidade">
            <div style="flex:1;position:relative">
              <svg style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--c-text-muted)" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input type="text" id="pdv-code" class="pdv-search-input" placeholder="Bipar código ou digitar + Enter" autocomplete="off">
            </div>
          </div>
        </div>
        <div class="pdv-categories" id="pdv-cats"></div>
        <div class="pdv-products-grid" id="pdv-grid"></div>
      </div>
      <div class="pdv-cart">
        <div class="pdv-cart-header">
          <span class="pdv-cart-title">Carrinho</span>
          <span id="cart-count" class="text-muted"></span>
        </div>
        <div class="pdv-cart-items" id="cart-items"></div>
        <div class="pdv-cart-footer">
          <div class="pdv-cart-total">
            <span class="pdv-cart-total-label">Total</span>
            <span class="pdv-cart-total-value" id="cart-total">R$ 0,00</span>
          </div>
          <div class="pdv-payment-methods">
            <button class="pdv-payment-btn dinheiro active" data-pay="dinheiro">Dinheiro</button>
            <button class="pdv-payment-btn pix" data-pay="pix">Pix</button>
            <button class="pdv-payment-btn cartao_credito" data-pay="cartao_credito">Crédito</button>
            <button class="pdv-payment-btn cartao_debito" data-pay="cartao_debito">Débito</button>
            <button class="pdv-payment-btn fiado" data-pay="fiado">Fiado</button>
          </div>
          <button class="pdv-finalize-btn" id="btn-finalize">Finalizar venda</button>
        </div>
      </div>
    </div>
  `;

  let catSel = '';
  let currentPayment = 'dinheiro';

  function drawCats() {
    $('#pdv-cats').innerHTML = `
      <button class="pdv-category-chip ${!catSel ? 'active' : ''}" data-cat="">Todas</button>
      ${cats.map(c => `<button class="pdv-category-chip ${String(c.id) === catSel ? 'active' : ''}" data-cat="${c.id}">${c.nome}</button>`).join('')}
    `;
    $$('#pdv-cats [data-cat]').forEach(b => b.onclick = () => { catSel = b.dataset.cat; drawCats(); drawGrid(); });
  }

  function drawGrid() {
    const q = ($('#pdv-code')?.value || '').toLowerCase();
    const rows = prods.filter(p =>
      (!q || p.nome.toLowerCase().includes(q)) &&
      (!catSel || String(p.categoria_id) === catSel)
    ).slice(0, 60);

    $('#pdv-grid').innerHTML = rows.map(p => `
      <button class="pdv-product-card" data-add="${p.id}">
        <span class="pdv-product-name">${p.nome}</span>
        <span class="pdv-product-price">${BRL(p.preco_venda)}</span>
        <span class="pdv-product-stock">est ${p.estoque_atual}</span>
      </button>
    `).join('') || '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:40px">Nenhum produto encontrado.</p>';

    $$('#pdv-grid [data-add]').forEach(b => b.onclick = () => addToCart(b.dataset.add));
  }

  function addToCart(productId) {
    const p = prods.find(x => x.id == productId);
    if (!p) return;
    const qty = Number($('#pdv-qty').value) || 1;
    const existing = state.cart.find(i => i.product_id == productId);
    if (existing) existing.qtd += qty;
    else state.cart.push({ product_id: p.id, nome: p.nome, qtd: qty, preco_unit: p.preco_venda });
    drawCart();
  }

  function drawCart() {
    $('#cart-items').innerHTML = state.cart.map((item, idx) => `
      <div class="pdv-cart-item">
        <div class="pdv-cart-item-qty">
          <button data-dec="${idx}">−</button>
          <input type="number" data-qty="${idx}" value="${item.qtd}" min="0" step="any">
          <button data-inc="${idx}">+</button>
        </div>
        <div class="pdv-cart-item-info">
          <div class="pdv-cart-item-name">${item.nome}</div>
          <div class="pdv-cart-item-price">${BRL(item.preco_unit)} un</div>
        </div>
        <span class="pdv-cart-item-total">${BRL(item.qtd * item.preco_unit)}</span>
        <button class="pdv-cart-item-remove" data-remove="${idx}">×</button>
      </div>
    `).join('') || '<p class="text-muted" style="text-align:center;padding:20px">Carrinho vazio</p>';

    const total = state.cart.reduce((s, i) => s + i.qtd * i.preco_unit, 0);
    $('#cart-total').textContent = BRL(total);
    $('#cart-count').textContent = state.cart.length ? `${state.cart.length} itens` : '';

    $$('#cart-items [data-inc]').forEach(b => b.onclick = () => { state.cart[b.dataset.inc].qtd++; drawCart(); });
    $$('#cart-items [data-dec]').forEach(b => b.onclick = () => { const i = state.cart[b.dataset.dec]; i.qtd--; if (i.qtd <= 0) state.cart.splice(b.dataset.dec, 1); drawCart(); });
    $$('#cart-items [data-remove]').forEach(b => b.onclick = () => { state.cart.splice(b.dataset.remove, 1); drawCart(); });
    $$('#cart-items [data-qty]').forEach(inp => inp.onchange = () => { const v = Number(inp.value); if (v > 0) state.cart[inp.dataset.qty].qtd = v; else state.cart.splice(inp.dataset.qty, 1); drawCart(); });
  }

  $$('.pdv-payment-btn').forEach(b => b.onclick = () => {
    $$('.pdv-payment-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    currentPayment = b.dataset.pay;
  });

  $('#pdv-code').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.target.value.trim();
    const p = prods.find(x => [x.codigo_barras, x.sku, x.codigo_interno].some(v => v && String(v) === code));
    if (p) addToCart(p.id);
    else toast('Produto não encontrado', 'error');
    e.target.value = '';
    e.target.focus();
  });

  $('#btn-finalize').onclick = async () => {
    if (!state.cart.length) return toast('Carrinho vazio', 'warning');
    const total = state.cart.reduce((s, i) => s + i.qtd * i.preco_unit, 0);
    const payload = {
      items: state.cart,
      payments: [{ method: currentPayment, amount: total }],
      caixa_id: abertos[0]?.id || null,
      operator_name: state.user.name,
    };
    try {
      const res = await api.post('/api/sales', payload);
      toast(`Venda #${res.id} finalizada!`, 'success');
      state.cart = [];
      drawCart();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  drawCats();
  drawGrid();
  drawCart();

  setTimeout(() => $('#pdv-code')?.focus(), 150);
}

// ---------- Outros Módulos (simplificados) ----------
async function renderVendas(container) {
  setPageTitle('Vendas', 'Histórico de vendas');
  const sales = await api.get('/api/sales');
  const can = ['admin', 'gerente', 'superadmin'].includes(state.user.role);

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-secondary" id="v-csv">Exportar CSV</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Cód</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${sales.map(v => `
            <tr>
              <td><strong>#${v.id}</strong><br><small class="text-muted">${formatDate(v.created_at)}</small></td>
              <td>${v.cliente || 'Balcão'}</td>
              <td>${BRL(v.total)}</td>
              <td>${PAYMENT_LABELS[v.pagamento] || v.pagamento}</td>
              <td><span class="tag ${v.status === 'finalizada' ? 'tag-success' : v.status === 'cancelada' ? 'tag-danger' : 'tag-warning'}">${STATUS_LABELS[v.status] || v.status}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm" data-view="${v.id}">Ver</button>
                ${v.status !== 'cancelada' && can ? `<button class="btn btn-ghost btn-sm" data-cancel="${v.id}">Cancelar</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  $$('[data-view]').forEach(b => b.onclick = async () => {
    const s = await api.get('/api/sales/' + b.dataset.view);
    modal(`
      <div class="modal-header"><h3 class="modal-title">Venda #${s.id}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <p>Cliente: ${s.cliente || 'Balcão'} · Total: ${BRL(s.total)} · Status: ${STATUS_LABELS[s.status] || s.status}</p>
        <h4 style="margin-top:16px">Itens</h4>
        ${s.itens.map(i => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)"><span>${i.qtd}x ${i.nome}</span><span>${BRL(i.qtd * i.preco_unit)}</span></div>`).join('')}
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
    `);
  });

  $$('[data-cancel]').forEach(b => b.onclick = () => confirmDialog('Cancelar esta venda?', async () => {
    await api.post(`/api/sales/${b.dataset.cancel}/cancel`);
    toast('Venda cancelada', 'success');
    navigate();
  }));
}

async function renderClientes(container) {
  setPageTitle('Clientes', 'Cadastro e fiado');
  const clientes = await api.get('/api/customers');

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="btn-new-cli">+ Novo cliente</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Nome</th><th>Telefone</th><th>Limite fiado</th><th></th></tr></thead>
        <tbody>
          ${clientes.map(c => `
            <tr>
              <td>${c.nome}</td>
              <td>${c.tel || ''}</td>
              <td>${BRL(c.limite_fiado)}</td>
              <td><button class="btn btn-ghost btn-sm" data-hist="${c.id}">Histórico</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  $$('[data-hist]').forEach(b => b.onclick = async () => {
    const c = await api.get('/api/customers/' + b.dataset.hist);
    modal(`
      <div class="modal-header"><h3 class="modal-title">${c.nome}</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <p class="text-muted">${c.tel || ''} · Compras: ${c.compras?.length || 0} · Ticket médio: ${BRL(c.ticket_medio)} · Fiado: ${BRL(c.fiado_aberto)}</p>
      </div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
    `);
  });

  $('#btn-new-cli').onclick = () => {
    modal(`
      <div class="modal-header"><h3 class="modal-title">Novo cliente</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div><label>Nome*</label><input type="text" id="cli-nome" class="input"></div>
          <div><label>Telefone</label><input type="text" id="cli-tel" class="input"></div>
          <div><label>Limite fiado</label><input type="number" id="cli-limite" class="input" value="0"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="cli-save">Salvar</button>
      </div>
    `);
    $('#cli-save').onclick = async () => {
      try {
        await api.post('/api/customers', { nome: $('#cli-nome').value, tel: $('#cli-tel').value, limite_fiado: Number($('#cli-limite').value) });
        closeModal();
        toast('Cliente salvo!', 'success');
        navigate();
      } catch (e) { toast(e.message, 'error'); }
    };
  };
}

async function renderFornecedores(container) {
  setPageTitle('Fornecedores', 'Cadastro e condições');
  const forns = await api.get('/api/suppliers');

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="btn-new-forn">+ Novo fornecedor</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Nome</th><th>Telefone</th><th>Doc</th></tr></thead>
        <tbody>
          ${forns.map(f => `<tr><td>${f.fantasia || f.razao}</td><td>${f.tel || ''}</td><td>${f.doc || ''}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  $('#btn-new-forn').onclick = () => {
    modal(`
      <div class="modal-header"><h3 class="modal-title">Novo fornecedor</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div style="display:flex;flex-direction:column;gap:16px">
          <div><label>Nome fantasia</label><input type="text" id="forn-nome" class="input"></div>
          <div><label>Telefone</label><input type="text" id="forn-tel" class="input"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="forn-save">Salvar</button>
      </div>
    `);
    $('#forn-save').onclick = async () => {
      try {
        await api.post('/api/suppliers', { fantasia: $('#forn-nome').value, tel: $('#forn-tel').value });
        closeModal();
        toast('Fornecedor salvo!', 'success');
        navigate();
      } catch (e) { toast(e.message, 'error'); }
    };
  };
}

async function renderFinanceiro(container) {
  setPageTitle('Financeiro', 'Contas, fluxo de caixa e DRE');
  const summary = await api.get('/api/finance/summary');
  const dre = ['admin', 'gerente'].includes(state.user.role) ? await api.get('/api/finance/dre') : null;

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-card-header"><span class="stat-card-label">A pagar</span><div class="stat-card-icon danger">💸</div></div>
        <div class="stat-card-value">${BRL(summary.aPagar)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header"><span class="stat-card-label">A receber</span><div class="stat-card-icon success">💰</div></div>
        <div class="stat-card-value">${BRL(summary.aReceber)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header"><span class="stat-card-label">Vendas hoje</span><div class="stat-card-icon primary">📊</div></div>
        <div class="stat-card-value">${BRL(summary.vendasHoje)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header"><span class="stat-card-label">Saldo previsto</span><div class="stat-card-icon warning">📈</div></div>
        <div class="stat-card-value">${BRL(summary.saldoPrevisto)}</div>
      </div>
    </div>
    ${dre ? `
    <div class="card card-padded" style="margin-top:20px">
      <h3 style="margin-bottom:12px">DRE Simplificado</h3>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)">
        <span>Receita</span><strong>${BRL(dre.receita)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)">
        <span>Custos</span><strong>${BRL(dre.custos)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--c-border-light)">
        <span>Despesas</span><strong>${BRL(dre.despesas)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:18px">
        <span><strong>Lucro</strong></span><strong>${BRL(dre.lucro)} (${dre.margem}%)</strong>
      </div>
    </div>` : ''}
  `;
}

async function renderCompras(container) {
  setPageTitle('Compras', 'Pedidos e recebimentos');
  const compras = await api.get('/api/purchases');

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="btn-new-compra">+ Novo pedido</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>#</th><th>Fornecedor</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${compras.map(c => `
            <tr>
              <td><strong>#${c.id}</strong></td>
              <td>${c.fornecedor || '-'}</td>
              <td>${BRL(c.total)}</td>
              <td><span class="tag ${c.status === 'recebido' ? 'tag-success' : c.status === 'parcial' ? 'tag-warning' : 'tag-info'}">${STATUS_LABELS[c.status] || c.status}</span></td>
              <td>${c.status !== 'recebido' ? `<button class="btn btn-ghost btn-sm" data-rec="${c.id}">Receber</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderOrcamentos(container) {
  setPageTitle('Orçamentos', 'Orçar, aprovar e converter em venda');
  const orcs = await api.get('/api/budgets');

  container.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-primary" id="btn-new-orc">+ Novo orçamento</button>
    </div>
    <div class="table-container">
      <table class="table">
        <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${orcs.map(o => `
            <tr>
              <td><strong>#${o.id}</strong></td>
              <td>${o.cliente || '—'}</td>
              <td>${BRL(o.total)}</td>
              <td><span class="tag ${o.status === 'convertido' ? 'tag-success' : o.status === 'cancelado' ? 'tag-danger' : 'tag-info'}">${STATUS_LABELS[o.status] || o.status}</span></td>
              <td>${o.status === 'aberto' ? `<button class="btn btn-ghost btn-sm" data-conv="${o.id}">Converter</button>` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderLotes(container) {
  setPageTitle('Lotes e validade', 'PVPS: primeiro que vence, primeiro que sai');
  const lotes = await api.get('/api/lots');

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Produto</th><th>Lote</th><th>Validade</th><th>Qtd</th></tr></thead>
        <tbody>
          ${lotes.map(l => `<tr><td>${l.produto}</td><td>${l.lote || '-'}</td><td>${l.validade || '-'}</td><td>${l.qtd}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderTransferencias(container) {
  setPageTitle('Transferências', 'Entre filiais/lojas');
  const branches = await api.get('/api/branches');
  const transfers = await api.get('/api/transfers');

  container.innerHTML = `
    <div class="grid grid-2">
      <div class="card card-padded">
        <h3 style="margin-bottom:12px">Filiais</h3>
        ${branches.map(b => `<p><strong>${b.nome}</strong> <span class="text-muted">· ${b.active ? 'ativa' : 'inativa'}</span></p>`).join('') || '<p class="text-muted">Nenhuma filial.</p>'}
      </div>
      <div class="card card-padded">
        <h3 style="margin-bottom:12px">Últimas transferências</h3>
        ${transfers.slice(0, 10).map(t => `<small style="display:block;padding:4px 0">#${t.id} ${t.origem || '?'} → ${t.destino || '?'}</small>`).join('') || '<p class="text-muted">Nenhuma.</p>'}
      </div>
    </div>
  `;
}

async function renderFichas(container) {
  setPageTitle('Ficha técnica', 'Receita e consumo automático de insumos');
  const fichas = await api.get('/api/recipes');

  container.innerHTML = `
    <div class="grid grid-2">
      ${fichas.map(f => `
        <div class="card card-padded">
          <strong>${f.nome}</strong>
          <span class="text-muted"> → ${f.produto} · custo ${BRL(f.custo)}</span>
          <br>
          <small class="text-muted">${f.itens.map(i => `${i.insumo} ${i.qtd}`).join(' · ')}</small>
        </div>
      `).join('') || '<p class="text-muted">Nenhuma ficha cadastrada.</p>'}
    </div>
  `;
}

async function renderRelatorios(container) {
  setPageTitle('Relatórios', 'Exportar dados');
  container.innerHTML = `
    <div class="card card-padded">
      <h3 style="margin-bottom:16px">Relatórios disponíveis</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        <button class="btn btn-secondary" data-report="estoque">Posição de estoque</button>
        <button class="btn btn-secondary" data-report="vendas">Vendas</button>
        <button class="btn btn-secondary" data-report="margens">Margens</button>
        <button class="btn btn-secondary" data-report="curva-abc">Curva ABC</button>
        <button class="btn btn-secondary" data-report="giro">Giro de estoque</button>
      </div>
      <div id="report-out" style="margin-top:20px"></div>
    </div>
  `;

  $$('[data-report]').forEach(b => b.onclick = async () => {
    const data = await api.get('/api/reports/' + b.dataset.report);
    const rows = Array.isArray(data) ? data : data.data || [];
    if (!rows.length) return toast('Sem dados', 'warning');
    const cols = Object.keys(rows[0]).slice(0, 6);
    $('#report-out').innerHTML = `
      <div class="table-container">
        <table class="table">
          <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
          <tbody>${rows.slice(0, 50).map(r => `<tr>${cols.map(c => `<td>${r[c] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      <p class="text-muted" style="margin-top:8px">${rows.length} registros</p>
    `;
  });
}

async function renderSegmento(container) {
  setPageTitle('Segmento', 'Módulo específico do seu ramo');
  const seg = state.user.company_segmento || 'mercado';
  container.innerHTML = `
    <div class="card card-padded">
      <h3 style="margin-bottom:12px">Segmento: ${seg}</h3>
      <p class="text-muted">Recursos específicos para ${seg} estarão disponíveis aqui.</p>
    </div>
  `;
}

async function renderUsuarios(container) {
  setPageTitle('Usuários', 'Equipe e perfis');
  const users = await api.get('/api/users');

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td><span class="tag tag-info">${ROLE_LABELS[u.role] || u.role}</span></td>
              <td>${u.active ? 'Sim' : 'Não'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderEmpresa(container) {
  setPageTitle('Empresa', 'Dados e configurações');
  const e = await api.get('/api/company');

  container.innerHTML = `
    <div class="card card-padded">
      <h3 style="margin-bottom:12px">${e.nome || 'Empresa'}</h3>
      <p class="text-muted">Segmento: ${e.segmento || '-'} · Margem mínima: ${e.margem_minima || 20}%</p>
      <p class="text-muted" style="margin-top:8px">ID: ${e.id} · Configurações avançadas disponíveis na API.</p>
    </div>
  `;
}

async function renderAuditoria(container) {
  setPageTitle('Auditoria', 'Quem fez o quê');
  const logs = await api.get('/api/audit?limit=100');

  container.innerHTML = `
    <div class="table-container">
      <table class="table">
        <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Registro</th></tr></thead>
        <tbody>
          ${logs.map(l => `
            <tr>
              <td>${l.created_at}</td>
              <td>${l.user_name || ''}</td>
              <td>${l.acao}</td>
              <td>${l.registro || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderAlertas(container) {
  setPageTitle('Alertas', 'Central de notificações');
  const alerts = await api.get('/api/alerts');

  container.innerHTML = alerts.length ? alerts.map(a => `
    <div class="card card-padded" style="margin-bottom:12px;border-left:4px solid ${a.nivel === 'critico' ? 'var(--c-danger)' : 'var(--c-warning)'}">
      <strong>${a.nivel === 'critico' ? '🔴' : '🟡'}</strong> ${a.msg}
    </div>
  `).join('') : '<div class="empty-state"><div class="empty-state-title">Nenhum alerta</div><div class="empty-state-description">Tudo certo!</div></div>';
}

async function renderSaaS(container) {
  setPageTitle('Painel SaaS', 'Empresas clientes');
  const companies = await api.get('/api/saas/companies');

  container.innerHTML = `
    <div class="grid grid-4">
      ${companies.map(c => `
        <div class="card card-padded">
          <h3>${c.nome}</h3>
          <small class="text-muted">#${c.id} · ${c.segmento} · ${c.usuarios || 0} usuários · ${c.ativa ? 'ativa' : 'inativa'}</small>
        </div>
      `).join('')}
    </div>
  `;
}

// ---------- Command Palette ----------
function openCommandPalette() {
  state.commandPaletteOpen = true;
  const root = $('#command-palette-root');
  root.innerHTML = `
    <div class="command-palette" onclick="if(event.target===this)closeCommandPalette()">
      <div class="command-palette-container">
        <div class="command-palette-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input type="text" id="cmd-input" class="command-palette-input" placeholder="Buscar produtos, clientes, vendas...">
        </div>
        <div class="command-palette-results" id="cmd-results"></div>
      </div>
    </div>
  `;
  $('#cmd-input').focus();
  $('#cmd-input').oninput = (e) => filterCommands(e.target.value);
  $('#cmd-input').onkeydown = (e) => {
    if (e.key === 'Escape') closeCommandPalette();
  };
}

function closeCommandPalette() {
  state.commandPaletteOpen = false;
  $('#command-palette-root').innerHTML = '';
}

async function filterCommands(q) {
  const results = [];
  const query = q.toLowerCase();

  if (state.products.length) {
    state.products.filter(p => p.nome.toLowerCase().includes(query)).slice(0, 5).forEach(p => {
      results.push({ type: 'product', title: p.nome, description: `Estoque: ${p.estoque_atual} · ${BRL(p.preco_venda)}`, action: () => { closeCommandPalette(); location.hash = '#/produtos'; } });
    });
  }

  if (state.customers.length) {
    state.customers.filter(c => c.nome.toLowerCase().includes(query)).slice(0, 5).forEach(c => {
      results.push({ type: 'customer', title: c.nome, description: c.telefone || '', action: () => { closeCommandPalette(); location.hash = '#/clientes'; } });
    });
  }

  const cmdResults = $('#cmd-results');
  if (!results.length) {
    cmdResults.innerHTML = '<div class="command-palette-empty">Nenhum resultado encontrado</div>';
    return;
  }

  cmdResults.innerHTML = results.map((r, i) => `
    <div class="command-palette-item" data-cmd="${i}">
      <div class="command-palette-item-icon">${r.type === 'product' ? '📦' : '👤'}</div>
      <div class="command-palette-item-content">
        <div class="command-palette-item-title">${r.title}</div>
        <div class="command-palette-item-description">${r.description}</div>
      </div>
    </div>
  `).join('');

  $$('#cmd-results [data-cmd]').forEach(el => el.onclick = () => results[el.dataset.cmd].action());
}

// ---------- Export CSV ----------
function exportCSV(filename, rows) {
  if (!rows.length) return toast('Nada para exportar', 'warning');
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(';')].concat(rows.map(r => cols.map(c => JSON.stringify(r[c] ?? '')).join(';'))).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ---------- Event Listeners ----------
function initEventListeners() {
  // Auth tabs
  $$('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      $('#form-login').classList.toggle('hidden', !isLogin);
      $('#form-signup').classList.toggle('hidden', isLogin);
    };
  });

  // Login form
  $('#form-login').onsubmit = async (e) => {
    e.preventDefault();
    $('#login-err').classList.add('hidden');
    try {
      const res = await api.post('/api/auth/login', {
        email: $('#login-email').value.trim(),
        password: $('#login-pass').value,
      });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('token', res.token);
      showApp();
      toast('Bem-vindo, ' + res.user.name + '!', 'success');
    } catch (err) {
      $('#login-err').textContent = err.message;
      $('#login-err').classList.remove('hidden');
    }
  };

  // Signup form
  $('#form-signup').onsubmit = async (e) => {
    e.preventDefault();
    $('#signup-err').classList.add('hidden');
    try {
      const res = await api.post('/api/auth/signup-company', {
        company_nome: $('#su-company').value.trim(),
        segmento: $('#su-seg').value,
        user_name: $('#su-name').value.trim(),
        email: $('#su-email').value.trim(),
        password: $('#su-pass').value,
      });
      state.token = res.token;
      state.user = res.user;
      localStorage.setItem('token', res.token);
      showApp();
      toast('Empresa criada com sucesso!', 'success');
    } catch (err) {
      $('#signup-err').textContent = err.message;
      $('#signup-err').classList.remove('hidden');
    }
  };

  // Logout
  $('#btn-logout').onclick = () => {
    localStorage.removeItem('token');
    state.token = null;
    state.user = null;
    location.reload();
  };

  // Sidebar toggle
  $('#btn-collapse').onclick = () => {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', state.sidebarCollapsed);
    $('#sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
  };

  // Mobile menu
  $('#btn-menu').onclick = () => {
    $('#sidebar').classList.add('open');
    $('#sidebar-overlay').classList.add('visible');
  };

  $('#sidebar-overlay').onclick = () => {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('visible');
  };

  // Global search
  $('#global-search').addEventListener('focus', () => {
    if (state.products.length === 0) {
      api.get('/api/products?limit=100').then(res => { state.products = res.data; });
    }
    api.get('/api/customers').then(res => { state.customers = res; });
  });

  $('#global-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      openCommandPalette();
    }
  });

  // Notifications
  $('#btn-notifications').onclick = async () => {
    const alerts = await api.get('/api/alerts');
    modal(`
      <div class="modal-header"><h3 class="modal-title">Notificações</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        ${alerts.length ? alerts.map(a => `<div style="padding:12px 0;border-bottom:1px solid var(--c-border-light)"><strong>${a.nivel === 'critico' ? '🔴' : '🟡'}</strong> ${a.msg}</div>`).join('') : '<p class="text-muted">Nenhuma notificação.</p>'}
      </div>
    `);
  };

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+K for command palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (state.commandPaletteOpen) closeCommandPalette();
      else openCommandPalette();
    }

    // PDV shortcuts
    if (state.currentRoute === '#/pdv') {
      if (e.key === 'F2') { e.preventDefault(); $('#pdv-code')?.focus(); }
      if (e.key === 'F9') { e.preventDefault(); $('#btn-finalize')?.click(); }
      if (e.key === 'Escape') { closeModal(); }
    }
  });

  // Hash change
  window.addEventListener('hashchange', navigate);
}

// ---------- Initialize App ----------
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initAuth();
});
