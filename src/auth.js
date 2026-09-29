// Auth multi-empresa: JWT carrega company_id + role. Superadmin (dono SaaS) não tem empresa.
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { mget, getTenantDb } = require('./db');

const SECRET = process.env.JWT_SECRET || 'troque-esta-chave-em-producao-123';
const EXPIRES = process.env.JWT_EXPIRES || '8h';

async function hashPass(p) { return bcrypt.hash(p, 10); }
async function checkPass(p, h) { return bcrypt.compare(p, h); }
function sign(user) {
  return jwt.sign({ id: user.id, company_id: user.company_id || null, role: user.role, name: user.name, email: user.email }, SECRET, { expiresIn: EXPIRES });
}

async function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado. Faça login.' });
  try {
    const payload = jwt.verify(token, SECRET);
    const u = await mget('SELECT u.*, c.nome as company_nome, c.segmento as company_segmento FROM users u LEFT JOIN companies c ON c.id=u.company_id WHERE u.id=?', payload.id);
    if (!u || !u.active) return res.status(401).json({ error: 'Usuário desativado ou inexistente.' });
    if (u.company_id) {
      const c = await mget('SELECT * FROM companies WHERE id=?', u.company_id);
      if (!c || !c.ativa) return res.status(403).json({ error: 'Empresa desativada. Fale com o suporte.' });
    }
    req.user = { id: u.id, name: u.name, email: u.email, role: u.role, company_id: u.company_id, company_nome: u.company_nome, company_segmento: u.company_segmento };
    // anexa banco/schema isolado da empresa (exceto superadmin sem empresa)
    if (u.company_id) {
      try { req.tdb = await getTenantDb(u.company_id); }
      catch { return res.status(401).json({ error: 'Empresa não identificada.' }); }
    } else if (u.role === 'superadmin') {
      // superadmin pode atuar no contexto de uma empresa (suporte): ?company_id= ou header x-company-id
      const cid = req.query.company_id || req.headers['x-company-id'];
      if (cid) {
        const c = await mget('SELECT * FROM companies WHERE id=?', cid);
        if (!c) return res.status(403).json({ error: 'Empresa inexistente.' });
        try { req.tdb = await getTenantDb(c.id); }
        catch { return res.status(401).json({ error: 'Empresa não identificada.' }); }
        req.user.company_id = c.id;
        req.user.company_nome = c.nome;
        req.user.company_segmento = c.segmento;
        req.user.actingAs = true;
      }
    }
    next();
  } catch (e) {
    if (res.headersSent) return;
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado.' });
    if (req.user.role === 'superadmin' || req.user.role === 'admin') return next();
    if (roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Sem permissão para esta operação.' });
  };
}
function requireSuperadmin(req, res, next) {
  if (req.user?.role === 'superadmin') return next();
  return res.status(403).json({ error: 'Acesso do provedor SaaS.' });
}
function filterProductByRole(p, role) {
  if (!p) return p;
  if (role === 'vendedor') { const { custo_medio, ...rest } = p; return rest; }
  return p;
}

module.exports = { hashPass, checkPass, sign, authRequired, requireRole, requireSuperadmin, filterProductByRole };
