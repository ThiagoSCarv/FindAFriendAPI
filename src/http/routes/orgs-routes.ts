import type { FastifyInstance } from 'fastify';
import {
  authenticateBodySchema,
  authenticateController,
} from '../controllers/authenticate-controller.js';
import { refreshController } from '../controllers/refresh-controller.js';
import {
  registerOrgBodySchema,
  registerOrgController,
} from '../controllers/register-org-controller.js';

export async function orgsRoutes(app: FastifyInstance) {
  app.post(
    '/orgs',
    {
      schema: {
        tags: ['Orgs'],
        summary: 'Cadastro de ORG',
        body: registerOrgBodySchema,
      },
    },
    registerOrgController,
  );

  app.post(
    '/sessions',
    {
      schema: {
        tags: ['Orgs'],
        summary: 'Login de ORG',
        body: authenticateBodySchema,
      },
    },
    authenticateController,
  );

  app.patch(
    '/token/refresh',
    {
      schema: {
        tags: ['Orgs'],
        summary: 'Refresh de access token',
      },
    },
    refreshController,
  );
}
