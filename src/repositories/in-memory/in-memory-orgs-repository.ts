import { randomUUID } from 'node:crypto';
import type { Org } from '@prisma/client';
import type {
  IOrgsRepository,
  OrgCreateInput,
} from '../interfaces/IOrgsRepository.js';

export class InMemoryOrgsRepository implements IOrgsRepository {
  public items: Org[] = [];

  async create(data: OrgCreateInput): Promise<Org> {
    const org: Org = {
      id: randomUUID(),
      created_at: new Date(),
      role: 'ORG',
      ...data,
    };
    this.items.push(org);
    return org;
  }

  async findByEmail(email: string): Promise<Org | null> {
    return this.items.find((item) => item.email === email) ?? null;
  }

  async findById(id: string): Promise<Org | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }
}
