import type { Pet } from '@prisma/client';
import type { IOrgsRepository } from '../repositories/interfaces/IOrgsRepository.js';
import type {
  IPetsRepository,
  PetCreateInput,
} from '../repositories/interfaces/IPetsRepository.js';
import { ResourceNotFoundError } from './errors/resource-not-found-error.js';

interface RegisterPetOutput {
  pet: Pet;
}

export class RegisterPetUseCase {
  constructor(
    private petsRepository: IPetsRepository,
    private orgsRepository: IOrgsRepository,
  ) {}

  async execute(data: PetCreateInput): Promise<RegisterPetOutput> {
    const org = await this.orgsRepository.findById(data.org_id);

    if (!org) {
      throw new ResourceNotFoundError();
    }

    const pet = await this.petsRepository.create(data);

    return { pet };
  }
}
