# EstoquePro — Controle de Estoque Multissegmento (SaaS Multi-Empresa)

Sistema web completo, cada empresa com **banco isolado** (`data/tenant_<id>.sqlite`), sem ligação entre elas. Pronto para vender como SaaS.

## Arquitetura
- **Back:** Node 22+ + Express + SQLite nativo (`node:sqlite`, sem compilação) + JWT + bcryptjs
- **Front:** SPA vanilla (HTML/CSS/JS), responsivo, sidebar + header, tooltips em tudo, toasts, modais, CSV
- **MASTER** `database.sqlite`: `companies` + `users` (com `company_id`)
- **TENANT** `data/tenant_<id>.sqlite`: produtos, estoque, compras, vendas, financeiro, ficha técnica, lotes (PVPS), salão/marmitaria/peixaria/mercado, auditoria
- Migração futura: trocar `src/db.js` por Postgres (1 schema por tenant) + Prisma — API já isolada por `req.tdb`.

## Regras de negócio
- Estoque = entradas − saídas − perdas ± ajustes · Custo médio ponderado · Margem=(Pv−C)/Pv·100 · Markup=(Pv−C)/C·100 · Lucro=Pv−C · Preço por margem=C/(1−m)
- Venda → baixa estoque (+ insumos da ficha) → financeiro → Kardex → auditoria
- Compra → recebimento atualiza custo médio + contas a pagar · PVPS nos lotes · Alertas: estoque mín, validade 30/15/7, margem mín

## Como rodar (o servidor PRECISA estar ligado — sem ele dá "Failed to fetch")
Opção 1 — duplo clique em `start-servidor.bat` (não feche a janela).
Opção 2 — terminal:
```powershell
cd "C:\Users\paulo\OneDrive\Documentos\controle-de-estoque"
npm install
node src/seed.js
npm start
# abra http://localhost:3000 (funciona no desktop, notebook, tablet e celular na mesma rede via http://SEU-IP:3000)
```

## Logins demo (empresas ISOLADAS)
- Desenvolvedor (controle total: empresas, usuários, senhas, logos): `dev@estoquepro.com / dev123` — **troque a senha após entrar (Usuários → 🔑)**
- Marmitaria: `admin@marmita.com / 123456`
- Salão: `admin@salao.com / 123456`
- Dono SaaS: `saas@dono.com / saas123`
- Ou clique **Cadastrar empresa** para criar a sua com banco próprio.

## Responsivo
Layout adaptado p/ desktop, notebook, tablet e celular: menu gaveta com overlay, tabelas com rolagem lateral, modais em folha inferior no celular, botões ≥44px em telas touch, fontes sem zoom forçado no iOS, breakpoints em 1100/900/640/400px.

## Logo por empresa
- Admin da empresa: **Empresa → Escolher logo** (imagem é redimensionada p/ 256px e aparece no menu).
- Desenvolvedor: **Painel SaaS → ✏️** edita nome, segmento, plano, ativa e logo de qualquer cliente.

## Banco de dados: SQLite local ou PostgreSQL (Neon)
- **Padrão:** sem `DATABASE_URL`, roda em SQLite (zero config).
- **PostgreSQL:** defina `DATABASE_URL` no `.env` (Neon: dashboard → **Connect** → copie a string, termina com `?sslmode=require`). O app converte sozinho string pooler (`-pooler`) para endpoint direto e cria: tabelas globais + 1 schema `tenant_<id>` isolado por empresa.
- **Levar seus dados p/ o Neon:** `npm run migrate:pg` (com `DATABASE_URL` definida) copia empresas, usuários e todos os tenants do SQLite.
- **Ver o schema:** `schema-pg.sql` (pode colar no OneCompiler → PostgreSQL para visualizar a estrutura).
- O OneCompiler é só playground de teste — o app precisa de um Postgres real (Neon/Supabase/local).

## Vender para várias empresas
1. Entre como `saas@dono.com` → **Painel SaaS → + Nova empresa cliente** (cria banco isolado).
2. Ou cada cliente se cadastra sozinho em **Cadastrar empresa**.
3. Cada empresa vê só seus dados. Backup por empresa = copiar `data/tenant_<id>.sqlite`.
4. Desativar empresa bloqueia login dela sem apagar dados. Excluir apaga só o tenant.

## Fluxo de aceite
Login → Dashboard → Produto → Fornecedor → Compra → Receber (estoque/custo) → Margem → PDV → baixa → financeiro → relatórios → Kardex → auditoria.

## Produção / backup
- Troque `JWT_SECRET`, use HTTPS/reverso, `DB_PATH` em volume persistente, backup diário de `database.sqlite` + `data/`.
- Documentado em `.env.example`. LGPD: acesso por perfil, vendedor não vê custo, auditoria total.
