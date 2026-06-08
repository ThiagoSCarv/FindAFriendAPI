import { ViaCepProvider } from '../../providers/cep/viacep-provider.js';
import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { RegisterOrgUseCase } from '../register-org.js';

export function makeRegisterOrgUseCase() {
  const orgsRepository = new PrismaOrgsRepository();
  const cepProvider = new ViaCepProvider();
  return new RegisterOrgUseCase(orgsRepository, cepProvider);
}
