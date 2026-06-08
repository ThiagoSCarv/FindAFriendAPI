import type { CepData, ICepProvider } from './interfaces/ICepProvider.js';

export class InMemoryCepProvider implements ICepProvider {
  private data = new Map<string, CepData>();

  addCep(cep: string, data: CepData): void {
    this.data.set(cep, data);
  }

  async fetch(cep: string): Promise<CepData | null> {
    return this.data.get(cep) ?? null;
  }
}
