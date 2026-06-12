# Erros de Domínio

Classes de erro customizadas lançadas pelos use-cases (ex: `org-already-exists-error.ts`).

- Uma classe por tipo de erro de domínio (ex: `ResourceNotFoundError`, `InvalidCredentialsError`, `OrgAlreadyExistsError`).
- Estendem `Error` e carregam uma mensagem clara; sem dependência de HTTP aqui.
- O mapeamento erro de domínio → status HTTP é feito **somente** no handler global em `src/app.ts`.
- Use-cases lançam esses erros; controllers/handler global os traduzem para a resposta.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
