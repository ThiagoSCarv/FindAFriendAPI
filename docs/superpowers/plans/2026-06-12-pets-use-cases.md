# Pets — Camada Interna (use-cases + repositório in-memory) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a lógica de negócio das três funcionalidades de Pet (#4 Cadastro, #5 Listagem por cidade, #6 Detalhes) na camada interna — interface `IPetsRepository`, double in-memory, três use-cases e o erro `ResourceNotFoundError` — validada por testes unitários via TDD, sem tocar em HTTP/Prisma de pets.

**Architecture:** Use-cases dependem apenas de interfaces de repositório (injeção por construtor) e lançam erros de domínio. `InMemoryPetsRepository` reproduz o comportamento observável da futura query Prisma: como `Pet` não tem `city`, a busca por cidade passa pela relação `org` — o double recebe o `InMemoryOrgsRepository` no construtor e resolve `Org.city` via `org_id`. O use-case não sabe disso: só conhece `IPetsRepository`.

**Tech Stack:** TypeScript (ESM, imports relativos com `.js` em `src/`; alias `@/` sem extensão em `test/`), Vitest, Biome, Prisma (apenas tipos de `@prisma/client` + um toque em `PrismaOrgsRepository`).

---

## Verification notes (este ambiente)

- **Vitest roda via esbuild e NÃO faz typecheck.** Toda task que mexe em tipos roda também `npx tsc --noEmit` (o `tsconfig.json` inclui `src` e `test`, então o typecheck cobre os testes).
- **O proxy `rtk` mascara a saída de `tsc`/`biome`/`tsup`** — pode imprimir "No errors found" mesmo com erro. Confirme sempre pelo **exit code** (no fish: `echo $status` logo após o comando) ou rode via `rtk proxy <cmd>`. `0` = sucesso.
- **Não rode `npm run build`** aqui: o `tsup src` quebra por causa dos arquivos `CLAUDE.md` dentro de `src/` (pré-existente, fora de escopo). O gate desta camada é `tsc --noEmit` + `vitest` + `biome check src`.
- `npm run lint` = `biome check src` (só cobre `src/`; arquivos em `test/` não são lintados pelo script, mas são typechecados pelo `tsc`).
- Commits **sem** co-author do Claude (regra do `CLAUDE.md` do projeto). Não commitar arquivos `CLAUDE.md` nem este plano.

---

## File Structure

**Novos**
| Arquivo | Responsabilidade |
|---|---|
| `src/use-cases/errors/resource-not-found-error.ts` | Erro de domínio genérico "não encontrado" (futuro → 404). |
| `src/repositories/interfaces/IPetsRepository.ts` | Contrato + tipos `PetCreateInput` / `FindManyByCityParams`. |
| `src/repositories/in-memory/in-memory-pets-repository.ts` | Double in-memory; resolve cidade via `InMemoryOrgsRepository`; pagina 20/pág. |
| `src/use-cases/register-pet.ts` | `RegisterPetUseCase` — valida org, cria pet. |
| `src/use-cases/get-pet-details.ts` | `GetPetDetailsUseCase` — busca por id. |
| `src/use-cases/search-pets-by-city.ts` | `SearchPetsByCityUseCase` — delega a busca por cidade. |
| `test/unit/register-pet.spec.ts` | Testes unitários do cadastro. |
| `test/unit/get-pet-details.spec.ts` | Testes unitários dos detalhes. |
| `test/unit/search-pets-by-city.spec.ts` | Testes unitários da busca + paginação. |

**Alterados**
| Arquivo | Mudança |
|---|---|
| `src/repositories/interfaces/IOrgsRepository.ts` | Adicionar `findById(id): Promise<Org \| null>`. |
| `src/repositories/in-memory/in-memory-orgs-repository.ts` | Implementar `findById`. |
| `src/repositories/prisma/prisma-orgs-repository.ts` | Implementar `findById` (`prisma.org.findUnique`) — só para manter o `tsc` verde. |

