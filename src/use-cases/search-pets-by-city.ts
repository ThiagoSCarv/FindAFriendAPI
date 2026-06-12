import type { Pet } from '@prisma/client';
import type {
  FindManyByCityParams,
  IPetsRepository,
} from '../repositories/interfaces/IPetsRepository.js';

interface SearchPetsByCityOutput {
  pets: Pet[];
}

export class SearchPetsByCityUseCase {
  constructor(private petsRepository: IPetsRepository) {}

  async execute(params: FindManyByCityParams): Promise<SearchPetsByCityOutput> {
    const pets = await this.petsRepository.findManyByCity(params);

    return { pets };
  }
}
