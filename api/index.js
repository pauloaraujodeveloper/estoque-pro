// Entrada serverless do Vercel: reutiliza o app Express (server.js).
// Todo o tráfego (front + /api) cai aqui via vercel.json.
const app = require('../server');
module.exports = app;
