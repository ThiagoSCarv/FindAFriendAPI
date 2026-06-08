# POST /orgs — Register Org Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a rota `POST /orgs` que cadastra uma organização com lookup automático de endereço via ViaCEP.

**Architecture:** Controller → Factory → UseCase com `ICepProvider` injetado (ViaCEP em produção, InMemory em testes) e `IOrgsRepository` (Prisma em produção, InMemory em testes). O handler global de erros em `app.ts` mapeia erros de domínio para status HTTP.

**Tech Stack:** Fastify 5, Prisma 7, Zod 4, bcryptjs, Vitest 4, Supertest

---

### Task 1: Vitest config

**Files:**
- Create: `vitest.config.ts`

- [ ] **Step 1: Criar vitest.config.ts**

```ts
// vitest.config.ts
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 2: Verificar que o vitest encontra a config**

Run: `npx vitest run 2>&1 | head -5`
Expected: sem erro de config (pode dizer "no test files found")

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "chore: add vitest config with tsconfig path aliases"
```

---

### Task 2: ICepProvider interface + InMemoryCepProvider

**Files:**
- Create: `src/providers/cep/interfaces/ICepProvider.ts`
- Create: `src/providers/cep/in-memory-cep-provider.ts`

- [ ] **Step 1: Criar ICepProvider**

```ts
// src/providers/cep/interfaces/ICepProvider.ts
export type CepData = {
  city: string;
  state: string;
  address: string;
};

export interface ICepProvider {
  fetch(cep: string): Promise<CepData | null>;
}
```

- [ ] **Step 2: Criar InMemoryCepProvider**

```ts
// src/providers/cep/in-memory-cep-provider.ts
import type { CepData, ICepProvider } from './interfaces/ICepProvider.js';

export class InMemoryCepProvider implements ICepProvider {
  private data = new Map<string, CepData>();

  addCep(cep: string, data: CepData): void {
    this.data.set(cep, data);
  }

  async fetch(cep: string): Promise<CepData | null> {
    return this.data.get(cep) ?? null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/providers/
git commit -m "feat: add ICepProvider interface and InMemoryCepProvider"
```

---

### Task 3: IOrgsRepository + InMemoryOrgsRepository

**Files:**
- Create: `src/repositories/interfaces/IOrgsRepository.ts`
- Create: `src/repositories/in-memory/in-memory-orgs-repository.ts`

- [ ] **Step 1: Criar IOrgsRepository**

```ts
// src/repositories/interfaces/IOrgsRepository.ts
import type { Org } from '@prisma/client';

export type OrgCreateInput = {
  name: string;
  email: string;
  password_hash: string;
  whatsapp: string;
  cep: string;
  city: string;
  state: string;
  address: string;
};

export interface IOrgsRepository {
  create(data: OrgCreateInput): Promise<Org>;
  findByEmail(email: string): Promise<Org | null>;
}
```

- [ ] **Step 2: Criar InMemoryOrgsRepository**

```ts
// src/repositories/in-memory/in-memory-orgs-repository.ts
import type { Org } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type {
  IOrgsRepository,
  OrgCreateInput,
} from '../interfaces/IOrgsRepository.js';

export class InMemoryOrgsRepository implements IOrgsRepository {
  public items: Org[] = [];

  async create(data: OrgCreateInput): Promise<Org> {
    const org: Org = {
      id: randomUUID(),
      created_at: new Date(),
      ...data,
    };
    this.items.push(org);
    return org;
  }

  async findByEmail(email: string): Promise<Org | null> {
    return this.items.find((item) => item.email === email) ?? null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/repositories/
git commit -m "feat: add IOrgsRepository interface and InMemoryOrgsRepository"
```

---

### Task 4: OrgAlreadyExistsError

**Files:**
- Create: `src/use-cases/errors/org-already-exists-error.ts`

- [ ] **Step 1: Criar classe de erro**

```ts
// src/use-cases/errors/org-already-exists-error.ts
export class OrgAlreadyExistsError extends Error {
  constructor() {
    super('Organization with this email already exists.');
    this.name = 'OrgAlreadyExistsError';
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/use-cases/errors/
git commit -m "feat: add OrgAlreadyExistsError"
```

---

### Task 5: Testes unitários do RegisterOrgUseCase (RED)

**Files:**
- Create: `test/unit/register-org.spec.ts`

- [ ] **Step 1: Escrever os testes (devem falhar)**

