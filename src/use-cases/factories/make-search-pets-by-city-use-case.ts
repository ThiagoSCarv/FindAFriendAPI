import { PrismaPetsRepository } from '../../repositories/prisma/prisma-pets-repository.js';
import { SearchPetsByCityUseCase } from '../search-pets-by-city.js';

export function makeSearchPetsByCityUseCase() {
  const petsRepository = new PrismaPetsRepository();
  return new SearchPetsByCityUseCase(petsRepository);
}
