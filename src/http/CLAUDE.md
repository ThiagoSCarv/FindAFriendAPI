# Camada HTTP

Tudo que toca o protocolo HTTP: configuração do Fastify, autenticação, controllers e rotas.
Subpastas têm regras próprias — veja `controllers/CLAUDE.md` e `routes/CLAUDE.md`.

- `src/app.ts` registra plugins, rotas e o handler global de erros.
- `src/server.ts` é o ponto de entrada (`listen`).
- O handler global de erros em `app.ts` mapeia erros de domínio (`src/use-cases/errors/`) para status HTTP adequados.

---

## Validação por schema

A validação roda na **camada do Fastify** via `fastify-type-provider-zod`
(`setValidatorCompiler` + `setSerializerCompiler` em `app.ts`). Cada controller **exporta**
o schema Zod do body e a rota o anexa em `schema.body`; o mesmo schema alimenta a validação
**e** a doc Swagger (`transform: jsonSchemaTransform`). Controllers **não** chamam `.parse()`
no body — o request já chega validado e tipado (`FastifyRequest<{ Body: z.infer<...> }>`).
Detalhes do padrão em `controllers/CLAUDE.md`.

- **Toda validação Zod deve ter mensagem formatada em português para cada campo.** Nenhum campo pode depender da mensagem padrão (em inglês) do Zod.
- Cada campo cobre os dois tipos de erro:
  - **Tipo/obrigatório**: `z.string({ error: 'O e-mail é obrigatório.' })` — exibida quando o campo está ausente ou tem o tipo errado.
  - **Refinamento**: a mensagem vai no próprio `.min()`/`.email()`/`.regex()` — ex: `.email('Informe um e-mail válido.')`.
- Campos opcionais também recebem a mensagem de tipo (`z.string({ error: '...' }).optional()`), válida quando o campo é enviado com tipo incorreto.
- Mensagens são frases completas, terminadas em ponto, e descrevem o formato esperado quando houver (ex: CEP com 8 dígitos, WhatsApp `+55DDDNÚMERO`).
- O handler global em `app.ts` devolve essas mensagens em `400` no array `issues`: erros do schema da rota são capturados por `hasZodFastifySchemaValidationErrors(error)` (→ `error.validation`); um `ZodError` de `.parse()` manual fora da rota cai no branch `flatten().fieldErrors`.
- API do **Zod 4**: use `{ error: '...' }` no construtor para tipo/obrigatório e o atalho de string nos refinamentos (`required_error`/`invalid_type_error` estão depreciados).

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
