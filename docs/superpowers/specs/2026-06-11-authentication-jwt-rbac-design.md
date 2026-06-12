# Spec — Autenticação (JWT + Refresh Token + RBAC)

- **Data**: 2026-06-11
- **Revisado**: 2026-06-12 — incorporadas melhorias da análise: tratamento explícito do 401 no
  refresh (evita 500 do handler global), ordem dos plugins (cookie antes do jwt), 403 para role
  divergente, e escopo de Swagger/CORS tornado explícito.
- **Status**: Aprovado — pronto para a fase de plano (`writing-plans`) e implementação
- **Escopo**: Login de ORG, refresh de access token (stateless) e RBAC (mecanismo de roles)
- **Próximo passo**: em uma nova sessão, invocar a skill `writing-plans` para gerar o plano de
  implementação a partir deste documento e então implementar seguindo TDD.

---

## 1. Contexto e estado atual do código

Levantamento feito em 2026-06-11 para que a próxima sessão não precise re-explorar:

- `@fastify/jwt@^10.1.0` e `@fastify/cookie@^11.0.2` **já estão instalados e registrados** em
  `src/app.ts`, porém:
  - o `fastifyJwt` é registrado apenas com `{ secret: env.JWT_SECRET }` — **sem** `cookie` e **sem**
    `sign.expiresIn`;
  - o `fastifyCookie` é registrado sem opções.
- `bcryptjs@^3.0.3` instalado; já é usado em `src/use-cases/register-org.ts` (`hash(password, 6)`).
- `src/env/index.ts` valida apenas `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET` (Zod).
- `prisma/schema.prisma`: o model `Org` **não possui campo `role`**. Campos atuais: `id`, `name`,
  `email` (`@unique`), `password_hash`, `whatsapp`, `cep`, `city`, `state`, `address`, `created_at`,
  relação `pets`.
- `src/repositories/interfaces/IOrgsRepository.ts` expõe `create(data: OrgCreateInput)` e
  `findByEmail(email)`. `OrgCreateInput` **não** inclui `role`.
- Implementações: `prisma/prisma-orgs-repository.ts` e `in-memory/in-memory-orgs-repository.ts`.
- Use-cases existentes: apenas `register-org.ts` (+ factory `make-register-org-use-case.ts`).
  **Não existem** login, refresh nem middlewares de autenticação.
- `src/app.ts` tem um `setErrorHandler` global que mapeia `ZodError` (400) e `OrgAlreadyExistsError`
  (409), com fallback 500.
- Rotas registradas: `src/http/routes/orgs-routes.ts` (hoje só `POST /orgs`).
- Pastas de regras (`CLAUDE.md`) já existem em `src/http/middlewares/` e `src/http/schemas/`,
  embora ainda **não haja arquivos de código** nelas.
- A entidade **Pet ainda não está implementada** (sem model concreto em uso, sem rotas). Por isso o
  primeiro consumidor real de `verifyUserRole('ORG')` — o `POST /pets` — fica para outro spec.

---

## 2. Decisões tomadas (com justificativa)

