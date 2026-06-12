# Env — Variáveis de Ambiente

Validação e tipagem das variáveis de ambiente.

- Todas as variáveis são validadas no startup via Zod em `src/env/index.ts`.
- A aplicação **não deve iniciar** com `.env` inválido — falhe rápido com mensagem clara.
- Importe sempre o objeto `env` validado; nunca leia `process.env` diretamente fora deste módulo.

```env
NODE_ENV=development       # development | test | production
PORT=3333
DATABASE_URL=              # PostgreSQL connection string
JWT_SECRET=                # Secret para assinar tokens
```

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
