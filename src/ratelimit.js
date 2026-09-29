// Rate limit simples em memória (por instância). Para serverless, vale por instância (aproximado).
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const key = (req.ip || 'ip') + ':' + req.path;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' });
    arr.push(now);
    hits.set(key, arr);
    if (hits.size > 10000) hits.clear();
    next();
  };
}
module.exports = { limit };