```ts
// test/unit/register-org.spec.ts
import { InMemoryCepProvider } from '@/providers/cep/in-memory-cep-provider';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { OrgAlreadyExistsError } from '@/use-cases/errors/org-already-exists-error';
import { RegisterOrgUseCase } from '@/use-cases/register-org';
import { compare } from 'bcryptjs';
import { beforeEach, describe, expect, it } from 'vitest';

describe('RegisterOrgUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let cepProvider: InMemoryCepProvider;
  let sut: RegisterOrgUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    cepProvider = new InMemoryCepProvider();
    sut = new RegisterOrgUseCase(orgsRepository, cepProvider);
  });

  it('should create an org with address data from ViaCEP', async () => {
    cepProvider.addCep('01310100', {
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
    });

    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    expect(org.city).toBe('São Paulo');
    expect(org.state).toBe('SP');
    expect(org.address).toBe('Avenida Paulista');
  });

  it('should accept org with empty address when CEP is not found', async () => {
    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '99999999',
    });

    expect(org.city).toBe('');
    expect(org.state).toBe('');
    expect(org.address).toBe('');
  });

  it('should let explicit body fields override ViaCEP data', async () => {
    cepProvider.addCep('01310100', {
      city: 'São Paulo',
      state: 'SP',
      address: 'Avenida Paulista',
    });

    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'Campinas',
    });

    expect(org.city).toBe('Campinas');
    expect(org.state).toBe('SP');
  });

  it('should throw OrgAlreadyExistsError when email is already taken', async () => {
    await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    await expect(() =>
      sut.execute({
        name: 'Adote SP 2',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '01310100',
      }),
    ).rejects.toBeInstanceOf(OrgAlreadyExistsError);
  });

  it('should hash the password before storing', async () => {
    const { org } = await sut.execute({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    });

    const isHashed = await compare('123456', org.password_hash);
    expect(isHashed).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que os testes falham**

Run: `npx vitest run test/unit/register-org.spec.ts`
Expected: FAIL — "Cannot find module '@/use-cases/register-org'"

- [ ] **Step 3: Commit dos testes (red)**

```bash
git add test/unit/register-org.spec.ts
git commit -m "test: add unit tests for RegisterOrgUseCase (red)"
```

---

### Task 6: Implementação do RegisterOrgUseCase (GREEN)

**Files:**
- Create: `src/use-cases/register-org.ts`

- [ ] **Step 1: Implementar RegisterOrgUseCase**

```ts
// src/use-cases/register-org.ts
import type { Org } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { ICepProvider } from '../providers/cep/interfaces/ICepProvider.js';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import { OrgAlreadyExistsError } from './errors/org-already-exists-error.js';

interface RegisterOrgInput {
  name: string;
  email: string;
  password: string;
  whatsapp: string;
  cep: string;
  city?: string;
  state?: string;
  address?: string;
}

interface RegisterOrgOutput {
  org: Org;
}

export class RegisterOrgUseCase {
  constructor(
    private orgsRepository: IOrgsRepository,
    private cepProvider: ICepProvider,
  ) {}

  async execute(data: RegisterOrgInput): Promise<RegisterOrgOutput> {
    const existing = await this.orgsRepository.findByEmail(data.email);
    if (existing) throw new OrgAlreadyExistsError();

    const cepData = await this.cepProvider.fetch(data.cep);

    const city = data.city ?? cepData?.city ?? '';
    const state = data.state ?? cepData?.state ?? '';
    const address = data.address ?? cepData?.address ?? '';
    const password_hash = await hash(data.password, 6);

    const org = await this.orgsRepository.create({
      name: data.name,
      email: data.email,
      password_hash,
      whatsapp: data.whatsapp,
      cep: data.cep,
      city,
      state,
      address,
    });

    return { org };
  }
}
```

- [ ] **Step 2: Rodar e confirmar que os testes passam**

Run: `npx vitest run test/unit/register-org.spec.ts`
Expected: 5 testes PASS

- [ ] **Step 3: Commit**

```bash
git add src/use-cases/register-org.ts
git commit -m "feat: implement RegisterOrgUseCase"
```

---

### Task 7: PrismaOrgsRepository

**Files:**
- Create: `src/repositories/prisma/prisma-orgs-repository.ts`

- [ ] **Step 1: Implementar PrismaOrgsRepository**

```ts
// src/repositories/prisma/prisma-orgs-repository.ts
import type { Org } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  IOrgsRepository,
  OrgCreateInput,
} from '../interfaces/IOrgsRepository.js';

export class PrismaOrgsRepository implements IOrgsRepository {
  async create(data: OrgCreateInput): Promise<Org> {
    return prisma.org.create({ data });
  }

