import fastifyJwt from '@fastify/jwt';
import fastify from 'fastify';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '@/env';
import { verifyJWT } from '@/http/middlewares/verify-jwt';
import { verifyUserRole } from '@/http/middlewares/verify-user-role';

const app = fastify();

beforeAll(async () => {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.post('/sign', async (request, reply) => {
    const { role } = request.body as { role: 'ORG' | 'ADMIN' };
    const token = await reply.jwtSign({ role }, { sign: { sub: 'org-1' } });
    return reply.send({ token });
  });

  app.get(
    '/only-org',
    { onRequest: [verifyJWT, verifyUserRole('ORG')] },
    async () => {
      return { ok: true };
    },
  );

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('RBAC middlewares', () => {
  async function signToken(role: 'ORG' | 'ADMIN') {
    const response = await request(app.server).post('/sign').send({ role });
    return response.body.token as string;
  }

  it('should return 401 without a token', async () => {
    const response = await request(app.server).get('/only-org');
    expect(response.statusCode).toBe(401);
  });

  it('should return 200 with a valid ORG token', async () => {
    const token = await signToken('ORG');

    const response = await request(app.server)
      .get('/only-org')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('should return 403 with a divergent role', async () => {
    const token = await signToken('ADMIN');

    const response = await request(app.server)
      .get('/only-org')
      .set('Authorization', `Bearer ${token}`);

    expect(response.statusCode).toBe(403);
  });
});
