import type { PrismaClient } from '@prisma/client';
import pino from 'pino';

import { config } from '../config.js';
import { getMockEventsAfter } from './mock-stream.js';
import { processEventTransactional } from './processor.js';
import { IndexerRepository } from '../storage/indexer-repository.js';

const logger = pino({ level: config.logLevel });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runIngestionOnce(prisma: PrismaClient): Promise<number> {
  const checkpointRepo = new IndexerRepository(prisma);
  const checkpoint = await checkpointRepo.getCheckpoint(config.workerId);
  const events = getMockEventsAfter(checkpoint.lastEventId, 100);

  let processedCount = 0;
  for (const event of events) {
    const result = await processEventTransactional(prisma, event, config.workerId);
    if (result.processed) {
      processedCount += 1;
    }
  }

  return processedCount;
}

export async function runWorker(prisma: PrismaClient): Promise<void> {
  logger.info({ workerId: config.workerId }, 'worker started');

  while (true) {
    try {
      const processed = await runIngestionOnce(prisma);
      if (processed > 0) {
        logger.info({ processed }, 'worker processed events batch');
        continue;
      }
    } catch (error) {
      logger.error({ err: error }, 'worker iteration failed');
    }

    await sleep(2_000);
  }
}
