# Providers

Integrações com serviços externos, isoladas atrás de uma interface (ex: consulta de CEP via ViaCEP).

```
providers/
  cep/
    interfaces/ICepProvider.ts      # Contrato
    viacep-provider.ts              # Implementação real (HTTP ViaCEP)
    in-memory-cep-provider.ts       # Implementação fake para testes
```

**Regras:**
- Cada provider é definido por uma **interface**; use-cases dependem da interface, não da implementação.
- Implementação real (rede/HTTP) e implementação in-memory (testes) ficam lado a lado.
- Providers são injetados nos use-cases via construtor (DI), igual aos repositórios.
- Nenhuma regra de negócio aqui — apenas a integração externa.

---

> **Nunca commitar:** todos os arquivos CLAUDE.md são ignorados pelo .gitignore.
