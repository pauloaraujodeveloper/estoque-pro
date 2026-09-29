# Backlog — EstoquePro

Itens propostos, aguardando confirmação do dono antes de implementar.

## [AGUARDANDO] Integração com IA (relatórios + dashboard)
**Objetivo:** permitir perguntas em linguagem natural sobre os dados ("quais produtos vão romper em 7 dias?") e geração de relatórios gerenciais com IA (Claude, Gemini ou qualquer outra).

**Desenho proposto:**
- Camada agnóstica a provedor, sem dependência nova (usa `fetch`).
- Env: `AI_PROVIDER` (`openai` | `anthropic` | `gemini` | `openrouter` | `ollama`), `AI_API_KEY`, `AI_MODEL`.
- `POST /api/ai/ask` — pergunta livre; backend monta resumo dos dados e envia à IA (IA nunca acessa o banco direto).
- `POST /api/ai/report` — texto gerencial (DRE comentada, sugestões de compra) para Relatórios.
- Segurança: só admin/gerente, chave só no servidor, auditoria das consultas, sem PII no prompt.
- Sugestão inicial: Gemini (cota grátis) ou Claude.

**Status:** proposta apresentada em 29/09/2026, sem implementação. Reativar quando o dono pedir.