**Sem alteração:** `prisma/schema.prisma` (o `model Pet` já existe), `src/env/index.ts`.

> **Nota TDD / test doubles:** as Tasks 1–2 criam contratos, um erro e um *test double* (in-memory) — não são lógica de negócio, então não têm teste próprio. O comportamento de cada método do double é exercido pelos testes de use-case: `create` (Task 3), `findById` de pet (Task 4) e `findManyByCity` (Task 5). Construímos os 3 métodos do double de uma vez porque o TypeScript exige que `implements IPetsRepository` os tenha todos.

---

## Task 1: `findById` no repositório de Orgs + `ResourceNotFoundError`

Plumbing compartilhado que o `RegisterPetUseCase` precisa. Estender `IOrgsRepository` obriga (via `implements`) a implementar `findById` também no Prisma — senão o `tsc` quebra.

**Files:**
- Modify: `src/repositories/interfaces/IOrgsRepository.ts`
- Modify: `src/repositories/in-memory/in-memory-orgs-repository.ts`
- Modify: `src/repositories/prisma/prisma-orgs-repository.ts`
- Create: `src/use-cases/errors/resource-not-found-error.ts`

- [ ] **Step 1: Adicionar `findById` ao contrato `IOrgsRepository`**

Em `src/repositories/interfaces/IOrgsRepository.ts`, acrescentar a assinatura na interface (mantendo o resto):

```ts
export interface IOrgsRepository {
  create(data: OrgCreateInput): Promise<Org>;
  findByEmail(email: string): Promise<Org | null>;
  findById(id: string): Promise<Org | null>;
}
```

- [ ] **Step 2: Implementar `findById` no in-memory**

Em `src/repositories/in-memory/in-memory-orgs-repository.ts`, adicionar o método dentro da classe, após `findByEmail`:

```ts
  async findById(id: string): Promise<Org | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
```

- [ ] **Step 3: Implementar `findById` no Prisma**

Em `src/repositories/prisma/prisma-orgs-repository.ts`, adicionar o método dentro da classe, após `findByEmail`:

```ts
  async findById(id: string): Promise<Org | null> {
    return prisma.org.findUnique({ where: { id } });
  }
```

- [ ] **Step 4: Criar o erro de domínio**

Criar `src/use-cases/errors/resource-not-found-error.ts`:

```ts
export class ResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found.');
    this.name = 'ResourceNotFoundError';
  }
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit` (no fish, confirme com `echo $status` em seguida)
Expected: exit code `0`, sem erros.

- [ ] **Step 6: Verificar lint**

Run: `npm run lint`
Expected: exit code `0` (`biome check src` sem erros). Se reclamar de formatação, rode `npm run format` e repita.

- [ ] **Step 7: Commit**

```bash
git add src/repositories/interfaces/IOrgsRepository.ts src/repositories/in-memory/in-memory-orgs-repository.ts src/repositories/prisma/prisma-orgs-repository.ts src/use-cases/errors/resource-not-found-error.ts
git commit -m "feat: add findById to orgs repository and ResourceNotFoundError"
```

---

## Task 2: Contrato `IPetsRepository` + double in-memory

Cria a interface (com `PetCreateInput` / `FindManyByCityParams`) e o `InMemoryPetsRepository` completo (3 métodos), incluindo a resolução de cidade via `InMemoryOrgsRepository` e a paginação de 20/página.

**Files:**
- Create: `src/repositories/interfaces/IPetsRepository.ts`
- Create: `src/repositories/in-memory/in-memory-pets-repository.ts`

- [ ] **Step 1: Criar a interface e os tipos**

Criar `src/repositories/interfaces/IPetsRepository.ts` (os tipos `Age`, `EnergyLevel`, `Environment`, `Independence`, `Pet`, `Size` vêm de `@prisma/client`; ordem alfabética dos imports nomeados conforme o Biome):

