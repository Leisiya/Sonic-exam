import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import { ApiError } from '../errors.js';

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export function registerAccountRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  app.get('/accounts/:address/activity', async (request) => {
    const params = request.params as { address: string };
    const parsedQuery = activityQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      throw new ApiError(400, 'INVALID_QUERY', parsedQuery.error.issues[0]?.message ?? 'Invalid query');
    }

    const { limit } = parsedQuery.data;

    const rows = await prisma.accountActivity.findMany({
      where: { address: params.address },
      orderBy: [{ slot: 'desc' }, { blockTime: 'desc' }],
      take: limit
    });

    return {
      address: params.address,
      limit,
      activity: rows
    };
  });
}
