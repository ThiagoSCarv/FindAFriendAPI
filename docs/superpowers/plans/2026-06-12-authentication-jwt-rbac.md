# Authentication (JWT + Refresh Token + RBAC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar login de ORG, refresh stateless de access token e os middlewares de RBAC (`verifyJWT` / `verifyUserRole`) na FindAFriend API.

**Architecture:** O JWT é assinado na camada HTTP (controllers), nunca nos use-cases. O access token (10m) trafega no header `Authorization: Bearer`; o refresh token (7d) trafega em cookie `httpOnly` e é rotacionado a cada refresh. A autorização usa um campo `role` (`ORG`/`ADMIN`) persistido no banco e embutido no payload. O use-case `AuthenticateUseCase` só valida credenciais (testável sem Fastify). Erros de token do `@fastify/jwt` são traduzidos para 401 **localmente** no controller/middleware, porque o `setErrorHandler` global é catch-all e os mapearia para 500.

**Tech Stack:** Node.js + TypeScript (ESM), Fastify 5, `@fastify/jwt` v10, `@fastify/cookie` v11, Prisma 7 + PostgreSQL, Zod 4, bcryptjs, Vitest + Supertest, Biome.

**Spec de origem:** `docs/superpowers/specs/2026-06-11-authentication-jwt-rbac-design.md`

---

## Convenções do codebase (siga à risca)

- **Imports em `src/`**: relativos, com extensão `.js` (ESM). Ex.: `import { env } from '../../env/index.js'`.
- **Imports em `test/`**: alias `@/` sem extensão. Ex.: `import { app } from '@/app'`.
- **Estilo Biome**: aspas simples, ponto-e-vírgula sempre, trailing comma em tudo, indentação de 2 espaços, largura 80. `npm run lint` roda `biome check src` (só `src/`, não `test/`).
- **Testes**: Vitest roda via esbuild (não faz typecheck). Por isso cada task que mexe em tipos roda **também** `npx tsc --noEmit`.
- **Comando de teste**: `npx vitest run <caminho>` para um arquivo específico. E2E exige Postgres no ar (o mesmo do `DATABASE_URL`).
- **Pré-requisito de ambiente**: Postgres rodando e `.env` válido (`DATABASE_URL`, `JWT_SECRET`). Sem isso, a migration (Task 1) e os E2E falham.

---

## File Structure

**Novos arquivos**

| Arquivo | Responsabilidade |
|---|---|
| `src/@types/fastify-jwt.d.ts` | Tipa `request.user` (`{ sub, role }`) via module augmentation do `@fastify/jwt`. |
| `src/use-cases/errors/invalid-credentials-error.ts` | Erro de domínio para credenciais inválidas. |
| `src/use-cases/authenticate.ts` | Use-case que valida email+senha e retorna a org. |
| `src/use-cases/factories/make-authenticate-use-case.ts` | Factory que instancia o use-case com `PrismaOrgsRepository`. |
| `src/http/controllers/authenticate-controller.ts` | `POST /sessions`: valida body, autentica, assina tokens, seta cookie. |
| `src/http/controllers/refresh-controller.ts` | `PATCH /token/refresh`: valida cookie, rotaciona tokens. |
| `src/http/middlewares/verify-jwt.ts` | Hook `onRequest` que exige access token válido (401 em erro). |
| `src/http/middlewares/verify-user-role.ts` | Hook factory que exige uma role específica (403 se divergir). |
| `test/unit/authenticate.spec.ts` | Testes unitários do `AuthenticateUseCase` (in-memory). |
| `test/e2e/authenticate.spec.ts` | E2E de `POST /sessions`. |
| `test/e2e/token-refresh.spec.ts` | E2E de `PATCH /token/refresh`. |
| `test/e2e/verify-role.spec.ts` | E2E dos middlewares em app Fastify isolado. |

