# Controllers

Handlers das rotas — um arquivo por caso de uso (ex: `register-org-controller.ts`).

- **Responsabilidade única**: receber request, chamar o use-case, retornar response.
- **Não contêm lógica de negócio** — essa vive nos use-cases.
- Obtêm o use-case **sempre via factory** (`src/use-cases/factories/`); nunca instanciam repositórios diretamente.
- Erros de domínio são capturados/propagados e mapeados para o status HTTP adequado (handler global em `app.ts`).

## Validação

- Toda entrada (body, query, params) é validada com Zod no nível do controller/rota.
- Schemas Zod reutilizáveis podem ser extraídos para `src/http/schemas/`.

```ts
// src/http/controllers/register-pet-controller.ts
export async function registerPetController(request: FastifyRequest, reply: FastifyReply) {
  // O controller não conhece repositórios — apenas chama a factory
  const registerPet = makeRegisterPetUseCase()
  await registerPet.execute({ ... })
}
```

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
