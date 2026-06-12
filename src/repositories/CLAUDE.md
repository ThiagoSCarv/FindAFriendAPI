# Repositórios

Toda interação com o banco passa por um repositório. Organizados em três pastas:

```
repositories/
  interfaces/   # Contratos (ex: IOrgsRepository, IPetsRepository)
  prisma/       # Implementações concretas com Prisma (produção)
  in-memory/    # Implementações in-memory para testes unitários
```

**Regras:**
- A **interface** define o contrato; implementações Prisma e in-memory são separadas e intercambiáveis.
- Use-cases dependem **apenas das interfaces**, nunca de uma implementação concreta.
- A implementação in-memory deve ter o mesmo comportamento observável da Prisma (para os testes serem fiéis).
- Nenhuma lógica de negócio nos repositórios — apenas persistência/consulta.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
