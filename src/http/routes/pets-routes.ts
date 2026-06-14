import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  registerPetBodySchema,
  registerPetController,
} from '../controllers/register-pet-controller.js';
import { verifyJWT } from '../middlewares/verify-jwt.js';
import { verifyUserRole } from '../middlewares/verify-user-role.js';

export async function petsRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post(
    '/pets',
    {
      onRequest: [verifyJWT, verifyUserRole('ORG')],
      schema: {
        tags: ['Pets'],
        summary: 'Cadastro de pet (ORG autenticada)',
        security: [{ bearerAuth: [] }],
        body: registerPetBodySchema,
      },
    },
    registerPetController,
  );
}
