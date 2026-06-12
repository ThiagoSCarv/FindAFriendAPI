import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './env/index.js';
import { orgsRoutes } from './http/routes/orgs-routes.js';
import { OrgAlreadyExistsError } from './use-cases/errors/org-already-exists-error.js';

export const app = fastify({ logger: env.NODE_ENV === 'development' });

app.register(fastifySwagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'FindAFriend API',
      description: 'API para adoção de animais de estimação',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${env.PORT}`, description: 'Local' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
});

app.register(scalarApiReference, {
  routePrefix: '/docs',
  configuration: {
    title: 'FindAFriend API',
    theme: 'purple',
  },
});

app.register(fastifyCookie);
app.register(fastifyJwt, {
  secret: env.JWT_SECRET,
  cookie: { cookieName: 'refreshToken', signed: false },
  sign: { expiresIn: '10m' },
});
app.register(orgsRoutes);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.flatten().fieldErrors,
    });
  }
  if (error instanceof OrgAlreadyExistsError) {
    return reply.status(409).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'Internal server error.' });
});
