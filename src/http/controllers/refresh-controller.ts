import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../env/index.js';

export async function refreshController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify({ onlyCookie: true });
  } catch {
    return reply.status(401).send({ message: 'Unauthorized.' });
  }

  const { sub, role } = request.user;

  const token = await reply.jwtSign({ role }, { sign: { sub } });

  const refreshToken = await reply.jwtSign(
    { role },
    { sign: { sub, expiresIn: '7d' } },
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