```ts
import type {
  Age,
  EnergyLevel,
  Environment,
  Independence,
  Pet,
  Size,
} from '@prisma/client';

export type PetCreateInput = {
  name: string;
  about: string;
  age: Age;
  size: Size;
  energy_level: EnergyLevel;
  independence: Independence;
  environment: Environment;
  photos: string[];
  requirements: string[];
  org_id: string;
};

export type FindManyByCityParams = {
  city: string;
  age?: Age;
  size?: Size;
  energy_level?: EnergyLevel;
  independence?: Independence;
  environment?: Environment;
  page: number;
};

export interface IPetsRepository {
  create(data: PetCreateInput): Promise<Pet>;
  findById(id: string): Promise<Pet | null>;
  findManyByCity(params: FindManyByCityParams): Promise<Pet[]>;
}
```

- [ ] **Step 2: Criar o double in-memory**

Criar `src/repositories/in-memory/in-memory-pets-repository.ts`. Como `Pet` não tem `city`, `findManyByCity` resolve as orgs da cidade via `orgsRepository.items` e filtra os pets por `org_id`:

```ts
import { randomUUID } from 'node:crypto';
import type { Pet } from '@prisma/client';
import type {
  FindManyByCityParams,
  IPetsRepository,
  PetCreateInput,
} from '../interfaces/IPetsRepository.js';
import type { InMemoryOrgsRepository } from './in-memory-orgs-repository.js';

const ITEMS_PER_PAGE = 20;

export class InMemoryPetsRepository implements IPetsRepository {
  public items: Pet[] = [];

  // recebe o repo de orgs para resolver Org.city via org_id (a busca passa pela relação)
  constructor(private orgsRepository: InMemoryOrgsRepository) {}

  async create(data: PetCreateInput): Promise<Pet> {
    const pet: Pet = { id: randomUUID(), created_at: new Date(), ...data };
    this.items.push(pet);
    return pet;
  }

  async findById(id: string): Promise<Pet | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findManyByCity(params: FindManyByCityParams): Promise<Pet[]> {
    const orgIdsInCity = new Set(
      this.orgsRepository.items
        .filter((org) => org.city === params.city)
        .map((org) => org.id),
    );

    return this.items
      .filter((pet) => orgIdsInCity.has(pet.org_id))
      .filter((pet) => !params.age || pet.age === params.age)
      .filter((pet) => !params.size || pet.size === params.size)
      .filter(
        (pet) =>
          !params.energy_level || pet.energy_level === params.energy_level,
      )
      .filter(
        (pet) =>
          !params.independence || pet.independence === params.independence,
      )
      .filter(
        (pet) => !params.environment || pet.environment === params.environment,
      )
      .slice((params.page - 1) * ITEMS_PER_PAGE, params.page * ITEMS_PER_PAGE);
  }
}
```

- [ ] **Step 3: Formatar (deixar o Biome ajustar quebras de linha)**

Run: `npm run format`
Expected: exit code `0`. O Biome pode requebrar a cadeia de `.filter(...)` — aceite o resultado formatado.

- [ ] **Step 4: Verificar typecheck**

Run: `npx tsc --noEmit` (confirme `echo $status`)
Expected: exit code `0`, sem erros.

- [ ] **Step 5: Verificar lint**

Run: `npm run lint`
Expected: exit code `0`.

- [ ] **Step 6: Commit**

```bash
git add src/repositories/interfaces/IPetsRepository.ts src/repositories/in-memory/in-memory-pets-repository.ts
git commit -m "feat: add IPetsRepository contract and in-memory implementation"
```

---

## Task 3: `RegisterPetUseCase` (TDD)

Valida que a org existe (`orgsRepository.findById`) antes de criar o pet — defende **[RN-03]**.

