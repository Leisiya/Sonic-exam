import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { PrismaClient } from '@prisma/client';

import { config } from '../config.js';
import { ApiError } from './errors.js';
import { registerRoutes } from './routes/index.js';

export function buildApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.logLevel
    }
  });

  app.register(cors);
  app.register(helmet);

  app.setErrorHandler((error: FastifyError | ApiError, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({ code: error.code, message: error.message });
    }

    const message = error.message ?? 'Unexpected error';
    return reply.status(500).send({ code: 'INTERNAL_ERROR', message });
  });

  app.register((instance) => {
    registerRoutes(instance, prisma);
  });

  return app;
}
