import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeRegisterPetUseCase } from '../../use-cases/factories/make-register-pet-use-case.js';

export const registerPetBodySchema = z.object({
  name: z
    .string({ error: 'O nome é obrigatório.' })
    .min(1, 'O nome não pode ser vazio.'),
  about: z
    .string({ error: 'A descrição é obrigatória.' })
    .min(1, 'A descrição não pode ser vazia.'),
  age: z.enum(['PUPPY', 'ADULT', 'SENIOR'], {
    error: 'A idade é obrigatória e deve ser PUPPY, ADULT ou SENIOR.',
  }),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE'], {
    error: 'O porte é obrigatório e deve ser SMALL, MEDIUM ou LARGE.',
  }),
  energy_level: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    error: 'O nível de energia é obrigatório e deve ser LOW, MEDIUM ou HIGH.',
  }),
  independence: z.enum(['LOW', 'MEDIUM', 'HIGH'], {
    error:
      'O nível de independência é obrigatório e deve ser LOW, MEDIUM ou HIGH.',
  }),
  environment: z.enum(['SMALL', 'MEDIUM', 'LARGE'], {
    error: 'O ambiente é obrigatório e deve ser SMALL, MEDIUM ou LARGE.',
  }),
  photos: z
    .array(z.string({ error: 'Cada foto deve ser um texto (URL).' }), {
      error: 'As fotos devem ser uma lista.',
    })
    .default([]),
  requirements: z
    .array(z.string({ error: 'Cada requisito deve ser um texto.' }), {
      error: 'Os requisitos devem ser uma lista.',
    })
    .default([]),
});

export async function registerPetController(
  request: FastifyRequest<{ Body: z.infer<typeof registerPetBodySchema> }>,
  reply: FastifyReply,
) {
  const registerPet = makeRegisterPetUseCase();
  const { pet } = await registerPet.execute({
    ...request.body,
    org_id: request.user.sub,
  });
  return reply.status(201).send({ pet });
}
