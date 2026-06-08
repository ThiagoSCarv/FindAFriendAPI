# CLAUDE.md — FindAFriend API

Guia de referência para desenvolvimento da API FindAFriend, um sistema de adoção de animais.

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
  repositories/         # Interfaces e implementações Prisma dos repositórios
    interfaces/         # Contratos (IOrgsRepository, IPetsRepository)
    prisma/             # Implementações concretas com Prisma
    in-memory/          # Implementações in-memory para testes unitários
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

## Entidades

### Org
Representa uma organização responsável por animais disponíveis para adoção.

| Campo         | Tipo     | Observações                          |
|---------------|----------|--------------------------------------|
| id            | UUID     | Gerado automaticamente               |
| name          | string   | Nome da organização                  |
| email         | string   | Único                                |
| password_hash | string   | Hash bcrypt                          |
| whatsapp      | string   | Obrigatório — contato com adotantes  |
| cep           | string   | CEP do endereço                      |
| city          | string   | Cidade — usada na busca de pets      |
| state         | string   |                                      |
| address       | string   | Endereço completo — obrigatório      |
| created_at    | DateTime |                                      |

### Pet
Representa um animal disponível para adoção.

| Campo          | Tipo     | Observações                         |
|----------------|----------|-------------------------------------|
| id             | UUID     | Gerado automaticamente              |
| name           | string   |                                     |
| about          | string   | Descrição do pet                    |
| age            | enum     | `PUPPY`, `ADULT`, `SENIOR`          |
| size           | enum     | `SMALL`, `MEDIUM`, `LARGE`          |
| energy_level   | enum     | `LOW`, `MEDIUM`, `HIGH`             |
| independence   | enum     | `LOW`, `MEDIUM`, `HIGH`             |
| environment    | enum     | `SMALL`, `MEDIUM`, `LARGE`          |
| photos         | string[] |                                     |
| requirements   | string[] | Requisitos para adoção              |
| org_id         | UUID     | FK para Org — obrigatório           |
| created_at     | DateTime |                                     |

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

## Autenticação

- **Access token**: JWT de curta duração (ex: 10 minutos), enviado no header `Authorization: Bearer <token>`.
- **Refresh token**: JWT de longa duração (ex: 7 dias), armazenado em cookie `httpOnly` com flag `secure` em produção.
- **Roles**: campo `role` no payload JWT. Valor padrão: `ORG`. Estrutura preparada para expansão (ex: `ADMIN`).
- Rotas protegidas usam o middleware `verifyJWT`. Rotas que exigem role específica usam `verifyUserRole('ORG')`.

---

## Rotas

### Orgs
```
POST   /orgs          → Cadastro de ORG
POST   /sessions      → Login de ORG
PATCH  /token/refresh → Refresh de access token
```

### Pets
```
POST  /pets            → Cadastro de pet (autenticado)
GET   /pets            → Listagem por cidade + filtros opcionais (?city=&age=&size=...)
GET   /pets/:petId     → Detalhes de um pet
```

---

## Variáveis de Ambiente

Todas as variáveis devem ser validadas no startup via Zod em `src/env/index.ts`. A aplicação não deve iniciar com `.env` inválido.

```env
NODE_ENV=development       # development | test | production
PORT=3333
DATABASE_URL=              # PostgreSQL connection string
JWT_SECRET=                # Secret para assinar tokens
```

---

## Padrões de Código

### Controllers
- Responsabilidade única: receber request, chamar use-case, retornar response.
- Não contêm lógica de negócio.
- Erros de domínio são capturados e mapeados para status HTTP adequado.

### Use Cases
- Contêm toda a lógica de negócio.
- Recebem repositórios por injeção de dependência (facilitando testes).
- Lançam erros customizados com classes próprias (ex: `ResourceNotFoundError`, `InvalidCredentialsError`).

### Repositórios
- Toda interação com o banco passa pelo repositório.
- Interfaces definem o contrato; implementações Prisma e in-memory são separadas.
- Use-cases dependem apenas das interfaces.

### Simple Factory

Cada use-case possui uma factory correspondente em `src/use-cases/factories/`. A factory é responsável por instanciar o use-case com todas as suas dependências (repositórios Prisma), centralizando o processo de criação e mantendo os controllers livres de qualquer conhecimento sobre infraestrutura.

**Convenção de nomenclatura**: `make-<nome-do-use-case>.ts`

```ts
// src/use-cases/factories/make-register-pet-use-case.ts
import { PrismaOrgsRepository } from '@/repositories/prisma/prisma-orgs-repository'
import { PrismaPetsRepository } from '@/repositories/prisma/prisma-pets-repository'
import { RegisterPetUseCase } from '@/use-cases/register-pet'

export function makeRegisterPetUseCase() {
  const petsRepository = new PrismaPetsRepository()
  const orgsRepository = new PrismaOrgsRepository()
  return new RegisterPetUseCase(petsRepository, orgsRepository)
}
```

```ts
// src/http/controllers/register-pet-controller.ts
export async function registerPetController(request: FastifyRequest, reply: FastifyReply) {
  // O controller não conhece repositórios — apenas chama a factory
  const registerPet = makeRegisterPetUseCase()
  await registerPet.execute({ ... })
}
```

**Regras:**
- Controllers **sempre** obtêm o use-case via factory — nunca instanciam repositórios diretamente.
- Factories **sempre** usam as implementações Prisma (produção). Testes unitários instanciam o use-case manualmente com repositórios in-memory, sem usar a factory.
- Uma factory por use-case — sem factories genéricas ou compartilhadas.

---

### Erros
- Criar classes de erro em `src/use-cases/errors/`.
- O handler global de erros em `app.ts` mapeia erros conhecidos para respostas HTTP.

### Validação
- Toda entrada de dados (body, query, params) validada com Zod no nível do controller/rota.
- Schemas Zod reutilizáveis podem ser extraídos para `src/http/schemas/`.

---

## Testes

### Unitários (`test/unit/`)
- Testam use-cases isoladamente com repositórios in-memory.
- Rápidos, sem dependência de banco ou rede.
- Comando: `npx vitest run`

### E2E (`test/e2e/`)
- Testam rotas completas com Supertest contra um banco de teste real.
- Cada teste deve criar e limpar seus próprios dados.
- Comando: `npx vitest run --project e2e` (ou configuração equivalente no `vitest.config.ts`)

### Cobertura
- Comando: `npx vitest run --coverage`
- Provider: `@vitest/coverage-v8`

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
