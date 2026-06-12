# Rotas

Registro das rotas agrupadas por domínio (ex: `orgs-routes.ts`). Cada grupo é registrado em `app.ts`.

- Uma rota aponta para um controller; o registro fica agrupado por domínio.
- Toda rota deve ter schema associado (validação + geração automática da doc Swagger/Scalar).
- O `schema` da rota traz `tags`/`summary` (doc) e o `body` (schema Zod **exportado pelo
  controller**); a validação roda via `fastify-type-provider-zod` — ver `controllers/CLAUDE.md`.

```ts
// src/http/routes/orgs-routes.ts
app.post(
  '/orgs',
  { schema: { tags: ['Orgs'], summary: 'Cadastro de ORG', body: registerOrgBodySchema } },
  registerOrgController,
)
```

## Orgs
```
POST   /orgs          → Cadastro de ORG
POST   /sessions      → Login de ORG
PATCH  /token/refresh → Refresh de access token
```

## Pets
```
POST  /pets            → Cadastro de pet (autenticado)
GET   /pets            → Listagem por cidade + filtros opcionais (?city=&age=&size=...)
GET   /pets/:petId     → Detalhes de um pet
```

## Regras relevantes
- **[RN-01]** A cidade é obrigatória em `GET /pets` — não existe listagem sem filtro de cidade.
- **[RN-05]** Os filtros de características (age, size, energy_level, independence, environment) são opcionais, exceto a cidade.
- **[RN-06]** `POST /pets` exige ORG autenticada (`verifyJWT` + `verifyUserRole('ORG')`).

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
