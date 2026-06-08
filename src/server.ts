import { app } from './app.js';
import { env } from './env/index.js';

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then(() => {
    console.log(`Server running on http://localhost:${env.PORT}`);
    console.log(`Docs:    http://localhost:${env.PORT}/docs`);
    console.log(`Swagger: http://localhost:${env.PORT}/swagger`);
  });
