# CLAUDE.md — FindAFriend API

Guia de referência para desenvolvimento da API FindAFriend, um sistema de adoção de animais.

Cada parte do sistema tem seu próprio `CLAUDE.md` com as regras específicas daquela camada.
O Claude Code carrega automaticamente o arquivo da pasta em que você está trabalhando. Use
este arquivo raiz para a visão geral; consulte o `CLAUDE.md` da pasta para os detalhes:

| Parte do sistema            | Arquivo de regras                       |
|-----------------------------|------------------------------------------|
| Banco / entidades / Prisma  | `prisma/CLAUDE.md`                       |
| Variáveis de ambiente       | `src/env/CLAUDE.md`                      |
| Camada HTTP / autenticação  | `src/http/CLAUDE.md`                     |
| Controllers                 | `src/http/controllers/CLAUDE.md`         |
| Rotas                       | `src/http/routes/CLAUDE.md`              |
| Use cases                   | `src/use-cases/CLAUDE.md`                |
| Factories                   | `src/use-cases/factories/CLAUDE.md`      |
| Erros de domínio            | `src/use-cases/errors/CLAUDE.md`         |
| Repositórios                | `src/repositories/CLAUDE.md`             |
| Providers externos          | `src/providers/CLAUDE.md`                |
| Testes                      | `test/CLAUDE.md`                         |

---

## Stack

- **Runtime**: Node.js com TypeScript
- **Framework**: Fastify
- **ORM**: Prisma
- **Banco de dados**: PostgreSQL
- **Validação**: Zod
- **Autenticação**: JWT (access token + refresh token) via `@fastify/jwt` + `@fastify/cookie`
- **Hash de senhas**: bcryptjs
- **Documentação**: Swagger + Scalar UI
- **Testes**: Vitest + Vitest UI + coverage-v8 + Supertest
- **Lint/Format**: Biome
- **Build**: tsup
- **Dev server**: tsx
- **Path aliases**: vite-tsconfig-paths
- **Env vars**: dotenv

---

## Estrutura de Pastas

```
src/
  http/
    controllers/        # Handlers das rotas (um arquivo por caso de uso)
    middlewares/        # Autenticação, verificação de roles
    routes/             # Registro de rotas agrupadas por domínio
  use-cases/            # Lógica de negócio isolada (um arquivo por caso de uso)
    factories/          # Simple Factories para instanciar use-cases com suas dependências
    errors/             # Classes de erro de domínio
  repositories/         # Interfaces e implementações Prisma dos repositórios
    interfaces/         # Contratos (IOrgsRepository, IPetsRepository)
    prisma/             # Implementações concretas com Prisma
    in-memory/          # Implementações in-memory para testes unitários
  providers/            # Integrações externas (ex: ViaCEP)
  lib/
    prisma.ts           # Instância singleton do PrismaClient
  utils/                # Funções utilitárias reutilizáveis
  env/
    index.ts            # Validação do .env via Zod
  app.ts                # Configuração do Fastify (plugins, rotas)
  server.ts             # Ponto de entrada (listen)
prisma/
  schema.prisma
  migrations/
test/
  unit/                 # Testes de use-cases com repositórios in-memory
  e2e/                  # Testes de rotas com banco real (Supertest)
```

---

## Funcionalidades

| # | Funcionalidade                                  | Acesso       |
|---|--------------------------------------------------|--------------|
| 1 | Cadastro de ORG                                  | Público      |
| 2 | Login de ORG                                     | Público      |
| 3 | Refresh de token                                 | Autenticado  |
| 4 | Cadastro de pet                                  | ORG logada   |
| 5 | Listagem de pets por cidade (+ filtros opcionais)| Público      |
| 6 | Visualização de detalhes de um pet               | Público      |

---

## Regras de Negócio

- **[RN-01]** A cidade é obrigatória para listar pets — não existe listagem sem filtro de cidade.
- **[RN-02]** Uma ORG deve ter obrigatoriamente `address` e `whatsapp` preenchidos no cadastro.
- **[RN-03]** Todo pet cadastrado deve estar vinculado a uma ORG (`org_id` obrigatório).
- **[RN-04]** O contato com a ORG para adoção é feito via WhatsApp — o número é retornado nos detalhes do pet.
- **[RN-05]** Os filtros de características do pet (age, size, energy_level, independence, environment) são todos opcionais, exceto a cidade.
- **[RN-06]** Somente uma ORG autenticada pode cadastrar pets.
- **[RN-07]** O refresh token deve ser armazenado em cookie `httpOnly`.
- **[RN-08]** Senhas devem ser armazenadas como hash bcrypt (nunca em texto puro).

---

## Scripts (`package.json`)

```json
{
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsup src --out-dir dist",
    "dev": "tsx watch src/server.ts",
    "lint": "biome check src",
    "format": "biome format --write src",
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Documentação

- Swagger gerado automaticamente via `@fastify/swagger`.
- UI servida pelo Scalar em `/docs`.
- Todas as rotas devem ter schema Zod associado para geração automática dos tipos na doc.

---

## Git

- **Nunca commitar** nenhum arquivo `CLAUDE.md` (em qualquer diretório) — todos são ignorados pelo `.gitignore`.
- **Nunca commitar** arquivos de skill do Superpowers (`.claude/`).
- Commits **não** devem incluir co-author do Claude.
