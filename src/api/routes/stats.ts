import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { config } from '../../config.js';

const startTime = Date.now();
type CountRow = { count: bigint };

export function registerStatsRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/stats', async () => {
    const [indexedTx, programCountRows, accountCountRows, checkpoint] = await Promise.all([
      prisma.transaction.count(),
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(DISTINCT "programId")::bigint AS count FROM "TransactionProgram"`,
      prisma.$queryRaw<CountRow[]>`SELECT COUNT(DISTINCT "address")::bigint AS count FROM "TransactionAccount"`,
      prisma.ingestionCheckpoint.findUnique({ where: { workerId: config.workerId } })
    ]);

    const uniquePrograms = Number(programCountRows[0]?.count ?? 0n);
    const uniqueAccounts = Number(accountCountRows[0]?.count ?? 0n);

    return {
      indexedTx,
      uniquePrograms,
      uniqueAccounts,
      lastProcessedEventId: checkpoint?.lastEventId ?? 0,
      lastProcessedSlot: checkpoint?.lastProcessedSlot ?? 0,
      uptimeSec: Math.floor((Date.now() - startTime) / 1000)
    };
  });
}
