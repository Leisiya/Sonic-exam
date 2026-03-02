import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export function registerHealthRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/health', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        db: 'up',
        time: new Date().toISOString()
      };
    } catch (error: unknown) {
      app.log.warn({ err: error }, 'health check database probe failed');
      return reply.status(503).send({
        status: 'degraded',
        db: 'down',
        time: new Date().toISOString()
      });
    }
  });
}
