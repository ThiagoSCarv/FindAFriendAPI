import { hash } from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';

describe('POST /sessions', () => {
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

  async function createOrg() {
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
  }

  it('should authenticate and return a token plus a refresh cookie', async () => {
    await createOrg();

    const response = await request(app.server)
      .post('/sessions')
      .send({ email: 'adote@sp.com', password: '123456' });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ token: expect.any(String) });
    expect(response.get('Set-Cookie')).toEqual([
      expect.stringContaining('refreshToken='),
    ]);
  });

  it('should return 401 with invalid credentials', async () => {
    const response = await request(app.server)
      .post('/sessions')
      .send({ email: 'nobody@sp.com', password: '123456' });

    expect(response.statusCode).toBe(401);
  });
});
