import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('GET /pets/:petId', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.pet.deleteMany();
    await prisma.org.deleteMany();
  });

  async function seedPet() {
    const org = await prisma.org.create({
      data: {
        name: 'Adote SP',
        email: 'sp@org.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5511999999999',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista',
      },
    });

    return prisma.pet.create({
      data: {
        name: 'Rex',
        about: 'Cachorro dócil.',
        age: 'PUPPY',
        size: 'MEDIUM',
        energy_level: 'HIGH',
        independence: 'LOW',
        environment: 'MEDIUM',
        photos: [],
        requirements: [],
        org_id: org.id,
      },
    });
  }

  it('should return 200 with the pet when it exists', async () => {
    const pet = await seedPet();

    const response = await request(app.server).get(`/pets/${pet.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.pet.id).toBe(pet.id);
    expect(response.body.pet.name).toBe('Rex');
  });

  it('should return 404 when the pet does not exist', async () => {
    const response = await request(app.server).get(`/pets/${randomUUID()}`);
    expect(response.statusCode).toBe(404);
  });

  it('should return 400 when petId is not a valid uuid', async () => {
    const response = await request(app.server).get('/pets/not-a-uuid');
    expect(response.statusCode).toBe(400);
  });
});