| Decisão | Escolha | Por quê |
|---|---|---|
| Estratégia de refresh | **Stateless** (JWT em cookie `httpOnly`, sem persistência) | Casa com o design do `CLAUDE.md` e o idiom do `@fastify/jwt`; sem migration/tabela extra. |
| RBAC | **Mecanismo de roles** (`role` no banco/payload + `verifyJWT`/`verifyUserRole`) | Atende ao requisito sem inventar superfície administrativa agora. `ADMIN` fica preparado. |
| Rotação do refresh | **Sim** — reemite refresh a cada `/token/refresh` (sessão deslizante) | Custo zero no modo stateless; melhora a UX mantendo a sessão viva enquanto usada. |
| Logout | **Fora de escopo** | Não está nas rotas do `CLAUDE.md`; em stateless o logout é o cliente limpar o cookie. |
| Secret dos tokens | **Único `JWT_SECRET`** para access e refresh (diferenciados pelo `expiresIn`) | Simples; é o que a env já oferece. Sem novas variáveis de ambiente. |
| TTLs | Access **10m**, refresh **7d** | Valores definidos no `CLAUDE.md`. |
| Assinatura do token no use-case? | **Não** — JWT é assinado na camada HTTP (controller) | O JWT é preocupação de transporte; o use-case só valida credenciais e permanece testável sem Fastify. |
| Erros de token (`@fastify/jwt`) → HTTP | **Tratados localmente** (try/catch no controller de refresh; o `verifyJWT` já trata) → **401** | O `setErrorHandler` global é catch-all e cairia em **500**; os erros do `@fastify/jwt` (`statusCode 401`) precisam ser traduzidos antes de chegar nele. |
| Autorização (role divergente) | **403 Forbidden** (não 401) | 401 = não autenticado; quem está autenticado mas sem a role exigida recebe **403** — semântica correta. |

---

## 3. Modelo de dados

`prisma/schema.prisma`:

```prisma
enum Role {
  ORG
  ADMIN
}

model Org {
  // ...campos atuais inalterados...
  role Role @default(ORG)
}
```

- Gera uma migration nova: `npx prisma migrate dev --name add-role-to-org` (ou `pnpm db:migrate`).
- `OrgCreateInput` **não muda** — `role` usa o default do banco no cadastro.
- O **repositório in-memory** passa a produzir `role: 'ORG'` ao criar uma org, para espelhar o
  comportamento do Prisma (o tipo `Org` do `@prisma/client` passará a incluir `role`).

---

## 4. Configuração de tokens e cookie (`src/app.ts`)

> ⚠️ **Ordem dos plugins:** registrar o `@fastify/cookie` **antes** do `@fastify/jwt`. Hoje o
> `app.ts` faz o inverso (`fastifyJwt` na linha 42, `fastifyCookie` na 43); inverter para seguir o
> padrão documentado do `@fastify/jwt` e garantir o parsing do cookie disponível ao
> `jwtVerify({ onlyCookie: true })`.

Atualizar o registro do `@fastify/jwt`:

```ts
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: 'refreshToken', signed: false },
  sign: { expiresIn: '10m' }, // padrão do access token
})
```

- **Access token**: payload `{ role }`, `sub: orgId`, expira em **10m**, trafega no header
  `Authorization: Bearer <token>`.
- **Refresh token**: payload `{ role }`, `sub: orgId`, expira em **7d**, trafega no cookie
  `refreshToken` com flags:
  - `httpOnly: true`
  - `secure: env.NODE_ENV === 'production'`
  - `sameSite: true`
  - `path: '/'`

Tipagem do payload (novo arquivo, ex. `src/@types/fastify-jwt.d.ts`):

```ts
import '@fastify/jwt'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string
      role: 'ORG' | 'ADMIN'
    }
  }
}
```

---

## 5. Endpoints e fluxo

```
POST  /sessions        → login da ORG
PATCH /token/refresh   → renova o access token a partir do cookie de refresh
```

### POST /sessions (login)
1. Controller valida o body com Zod: `{ email: string.email(), password: string }`.
2. Chama `makeAuthenticateUseCase().execute({ email, password })`.
3. Em sucesso, assina os tokens na camada HTTP:
   ```ts
   const token = await reply.jwtSign({ role: org.role }, { sign: { sub: org.id } })
   const refreshToken = await reply.jwtSign(
     { role: org.role },
     { sign: { sub: org.id, expiresIn: '7d' } },
   )
   ```
4. Seta o cookie e responde:
   ```ts
   return reply
     .setCookie('refreshToken', refreshToken, {
       path: '/',
       secure: env.NODE_ENV === 'production',
       sameSite: true,
       httpOnly: true,
     })
     .status(200)
     .send({ token })
   ```
5. Credenciais inválidas → `InvalidCredentialsError` (401, via error handler).

