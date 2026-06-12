# Camada HTTP

Tudo que toca o protocolo HTTP: configuração do Fastify, autenticação, controllers e rotas.
Subpastas têm regras próprias — veja `controllers/CLAUDE.md` e `routes/CLAUDE.md`.

- `src/app.ts` registra plugins, rotas e o handler global de erros.
- `src/server.ts` é o ponto de entrada (`listen`).
- O handler global de erros em `app.ts` mapeia erros de domínio (`src/use-cases/errors/`) para status HTTP adequados.

---

## Autenticação

- **Access token**: JWT de curta duração (ex: 10 minutos), enviado no header `Authorization: Bearer <token>`.
- **Refresh token**: JWT de longa duração (ex: 7 dias), armazenado em cookie `httpOnly` com flag `secure` em produção. **[RN-07]**
- **Roles**: campo `role` no payload JWT. Valor padrão: `ORG`. Estrutura preparada para expansão (ex: `ADMIN`).
- Plugins: `@fastify/jwt` + `@fastify/cookie`.
- Rotas protegidas usam o middleware `verifyJWT`. Rotas que exigem role específica usam `verifyUserRole('ORG')`.
- Middlewares de autenticação/role ficam em `src/http/middlewares/`.

**[RN-06]** Somente uma ORG autenticada pode cadastrar pets.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
