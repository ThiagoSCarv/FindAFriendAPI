import type { FastifyInstance } from 'fastify';
import { registerOrgController } from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post('/orgs', registerOrgController);
}