### PATCH /token/refresh
1. `await request.jwtVerify({ onlyCookie: true })` — lê e valida o refresh token **do cookie**.
2. Reemite **access e refresh** (rotação) usando `request.user.sub` e `request.user.role`.
3. Reseta o cookie `refreshToken` (mesmas flags) e responde `200 { token }`.
4. **Sem cookie / cookie inválido ou expirado → 401.** ⚠️ O `@fastify/jwt` lança erros com
   `statusCode: 401` (ex. `FST_JWT_NO_AUTHORIZATION_IN_COOKIE`, `FST_JWT_AUTHORIZATION_TOKEN_EXPIRED`),
   mas o `setErrorHandler` global de `app.ts` é catch-all e os mapearia para **500**. Por isso o
   controller **deve** capturar a falha localmente e responder 401 explicitamente:
   ```ts
   try {
     await request.jwtVerify({ onlyCookie: true })
   } catch {
     return reply.status(401).send({ message: 'Unauthorized.' })
   }
   ```
   (Mesmo padrão do `verifyJWT`.) Alternativa equivalente: tornar o handler global tolerante a erros
   com `statusCode < 500` — mas o try/catch local é mais explícito e casa com a decisão de "token
   vive no controller".
5. **Não** há use-case (operação puramente de token; vive no controller).

---

## 6. Middlewares de RBAC (`src/http/middlewares/`)

- `verify-jwt.ts` → `verifyJWT`: hook `onRequest` que executa `await request.jwtVerify()` (lê o
  header `Authorization`). Em erro, responde **401** `{ message: 'Unauthorized.' }`.
- `verify-user-role.ts` → `verifyUserRole(roleToVerify: 'ORG' | 'ADMIN')`: retorna um hook
  `onRequest` que compara `request.user.role` com `roleToVerify`; se divergir, responde **403**
  `{ message: 'Forbidden.' }`. (401 = não autenticado; quem está autenticado mas sem a role
  exigida recebe **403 Forbidden** — semântica correta. O `verifyJWT`, esse sim, responde 401.)

Uso pretendido (a ser aplicado quando a rota existir, fora deste spec):
```ts
app.post('/pets', { onRequest: [verifyJWT, verifyUserRole('ORG')] }, registerPetController)
```

---

## 7. Use-case, erro e factory

- `src/use-cases/authenticate.ts` → `AuthenticateUseCase`
  - Construtor: `(private orgsRepository: IOrgsRepository)`.
  - `execute({ email, password })`: `findByEmail` → se não existe, `InvalidCredentialsError`;
    `compare(password, org.password_hash)` (bcryptjs) → se falso, `InvalidCredentialsError`;
    senão retorna `{ org }`.
- `src/use-cases/errors/invalid-credentials-error.ts` → classe `InvalidCredentialsError extends Error`
  com mensagem `'Invalid credentials.'`. Mapeada para **401** no `setErrorHandler` de `app.ts`.
- `src/use-cases/factories/make-authenticate-use-case.ts` → instancia o use-case com
  `PrismaOrgsRepository` (segue a convenção `make-*`).

---

## 8. Plano de testes (TDD — teste antes da implementação)

### Unitários (`test/unit/`) — `AuthenticateUseCase` com `InMemoryOrgsRepository`
- ✅ autentica com email + senha corretos (retorna a org).
- ❌ senha incorreta → lança `InvalidCredentialsError`.
- ❌ email inexistente → lança `InvalidCredentialsError`.
- (a org de teste é criada com `password_hash = await hash('123456', 6)`.)

### E2E (`test/e2e/`) — Supertest contra o `app`
- `POST /sessions`: 200 com `{ token }` no corpo **e** cookie `refreshToken` no `set-cookie`
  (criar a org antes via `POST /orgs`); 401 com credenciais inválidas.
- `PATCH /token/refresh`: a partir do cookie obtido no login, retorna 200 com **novo** `token` e
  **novo** cookie `refreshToken`; **401 sem cookie** (asserir que é 401 e **não** 500 — esse é o
  caso que o try/catch do controller precisa cobrir).