**Arquivos alterados**

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Enum `Role` + campo `Org.role @default(ORG)`. |
| `prisma/migrations/<timestamp>_add_role_to_org/` | Migration gerada pelo Prisma. |
| `src/repositories/in-memory/in-memory-orgs-repository.ts` | `role: 'ORG'` no `create` (paridade com o Prisma). |
| `src/app.ts` | Reordenar cookie antes do jwt; config de cookie+`sign` no `fastifyJwt`; mapear `InvalidCredentialsError` → 401. |
| `src/http/routes/orgs-routes.ts` | Registrar `POST /sessions` e `PATCH /token/refresh`. |

**Sem alteração:** `src/env/index.ts` (nenhuma env nova).

---

## Task 1: Adicionar `role` ao modelo Org (Prisma + in-memory)

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_role_to_org/` (gerada)
- Modify: `src/repositories/in-memory/in-memory-orgs-repository.ts`

> Task de modelo de dados — não há teste unitário próprio (não se faz TDD de migration). A verificação é `npx tsc --noEmit` verde + suíte existente verde.

- [ ] **Step 1: Adicionar o enum `Role` e o campo `Org.role` no schema**

Em `prisma/schema.prisma`, adicione o enum logo acima do `model Org` e o campo `role` dentro do model (após `created_at`):

```prisma
enum Role {
  ORG
  ADMIN
}

model Org {
  id            String   @id @default(uuid())
  name          String
  email         String   @unique
  password_hash String
  whatsapp      String
  cep           String
  city          String
  state         String
  address       String
  created_at    DateTime @default(now())
  role          Role     @default(ORG)

  pets Pet[]

  @@map("orgs")
}
```

- [ ] **Step 2: Gerar e aplicar a migration**

Run: `npx prisma migrate dev --name add-role-to-org`
Expected: cria `prisma/migrations/<timestamp>_add_role_to_org/migration.sql`, aplica no banco e roda `prisma generate` (o tipo `Org` do `@prisma/client` passa a ter `role`, e o enum `Role` fica disponível).

- [ ] **Step 3: Verificar que a migration foi criada**

Run: `ls prisma/migrations`
Expected: aparece a pasta `<timestamp>_add_role_to_org` ao lado de `20260608155928_init`.

- [ ] **Step 4: Atualizar o repositório in-memory para espelhar o default**

Em `src/repositories/in-memory/in-memory-orgs-repository.ts`, adicione `role: 'ORG'` no objeto criado:

```ts
async create(data: OrgCreateInput): Promise<Org> {
  const org: Org = {
    id: randomUUID(),
    created_at: new Date(),
    role: 'ORG',
    ...data,
  };
  this.items.push(org);
  return org;
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erros (sem o Step 4, falharia com "Property 'role' is missing in type ... Org").

- [ ] **Step 6: Verificar que a suíte existente continua verde**

Run: `npx vitest run`
Expected: PASS — todos os testes de `register-org` (unit + e2e) continuam passando.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/repositories/in-memory/in-memory-orgs-repository.ts
git commit -m "feat: add role field to Org model"
```

---

## Task 2: Configurar tokens/cookie e tipar o payload JWT (`app.ts` + `.d.ts`)

**Files:**
- Modify: `src/app.ts:42-43` (registro dos plugins)
- Create: `src/@types/fastify-jwt.d.ts`

> Config de transporte. Verificação: `npx tsc --noEmit` verde + a suíte existente (que sobe o `app`) continua passando.

- [ ] **Step 1: Tipar `request.user` via module augmentation**

Crie `src/@types/fastify-jwt.d.ts`:

```ts
import '@fastify/jwt';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      role: 'ORG' | 'ADMIN';
    };
  }
}
```

- [ ] **Step 2: Reordenar plugins e configurar cookie + sign no `fastifyJwt`**

Em `src/app.ts`, troque o bloco atual:

```ts
app.register(fastifyJwt, { secret: env.JWT_SECRET });
app.register(fastifyCookie);
app.register(orgsRoutes);
```

por (cookie **antes** do jwt; jwt com `cookie` e `sign`):

```ts
app.register(fastifyCookie);
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: 'refreshToken', signed: false },
  sign: { expiresIn: '10m' },
});
app.register(orgsRoutes);
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Step 4: Verificar que o app ainda sobe e os testes passam**

