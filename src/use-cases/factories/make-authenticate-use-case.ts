import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { AuthenticateUseCase } from '../authenticate.js';

export function makeAuthenticateUseCase() {
  const orgsRepository = new PrismaOrgsRepository();
  return new AuthenticateUseCase(orgsRepository);
}
