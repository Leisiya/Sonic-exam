import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { config } from '../../config.js';

const startTime = Date.now();

export function registerStatsRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/stats', async () => {
    const [indexedTx, uniquePrograms, uniqueAccounts, checkpoint] = await Promise.all([
      prisma.transaction.count(),
      prisma.transactionProgram.findMany({ distinct: ['programId'], select: { programId: true } }),
      prisma.transactionAccount.findMany({ distinct: ['address'], select: { address: true } }),
      prisma.ingestionCheckpoint.findUnique({ where: { workerId: config.workerId } })
    ]);

    return {
      indexedTx,
      uniquePrograms: uniquePrograms.length,
      uniqueAccounts: uniqueAccounts.length,
      lastProcessedEventId: checkpoint?.lastEventId ?? 0,
      lastProcessedSlot: checkpoint?.lastProcessedSlot ?? 0,
      uptimeSec: Math.floor((Date.now() - startTime) / 1000)
    };
  });
}
