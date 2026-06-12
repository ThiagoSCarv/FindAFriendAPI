# Prisma — Banco de Dados e Entidades

Camada de persistência: schema, migrations e modelagem das entidades.

- **ORM**: Prisma · **Banco**: PostgreSQL
- O schema vive em `prisma/schema.prisma`; migrations em `prisma/migrations/`.
- A instância singleton do `PrismaClient` fica em `src/lib/prisma.ts` (não instanciar `PrismaClient` em outros lugares).
- Toda alteração de modelo gera uma migration versionada.

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

## Regras de domínio refletidas no schema

- **[RN-02]** `Org.address` e `Org.whatsapp` são obrigatórios.
- **[RN-03]** `Pet.org_id` é obrigatório (todo pet pertence a uma ORG).
- **[RN-08]** Senha persistida apenas como `password_hash` (bcrypt), nunca em texto puro.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
