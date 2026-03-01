import { prisma } from './storage/client.js';
import { runWorker } from './ingestion/worker-service.js';

void runWorker(prisma).catch((error: unknown) => {
  console.error('worker crashed fatally', error);
  process.exit(1);
});
