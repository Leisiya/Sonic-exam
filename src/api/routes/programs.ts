import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { ApiError } from '../errors.js';

const usageQuerySchema = z
  .object({
    fromSlot: z.coerce.number().int().nonnegative().optional(),
    toSlot: z.coerce.number().int().nonnegative().optional()
  })
  .refine((value) => {
    if (value.fromSlot === undefined || value.toSlot === undefined) {
      return true;
    }
    return value.fromSlot <= value.toSlot;
  }, 'fromSlot cannot be greater than toSlot');

export function registerProgramRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/programs/:programId/usage', async (request) => {
    const params = request.params as { programId: string };
    const parsedQuery = usageQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new ApiError(400, 'INVALID_QUERY', parsedQuery.error.issues[0]?.message ?? 'Invalid query');
    }

    const { fromSlot, toSlot } = parsedQuery.data;
    const where = {
      programId: params.programId,
      ...(fromSlot !== undefined || toSlot !== undefined
        ? {
            slot: {
              ...(fromSlot !== undefined ? { gte: fromSlot } : {}),
              ...(toSlot !== undefined ? { lte: toSlot } : {})
            }
          }
        : {})
    };

    const rows = await prisma.programSlotUsage.findMany({ where });

    const txCount = rows.reduce((acc, row) => acc + row.txCount, 0);
    const totalFeeLamports = rows.reduce((acc, row) => acc + row.totalFeeLamports, BigInt(0));
    const totalComputeUnits = rows.reduce((acc, row) => acc + row.totalComputeUnits, 0);

    return {
      programId: params.programId,
      fromSlot: fromSlot ?? null,
      toSlot: toSlot ?? null,
      txCount,
      totalFeeLamports: totalFeeLamports.toString(),
      totalComputeUnits
    };
  });
}
