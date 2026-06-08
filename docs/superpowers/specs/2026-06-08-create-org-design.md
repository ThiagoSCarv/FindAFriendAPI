# Design: Rota de Cadastro de ORG — POST /orgs

**Data:** 2026-06-08  
**Status:** Aprovado

---

## Contexto

Primeira rota de negócio da API FindAFriend. Permite que organizações responsáveis por animais se cadastrem no sistema. O endereço é preenchido automaticamente via lookup no ViaCEP quando o CEP é fornecido, mas todos os campos de endereço podem ser sobrescritos manualmente pelo usuário.

---

## Arquitetura

Segue o padrão já estabelecido no projeto: controller → factory → use-case → repositório. A novidade é a introdução de um **provider** para abstração de serviços externos, com o mesmo padrão de porta/interface usado pelos repositórios.

### Novos arquivos

```
src/
  providers/
    cep/
      interfaces/
        ICepProvider.ts              # interface: fetch(cep) → CepData | null
      viacep-provider.ts             # implementação real (HTTP → ViaCEP)
      in-memory-cep-provider.ts      # fake para testes unitários
  repositories/
    interfaces/
      IOrgsRepository.ts
    prisma/
      prisma-orgs-repository.ts
    in-memory/
      in-memory-orgs-repository.ts
  use-cases/
    register-org.ts
    errors/
      org-already-exists-error.ts
    factories/
      make-register-org-use-case.ts
  http/
    controllers/
      register-org-controller.ts
    routes/
      orgs-routes.ts
test/
  unit/
    register-org.spec.ts
  e2e/
    register-org.spec.ts
```

---

## Contrato da Rota

**`POST /orgs`** — público, sem autenticação.

### Request body

| Campo      | Tipo     | Obrigatório | Validação                                  |
|------------|----------|-------------|---------------------------------------------|
| `name`     | string   | sim         | não vazio                                   |
| `email`    | string   | sim         | formato email válido                        |
| `password` | string   | sim         | mínimo 6 caracteres                         |
| `whatsapp` | string   | sim         | regex `/^\+55\d{2}9?\d{8}$/`               |
| `cep`      | string   | sim         | 8 dígitos numéricos (sem hífen)             |
| `city`     | string   | não         | override do valor retornado pelo ViaCEP     |
| `state`    | string   | não         | override do valor retornado pelo ViaCEP     |
| `address`  | string   | não         | override do valor retornado pelo ViaCEP     |

### Response

- **201 Created** — corpo vazio
- **400 Bad Request** — falha de validação Zod
- **409 Conflict** — email já cadastrado (`OrgAlreadyExistsError`)

---

## Provider: ICepProvider

```ts
export type CepData = {
  city: string
  state: string
  address: string
}

export interface ICepProvider {
  fetch(cep: string): Promise<CepData | null>
}
```

- `ViaCepProvider` — chama `https://viacep.com.br/ws/{cep}/json/` via `fetch`. Retorna `null` se o CEP não existe ou a resposta contém `{ erro: true }`.
- `InMemoryCepProvider` — mapa em memória para testes; retorna `null` por padrão, configurável por CEP.

---

## Lógica do Use-Case: RegisterOrgUseCase

```
execute(data):
  1. orgsRepository.findByEmail(email)
     → se existir: throw OrgAlreadyExistsError

  2. cepProvider.fetch(cep)
     → retorna CepData | null

  3. Mesclar endereço:
     city    = data.city    ?? cepData?.city    ?? ''
     state   = data.state   ?? cepData?.state   ?? ''
     address = data.address ?? cepData?.address ?? ''

  4. password_hash = bcrypt.hash(password, 6)

  5. orgsRepository.create({ ...data, city, state, address, password_hash })

  6. return { org }
```

Campos explícitos no body **sempre** têm prioridade sobre o retorno do ViaCEP.

---

## IOrgsRepository

```ts
export interface IOrgsRepository {
  create(data: OrgCreateInput): Promise<Org>
  findByEmail(email: string): Promise<Org | null>
}
```

---

## Testes

### Unitários (`test/unit/register-org.spec.ts`)

- Cria ORG com dados do ViaCEP quando CEP é válido
- Aceita ORG quando CEP não é encontrado (campos de endereço ficam vazios)
- Campos explícitos no body sobrescrevem o retorno do ViaCEP
- Lança `OrgAlreadyExistsError` quando email já cadastrado
- Armazena `password_hash`, nunca a senha em texto puro

### E2E (`test/e2e/register-org.spec.ts`)

O `ViaCepProvider` é substituído por um fake no ambiente de teste para não depender de rede externa em CI.

- `POST /orgs` com body válido → 201
- `POST /orgs` com email duplicado → 409
- `POST /orgs` com `whatsapp` fora do formato → 400
- `POST /orgs` sem campos de endereço e CEP inválido → 201

---

## Mapeamento de Erros (app.ts)

O handler global de erros em `app.ts` deve mapear:

| Classe de erro          | Status HTTP |
|-------------------------|-------------|
| `OrgAlreadyExistsError` | 409         |
| `ZodError`              | 400         |
