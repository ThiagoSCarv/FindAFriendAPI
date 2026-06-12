import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { env } from '../../env/index.js';
import { makeAuthenticateUseCase } from '../../use-cases/factories/make-authenticate-use-case.js';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authenticateController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { email, password } = bodySchema.parse(request.body);

  const authenticate = makeAuthenticateUseCase();
  const { org } = await authenticate.execute({ email, password });

  const token = await reply.jwtSign(
    { role: org.role },
    { sign: { sub: org.id } },
  );

  const refreshToken = await reply.jwtSign(
    { role: org.role },
    { sign: { sub: org.id, expiresIn: '7d' } },
  );

  return reply
    .setCookie('refreshToken', refreshToken, {
      path: '/',
      secure: env.NODE_ENV === 'production',
      sameSite: true,
      httpOnly: true,
    })
    .status(200)
    .send({ token });
}
