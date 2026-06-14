import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('GET /pets', () => {
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

  async function seed() {
    const orgSp = await prisma.org.create({
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

    const orgRio = await prisma.org.create({
      data: {
        name: 'Adote Rio',
        email: 'rio@org.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5521999999999',
        cep: '20040002',
        city: 'Rio de Janeiro',
        state: 'RJ',
        address: 'Av. Rio Branco',
      },
    });

    const basePet = {
      about: 'Pet de teste.',
      size: 'MEDIUM' as const,
      energy_level: 'HIGH' as const,
      independence: 'LOW' as const,
      environment: 'MEDIUM' as const,
      photos: [],
      requirements: [],
    };

    await prisma.pet.create({
      data: { ...basePet, name: 'Filhote SP', age: 'PUPPY', org_id: orgSp.id },
    });
    await prisma.pet.create({
      data: { ...basePet, name: 'Adulto SP', age: 'ADULT', org_id: orgSp.id },
    });
    await prisma.pet.create({
      data: { ...basePet, name: 'Pet Rio', age: 'PUPPY', org_id: orgRio.id },
    });
  }

  it('should return 200 with only pets from orgs in the queried city', async () => {
    await seed();

    const response = await request(app.server)
      .get('/pets')
      .query({ city: 'São Paulo' });

    expect(response.statusCode).toBe(200);
    expect(response.body.pets).toHaveLength(2);
    const names = response.body.pets.map((pet: { name: string }) => pet.name);
    expect(names).toEqual(
      expect.arrayContaining(['Filhote SP', 'Adulto SP']),
    );
    expect(names).not.toContain('Pet Rio');
  });

  it('should apply an optional filter', async () => {
    await seed();

    const response = await request(app.server)
      .get('/pets')
      .query({ city: 'São Paulo', age: 'PUPPY' });

    expect(response.statusCode).toBe(200);
    expect(response.body.pets).toHaveLength(1);
    expect(response.body.pets[0].name).toBe('Filhote SP');
  });

  it('should return 400 when city is missing', async () => {
    const response = await request(app.server).get('/pets');
    expect(response.statusCode).toBe(400);
  });
});