- **Middlewares** (`verifyJWT` + `verifyUserRole`): como ainda não há rota de produção protegida,
  testar montando uma instância Fastify isolada no próprio arquivo de teste — registrar
  `@fastify/jwt`, uma rota dummy protegida e asserir: 401 sem token, 200 com token válido,
  **403** com role divergente.

---

## 9. Inventário de arquivos

**Novos**
- `src/use-cases/authenticate.ts`
- `src/use-cases/errors/invalid-credentials-error.ts`
- `src/use-cases/factories/make-authenticate-use-case.ts`
- `src/http/controllers/authenticate-controller.ts`
- `src/http/controllers/refresh-controller.ts` (com try/catch → 401 nos erros do `@fastify/jwt`)
- `src/http/middlewares/verify-jwt.ts`
- `src/http/middlewares/verify-user-role.ts` (responde **403** em role divergente)
- `src/@types/fastify-jwt.d.ts`
- `prisma/migrations/<timestamp>_add_role_to_org/` (gerada pelo Prisma)
- Testes: `test/unit/authenticate.spec.ts`, `test/e2e/authenticate.spec.ts`,
  `test/e2e/token-refresh.spec.ts`, `test/e2e/verify-role.spec.ts`

**Alterados**
- `prisma/schema.prisma` — enum `Role` + campo `Org.role`.
- `src/app.ts` — **reordenar** `fastifyCookie` antes de `fastifyJwt`; config do `fastifyJwt`
  (cookie + `sign.expiresIn`) e map de `InvalidCredentialsError` (401) no `setErrorHandler`.
- `src/http/routes/orgs-routes.ts` — registra `POST /sessions` e `PATCH /token/refresh`.
- `src/repositories/in-memory/in-memory-orgs-repository.ts` — `role: 'ORG'` no create.

**Sem alteração**
- `src/env/index.ts` — nenhuma variável de ambiente nova.

---

## 10. Fora de escopo (futuro)

- Rota de logout (cliente limpa o cookie no modo stateless).
- Superfície administrativa / rota `ADMIN`-only e promoção de role (sem endpoint; `ADMIN` é manual).
- Aplicação de `verifyJWT`/`verifyUserRole('ORG')` no `POST /pets` (depende do spec de Pets).
- Refresh stateful (persistência, revogação, detecção de reuso).
- **Documentação Swagger/Scalar** das novas rotas (`POST /sessions`, `PATCH /token/refresh`) e
  aplicação do `security: [{ bearerAuth: [] }]` nas rotas protegidas. O `bearerAuth` já está
  declarado em `app.ts`, mas — coerente com o `register-org`, que valida só no controller — as
  rotas ainda não anexam schema Fastify para a doc. Fica como dívida consciente.
- **CORS com credenciais** (`@fastify/cors` com `credentials: true` + `sameSite` compatível), caso
  um frontend em outra origem precise enviar o cookie `httpOnly` de refresh. Hoje não há
  `@fastify/cors` no projeto; só é necessário em cenário cross-origin (não para same-origin/mobile).

---

## 11. Definition of Done

- [ ] Migration `add-role-to-org` aplicada; `Org.role` com default `ORG`.
- [ ] `fastifyJwt` configurado com cookie e TTL de access; `InvalidCredentialsError` mapeado para 401.
- [ ] `fastifyCookie` registrado **antes** do `fastifyJwt`.
- [ ] `POST /sessions` e `PATCH /token/refresh` funcionando (com rotação do refresh).
- [ ] `PATCH /token/refresh` responde **401** (não 500) para cookie ausente/inválido/expirado.
- [ ] `verifyJWT` e `verifyUserRole` implementados e tipados; `verifyUserRole` responde **403** em
      role divergente e `verifyJWT` responde 401 sem token.
- [ ] Testes unitários e E2E acima passando (`pnpm test`).
- [ ] `pnpm lint` sem erros.
