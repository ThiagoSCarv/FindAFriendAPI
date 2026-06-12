# Controllers

Handlers das rotas — um arquivo por caso de uso (ex: `register-org-controller.ts`).

- **Responsabilidade única**: receber request, chamar o use-case, retornar response.
- **Não contêm lógica de negócio** — essa vive nos use-cases.
- Obtêm o use-case **sempre via factory** (`src/use-cases/factories/`); nunca instanciam repositórios diretamente.
- Erros de domínio são capturados/propagados e mapeados para o status HTTP adequado (handler global em `app.ts`).

## Validação por schema (Fastify + Zod)

A validação de entrada é feita **pela camada do Fastify** (via `fastify-type-provider-zod`,
configurado em `src/app.ts`), **não** manualmente no controller. O padrão:

1. O **controller exporta** o schema Zod do body (ex: `registerOrgBodySchema`).
2. A **rota** anexa esse schema em `schema.body` — o Fastify valida automaticamente
   antes de chamar o handler.
3. O controller **tipa** o request com `z.infer` e lê `request.body` já validado —
   **nunca chama `.parse()`** no body.

```ts
// src/http/controllers/register-org-controller.ts
import type { FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { makeRegisterOrgUseCase } from '../../use-cases/factories/make-register-org-use-case.js'

export const registerOrgBodySchema = z.object({
  email: z
    .string({ error: 'O e-mail é obrigatório.' })
    .email('Informe um e-mail válido.'),
  // ... demais campos, todos com mensagem em PT-BR (ver src/http/CLAUDE.md)
})

export async function registerOrgController(
  request: FastifyRequest<{ Body: z.infer<typeof registerOrgBodySchema> }>,
  reply: FastifyReply,
) {
  // O controller não conhece repositórios — apenas obtém o use-case via factory
  const registerOrg = makeRegisterOrgUseCase()
  await registerOrg.execute(request.body) // request.body já validado e tipado
  return reply.status(201).send()
}
```

- Erros de validação do schema da rota caem no `400` do handler global em `app.ts`
  (`hasZodFastifySchemaValidationErrors` → array `issues`).
- O mesmo schema alimenta a geração automática da doc Swagger/Scalar (`jsonSchemaTransform`).

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