Run: `npx vitest run test/e2e/register-org.spec.ts`
Expected: PASS — a config nova do `fastifyJwt` não quebra a inicialização do `app`.

- [ ] **Step 5: Lint**

Run: `npx biome check src`
Expected: sem erros (use `npx biome check src --write` para auto-corrigir formatação se necessário).

- [ ] **Step 6: Commit**

```bash
git add src/app.ts src/@types/fastify-jwt.d.ts
git commit -m "feat: configure jwt cookie/sign and type jwt payload"
```

---

## Task 3: `AuthenticateUseCase` + `InvalidCredentialsError` + factory (TDD unitário)

**Files:**
- Create: `src/use-cases/errors/invalid-credentials-error.ts`
- Create: `src/use-cases/authenticate.ts`
- Create: `src/use-cases/factories/make-authenticate-use-case.ts`
- Test: `test/unit/authenticate.spec.ts`

- [ ] **Step 1: Escrever o teste unitário (que falha)**

Crie `test/unit/authenticate.spec.ts`:

```ts
import { hash } from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { AuthenticateUseCase } from '@/use-cases/authenticate';
import { InvalidCredentialsError } from '@/use-cases/errors/invalid-credentials-error';

describe('AuthenticateUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let sut: AuthenticateUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    sut = new AuthenticateUseCase(orgsRepository);
  });

  async function createOrg(email = 'adote@sp.com', password = '123456') {
    await orgsRepository.create({
      name: 'Adote SP',
      email,
      password_hash: await hash(password, 6),
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Av. Paulista',
    });
  }

  it('should authenticate with valid credentials', async () => {
    await createOrg();

    const { org } = await sut.execute({
      email: 'adote@sp.com',
      password: '123456',
    });

    expect(org.id).toEqual(expect.any(String));
    expect(org.role).toBe('ORG');
  });

  it('should not authenticate with a wrong password', async () => {
    await createOrg();

    await expect(() =>
      sut.execute({ email: 'adote@sp.com', password: 'wrong-password' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('should not authenticate with a non-existing email', async () => {
    await expect(() =>
      sut.execute({ email: 'nobody@sp.com', password: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/unit/authenticate.spec.ts`
Expected: FAIL — não resolve `@/use-cases/authenticate` nem `@/use-cases/errors/invalid-credentials-error`.

- [ ] **Step 3: Criar a classe de erro**

Crie `src/use-cases/errors/invalid-credentials-error.ts`:

```ts
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials.');
    this.name = 'InvalidCredentialsError';
  }
}
```

- [ ] **Step 4: Criar o use-case**

Crie `src/use-cases/authenticate.ts`:

```ts
import type { Org } from '@prisma/client';
import { compare } from 'bcryptjs';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import { InvalidCredentialsError } from './errors/invalid-credentials-error.js';

interface AuthenticateInput {
  email: string;
  password: string;
}

interface AuthenticateOutput {
  org: Org;
}

export class AuthenticateUseCase {
  constructor(private orgsRepository: IOrgsRepository) {}

  async execute({
    email,
    password,
  }: AuthenticateInput): Promise<AuthenticateOutput> {
    const org = await this.orgsRepository.findByEmail(email);

    if (!org) {
      throw new InvalidCredentialsError();
    }

    const doesPasswordMatch = await compare(password, org.password_hash);

    if (!doesPasswordMatch) {
      throw new InvalidCredentialsError();
    }

    return { org };
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/unit/authenticate.spec.ts`
Expected: PASS — 3 testes verdes.

- [ ] **Step 6: Criar a factory**

Crie `src/use-cases/factories/make-authenticate-use-case.ts`:

```ts
import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { AuthenticateUseCase } from '../authenticate.js';

export function makeAuthenticateUseCase() {
  const orgsRepository = new PrismaOrgsRepository();
  return new AuthenticateUseCase(orgsRepository);
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npx biome check src`
Expected: 0 erros.

- [ ] **Step 8: Commit**

