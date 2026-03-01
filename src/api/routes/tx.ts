import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { ApiError } from '../errors.js';

export function registerTxRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/tx/:signature', async (request) => {
    const params = request.params as { signature: string };

    const tx = await prisma.transaction.findUnique({
      where: { signature: params.signature },
      select: {
        signature: true,
        slot: true,
        blockTime: true,
        feeLamports: true,
        computeUnits: true,
        error: true,
        instructions: true,
        programs: {
          select: {
            programId: true
          }
        },
        accounts: {
          select: {
            address: true
          }
        }
      }
    });

    if (!tx) {
      throw new ApiError(404, 'TX_NOT_FOUND', 'Transaction not found');
    }

    return {
      signature: tx.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      feeLamports: tx.feeLamports.toString(),
      computeUnits: tx.computeUnits,
      error: tx.error,
      instructions: tx.instructions,
      programIds: tx.programs.map((p) => p.programId),
      accounts: tx.accounts.map((a) => a.address)
    };
  });
}
