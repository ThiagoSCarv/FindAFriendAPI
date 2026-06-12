# Spec — Pets: camada interna (use-cases + repositório in-memory)

- **Data**: 2026-06-12
- **Status**: Aprovado — pronto para a fase de plano (`writing-plans`) e implementação
- **Escopo**: **Apenas a camada interna** das três funcionalidades de Pet (#4 Cadastro, #5 Listagem
  por cidade, #6 Detalhes): a interface `IPetsRepository`, sua implementação **in-memory**, os três
  use-cases, o erro de domínio `ResourceNotFoundError` e os testes **unitários** (TDD). **Sem**
  Prisma, factories, controllers, rotas, Swagger ou e2e — tudo isso fica para um spec de HTTP
  posterior.
- **Próximo passo**: invocar a skill `writing-plans` para gerar o plano de implementação a partir
  deste documento e então implementar seguindo TDD (Red → Green → Refactor, um use-case por ciclo).

---

## 1. Contexto e estado atual do código

Levantamento feito em 2026-06-12 para que a próxima sessão não precise re-explorar:

- A metade de **Orgs/autenticação está pronta**: `register-org`, `authenticate`, refresh e os
  middlewares `verifyJWT` / `verifyUserRole`. A entidade **Pet ainda não tem nenhum código** —
  só existe o `model Pet` em `prisma/schema.prisma`.
- `prisma/schema.prisma` define `model Pet` com os campos: `id` (uuid), `name`, `about`, `age`
  (`Age`), `size` (`Size`), `energy_level` (`EnergyLevel`), `independence` (`Independence`),
  `environment` (`Environment`), `photos String[]`, `requirements String[]`, `org_id`, `created_at`,
  e a relação `org Org @relation(fields: [org_id], references: [id])`.
- **Decisivo:** `Pet` **não tem campo `city`**. A cidade vive em `Org.city`. Portanto, buscar pets
  "por cidade" exige passar pela relação `org` (`org_id` → `Org.city`).
- Enums já no schema: `Age` (PUPPY/ADULT/SENIOR), `Size` (SMALL/MEDIUM/LARGE), `EnergyLevel`
  (LOW/MEDIUM/HIGH), `Independence` (LOW/MEDIUM/HIGH), `Environment` (SMALL/MEDIUM/LARGE). Todos
  exportados como tipos/valores pelo `@prisma/client`.
- `src/repositories/interfaces/IOrgsRepository.ts` expõe hoje **apenas** `create(data: OrgCreateInput)`
  e `findByEmail(email)`. **Não há `findById`.** Implementações em `prisma/prisma-orgs-repository.ts`
  e `in-memory/in-memory-orgs-repository.ts`.
- `src/use-cases/errors/` tem hoje `invalid-credentials-error.ts` e `org-already-exists-error.ts`.
  **Não existe** `ResourceNotFoundError`.
- Padrões a seguir (já consolidados no register-org/authenticate):
  - **Imports em `src/`**: relativos, com extensão `.js` (ESM).
  - **Imports em `test/`**: alias `@/` sem extensão.
  - Use-case = classe com construtor por injeção de dependência; depende **só de interfaces** de
    repositório; lança erros de `src/use-cases/errors/`; retorna um objeto (`{ pet }` / `{ pets }`).
  - Repositório in-memory reproduz o **comportamento observável** do Prisma (para os testes serem
    fiéis); `create` monta `{ id: randomUUID(), created_at: new Date(), ...data }`.
  - Biome: aspas simples, ponto-e-vírgula, trailing comma, 2 espaços, largura 80.
  - Vitest roda via esbuild (não faz typecheck) → cada task que mexe em tipos roda também
    `npx tsc --noEmit`.

---

## 2. Decisões tomadas (com justificativa)

| Decisão | Escolha | Por quê |
|---|---|---|
| Fronteira deste ciclo | **Só a camada interna** das 3 use-cases (interface + in-memory + use-cases + erro + testes unitários) | Validar a lógica de negócio com in-memory **antes** de expô-la por HTTP. A camada HTTP (Prisma, factories, controllers, rotas, e2e) é um spec separado. |
| Validação de ORG no cadastro | **RegisterPet valida que a org existe** — injeta `IOrgsRepository`, busca por `findById`, lança `ResourceNotFoundError` se ausente | Defende a fronteira do use-case **[RN-03]** (todo pet pertence a uma ORG) e é testável in-memory. Casa com o exemplo de `factories/CLAUDE.md` (`RegisterPetUseCase(petsRepository, orgsRepository)`). |
| Busca por cidade | **Match exato** de `city` (obrigatória **[RN-01]**) + filtros opcionais de enum em match exato **[RN-05]**, **com paginação** | `city` é o único filtro obrigatório; cada filtro opcional informado vira igualdade no enum; filtros ausentes são ignorados. |
| Resolução da cidade no in-memory | **`InMemoryPetsRepository` recebe `InMemoryOrgsRepository` no construtor** e resolve `Org.city` via `org_id` | `Pet` não tem `city`; a busca passa pela relação `org`. Isso mantém o double in-memory **fiel** à query relacional do Prisma (`where: { org: { city } }`). O use-case **não** sabe disso — só conhece `IPetsRepository`. |
| Paginação | **`page` na entrada; `ITEMS_PER_PAGE = 20` constante** no repositório (`slice((page-1)*20, page*20)`) | Padrão clássico do desafio FindAFriend. `perPage` **não** é parâmetro — fixo em 20 (decisão consciente; reabrir se necessário no review). |
| Erro "não encontrado" | **Um `ResourceNotFoundError` genérico** reutilizado por RegisterPet (org ausente) e GetPetDetails (pet ausente) | Citado em `use-cases/CLAUDE.md`; mapeia 1:1 para **404** na futura camada HTTP. Evita duplicar classes (`OrgNotFoundError`/`PetNotFoundError` cairiam no mesmo 404). |
| `findById` em `IOrgsRepository` | **Adicionar à interface, ao in-memory e ao Prisma** | RegisterPet precisa de `orgsRepository.findById`. Como `PrismaOrgsRepository implements IOrgsRepository`, estender a interface **obriga** implementar o método também no Prisma (senão `tsc` quebra) — único toque de Prisma neste spec. |
| Estrutura do trabalho | **TDD incremental, um use-case por ciclo** (Red → Green → Refactor) | Segue à risca `use-cases/CLAUDE.md` ("nunca escreva código de produção sem um teste falhando") e o estilo do plano de autenticação. |

---

## 3. Contratos: `IPetsRepository` e tipos

Novo arquivo `src/repositories/interfaces/IPetsRepository.ts` (espelhando o estilo hand-rolled de
`IOrgsRepository` com `OrgCreateInput`):

```ts
import type {
  Age,
  Environment,
  EnergyLevel,
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

Extensão de `src/repositories/interfaces/IOrgsRepository.ts` — acrescentar **uma** assinatura:

```ts
findById(id: string): Promise<Org | null>;
```

---

## 4. Repositório in-memory (`src/repositories/in-memory/in-memory-pets-repository.ts`)

```ts
import { randomUUID } from 'node:crypto';
import type { Pet } from '@prisma/client';
import type { InMemoryOrgsRepository } from './in-memory-orgs-repository.js';
import type {
  FindManyByCityParams,
  IPetsRepository,
  PetCreateInput,
} from '../interfaces/IPetsRepository.js';

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
      .filter((pet) => !params.energy_level || pet.energy_level === params.energy_level)
      .filter((pet) => !params.independence || pet.independence === params.independence)
      .filter((pet) => !params.environment || pet.environment === params.environment)
      .slice((params.page - 1) * ITEMS_PER_PAGE, params.page * ITEMS_PER_PAGE);
  }
}
```

> A futura `PrismaPetsRepository` (outro spec) implementa a mesma interface via
> `prisma.pet.findMany({ where: { org: { city }, age, ... }, take: 20, skip: (page-1)*20 })` —
> mesmo comportamento observável.

`InMemoryOrgsRepository` ganha o método paralelo ao da interface:

```ts
async findById(id: string): Promise<Org | null> {
  return this.items.find((item) => item.id === id) ?? null;
}
```

---

## 5. Use-cases (`src/use-cases/`)

### 5.1 `register-pet.ts` → `RegisterPetUseCase`
- Construtor: `(private petsRepository: IPetsRepository, private orgsRepository: IOrgsRepository)`.
- Entrada: todos os campos de `PetCreateInput` (inclui `org_id`).
- Fluxo: `orgsRepository.findById(org_id)` → se `null`, lança `ResourceNotFoundError` **[RN-03]**;
  senão `petsRepository.create(data)` e retorna `{ pet }`.

### 5.2 `get-pet-details.ts` → `GetPetDetailsUseCase`
- Construtor: `(private petsRepository: IPetsRepository)`.
- Entrada: `{ petId: string }`.
- Fluxo: `petsRepository.findById(petId)` → se `null`, lança `ResourceNotFoundError`; senão `{ pet }`.

### 5.3 `search-pets-by-city.ts` → `SearchPetsByCityUseCase`
- Construtor: `(private petsRepository: IPetsRepository)`.
- Entrada: `FindManyByCityParams` (`city` obrigatória, filtros opcionais, `page`).
- Fluxo: delega a `petsRepository.findManyByCity(params)` e retorna `{ pets }`. O join por cidade e
  a paginação são detalhes do repositório — o use-case permanece fino.

### Erro de domínio
`src/use-cases/errors/resource-not-found-error.ts`:

```ts
export class ResourceNotFoundError extends Error {
  constructor() {
    super('Resource not found.');
    this.name = 'ResourceNotFoundError';
  }
}
```

(Na futura camada HTTP, mapeado para **404** no `setErrorHandler` de `app.ts`.)

---

## 6. Plano de testes (TDD — teste antes da implementação, `test/unit/`)

Cada use-case é um ciclo Red → Green → Refactor independente, com `InMemoryPetsRepository`
(+ `InMemoryOrgsRepository` quando precisar de org/cidade).

### `register-pet.spec.ts`
- ✅ cria o pet quando a org (`org_id`) existe (cria a org via `orgsRepository.create`, depois
  executa o use-case; assere `pet.id` e `pet.org_id`).
- ❌ `org_id` inexistente → lança `ResourceNotFoundError`.

### `get-pet-details.spec.ts`
- ✅ retorna o pet quando o `petId` existe (seed via `petsRepository.create`).
- ❌ `petId` inexistente → lança `ResourceNotFoundError`.

### `search-pets-by-city.spec.ts`
- ✅ retorna pets cuja org está na cidade buscada; exclui pets de orgs de **outra** cidade.
- ✅ aplica um filtro opcional (ex.: `age: 'PUPPY'` retorna só os filhotes).
- ✅ paginação: criar **22** pets na mesma cidade → `page 1` retorna 20, `page 2` retorna 2.

Setup típico:
```ts
orgsRepository = new InMemoryOrgsRepository();
petsRepository = new InMemoryPetsRepository(orgsRepository);
sut = new SearchPetsByCityUseCase(petsRepository);
// criar org com city='São Paulo' → criar pets com org_id dela
```

---

## 7. Inventário de arquivos

**Novos**
- `src/repositories/interfaces/IPetsRepository.ts`
- `src/repositories/in-memory/in-memory-pets-repository.ts`
- `src/use-cases/register-pet.ts`
- `src/use-cases/get-pet-details.ts`
- `src/use-cases/search-pets-by-city.ts`
- `src/use-cases/errors/resource-not-found-error.ts`
- Testes: `test/unit/register-pet.spec.ts`, `test/unit/get-pet-details.spec.ts`,
  `test/unit/search-pets-by-city.spec.ts`

**Alterados**
- `src/repositories/interfaces/IOrgsRepository.ts` — adicionar `findById`.
- `src/repositories/in-memory/in-memory-orgs-repository.ts` — implementar `findById`.
- `src/repositories/prisma/prisma-orgs-repository.ts` — implementar `findById`
  (`prisma.org.findUnique({ where: { id } })`) **apenas para manter o `tsc` verde**.

**Sem alteração**
- `prisma/schema.prisma` — o `model Pet` já existe; nada muda.
- `src/env/index.ts` — nenhuma variável de ambiente nova.

---

## 8. Fora de escopo (próximo spec — camada HTTP de Pets)

- `src/repositories/prisma/prisma-pets-repository.ts` (implementação Prisma do `IPetsRepository`).
- Factories `make-register-pet-use-case.ts`, `make-get-pet-details-use-case.ts`,
  `make-search-pets-by-city-use-case.ts`.
- Controllers + rotas: `POST /pets` (com `verifyJWT` + `verifyUserRole('ORG')` **[RN-06]**),
  `GET /pets` (`city` obrigatória na query), `GET /pets/:petId`.
- Validação Zod das rotas (mensagens em PT-BR), schema Swagger/Scalar e mapeamento de
  `ResourceNotFoundError` → **404** no `setErrorHandler`.
- Testes e2e das rotas de Pet.

---

## 9. Definition of Done

- [ ] `IPetsRepository` (+ tipos `PetCreateInput` / `FindManyByCityParams`) criada.
- [ ] `InMemoryPetsRepository` implementa as 3 operações; resolve cidade via `InMemoryOrgsRepository`;
      pagina por `ITEMS_PER_PAGE = 20`.
- [ ] `IOrgsRepository.findById` adicionado e implementado no in-memory **e** no Prisma.
- [ ] `ResourceNotFoundError` criado.
- [ ] `RegisterPetUseCase` (valida org → `ResourceNotFoundError`), `GetPetDetailsUseCase`
      (`ResourceNotFoundError` se ausente) e `SearchPetsByCityUseCase` (city + filtros + paginação)
      implementados via TDD.
- [ ] Testes unitários acima passando (`npx vitest run`).
- [ ] `npx tsc --noEmit` com 0 erros.
- [ ] `npm run lint` (`biome check src`) sem erros.
