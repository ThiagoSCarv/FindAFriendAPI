import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeSearchPetsByCityUseCase } from '../../use-cases/factories/make-search-pets-by-city-use-case.js';

export const searchPetsQuerySchema = z.object({
  city: z
    .string({ error: 'A cidade é obrigatória.' })
    .min(1, 'A cidade não pode ser vazia.'),
  age: z
    .enum(['PUPPY', 'ADULT', 'SENIOR'], {
      error: 'A idade deve ser PUPPY, ADULT ou SENIOR.',
    })
    .optional(),
  size: z
    .enum(['SMALL', 'MEDIUM', 'LARGE'], {
      error: 'O porte deve ser SMALL, MEDIUM ou LARGE.',
    })
    .optional(),
  energy_level: z
    .enum(['LOW', 'MEDIUM', 'HIGH'], {
      error: 'O nível de energia deve ser LOW, MEDIUM ou HIGH.',
    })
    .optional(),
  independence: z
    .enum(['LOW', 'MEDIUM', 'HIGH'], {
      error: 'O nível de independência deve ser LOW, MEDIUM ou HIGH.',
    })
    .optional(),
  environment: z
    .enum(['SMALL', 'MEDIUM', 'LARGE'], {
      error: 'O ambiente deve ser SMALL, MEDIUM ou LARGE.',
    })
    .optional(),
  page: z.coerce
    .number({ error: 'A página deve ser um número.' })
    .int('A página deve ser um inteiro.')
    .positive('A página deve ser positiva.')
    .default(1),
});

export async function searchPetsByCityController(
  request: FastifyRequest<{
    Querystring: z.infer<typeof searchPetsQuerySchema>;
  }>,
  reply: FastifyReply,
) {
  const searchPets = makeSearchPetsByCityUseCase();
  const { pets } = await searchPets.execute(request.query);
  return reply.status(200).send({ pets });
}
