# Testes

Dois níveis de teste, cada um na sua pasta.

## Unitários (`test/unit/`)
- Testam use-cases isoladamente com repositórios/providers **in-memory**.
- Rápidos, sem dependência de banco ou rede.
- Comando: `npx vitest run`

## E2E (`test/e2e/`)
- Testam rotas completas com **Supertest** contra um banco de teste real.
- Cada teste deve **criar e limpar seus próprios dados**.
- Comando: `npx vitest run --project e2e` (ou configuração equivalente no `vitest.config.ts`)

## Cobertura
- Comando: `npx vitest run --coverage`
- Provider: `@vitest/coverage-v8`

## TDD
Os testes são escritos **antes** da implementação (ciclo Red → Green → Refactor). Use-cases são
cobertos por testes unitários antes de qualquer implementação Prisma; rotas têm teste E2E antes
da lógica do controller. Veja `src/use-cases/CLAUDE.md` para o detalhe do ciclo.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
