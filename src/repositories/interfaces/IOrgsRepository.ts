import type { Org } from '@prisma/client';

export type OrgCreateInput = {
  name: string;
  email: string;
  password_hash: string;
  whatsapp: string;
  cep: string;
  city: string;
  state: string;
  address: string;
};

export interface IOrgsRepository {
  create(data: OrgCreateInput): Promise<Org>;
  findByEmail(email: string): Promise<Org | null>;
}