```bash
git add src/use-cases/authenticate.ts src/use-cases/errors/invalid-credentials-error.ts src/use-cases/factories/make-authenticate-use-case.ts test/unit/authenticate.spec.ts
git commit -m "feat: add authenticate use-case with invalid credentials error"
```

---

## Task 4: `POST /sessions` — login (controller + rota + e2e)

**Files:**
- Modify: `src/app.ts` (mapear `InvalidCredentialsError` → 401)
- Create: `src/http/controllers/authenticate-controller.ts`
- Modify: `src/http/routes/orgs-routes.ts`
- Test: `test/e2e/authenticate.spec.ts`

- [ ] **Step 1: Escrever o e2e (que falha)**

Crie `test/e2e/authenticate.spec.ts`:

```ts
import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('POST /sessions', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.org.deleteMany();
  });

  async function createOrg() {
    await prisma.org.create({
      data: {
        name: 'Adote SP',
        email: 'adote@sp.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5511999999999',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista',
      },
    });
  }

  it('should authenticate and return a token plus a refresh cookie', async () => {
    await createOrg();

    const response = await request(app.server)
      .post('/sessions')
      .send({ email: 'adote@sp.com', password: '123456' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ token: expect.any(String) });
    expect(response.get('Set-Cookie')).toEqual([
      expect.stringContaining('refreshToken='),
    ]);
  });

  it('should return 401 with invalid credentials', async () => {
    const response = await request(app.server)
      .post('/sessions')
      .send({ email: 'nobody@sp.com', password: '123456' });

    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar o e2e e confirmar que falha**

Run: `npx vitest run test/e2e/authenticate.spec.ts`
Expected: FAIL — a rota `/sessions` não existe (404), então as asserções de 200/401 falham.

- [ ] **Step 3: Mapear `InvalidCredentialsError` → 401 no handler global**

Em `src/app.ts`, adicione o import e o branch no `setErrorHandler`.

Import (junto aos outros, no topo):

```ts
import { InvalidCredentialsError } from './use-cases/errors/invalid-credentials-error.js';
```

Branch dentro do `setErrorHandler`, antes do fallback 500:

```ts
if (error instanceof InvalidCredentialsError) {
  return reply.status(401).send({ message: error.message });
}
```

- [ ] **Step 4: Criar o controller**

Crie `src/http/controllers/authenticate-controller.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../../env/index.js';
import { makeAuthenticateUseCase } from '../../use-cases/factories/make-authenticate-use-case.js';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authenticateController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { email, password } = bodySchema.parse(request.body);

  const authenticate = makeAuthenticateUseCase();
  const { org } = await authenticate.execute({ email, password });

  const token = await reply.jwtSign(
    { role: org.role },
    { sign: { sub: org.id } },
  );

  const refreshToken = await reply.jwtSign(
    { role: org.role },
    { sign: { sub: org.id, expiresIn: '7d' } },
  );

  return reply
    .setCookie('refreshToken', refreshToken, {
      path: '/',
      secure: env.NODE_ENV === 'production',
      sameSite: true,
      httpOnly: true,
    })
    .status(200)
    .send({ token });
}
```

- [ ] **Step 5: Registrar a rota**

Em `src/http/routes/orgs-routes.ts`, adicione o import e o registro:

```ts
import type { FastifyInstance } from 'fastify';
import { authenticateController } from '../controllers/authenticate-controller.js';
import { registerOrgController } from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post('/orgs', registerOrgController);
  app.post('/sessions', authenticateController);
}
```

- [ ] **Step 6: Rodar o e2e e confirmar que passa**

Run: `npx vitest run test/e2e/authenticate.spec.ts`
Expected: PASS — 2 testes verdes (200 com token+cookie, 401 com credenciais inválidas).

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npx biome check src`
Expected: 0 erros.

- [ ] **Step 8: Commit**

```bash
git add src/app.ts src/http/controllers/authenticate-controller.ts src/http/routes/orgs-routes.ts test/e2e/authenticate.spec.ts
git commit -m "feat: add POST /sessions login route"
```

---

## Task 5: `PATCH /token/refresh` — rotação de token (controller + rota + e2e)

