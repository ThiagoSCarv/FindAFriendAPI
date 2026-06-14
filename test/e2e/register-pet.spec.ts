import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('POST /pets', () => {
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

  async function createAndAuthenticateOrg(role: 'ORG' | 'ADMIN' = 'ORG') {
    const org = await prisma.org.create({
      data: {
        name: 'Adote SP',
        email: 'adote@sp.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5511999999999',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista',
        role,
      },
    });

    const authResponse = await request(app.server)
      .post('/sessions')
      .send({ email: 'adote@sp.com', password: '123456' });

    return { token: authResponse.body.token as string, orgId: org.id };
  }

  const validPetBody = {
    name: 'Rex',
    about: 'Cachorro dócil e brincalhão.',
    age: 'PUPPY',
    size: 'MEDIUM',
    energy_level: 'HIGH',
    independence: 'LOW',
    environment: 'MEDIUM',
    photos: ['https://example.com/rex.jpg'],
    requirements: ['Espaço amplo'],
  };

  it('should return 201 and create the pet for the authenticated org', async () => {
    const { token, orgId } = await createAndAuthenticateOrg();

    const response = await request(app.server)
      .post('/pets')
      .set('Authorization', `Bearer ${token}`)
      .send(validPetBody);

    expect(response.statusCode).toBe(201);
    expect(response.body.pet.id).toEqual(expect.any(String));
    expect(response.body.pet.org_id).toBe(orgId);
  });

  it('should return 401 without a token', async () => {
    const response = await request(app.server).post('/pets').send(validPetBody);
    expect(response.statusCode).toBe(401);
  });

  it('should return 403 when the role is not ORG', async () => {
    const { token } = await createAndAuthenticateOrg('ADMIN');

    const response = await request(app.server)
      .post('/pets')
      .set('Authorization', `Bearer ${token}`)
      .send(validPetBody);

    expect(response.statusCode).toBe(403);
  });

  it('should return 400 with an invalid body', async () => {
    const { token } = await createAndAuthenticateOrg();

    const response = await request(app.server)
      .post('/pets')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPetBody, age: 'INVALID' });

    expect(response.statusCode).toBe(400);
  });
});
