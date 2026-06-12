# Schemas (Zod)

Schemas Zod reutilizáveis para validação de entrada (body, query, params) e geração da documentação.

- Centralize aqui os schemas usados por mais de um controller/rota; schemas de uso único podem permanecer no próprio controller.
- Toda rota deve ter schema associado — alimenta tanto a validação quanto a doc Swagger/Scalar.
- Schemas cobrem **validação de entrada**, não regras de negócio (essas vivem nos use-cases).

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
