import type { PrismaClient } from '@prisma/client';

import type { IngestionEvent } from '../domain/types.js';
import { IndexerRepository } from '../storage/indexer-repository.js';

export async function processEventTransactional(
  prisma: PrismaClient,
  event: IngestionEvent,
  workerId: string
): Promise<{ processed: boolean }> {
  return prisma.$transaction(async (tx) => {
    const repo = new IndexerRepository(tx);
    return repo.processEvent(event, workerId);
  });
}
