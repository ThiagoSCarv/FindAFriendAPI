# GitHub Actions CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um workflow de CI no GitHub Actions que rode lint, typecheck, testes unitários e testes E2E (com Postgres) em cada push na `main` e em cada Pull Request.

**Architecture:** Um único arquivo `.github/workflows/ci.yml` com 4 jobs paralelos e independentes (`lint`, `typecheck`, `unit`, `e2e`). Apenas o job `e2e` provisiona um service container Postgres e aplica as migrations antes de rodar a suíte. Os scripts de teste do `package.json` são separados em `test:unit` e `test:e2e` para permitir a divisão. Reutiliza os scripts Prisma existentes (`db:generate`, `db:migrate:prod`).

**Tech Stack:** GitHub Actions, pnpm 11.3.0, Node 22, Vitest, Prisma 7 (adapter-pg), PostgreSQL 16.

---

## File Structure

- **Create:** `.github/workflows/ci.yml` — definição do pipeline de CI (4 jobs).
- **Modify:** `package.json` — adicionar scripts `test:unit`, `test:e2e`, `typecheck`.

Nada mais é tocado. As migrations, o `prisma.config.ts` (que já expõe `datasource.url = env('DATABASE_URL')`) e o `vitest.config.ts` permanecem inalterados.

---

## Notas de contexto (ler antes de começar)

- Gerenciador: **pnpm**. Sempre `pnpm install --frozen-lockfile` no CI.
- `vitest run test/unit` roda só unit (in-memory, sem banco). `vitest run test/e2e` roda os E2E (Prisma real → precisa de Postgres + migrations aplicadas).
- Ordem dos steps importa: `pnpm/action-setup` (instala pnpm) **antes** de `actions/setup-node` com `cache: pnpm`, senão o cache falha por não achar o pnpm.
- O client Prisma precisa ser gerado (`pnpm db:generate`) antes de typecheck/unit/e2e porque o código importa valores de `@prisma/client` (enums).
- `pnpm db:migrate:prod` é `prisma migrate deploy`; lê `DATABASE_URL` via `prisma.config.ts`.

---

## Task 1: Adicionar scripts de teste/typecheck no package.json

**Files:**
- Modify: `package.json` (bloco `scripts`)

- [ ] **Step 1: Adicionar os três scripts**

No objeto `scripts` do `package.json`, logo após a linha `"test:coverage": "vitest run --coverage",`, adicionar:

```json
    "test:unit": "vitest run test/unit",
    "test:e2e": "vitest run test/e2e",
    "typecheck": "tsc --noEmit",
```

Resultado esperado do bloco (trecho) — as linhas existentes permanecem, só foram acrescentadas três:

```json
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run test/unit",
    "test:e2e": "vitest run test/e2e",
    "typecheck": "tsc --noEmit",
    "db:migrate": "prisma migrate dev",
```

- [ ] **Step 2: Verificar que `test:unit` roda e passa localmente (sem banco)**

Run: `pnpm test:unit`
Expected: PASS — só os specs de `test/unit/` rodam, todos verdes, sem tentar conectar no Postgres.

- [ ] **Step 3: Verificar que `typecheck` roda**

Run: `pnpm typecheck`
Expected: termina sem erros de tipo (exit code 0). Se o client Prisma não estiver gerado e aparecer erro de tipo de `@prisma/client`, rode `pnpm db:generate` antes e repita.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: add test:unit, test:e2e and typecheck scripts"
```

---

## Task 2: Criar o workflow de CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Criar o arquivo do workflow com o conteúdo completo**

Criar `.github/workflows/ci.yml` com exatamente:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.3.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.3.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm typecheck

  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.3.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm test:unit

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: findafriend_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/findafriend_test
      JWT_SECRET: ci-test-secret
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.3.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm db:migrate:prod
      - run: pnpm test:e2e
```

- [ ] **Step 2: Validar a sintaxe YAML localmente**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');console.log('lines:',s.split('\n').length)"`
Expected: imprime o número de linhas sem erro (confirma que o arquivo foi escrito). Para uma validação YAML real, se houver `python3`:

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"`
Expected: `YAML OK` (sem traceback). Se `python3`/`pyyaml` não existir, pule esta verificação — o GitHub validará no push.

- [ ] **Step 3 (opcional, se houver Postgres local): smoke test do caminho E2E**

Se você tiver um Postgres acessível, confirme que a sequência do job `e2e` funciona ponta a ponta apontando para um banco de teste:

Run:
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/findafriend_test \
JWT_SECRET=ci-test-secret NODE_ENV=test \
pnpm db:migrate:prod && \
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/findafriend_test \
JWT_SECRET=ci-test-secret NODE_ENV=test \
pnpm test:e2e
```
Expected: migrations aplicadas (`No pending migrations` ou as 2 aplicadas) e suíte E2E verde. Se não houver Postgres local, pule — o job `e2e` valida isso no CI.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, typecheck, unit and e2e"
```

---

## Task 3: Verificar o CI no GitHub

**Files:** nenhum (verificação)

- [ ] **Step 1: Push da branch**

Run: `git push -u origin feat/github-actions-ci`
Expected: branch publicada no remoto.

- [ ] **Step 2: Abrir o Pull Request**

Run: `gh pr create --fill --base main`
Expected: PR criado; o evento `pull_request` dispara o workflow.

- [ ] **Step 3: Acompanhar os checks**

Run: `gh pr checks --watch`
Expected: os 4 jobs (`lint`, `typecheck`, `unit`, `e2e`) aparecem e terminam com sucesso (verde). Se algum falhar, abrir os logs com `gh run view --log-failed` e corrigir.

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** lint → Task 2 job `lint`; typecheck → Task 1 (script) + Task 2 job `typecheck`; unit → Task 1 (script) + Task 2 job `unit`; e2e com Postgres + migrations → Task 2 job `e2e`; gatilhos push main + PR → Task 2 bloco `on`; concorrência → Task 2 bloco `concurrency`. Sem lacunas.
- **Placeholders:** nenhum — todo conteúdo de arquivo e comando está explícito.
- **Consistência de nomes:** scripts `test:unit`/`test:e2e`/`typecheck` definidos na Task 1 são exatamente os usados nos jobs da Task 2; `db:generate`/`db:migrate:prod` são scripts já existentes no `package.json`.
- **Fora de escopo (confirmado no spec):** o `package-lock.json` solto não é tratado aqui.
