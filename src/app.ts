import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import scalarApiReference from '@scalar/fastify-api-reference';
import fastify from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';
import { env } from './env/index.js';
import { orgsRoutes } from './http/routes/orgs-routes.js';
import { petsRoutes } from './http/routes/pets-routes.js';
import { InvalidCredentialsError } from './use-cases/errors/invalid-credentials-error.js';
import { OrgAlreadyExistsError } from './use-cases/errors/org-already-exists-error.js';
import { ResourceNotFoundError } from './use-cases/errors/resource-not-found-error.js';

export const app = fastify({ logger: env.NODE_ENV === 'development' });

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

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
  transform: jsonSchemaTransform,
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
app.register(petsRoutes);

app.setErrorHandler((error, _request, reply) => {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.validation,
    });
  }
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: 'Validation error.',
      issues: error.flatten().fieldErrors,
    });
  }
  if (error instanceof OrgAlreadyExistsError) {
    return reply.status(409).send({ message: error.message });
  }
  if (error instanceof InvalidCredentialsError) {
    return reply.status(401).send({ message: error.message });
  }
  if (error instanceof ResourceNotFoundError) {
    return reply.status(404).send({ message: error.message });
  }
  return reply.status(500).send({ message: 'Internal server error.' });
});