**Files:**
- Create: `src/http/controllers/refresh-controller.ts`
- Modify: `src/http/routes/orgs-routes.ts`
- Test: `test/e2e/token-refresh.spec.ts`

- [ ] **Step 1: Escrever o e2e (que falha)**

Crie `test/e2e/token-refresh.spec.ts`:

```ts
import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('PATCH /token/refresh', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.org.deleteMany();
  });

  async function createAndAuthenticate() {
    await prisma.org.create({
      data: {
        name: 'Adote SP',
        email: 'adote@sp.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5511999999999',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista',
      },
    });

    const auth = await request(app.server)
      .post('/sessions')
      .send({ email: 'adote@sp.com', password: '123456' });

    return auth.get('Set-Cookie');
  }

  it('should issue a new token and a new refresh cookie', async () => {
    const cookies = await createAndAuthenticate();

    const response = await request(app.server)
      .patch('/token/refresh')
      .set('Cookie', cookies)
      .send();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ token: expect.any(String) });
    expect(response.get('Set-Cookie')).toEqual([
      expect.stringContaining('refreshToken='),
    ]);
  });

  it('should return 401 (not 500) without the refresh cookie', async () => {
    const response = await request(app.server).patch('/token/refresh').send();

    expect(response.statusCode).toBe(401);
  });
});
```

- [ ] **Step 2: Rodar o e2e e confirmar que falha**

Run: `npx vitest run test/e2e/token-refresh.spec.ts`
Expected: FAIL — rota `/token/refresh` inexistente (404).

- [ ] **Step 3: Criar o controller (com try/catch → 401)**

Crie `src/http/controllers/refresh-controller.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../env/index.js';

export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify({ onlyCookie: true });
  } catch {
    return reply.status(401).send({ message: 'Unauthorized.' });
  }

  const { sub, role } = request.user;

  const token = await reply.jwtSign({ role }, { sign: { sub } });

  const refreshToken = await reply.jwtSign(
    { role },
    { sign: { sub, expiresIn: '7d' } },
  );

  return reply
    .setCookie('refreshToken', refreshToken, {
      path: '/',
      secure: env.NODE_ENV === 'production',
      sameSite: true,
      httpOnly: true,
    })
    .status(200)
    .send({ token });
}
```

- [ ] **Step 4: Registrar a rota**

Em `src/http/routes/orgs-routes.ts`, adicione o import e o registro `PATCH /token/refresh`:

```ts
import type { FastifyInstance } from 'fastify';
import { authenticateController } from '../controllers/authenticate-controller.js';
import { refreshController } from '../controllers/refresh-controller.js';
import { registerOrgController } from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post('/orgs', registerOrgController);
  app.post('/sessions', authenticateController);
  app.patch('/token/refresh', refreshController);
}
```

- [ ] **Step 5: Rodar o e2e e confirmar que passa**

Run: `npx vitest run test/e2e/token-refresh.spec.ts`
Expected: PASS — 2 testes verdes (200 com novo token+cookie; 401 sem cookie, **não** 500).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx biome check src`
Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/http/controllers/refresh-controller.ts src/http/routes/orgs-routes.ts test/e2e/token-refresh.spec.ts
git commit -m "feat: add PATCH /token/refresh route with token rotation"
```

---

## Task 6: Middlewares de RBAC — `verifyJWT` + `verifyUserRole` (e2e isolado)

**Files:**
- Create: `src/http/middlewares/verify-jwt.ts`
- Create: `src/http/middlewares/verify-user-role.ts`
- Test: `test/e2e/verify-role.spec.ts`

> Como ainda não há rota de produção protegida (o `POST /pets` é de outro spec), os middlewares são testados num app Fastify isolado, montado dentro do próprio arquivo de teste.

- [ ] **Step 1: Escrever o e2e isolado (que falha)**

Crie `test/e2e/verify-role.spec.ts`:

