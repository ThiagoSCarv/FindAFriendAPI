import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeRegisterOrgUseCase } from '../../use-cases/factories/make-register-org-use-case.js';

const bodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  whatsapp: z.string().regex(/^\+55\d{2}9?\d{8}$/),
  cep: z.string().regex(/^\d{8}$/),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
});

export async function registerOrgController(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const data = bodySchema.parse(request.body);
  const registerOrg = makeRegisterOrgUseCase();
  await registerOrg.execute(data);
  return reply.status(201).send();
}
