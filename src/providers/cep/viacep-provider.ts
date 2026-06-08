import type { CepData, ICepProvider } from './interfaces/ICepProvider.js';

interface ViaCepResponse {
  erro?: boolean;
  logradouro: string;
  localidade: string;
  uf: string;
}

export class ViaCepProvider implements ICepProvider {
  async fetch(cep: string): Promise<CepData | null> {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return null;

    const data = (await response.json()) as ViaCepResponse;
    if (data.erro) return null;

    return {
      city: data.localidade,
      state: data.uf,
      address: data.logradouro,
    };
  }
}