**Files:**
- Test: `test/unit/register-pet.spec.ts`
- Create: `src/use-cases/register-pet.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/unit/register-pet.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error';
import { RegisterPetUseCase } from '@/use-cases/register-pet';

describe('RegisterPetUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: RegisterPetUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new RegisterPetUseCase(petsRepository, orgsRepository);
  });

  async function createOrg() {
    return orgsRepository.create({
      name: 'Adote SP',
      email: 'adote@sp.com',
      password_hash: 'hash',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city: 'São Paulo',
      state: 'SP',
      address: 'Av. Paulista',
    });
  }

  it('should register a pet for an existing org', async () => {
    const org = await createOrg();

    const { pet } = await sut.execute({
      name: 'Rex',
      about: 'Cão dócil',
      age: 'PUPPY',
      size: 'MEDIUM',
      energy_level: 'HIGH',
      independence: 'LOW',
      environment: 'MEDIUM',
      photos: ['rex.jpg'],
      requirements: ['Espaço amplo'],
      org_id: org.id,
    });

    expect(pet.id).toEqual(expect.any(String));
    expect(pet.org_id).toBe(org.id);
  });

  it('should throw ResourceNotFoundError when the org does not exist', async () => {
    await expect(() =>
      sut.execute({
        name: 'Rex',
        about: 'Cão dócil',
        age: 'PUPPY',
        size: 'MEDIUM',
        energy_level: 'HIGH',
        independence: 'LOW',
        environment: 'MEDIUM',
        photos: ['rex.jpg'],
        requirements: ['Espaço amplo'],
        org_id: 'non-existing-org-id',
      }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/unit/register-pet.spec.ts`
Expected: FAIL — não resolve `@/use-cases/register-pet` (módulo inexistente).

- [ ] **Step 3: Implementar o use-case (mínimo para passar)**

Criar `src/use-cases/register-pet.ts`:

```ts
import type { Pet } from '@prisma/client';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import type {
  IPetsRepository,
  PetCreateInput,
} from '../repositories/interfaces/IPetsRepository.js';
import { ResourceNotFoundError } from './errors/resource-not-found-error.js';

interface RegisterPetOutput {
  pet: Pet;
}

export class RegisterPetUseCase {
  constructor(
    private petsRepository: IPetsRepository,
    private orgsRepository: IOrgsRepository,
  ) {}

  async execute(data: PetCreateInput): Promise<RegisterPetOutput> {
    const org = await this.orgsRepository.findById(data.org_id);

    if (!org) {
      throw new ResourceNotFoundError();
    }

    const pet = await this.petsRepository.create(data);

    return { pet };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/unit/register-pet.spec.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (confirme `echo $status`) e `npm run lint`
Expected: ambos exit code `0`. Se o lint pedir formatação, rode `npm run format`.

- [ ] **Step 6: Commit**

```bash
git add test/unit/register-pet.spec.ts src/use-cases/register-pet.ts
git commit -m "feat: add register-pet use-case with org existence check"
```

---

## Task 4: `GetPetDetailsUseCase` (TDD)

Busca um pet por id; lança `ResourceNotFoundError` se ausente.

**Files:**
- Test: `test/unit/get-pet-details.spec.ts`
- Create: `src/use-cases/get-pet-details.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/unit/get-pet-details.spec.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import { ResourceNotFoundError } from '@/use-cases/errors/resource-not-found-error';
import { GetPetDetailsUseCase } from '@/use-cases/get-pet-details';

