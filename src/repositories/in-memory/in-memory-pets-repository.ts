import { randomUUID } from 'node:crypto';
import type { Pet } from '@prisma/client';
import type {
  FindManyByCityParams,
  IPetsRepository,
  PetCreateInput,
} from '../interfaces/IPetsRepository.js';
import type { InMemoryOrgsRepository } from './in-memory-orgs-repository.js';

const ITEMS_PER_PAGE = 20;

export class InMemoryPetsRepository implements IPetsRepository {
  public items: Pet[] = [];

  // recebe o repo de orgs para resolver Org.city via org_id (a busca passa pela relação)
  constructor(private orgsRepository: InMemoryOrgsRepository) {}

  async create(data: PetCreateInput): Promise<Pet> {
    const pet: Pet = { id: randomUUID(), created_at: new Date(), ...data };
    this.items.push(pet);
    return pet;
  }

  async findById(id: string): Promise<Pet | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async findManyByCity(params: FindManyByCityParams): Promise<Pet[]> {
    const orgIdsInCity = new Set(
      this.orgsRepository.items
        .filter((org) => org.city === params.city)
        .map((org) => org.id),
    );

    return this.items
      .filter((pet) => orgIdsInCity.has(pet.org_id))
      .filter((pet) => !params.age || pet.age === params.age)
      .filter((pet) => !params.size || pet.size === params.size)
      .filter(
        (pet) =>
          !params.energy_level || pet.energy_level === params.energy_level,
      )
      .filter(
        (pet) =>
          !params.independence || pet.independence === params.independence,
      )
      .filter(
        (pet) => !params.environment || pet.environment === params.environment,
      )
      .slice((params.page - 1) * ITEMS_PER_PAGE, params.page * ITEMS_PER_PAGE);
  }
}
