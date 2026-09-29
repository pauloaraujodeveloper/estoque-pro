// Envio de e-mails via Resend. Config: RESEND_API_KEY + MAIL_FROM no .env (ou Vercel).
// Sem chave, as funções só registram aviso e retornam { skipped: true } (não quebram o app).
let resend = null;
function client() {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const { Resend } = require('resend');
  resend = new Resend(key);
  return resend;
}
function fromAddr() {
  return process.env.MAIL_FROM || 'EstoquePro <onboarding@resend.dev>';
}
async function sendMail({ to, subject, html }) {
  const c = client();
  if (!c) { console.warn('RESEND_API_KEY ausente: e-mail ignorado para ' + to); return { skipped: true }; }
  try {
    const { data, error } = await c.emails.send({ from: fromAddr(), to, subject, html });
    if (error) throw new Error(error.message || JSON.stringify(error));
    return { id: data && data.id };
  } catch (e) {
    console.error('Falha Resend:', e.message);
    throw new Error('Não foi possível enviar o e-mail.');
  }
}
function welcomeHtml(company, name) {
  return `<h2>Bem-vindo ao EstoquePro, ${name}!</h2><p>A empresa <strong>${company}</strong> foi criada com banco de dados isolado.</p><p>Acesse com seu e-mail e senha cadastrados.</p><p><small>Controle simples para uma gestão mais inteligente.</small></p>`;
}
function tempPassHtml(name, tmp) {
  return `<h2>Olá, ${name}</h2><p>Sua senha temporária é: <strong>${tmp}</strong></p><p>Entre e peça ao administrador para trocar, ou use Usuários → 🔑.</p>`;
}
module.exports = { sendMail, welcomeHtml, tempPassHtml, mailConfigured: () => !!process.env.RESEND_API_KEY };
