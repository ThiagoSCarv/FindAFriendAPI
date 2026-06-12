import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Authorization hook. Must run AFTER `verifyJWT` in the `onRequest` array,
 * since it reads `request.user` (populated by the JWT verification).
 */
export function verifyUserRole(roleToVerify: 'ORG' | 'ADMIN') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { role } = request.user;

    if (role !== roleToVerify) {
      return reply.status(403).send({ message: 'Forbidden.' });
    }
  };
}