```ts
import fastifyJwt from '@fastify/jwt';
import fastify from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '@/env';
import { verifyJWT } from '@/http/middlewares/verify-jwt';
import { verifyUserRole } from '@/http/middlewares/verify-user-role';

const app = fastify();

beforeAll(async () => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.post('/sign', async (request, reply) => {
    const { role } = request.body as { role: 'ORG' | 'ADMIN' };
    const token = await reply.jwtSign({ role }, { sign: { sub: 'org-1' } });
    return reply.send({ token });
  });

  app.get(
    '/only-org',
    { onRequest: [verifyJWT, verifyUserRole('ORG')] },
    async () => {
      return { ok: true };
    },
  );

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('RBAC middlewares', () => {
  async function signToken(role: 'ORG' | 'ADMIN') {
    const response = await request(app.server).post('/sign').send({ role });
    return response.body.token as string;
  }

  it('should return 401 without a token', async () => {
    const response = await request(app.server).get('/only-org');
    expect(response.statusCode).toBe(401);
  });

  it('should return 200 with a valid ORG token', async () => {
    const token = await signToken('ORG');

    const response = await request(app.server)
      .get('/only-org')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('should return 403 with a divergent role', async () => {
    const token = await signToken('ADMIN');

    const response = await request(app.server)
      .get('/only-org')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar o e2e e confirmar que falha**

Run: `npx vitest run test/e2e/verify-role.spec.ts`
Expected: FAIL — não resolve `@/http/middlewares/verify-jwt` nem `@/http/middlewares/verify-user-role`.

- [ ] **Step 3: Criar `verifyJWT`**

Crie `src/http/middlewares/verify-jwt.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';

export async function verifyJWT(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ message: 'Unauthorized.' });
  }
}
```

- [ ] **Step 4: Criar `verifyUserRole`**

Crie `src/http/middlewares/verify-user-role.ts`:

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';

export function verifyUserRole(roleToVerify: 'ORG' | 'ADMIN') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;

    if (role !== roleToVerify) {
      return reply.status(403).send({ message: 'Forbidden.' });
    }
  };
}
```

- [ ] **Step 5: Rodar o e2e e confirmar que passa**

Run: `npx vitest run test/e2e/verify-role.spec.ts`
Expected: PASS — 3 testes verdes (401 sem token, 200 com ORG, 403 com role divergente).

- [ ] **Step 6: Typecheck + lint**

Run: `npx tsc --noEmit && npx biome check src`
Expected: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/http/middlewares/verify-jwt.ts src/http/middlewares/verify-user-role.ts test/e2e/verify-role.spec.ts
git commit -m "feat: add verifyJWT and verifyUserRole RBAC middlewares"
```

---

## Verificação final (Definition of Done)

- [ ] **Suíte completa verde**

Run: `npx vitest run`
Expected: PASS — todos os arquivos (register-org unit/e2e, authenticate unit, sessions e2e, token-refresh e2e, verify-role e2e).

- [ ] **Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 erros.

- [ ] **Lint**

Run: `npm run lint`
Expected: `biome check src` sem erros.

- [ ] **Checklist da spec**
  - [ ] Migration `add-role-to-org` aplicada; `Org.role` default `ORG`.
  - [ ] `fastifyCookie` registrado antes do `fastifyJwt`; jwt com `cookie` + `sign.expiresIn`.
  - [ ] `InvalidCredentialsError` mapeado para 401 no `setErrorHandler`.
  - [ ] `POST /sessions` e `PATCH /token/refresh` funcionando (com rotação do refresh).
  - [ ] `PATCH /token/refresh` responde 401 (não 500) para cookie ausente/inválido/expirado.
  - [ ] `verifyJWT` (401 sem token) e `verifyUserRole` (403 em role divergente) implementados e tipados.

---

## Fora de escopo (conforme a spec — não implementar aqui)

- Documentação Swagger/Scalar das novas rotas e `security: [{ bearerAuth: [] }]`.
- CORS com credenciais (`@fastify/cors`).
- Logout, superfície `ADMIN`-only, refresh stateful.
- Aplicação de `verifyJWT`/`verifyUserRole('ORG')` no `POST /pets` (depende do spec de Pets).
