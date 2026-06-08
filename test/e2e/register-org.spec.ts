import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('@/providers/cep/viacep-provider', () => ({
  ViaCepProvider: class {
    async fetch(cep: string) {
      if (cep === '01310100') {
        return { city: 'São Paulo', state: 'SP', address: 'Av. Paulista' };
      }
      return null;
    }
  },
}));

describe('POST /orgs', () => {
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

  it('should return 201 on success', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '01310100',
      });

    expect(response.statusCode).toBe(201);
  });

  it('should return 409 when email is already taken', async () => {
    const body = {
      name: 'Adote SP',
      email: 'adote@sp.com',
      password: '123456',
      whatsapp: '+5511999999999',
      cep: '01310100',
    };

    const firstResponse = await request(app.server).post('/orgs').send(body);
    expect(firstResponse.statusCode).toBe(201);

    const response = await request(app.server).post('/orgs').send(body);
    expect(response.statusCode).toBe(409);
  });

  it('should return 400 when whatsapp format is invalid', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '11999999999',
        cep: '01310100',
      });

    expect(response.statusCode).toBe(400);
  });

  it('should return 201 when CEP is not found and no address provided', async () => {
    const response = await request(app.server)
      .post('/orgs')
      .send({
        name: 'Adote SP',
        email: 'adote@sp.com',
        password: '123456',
        whatsapp: '+5511999999999',
        cep: '99999999',
      });

    expect(response.statusCode).toBe(201);
  });
});