describe('GetPetDetailsUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: GetPetDetailsUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new GetPetDetailsUseCase(petsRepository);
  });

  it('should return the pet when it exists', async () => {
    const created = await petsRepository.create({
      name: 'Rex',
      about: 'Cão dócil',
      age: 'PUPPY',
      size: 'MEDIUM',
      energy_level: 'HIGH',
      independence: 'LOW',
      environment: 'MEDIUM',
      photos: ['rex.jpg'],
      requirements: ['Espaço amplo'],
      org_id: 'org-1',
    });

    const { pet } = await sut.execute({ petId: created.id });

    expect(pet.id).toBe(created.id);
    expect(pet.name).toBe('Rex');
  });

  it('should throw ResourceNotFoundError when the pet does not exist', async () => {
    await expect(() =>
      sut.execute({ petId: 'non-existing-pet-id' }),
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/unit/get-pet-details.spec.ts`
Expected: FAIL — não resolve `@/use-cases/get-pet-details`.

- [ ] **Step 3: Implementar o use-case (mínimo para passar)**

Criar `src/use-cases/get-pet-details.ts`:

```ts
import type { Pet } from '@prisma/client';
import type { IPetsRepository } from '../repositories/interfaces/IPetsRepository.js';
import { ResourceNotFoundError } from './errors/resource-not-found-error.js';

interface GetPetDetailsInput {
  petId: string;
}

interface GetPetDetailsOutput {
  pet: Pet;
}

export class GetPetDetailsUseCase {
  constructor(private petsRepository: IPetsRepository) {}

  async execute({ petId }: GetPetDetailsInput): Promise<GetPetDetailsOutput> {
    const pet = await this.petsRepository.findById(petId);

    if (!pet) {
      throw new ResourceNotFoundError();
    }

    return { pet };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/unit/get-pet-details.spec.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (confirme `echo $status`) e `npm run lint`
Expected: ambos exit code `0`.

- [ ] **Step 6: Commit**

```bash
git add test/unit/get-pet-details.spec.ts src/use-cases/get-pet-details.ts
git commit -m "feat: add get-pet-details use-case"
```

---

## Task 5: `SearchPetsByCityUseCase` (TDD)

Use-case fino: delega a `petsRepository.findManyByCity`. O join por cidade e a paginação são detalhes do repositório.

**Files:**
- Test: `test/unit/search-pets-by-city.spec.ts`
- Create: `src/use-cases/search-pets-by-city.ts`

- [ ] **Step 1: Escrever o teste que falha**

Criar `test/unit/search-pets-by-city.spec.ts` (cobre: filtro de cidade, um filtro opcional, e paginação 22 → 20 + 2):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryOrgsRepository } from '@/repositories/in-memory/in-memory-orgs-repository';
import { InMemoryPetsRepository } from '@/repositories/in-memory/in-memory-pets-repository';
import type { PetCreateInput } from '@/repositories/interfaces/IPetsRepository';
import { SearchPetsByCityUseCase } from '@/use-cases/search-pets-by-city';

describe('SearchPetsByCityUseCase', () => {
  let orgsRepository: InMemoryOrgsRepository;
  let petsRepository: InMemoryPetsRepository;
  let sut: SearchPetsByCityUseCase;

  beforeEach(() => {
    orgsRepository = new InMemoryOrgsRepository();
    petsRepository = new InMemoryPetsRepository(orgsRepository);
    sut = new SearchPetsByCityUseCase(petsRepository);
  });

  async function createOrgInCity(city: string, email: string) {
    return orgsRepository.create({
      name: 'Adote',
      email,
      password_hash: 'hash',
      whatsapp: '+5511999999999',
      cep: '01310100',
      city,
      state: 'SP',
      address: 'Rua X',
    });
  }

  function petData(
    orgId: string,
    overrides: Partial<PetCreateInput> = {},
  ): PetCreateInput {
    return {
      name: 'Rex',
      about: 'Cão dócil',
      age: 'ADULT',
      size: 'MEDIUM',
      energy_level: 'MEDIUM',
      independence: 'MEDIUM',
      environment: 'MEDIUM',
      photos: [],
      requirements: [],
      org_id: orgId,
      ...overrides,
    };
  }

  it('should return only pets whose org is in the searched city', async () => {
    const spOrg = await createOrgInCity('São Paulo', 'sp@org.com');
    const rjOrg = await createOrgInCity('Rio de Janeiro', 'rj@org.com');

    await petsRepository.create(petData(spOrg.id, { name: 'Paulista' }));
    await petsRepository.create(petData(rjOrg.id, { name: 'Carioca' }));

    const { pets } = await sut.execute({ city: 'São Paulo', page: 1 });

    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Paulista');
  });

  it('should apply an optional filter (age)', async () => {
    const org = await createOrgInCity('São Paulo', 'sp@org.com');

    await petsRepository.create(petData(org.id, { name: 'Filhote', age: 'PUPPY' }));
    await petsRepository.create(petData(org.id, { name: 'Idoso', age: 'SENIOR' }));

    const { pets } = await sut.execute({ city: 'São Paulo', age: 'PUPPY', page: 1 });

    expect(pets).toHaveLength(1);
    expect(pets[0].name).toBe('Filhote');
  });

  it('should paginate results at 20 per page', async () => {
    const org = await createOrgInCity('São Paulo', 'sp@org.com');

    for (let i = 0; i < 22; i++) {
      await petsRepository.create(petData(org.id, { name: `Pet ${i}` }));
    }

    const page1 = await sut.execute({ city: 'São Paulo', page: 1 });
    const page2 = await sut.execute({ city: 'São Paulo', page: 2 });

    expect(page1.pets).toHaveLength(20);
    expect(page2.pets).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run test/unit/search-pets-by-city.spec.ts`
Expected: FAIL — não resolve `@/use-cases/search-pets-by-city`.

- [ ] **Step 3: Implementar o use-case (mínimo para passar)**

Criar `src/use-cases/search-pets-by-city.ts`:

```ts
import type { Pet } from '@prisma/client';
import type {
  FindManyByCityParams,
  IPetsRepository,
} from '../repositories/interfaces/IPetsRepository.js';

interface SearchPetsByCityOutput {
  pets: Pet[];
}

export class SearchPetsByCityUseCase {
  constructor(private petsRepository: IPetsRepository) {}

  async execute(params: FindManyByCityParams): Promise<SearchPetsByCityOutput> {
    const pets = await this.petsRepository.findManyByCity(params);

    return { pets };
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run test/unit/search-pets-by-city.spec.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit` (confirme `echo $status`) e `npm run lint`
Expected: ambos exit code `0`. Se o lint pedir formatação, rode `npm run format` (o `search-pets-by-city.ts` pode ter a linha do `execute` reformatada).

- [ ] **Step 6: Commit**

```bash
git add test/unit/search-pets-by-city.spec.ts src/use-cases/search-pets-by-city.ts
git commit -m "feat: add search-pets-by-city use-case with pagination"
```

---

## Task 6: Gate final (Definition of Done)

Rodar a suíte inteira e os checks de qualidade de uma vez para garantir que nada regrediu.

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa de testes**

Run: `npx vitest run`
Expected: todos os specs verdes (incluindo os pré-existentes de orgs/auth e os 3 novos de pets).

- [ ] **Step 2: Typecheck do projeto**

Run: `npx tsc --noEmit` (confirme `echo $status`)
Expected: exit code `0`, 0 erros.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: exit code `0`.

- [ ] **Step 4: Conferir o checklist da spec**

Confirmar contra `docs/superpowers/specs/2026-06-12-pets-use-cases-design.md` §9:
- `IPetsRepository` (+ `PetCreateInput` / `FindManyByCityParams`) criada — Task 2.
- `InMemoryPetsRepository`: 3 operações, cidade via orgs, paginação 20 — Task 2.
- `IOrgsRepository.findById` no contrato, in-memory e Prisma — Task 1.
- `ResourceNotFoundError` — Task 1.
- 3 use-cases via TDD — Tasks 3–5.
- Testes unitários passando, `tsc --noEmit` 0 erros, `biome check src` limpo — este gate.

Não há commit nesta task (apenas verificação). Se algo falhar, voltar à task correspondente.

---

## Out of scope (próximo spec — camada HTTP de Pets)

`PrismaPetsRepository`; factories `make-*-use-case`; controllers/rotas `POST /pets` (com `verifyJWT` + `verifyUserRole('ORG')`), `GET /pets` (city obrigatória), `GET /pets/:petId`; validação Zod + Swagger/Scalar; mapeamento `ResourceNotFoundError` → 404 no `setErrorHandler`; testes e2e.
