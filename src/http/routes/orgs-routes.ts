import type { FastifyInstance } from 'fastify';
import { authenticateController } from '../controllers/authenticate-controller.js';
import { refreshController } from '../controllers/refresh-controller.js';
import { registerOrgController } from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post('/orgs', registerOrgController);
  app.post('/sessions', authenticateController);
  app.patch('/token/refresh', refreshController);
}
