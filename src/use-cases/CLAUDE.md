# Use Cases

Lógica de negócio isolada — um arquivo por caso de uso (ex: `register-org.ts`).
Subpastas: `factories/` (instanciação) e `errors/` (erros de domínio).

- Contêm **toda** a lógica de negócio (as regras `[RN-*]`).
- Recebem repositórios/providers por **injeção de dependência** (facilita testes).
- Dependem apenas das **interfaces** dos repositórios, nunca das implementações concretas.
- Lançam erros customizados de `src/use-cases/errors/` (ex: `ResourceNotFoundError`, `InvalidCredentialsError`).

## TDD — obrigatório

Todo use-case é desenvolvido pelo ciclo Red → Green → Refactor:

1. **Red** — escreva o teste antes do código. O teste deve falhar.
2. **Green** — escreva o mínimo de código para o teste passar.
3. **Refactor** — melhore o código mantendo os testes verdes.

**Regras:**
- Nunca escreva código de produção sem um teste falhando que o justifique.
- Use-cases são testados **unitariamente com repositórios in-memory** antes de qualquer implementação Prisma.
- Commit do teste + commit da implementação são separados (ou ao menos atômicos por ciclo Red/Green).

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
