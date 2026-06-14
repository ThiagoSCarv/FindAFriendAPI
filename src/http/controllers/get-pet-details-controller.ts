import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { makeGetPetDetailsUseCase } from '../../use-cases/factories/make-get-pet-details-use-case.js';

export const getPetDetailsParamsSchema = z.object({
  petId: z
    .string({ error: 'O id do pet é obrigatório.' })
    .uuid('O id do pet deve ser um UUID válido.'),
});

export async function getPetDetailsController(
  request: FastifyRequest<{
    Params: z.infer<typeof getPetDetailsParamsSchema>;
  }>,
  reply: FastifyReply,
) {
  const getPetDetails = makeGetPetDetailsUseCase();
  const { pet } = await getPetDetails.execute({ petId: request.params.petId });
  return reply.status(200).send({ pet });
}
