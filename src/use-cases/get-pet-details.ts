import type { Pet } from '@prisma/client';
import type { IPetsRepository } from '../repositories/interfaces/IPetsRepository.js';
import { ResourceNotFoundError } from './errors/resource-not-found-error.js';

interface GetPetDetailsInput {
  petId: string;
}

interface GetPetDetailsOutput {
  pet: Pet;
}

export class GetPetDetailsUseCase {
  constructor(private petsRepository: IPetsRepository) {}

  async execute({ petId }: GetPetDetailsInput): Promise<GetPetDetailsOutput> {
    const pet = await this.petsRepository.findById(petId);

    if (!pet) {
      throw new ResourceNotFoundError();
    }

    return { pet };
  }
}
