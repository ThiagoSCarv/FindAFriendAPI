import type { Org } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import type {
  IOrgsRepository,
  OrgCreateInput,
} from '../interfaces/IOrgsRepository.js';

export class PrismaOrgsRepository implements IOrgsRepository {
  async create(data: OrgCreateInput): Promise<Org> {
    return prisma.org.create({ data });
  }

  async findByEmail(email: string): Promise<Org | null> {
    return prisma.org.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<Org | null> {
    return prisma.org.findUnique({ where: { id } });
  }
}
