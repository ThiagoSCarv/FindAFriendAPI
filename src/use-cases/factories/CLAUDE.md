# Factories (Simple Factory)

Cada use-case possui uma factory correspondente que o instancia com todas as suas dependências
(repositórios/providers Prisma), centralizando a criação e mantendo os controllers livres de
qualquer conhecimento sobre infraestrutura.

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

**Regras:**
- Controllers **sempre** obtêm o use-case via factory — nunca instanciam repositórios diretamente.
- Factories **sempre** usam as implementações Prisma (produção). Testes unitários instanciam o use-case manualmente com repositórios in-memory, **sem** usar a factory.
- Uma factory por use-case — sem factories genéricas ou compartilhadas.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
