import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

export function registerHealthRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      db: 'up',
      time: new Date().toISOString()
    };
  });
}
