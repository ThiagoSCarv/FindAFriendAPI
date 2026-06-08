import type { Org } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { ICepProvider } from '../providers/cep/interfaces/ICepProvider.js';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import { OrgAlreadyExistsError } from './errors/org-already-exists-error.js';

interface RegisterOrgInput {
  name: string;
  email: string;
  password: string;
  whatsapp: string;
  cep: string;
  city?: string;
  state?: string;
  address?: string;
}

interface RegisterOrgOutput {
  org: Org;
}

export class RegisterOrgUseCase {
  constructor(
    private orgsRepository: IOrgsRepository,
    private cepProvider: ICepProvider,
  ) {}

  async execute(data: RegisterOrgInput): Promise<RegisterOrgOutput> {
    const existing = await this.orgsRepository.findByEmail(data.email);
    if (existing) throw new OrgAlreadyExistsError();

    const cepData = await this.cepProvider.fetch(data.cep);

    const city = data.city ?? cepData?.city ?? '';
    const state = data.state ?? cepData?.state ?? '';
    const address = data.address ?? cepData?.address ?? '';
    const password_hash = await hash(data.password, 6);

    const org = await this.orgsRepository.create({
      name: data.name,
      email: data.email,
      password_hash,
      whatsapp: data.whatsapp,
      cep: data.cep,
      city,
      state,
      address,
    });

    return { org };
  }
}
