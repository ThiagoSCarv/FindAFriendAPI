import { PrismaOrgsRepository } from '../../repositories/prisma/prisma-orgs-repository.js';
import { PrismaPetsRepository } from '../../repositories/prisma/prisma-pets-repository.js';
import { RegisterPetUseCase } from '../register-pet.js';

export function makeRegisterPetUseCase() {
  const petsRepository = new PrismaPetsRepository();
  const orgsRepository = new PrismaOrgsRepository();
  return new RegisterPetUseCase(petsRepository, orgsRepository);
}
