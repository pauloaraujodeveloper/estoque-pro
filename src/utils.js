// Regras de negocio puras + auditoria por tenant
function margemPct(preco, custo) {
  if (!preco || preco <= 0) return 0;
  return Number((((preco - custo) / preco) * 100).toFixed(2));
}
function markupPct(preco, custo) {
  if (!custo || custo <= 0) return 0;
  return Number((((preco - custo) / custo) * 100).toFixed(2));
}
function lucroUnit(preco, custo) { return Number(((preco || 0) - (custo || 0)).toFixed(2)); }
function precoPorMargem(custo, margemDesejada) {
  const m = Number(margemDesejada) / 100;
  if (m >= 1) return 0;
  return Number((Number(custo) / (1 - m)).toFixed(2));
}
function custoMedioPonderado(estoqueAtual, custoAtual, qtdEntrada, custoEntrada) {
  const total = Number(estoqueAtual) + Number(qtdEntrada);
  if (total <= 0) return Number(custoEntrada || 0);
  return Number(((estoqueAtual * custoAtual + qtdEntrada * custoEntrada) / total).toFixed(4));
}
function auditTdb(tdb, user, acao, modulo, registro, antes, depois, ip) {
  try {
    tdb.prepare('INSERT INTO audit_logs(user_id,user_name,acao,modulo,registro,antes,depois,ip) VALUES(?,?,?,?,?,?,?,?)')
      .run(user ? user.id : null, user ? user.name : 'sistema', acao, modulo, String(registro || ''),
        antes ? JSON.stringify(antes).slice(0, 2000) : null,
        depois ? JSON.stringify(depois).slice(0, 2000) : null, ip || null);
  } catch {}
}
function diasPara(dataISO) {
  if (!dataISO) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = new Date(dataISO); if (isNaN(d)) return null; d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}
module.exports = { margemPct, markupPct, lucroUnit, precoPorMargem, custoMedioPonderado, auditTdb, diasPara };
