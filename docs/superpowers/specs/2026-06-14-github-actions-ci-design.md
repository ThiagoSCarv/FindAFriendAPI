# GitHub Actions CI — FindAFriend API

**Data:** 2026-06-14
**Objetivo:** Adicionar integração contínua via GitHub Actions que valide cada push na `main` e cada Pull Request, rodando lint, typecheck, testes unitários e testes E2E.

## Contexto

- Gerenciador de pacotes: **pnpm 11.3.0** (`pnpm-lock.yaml`, campo `packageManager`).
- `pnpm test` (`vitest run`) hoje roda unit + E2E juntos, com `fileParallelism: false`.
- Os testes E2E usam o `prisma` client real (ex.: `prisma.org.deleteMany()`) e **não** aplicam migrations sozinhos — exigem um Postgres provisionado e o schema aplicado antes.
- Os testes unitários usam repositórios in-memory e **não** importam `@/env`, `@/app` nem `@/lib/prisma` — não precisam de banco. Ainda assim importam enums de `@prisma/client`, então precisam do client gerado.
- Existem 2 migrations em `prisma/migrations/` → usar `prisma migrate deploy`.
- Não há `postinstall` → `prisma generate` deve ser chamado explicitamente.
- Variáveis de ambiente validadas em `src/env/index.ts`: `DATABASE_URL` (url), `JWT_SECRET` (min 1), `NODE_ENV` (`development|test|production`).

## Decisões

- **Estrutura:** jobs separados — `unit` (sem Postgres) e `e2e` (com Postgres) — além de `lint` e `typecheck`.
- **Gates de qualidade:** lint (biome) + typecheck (`tsc --noEmit`), porque o Vitest não checa tipos.
- **Gatilhos:** `push` na `main` + `pull_request`.

## Arquivo: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

### Base comum a todos os jobs

- Runner: `ubuntu-latest`
- `actions/checkout`
- `pnpm/action-setup` com `version: 11.3.0` (casa com `packageManager`)
- `actions/setup-node` com `node-version: 22` e `cache: pnpm`
- `pnpm install --frozen-lockfile`

### Jobs (executam em paralelo)

| Job | Passos específicos | Postgres |
|-----|--------------------|----------|
| `lint` | `pnpm lint` | Não |
| `typecheck` | `pnpm prisma generate` → `pnpm typecheck` | Não |
| `unit` | `pnpm prisma generate` → `pnpm test:unit` | Não |
| `e2e` | service `postgres:16` → `pnpm prisma generate` → `pnpm prisma migrate deploy` → `pnpm test:e2e` | Sim |

### Job `e2e` — detalhes

- **Service container:** `postgres:16` com healthcheck (`pg_isready`), `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=postgres`, `POSTGRES_DB=findafriend_test`, porta `5432:5432`.
- **Env do job:**
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/findafriend_test`
  - `JWT_SECRET=ci-test-secret` (valor dummy, só para o CI)
  - `NODE_ENV=test`
- **Ordem:** instalar deps → gerar client → `prisma migrate deploy` (aplica as 2 migrations no banco do service) → rodar `pnpm test:e2e`.

## Mudanças no `package.json`

Adicionar scripts (necessários para separar unit/e2e e padronizar typecheck):

```json
"test:unit": "vitest run test/unit",
"test:e2e": "vitest run test/e2e",
"typecheck": "tsc --noEmit"
```

Os scripts existentes (`test`, `lint`, etc.) permanecem inalterados.

## Fora de escopo / observação

- Há um `package-lock.json` solto não rastreado no repositório. Como o projeto é pnpm, recomenda-se não commitá-lo e adicioná-lo ao `.gitignore`. Tratado separadamente, não faz parte deste workflow.
- Sem deploy/publish — apenas verificação (CI), não CD.
- Sem matrix de versões de Node — uma única versão (22 LTS).

## Critérios de sucesso

- Abrir um PR dispara os 4 jobs.
- `lint`, `typecheck` e `unit` rodam sem banco.
- `e2e` sobe Postgres, aplica migrations e roda a suíte E2E com sucesso.
- Falha em qualquer job marca o check do PR como falho.
