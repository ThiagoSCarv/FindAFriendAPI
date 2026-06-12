import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('PATCH /token/refresh', () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.org.deleteMany();
  });

  async function createAndAuthenticate() {
    await prisma.org.create({
      data: {
        name: 'Adote SP',
        email: 'adote@sp.com',
        password_hash: await hash('123456', 6),
        whatsapp: '+5511999999999',
        cep: '01310100',
        city: 'São Paulo',
        state: 'SP',
        address: 'Av. Paulista',
      },
    });

    const auth = await request(app.server)
      .post('/sessions')
      .send({ email: 'adote@sp.com', password: '123456' });

    return auth.get('Set-Cookie') as string[];
  }

  it('should issue a new token and a new refresh cookie', async () => {
    const cookies = await createAndAuthenticate();

    const response = await request(app.server)
      .patch('/token/refresh')
      .set('Cookie', cookies)
      .send();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ token: expect.any(String) });
    expect(response.get('Set-Cookie')).toEqual([
      expect.stringContaining('refreshToken='),
    ]);
  });

  it('should return 401 (not 500) without the refresh cookie', async () => {
    const response = await request(app.server).patch('/token/refresh').send();

    expect(response.statusCode).toBe(401);
  });
});
