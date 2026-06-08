export type CepData = {
  city: string;
  state: string;
  address: string;
};

export interface ICepProvider {
  fetch(cep: string): Promise<CepData | null>;
}
