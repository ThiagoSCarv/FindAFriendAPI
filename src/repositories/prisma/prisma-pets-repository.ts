import type { Pet } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  FindManyByCityParams,
  IPetsRepository,
  PetCreateInput,
} from '../interfaces/IPetsRepository.js';

const ITEMS_PER_PAGE = 20;

export class PrismaPetsRepository implements IPetsRepository {
  async create(data: PetCreateInput): Promise<Pet> {
    return prisma.pet.create({ data });
  }

  async findById(id: string): Promise<Pet | null> {
    return prisma.pet.findUnique({ where: { id } });
  }

  async findManyByCity({
    city,
    age,
    size,
    energy_level,
    independence,
    environment,
    page,
  }: FindManyByCityParams): Promise<Pet[]> {
    return prisma.pet.findMany({
      where: {
        org: { city },
        age,
        size,
        energy_level,
        independence,
        environment,
      },
      take: ITEMS_PER_PAGE,
      skip: (page - 1) * ITEMS_PER_PAGE,
    });
  }
}