  async findByEmail(email: string): Promise<Org | null> {
    return prisma.org.findUnique({ where: { email } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/repositories/prisma/
git commit -m "feat: add PrismaOrgsRepository"
```

---

### Task 8: ViaCepProvider

**Files:**
- Create: `src/providers/cep/viacep-provider.ts`

- [ ] **Step 1: Implementar ViaCepProvider**

```ts
// src/providers/cep/viacep-provider.ts
import type { CepData, ICepProvider } from './interfaces/ICepProvider.js';

interface ViaCepResponse {
  erro?: boolean;
  logradouro: string;
  localidade: string;
  uf: string;
}

export class ViaCepProvider implements ICepProvider {
  async fetch(cep: string): Promise<CepData | null> {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return null;

    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) return null;

    return {
      city: data.localidade,
      state: data.uf,
      address: data.logradouro,
    };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/cep/viacep-provider.ts
git commit -m "feat: add ViaCepProvider"
```

---

### Task 9: Factory + Controller + Route

**Files:**
- Create: `src/use-cases/factories/make-register-org-use-case.ts`
- Create: `src/http/controllers/register-org-controller.ts`
- Create: `src/http/routes/orgs-routes.ts`

- [ ] **Step 1: Criar factory**

```ts
// src/use-cases/factories/make-register-org-use-case.ts
import { ViaCepProvider } from '../../providers/cep/viacep-provider.js';
import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { RegisterOrgUseCase } from '../register-org.js';

export function makeRegisterOrgUseCase() {
  const orgsRepository = new PrismaOrgsRepository();
  const cepProvider = new ViaCepProvider();
  return new RegisterOrgUseCase(orgsRepository, cepProvider);
}
```

- [ ] **Step 2: Criar controller**

```ts
// src/http/controllers/register-org-controller.ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeRegisterOrgUseCase } from '../../use-cases/factories/make-register-org-use-case.js';

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  whatsapp: z.string().regex(/^\+55\d{2}9?\d{8}$/),
  cep: z.string().regex(/^\d{8}$/),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
});

export async function registerOrgController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const data = bodySchema.parse(request.body);
  const registerOrg = makeRegisterOrgUseCase();
  await registerOrg.execute(data);
  return reply.status(201).send();
}
```

- [ ] **Step 3: Criar route**

```ts
// src/http/routes/orgs-routes.ts
import type { FastifyInstance } from 'fastify';
import { registerOrgController } from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post('/orgs', registerOrgController);
}
```

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/factories/ src/http/
git commit -m "feat: add factory, controller and route for register org"
```

---

### Task 10: Error handler + registrar rota em app.ts

**Files:**
- Modify: `src/app.ts`

- [ ] **Step 1: Atualizar app.ts com error handler e registro da rota**

Substituir o conteúdo completo de `src/app.ts`:

```ts
import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './env/index.js';
import { orgsRoutes } from './http/routes/orgs-routes.js';
import { OrgAlreadyExistsError } from './use-cases/errors/org-already-exists-error.js';

export const app = fastify({ logger: env.NODE_ENV === 'development' });

app.register(fastifySwagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'FindAFriend API',
      description: 'API para adoção de animais de estimação',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

app.register(scalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    title: 'FindAFriend API',
    theme: 'purple',
  },
});

app.register(fastifyJwt, { secret: env.JWT_SECRET });
app.register(fastifyCookie);
app.register(orgsRoutes);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.flatten().fieldErrors,
    });
  }
  if (error instanceof OrgAlreadyExistsError) {
    return reply.status(409).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'Internal server error.' });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/app.ts
git commit -m "feat: register orgs route and add global error handler"
```

---

### Task 11: Testes E2E

**Files:**
- Create: `test/e2e/register-org.spec.ts`

**Pré-requisito:** PostgreSQL rodando (`docker compose up -d`) e `.env` com `DATABASE_URL` válida apontando para o banco de testes.

- [ ] **Step 1: Escrever os testes E2E**

```ts
// test/e2e/register-org.spec.ts
import 'dotenv/config';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/providers/cep/viacep-provider', () => ({
  ViaCepProvider: class {
    async fetch(cep: string) {
      if (cep === '01310100') {
        return { city: 'São Paulo', state: 'SP', address: 'Av. Paulista' };
      }
      return null;
    }
  },
}));

describe('POST /orgs', () => {
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

  it('should return 201 on success', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '01310100',
      });

    expect(response.statusCode).toBe(201);
  });

  it('should return 409 when email is already taken', async () => {
    const body = {
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    };

    await request(app.server).post('/orgs').send(body);
    const response = await request(app.server).post('/orgs').send(body);

    expect(response.statusCode).toBe(409);
  });

  it('should return 400 when whatsapp format is invalid', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '11999999999',
        cep: '01310100',
      });

    expect(response.statusCode).toBe(400);
  });

  it('should return 201 when CEP is not found and no address provided', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '99999999',
      });

    expect(response.statusCode).toBe(201);
  });
});
```

- [ ] **Step 2: Rodar os testes E2E**

Run: `npx vitest run test/e2e/register-org.spec.ts`
Expected: 4 testes PASS

- [ ] **Step 3: Commit**

```bash
git add test/e2e/register-org.spec.ts
git commit -m "test: add e2e tests for POST /orgs"
```
