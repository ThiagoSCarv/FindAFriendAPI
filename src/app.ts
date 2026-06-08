import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import scalarApiReference from '@scalar/fastify-api-reference';
import fastify from 'fastify';
import { env } from './env/index.js';

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

app.register(fastifySwaggerUi, { routePrefix: '/swagger' });

app.register(fastifyJwt, { secret: env.JWT_SECRET });

app.register(fastifyCookie);
