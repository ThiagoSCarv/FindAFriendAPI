# Middlewares HTTP

Pré-handlers do Fastify para autenticação e autorização. Veja `src/http/CLAUDE.md` para a estratégia geral de auth.

- `verifyJWT` — valida o access token (`Authorization: Bearer <token>`), popula `request.user` e bloqueia requests não autenticados. Usado em rotas protegidas.
- `verifyUserRole(role)` — garante que o `role` do payload JWT corresponde ao exigido (ex: `verifyUserRole('ORG')`).
- Registrados como `onRequest`/pre-handler nas rotas que precisam de proteção.
- **Não contêm lógica de negócio** — apenas autenticação/autorização.

Regras:
- **[RN-06]** Somente uma ORG autenticada pode cadastrar pets (`verifyJWT` + `verifyUserRole('ORG')`).
- **[RN-07]** O refresh token é lido do cookie `httpOnly`.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
