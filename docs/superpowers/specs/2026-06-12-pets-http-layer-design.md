# Spec — Pets: camada HTTP (Prisma + factories + controllers + rotas + e2e)

- **Data**: 2026-06-12
- **Status**: Aprovado — pronto para a fase de plano (`writing-plans`) e implementação
- **Escopo**: A **camada externa** das três funcionalidades de Pet (#4 Cadastro, #5 Listagem por
  cidade, #6 Detalhes), expondo por HTTP os use-cases que já existem e já têm testes unitários.
  Inclui: `PrismaPetsRepository`, as 3 factories, os 3 controllers (com schemas Zod em PT-BR),
  o grupo de rotas `pets-routes.ts`, o registro em `app.ts` (rotas + mapeamento de
  `ResourceNotFoundError` → 404) e os **testes e2e** das três rotas (TDD).
- **Continuação de**: `docs/superpowers/specs/2026-06-12-pets-use-cases-design.md` (camada interna).
  Este spec realiza exatamente a Seção 8 ("Fora de escopo — camada HTTP de Pets") daquele
  documento.
- **Próximo passo**: invocar a skill `writing-plans` para gerar o plano de implementação a partir
  deste documento e implementar seguindo TDD (e2e Red → slice Green → Refactor, uma rota por ciclo).

---

## 1. Contexto e estado atual do código

Levantamento feito em 2026-06-12 para que a próxima sessão não precise re-explorar:

- **Camada interna de Pet está pronta e testada (unitário):** `src/use-cases/register-pet.ts`,
  `get-pet-details.ts`, `search-pets-by-city.ts`; `IPetsRepository` + tipos; `InMemoryPetsRepository`;
  `ResourceNotFoundError`. `IOrgsRepository.findById` já existe (interface + in-memory + Prisma).
- **Camada HTTP de Orgs é o molde a seguir** (já consolidada):
  - Controllers: `register-org-controller.ts` (exporta `registerOrgBodySchema`, `201` vazio),
    `authenticate-controller.ts` (assina token + refresh cookie), `refresh-controller.ts`
    (lê `request.user.sub`/`role`).
  - Rotas: `src/http/routes/orgs-routes.ts` — cada rota com `schema: { tags, summary, body }`;
    registrada em `app.ts` via `app.register(orgsRoutes)`.
  - Factories: `make-register-org-use-case.ts`, `make-authenticate-use-case.ts`.
- **Middlewares já existem mas ainda não estão ligados a nenhuma rota registrada:**
  `src/http/middlewares/verify-jwt.ts` (`verifyJWT`) e `verify-user-role.ts`
  (`verifyUserRole('ORG' | 'ADMIN')`, lê `request.user.role`, responde `403`). `verifyUserRole`
  **deve** rodar **depois** de `verifyJWT` no array `onRequest` (depende de `request.user`).
- **`request.user` é tipado** por `src/@types/fastify-jwt.d.ts` como `{ sub: string; role: 'ORG' |
  'ADMIN' }`. Logo, no `POST /pets` o `org_id` sai de `request.user.sub`.
- **`PrismaPetsRepository` NÃO existe** — `src/repositories/prisma/` só tem
  `prisma-orgs-repository.ts`. **Não há factories de Pet.**
- **`app.ts` (`setErrorHandler`)** mapeia hoje só `OrgAlreadyExistsError` (409) e
  `InvalidCredentialsError` (401), além do `400` de validação Zod. **`ResourceNotFoundError` ainda
  não é mapeado** — precisa virar **404**.
- **`prisma/schema.prisma`**: `model Pet` já existe (campos `name`, `about`, enums `age`/`size`/
  `energy_level`/`independence`/`environment`, `photos String[]`, `requirements String[]`, `org_id`,
  `created_at`, relação `org`). **Pet não tem `city`** — a cidade vive em `Org.city`; a busca passa
  pela relação `org`. Nenhuma mudança de schema neste spec.
- **Convenções (já consolidadas):**
  - **Imports em `src/`**: relativos, com extensão `.js` (ESM).
  - **Imports em `test/`**: alias `@/` sem extensão.
  - **Validação**: na camada do Fastify via `fastify-type-provider-zod` (`validatorCompiler` +
    `serializerCompiler` em `app.ts`). O controller **exporta** o schema e **não** chama `.parse()`;
    o request chega validado e tipado por `z.infer`.
  - **Mensagens Zod sempre em PT-BR**, por campo, frase completa terminada em ponto. Zod 4: tipo/
    obrigatório via `{ error: '...' }` no construtor; refinamento com mensagem no próprio
    `.min()`/`.regex()`/`.uuid()`.
  - **Biome**: aspas simples, ponto-e-vírgula, trailing comma, 2 espaços, largura 80.
  - Vitest roda via esbuild (não faz typecheck) → toda task que mexe em tipos roda também
    `npx tsc --noEmit`.

---

## 2. Decisões tomadas (com justificativa)

| Decisão | Escolha | Por quê |
|---|---|---|
| Fronteira deste ciclo | Camada **HTTP** das 3 use-cases: Prisma repo + factories + controllers + rotas + registro em `app.ts` + **e2e** | Os use-cases já estão validados por testes unitários; falta apenas expô-los por HTTP de ponta a ponta. |
| Origem do `org_id` no `POST /pets` | **Do JWT** (`request.user.sub`); o body carrega só dados do pet | Segurança + **[RN-06]**: uma ORG autenticada não pode cadastrar pet em nome de outra. O controller injeta `org_id` ao montar a entrada do use-case. |
| Resposta do `POST /pets` | **`201` com `{ pet }`** no corpo | Útil ao cliente (retorna `id` etc.) e facilita asserções no e2e. (Diverge do `POST /orgs`, que é `201` vazio — decisão consciente.) |
| Schemas de **response** (Zod) | **Não adicionar** — só schemas de entrada (`body`/`querystring`/`params`) + `tags`/`summary` | Segue o padrão das rotas de Orgs; deixa o serializer padrão do Fastify lidar com `Date` (`created_at`) sem `transform`. Trade-off aceito: Swagger não documenta o formato da resposta. |
| Proteção do `POST /pets` | `onRequest: [verifyJWT, verifyUserRole('ORG')]` | **[RN-06]**. Ordem importa: `verifyUserRole` lê `request.user`, populado por `verifyJWT`. |
| `GET /pets` e `GET /pets/:petId` | **Públicos** (sem `onRequest`) | Funcionalidades #5 e #6 são públicas. |
| Validação da busca (`GET /pets`) | `city` **obrigatória** (`querystring`); 5 filtros de enum **opcionais**; `page` com `z.coerce.number().int().positive().default(1)` | **[RN-01]**/**[RN-05]**. Query params chegam como string → `z.coerce` para `page`; filtros ausentes ficam `undefined` e são ignorados pelo Prisma. |
| `petId` em `GET /pets/:petId` | `z.string().uuid('...')` nos `params` | `id` é uuid; `uuid` malformado → `400`; uuid válido inexistente → `404` (via `ResourceNotFoundError`). |
| Enums nos schemas Zod | `z.enum([...valores Prisma], { error: '...' })` (literais explícitos) | Mantém mensagem PT-BR por campo e infere o mesmo union de string do `@prisma/client` (`Age`, `Size`, ...), compatível com `PetCreateInput`. |
| `ResourceNotFoundError` → HTTP | **404** no `setErrorHandler` de `app.ts` | Usado por `register-pet` (org ausente) e `get-pet-details` (pet ausente); mapeia 1:1 para 404. |
| `PrismaPetsRepository.findManyByCity` | `prisma.pet.findMany({ where: { org: { city }, age, size, ... }, take: 20, skip: (page-1)*20 })` | Mesmo **comportamento observável** do in-memory (`ITEMS_PER_PAGE = 20`); join por cidade via relação `org`; `undefined` nos filtros é ignorado pelo Prisma. |
| Testes desta camada | **Apenas e2e** (`test/e2e/`); use-cases já têm unitário | Evita duplicar a cobertura de regra de negócio; e2e valida rota + validação + auth + serialização + persistência real. |

---

## 3. `PrismaPetsRepository` (novo)

`src/repositories/prisma/prisma-pets-repository.ts` — implementação concreta de `IPetsRepository`,
espelhando o estilo de `PrismaOrgsRepository` e o comportamento de `InMemoryPetsRepository`:

```ts
import type { Pet } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  FindManyByCityParams,
  IPetsRepository,
  PetCreateInput,
} from '../interfaces/IPetsRepository.js';

const ITEMS_PER_PAGE = 20;

export class PrismaPetsRepository implements IPetsRepository {
  async create(data: PetCreateInput): Promise<Pet> {
    return prisma.pet.create({ data });
  }

  async findById(id: string): Promise<Pet | null> {
    return prisma.pet.findUnique({ where: { id } });
  }

  async findManyByCity({
    city,
    age,
    size,
    energy_level,
    independence,
    environment,
    page,
  }: FindManyByCityParams): Promise<Pet[]> {
    return prisma.pet.findMany({
      where: { org: { city }, age, size, energy_level, independence, environment },
      take: ITEMS_PER_PAGE,
      skip: (page - 1) * ITEMS_PER_PAGE,
    });
  }
}
```

> `where` com filtro `undefined` é ignorado pelo Prisma → mesma semântica do in-memory
> (`!params.age || pet.age === params.age`).

---

## 4. Factories (novas)

Uma factory por use-case, conforme `factories/CLAUDE.md` (sempre implementações Prisma).

`src/use-cases/factories/make-register-pet-use-case.ts`:
```ts
import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { PrismaPetsRepository } from '../../repositories/prisma/prisma-pets-repository.js';
import { RegisterPetUseCase } from '../register-pet.js';

export function makeRegisterPetUseCase() {
  const petsRepository = new PrismaPetsRepository();
  const orgsRepository = new PrismaOrgsRepository();
  return new RegisterPetUseCase(petsRepository, orgsRepository);
}
```

`make-search-pets-by-city-use-case.ts` e `make-get-pet-details-use-case.ts` seguem o mesmo
formato, instanciando só `PrismaPetsRepository` e passando ao respectivo use-case.

---

## 5. Controllers (novos)

Um arquivo por use-case; cada um **exporta** seu schema Zod. Obtêm o use-case via factory; sem
lógica de negócio.

### 5.1 `register-pet-controller.ts`
- Exporta `registerPetBodySchema` (sem `org_id` — ele vem do JWT):
  ```ts
  export const registerPetBodySchema = z.object({
    name: z.string({ error: 'O nome é obrigatório.' }).min(1, 'O nome não pode ser vazio.'),
    about: z.string({ error: 'A descrição é obrigatória.' }).min(1, 'A descrição não pode ser vazia.'),
    age: z.enum(['PUPPY', 'ADULT', 'SENIOR'], { error: 'A idade é obrigatória e deve ser PUPPY, ADULT ou SENIOR.' }),
    size: z.enum(['SMALL', 'MEDIUM', 'LARGE'], { error: 'O porte é obrigatório e deve ser SMALL, MEDIUM ou LARGE.' }),
    energy_level: z.enum(['LOW', 'MEDIUM', 'HIGH'], { error: 'O nível de energia é obrigatório e deve ser LOW, MEDIUM ou HIGH.' }),
    independence: z.enum(['LOW', 'MEDIUM', 'HIGH'], { error: 'O nível de independência é obrigatório e deve ser LOW, MEDIUM ou HIGH.' }),
    environment: z.enum(['SMALL', 'MEDIUM', 'LARGE'], { error: 'O ambiente é obrigatório e deve ser SMALL, MEDIUM ou LARGE.' }),
    photos: z.array(z.string({ error: 'Cada foto deve ser um texto (URL).' }), { error: 'As fotos devem ser uma lista.' }).default([]),
    requirements: z.array(z.string({ error: 'Cada requisito deve ser um texto.' }), { error: 'Os requisitos devem ser uma lista.' }).default([]),
  });
  ```
- Handler: pega `org_id = request.user.sub`, chama `makeRegisterPetUseCase().execute({ ...request.body, org_id })`,
  responde `reply.status(201).send({ pet })`.
  ```ts
  export async function registerPetController(
    request: FastifyRequest<{ Body: z.infer<typeof registerPetBodySchema> }>,
    reply: FastifyReply,
  ) {
    const registerPet = makeRegisterPetUseCase();
    const { pet } = await registerPet.execute({
      ...request.body,
      org_id: request.user.sub,
    });
    return reply.status(201).send({ pet });
  }
  ```

### 5.2 `search-pets-by-city-controller.ts`
- Exporta `searchPetsQuerySchema`:
  ```ts
  export const searchPetsQuerySchema = z.object({
    city: z.string({ error: 'A cidade é obrigatória.' }).min(1, 'A cidade não pode ser vazia.'),
    age: z.enum(['PUPPY', 'ADULT', 'SENIOR'], { error: 'A idade deve ser PUPPY, ADULT ou SENIOR.' }).optional(),
    size: z.enum(['SMALL', 'MEDIUM', 'LARGE'], { error: 'O porte deve ser SMALL, MEDIUM ou LARGE.' }).optional(),
    energy_level: z.enum(['LOW', 'MEDIUM', 'HIGH'], { error: 'O nível de energia deve ser LOW, MEDIUM ou HIGH.' }).optional(),
    independence: z.enum(['LOW', 'MEDIUM', 'HIGH'], { error: 'O nível de independência deve ser LOW, MEDIUM ou HIGH.' }).optional(),
    environment: z.enum(['SMALL', 'MEDIUM', 'LARGE'], { error: 'O ambiente deve ser SMALL, MEDIUM ou LARGE.' }).optional(),
    page: z.coerce.number({ error: 'A página deve ser um número.' }).int('A página deve ser um inteiro.').positive('A página deve ser positiva.').default(1),
  });
  ```
- Handler: tipa `request` com `{ Querystring: z.infer<...> }`, chama
  `makeSearchPetsByCityUseCase().execute(request.query)`, responde `reply.status(200).send({ pets })`.

### 5.3 `get-pet-details-controller.ts`
- Exporta `getPetDetailsParamsSchema`:
  ```ts
  export const getPetDetailsParamsSchema = z.object({
    petId: z.string({ error: 'O id do pet é obrigatório.' }).uuid('O id do pet deve ser um UUID válido.'),
  });
  ```
- Handler: tipa `request` com `{ Params: z.infer<...> }`, chama
  `makeGetPetDetailsUseCase().execute({ petId: request.params.petId })`, responde
  `reply.status(200).send({ pet })`.

---

## 6. Rotas (`src/http/routes/pets-routes.ts`, novo)

```ts
import type { FastifyInstance } from 'fastify';
import {
  getPetDetailsController,
  getPetDetailsParamsSchema,
} from '../controllers/get-pet-details-controller.js';
import {
  registerPetBodySchema,
  registerPetController,
} from '../controllers/register-pet-controller.js';
import {
  searchPetsByCityController,
  searchPetsQuerySchema,
} from '../controllers/search-pets-by-city-controller.js';
import { verifyJWT } from '../middlewares/verify-jwt.js';
import { verifyUserRole } from '../middlewares/verify-user-role.js';

export async function petsRoutes(app: FastifyInstance) {
  app.post(
    '/pets',
    {
      onRequest: [verifyJWT, verifyUserRole('ORG')],
      schema: {
        tags: ['Pets'],
        summary: 'Cadastro de pet (ORG autenticada)',
        security: [{ bearerAuth: [] }],
        body: registerPetBodySchema,
      },
    },
    registerPetController,
  );

  app.get(
    '/pets',
    {
      schema: {
        tags: ['Pets'],
        summary: 'Listagem de pets por cidade (+ filtros opcionais)',
        querystring: searchPetsQuerySchema,
      },
    },
    searchPetsByCityController,
  );

  app.get(
    '/pets/:petId',
    {
      schema: {
        tags: ['Pets'],
        summary: 'Detalhes de um pet',
        params: getPetDetailsParamsSchema,
      },
    },
    getPetDetailsController,
  );
}
```

> `security: [{ bearerAuth: [] }]` apenas documenta o cadeado no Swagger (o `securitySchemes.bearerAuth`
> já existe em `app.ts`); a proteção real é o `onRequest`.

---

## 7. Wiring em `app.ts` (alterado)

1. Importar e registrar o grupo de rotas, ao lado de `orgsRoutes`:
   ```ts
   import { petsRoutes } from './http/routes/pets-routes.js';
   // ...
   app.register(petsRoutes);
   ```
2. Mapear `ResourceNotFoundError` → **404** no `setErrorHandler` (importar de
   `./use-cases/errors/resource-not-found-error.js`), no mesmo estilo dos demais branches:
   ```ts
   if (error instanceof ResourceNotFoundError) {
     return reply.status(404).send({ message: error.message });
   }
   ```

---

## 8. Plano de testes e2e (TDD — `test/e2e/`)

Padrão dos e2e existentes: `app` de `@/app`; `beforeAll` → `app.ready()`; `afterAll` →
`app.close()` + `prisma.$disconnect()`; **cada teste limpa seus próprios dados** em `beforeEach`,
**na ordem de FK** (`pet` antes de `org`):
```ts
beforeEach(async () => {
  await prisma.pet.deleteMany();
  await prisma.org.deleteMany();
});
```
`vitest.config.ts` usa `fileParallelism: false` e os e2e batem num **PostgreSQL real** (via
`DATABASE_URL`, carregado por `dotenv` em `test/setup.ts`) com as migrations aplicadas.

### `register-pet.spec.ts` (`POST /pets`)
Helper local `createAndAuthenticateOrg()` (cria org com `password_hash` via `bcryptjs.hash`, faz
`POST /sessions` e devolve `{ token, orgId }`) — mesmo padrão inline dos e2e de Orgs.
- ✅ **201** com pet criado: com `Authorization: Bearer <token>` e body válido →
  `statusCode === 201`, `response.body.pet.id` definido, `pet.org_id === orgId`.
- ❌ **401** sem token (sem header `Authorization`).
- ❌ **403** com token de role divergente (ex.: assinar/forjar um token `ADMIN` para a mesma org,
  ou criar org com `role: 'ADMIN'` e autenticar) — exercita `verifyUserRole('ORG')`.
- (Opcional) **400** com body inválido (ex.: `age` fora do enum), confirmando a validação Zod.

### `search-pets-by-city.spec.ts` (`GET /pets`)
Seed direto via Prisma: cria 1 org em `city: 'São Paulo'` (+ opcionalmente outra cidade) e pets
ligados a ela.
- ✅ **200** retornando os pets cuja org está na `city` buscada; exclui pets de org de **outra**
  cidade. `GET /pets?city=São Paulo`.
- ✅ aplica um filtro opcional (ex.: `?city=São Paulo&age=PUPPY` retorna só filhotes).
- ❌ **400** quando `city` está ausente (`GET /pets`).

### `get-pet-details.spec.ts` (`GET /pets/:petId`)
- ✅ **200** com o pet quando o `petId` existe (seed via Prisma; org + pet).
- ❌ **404** para um `petId` inexistente (uuid válido porém ausente).
- (Opcional) **400** para `petId` malformado (não-uuid), confirmando a validação de `params`.

---

## 9. Inventário de arquivos

**Novos (11)**
- `src/repositories/prisma/prisma-pets-repository.ts`
- `src/use-cases/factories/make-register-pet-use-case.ts`
- `src/use-cases/factories/make-search-pets-by-city-use-case.ts`
- `src/use-cases/factories/make-get-pet-details-use-case.ts`
- `src/http/controllers/register-pet-controller.ts`
- `src/http/controllers/search-pets-by-city-controller.ts`
- `src/http/controllers/get-pet-details-controller.ts`
- `src/http/routes/pets-routes.ts`
- `test/e2e/register-pet.spec.ts`
- `test/e2e/search-pets-by-city.spec.ts`
- `test/e2e/get-pet-details.spec.ts`

**Alterados (1)**
- `src/app.ts` — `app.register(petsRoutes)` + branch `ResourceNotFoundError` → 404 no `setErrorHandler`.

**Sem alteração**
- `prisma/schema.prisma`, `src/env/index.ts`, use-cases/interfaces/in-memory de Pet (já prontos),
  middlewares (já prontos — só passam a ser usados).

---

## 10. Verificação (atenção a mascaramento de saída por proxy)

O proxy `rtk` pode mascarar exit codes de `tsc`/`biome`/`vitest` (falso-positivo **e** falso-negativo).
Rodar os comandos por um caminho confiável:
- **Typecheck**: `rtk proxy npx tsc --noEmit` (deve dar **0 erros**).
- **Lint**: `./node_modules/.bin/biome check src` (direto, sem proxy).
- **Testes**: `npx vitest run --reporter=json` (ou alvo único, ex.:
  `npx vitest run test/e2e/register-pet.spec.ts`). E2e exige PostgreSQL no ar + migrations.
- **Não** usar `npm run build` para verificar: o `tsup src` quebra ao topar arquivos `CLAUDE.md`
  dentro de `src/` (problema pré-existente, fora de escopo).

---

## 11. Definition of Done

- [ ] `PrismaPetsRepository` implementa `create`/`findById`/`findManyByCity` (join por `org.city`,
      `take/skip` com `ITEMS_PER_PAGE = 20`).
- [ ] 3 factories criadas, usando implementações Prisma.
- [ ] 3 controllers criados, cada um exportando seu schema Zod (mensagens PT-BR por campo);
      `register-pet` lê `org_id` de `request.user.sub` e responde `201 { pet }`; `search` responde
      `200 { pets }`; `get-pet-details` responde `200 { pet }`.
- [ ] `pets-routes.ts` registra as 3 rotas; `POST /pets` com `onRequest: [verifyJWT,
      verifyUserRole('ORG')]`; `GET`s públicos.
- [ ] `app.ts` registra `petsRoutes` e mapeia `ResourceNotFoundError` → 404.
- [ ] Testes e2e (Seção 8) passando, incluindo 401/403 no `POST /pets`, 400 sem `city` no `GET
      /pets` e 404 no `GET /pets/:petId` inexistente.
- [ ] `rtk proxy npx tsc --noEmit` com 0 erros.
- [ ] `./node_modules/.bin/biome check src` sem erros.
