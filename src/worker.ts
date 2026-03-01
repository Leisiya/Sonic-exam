import { prisma } from './storage/client.js';
import { config, ensureDatabaseUrl, warnIfWorkerIdMayConflict } from './config.js';
import { runWorker } from './ingestion/worker-service.js';

async function main(): Promise<void> {
  ensureDatabaseUrl();
  warnIfWorkerIdMayConflict();

  const abortController = new AbortController();

  const shutdown = (signal: string): void => {
    console.log(`worker received ${signal}, shutting down`);
    abortController.abort();
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  try {
    await runWorker(prisma, abortController.signal);
  } catch (error: unknown) {
    console.error('worker crashed fatally', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
    if (config.nodeEnv !== 'test') {
      console.log('worker disconnected from database');
    }
  }
}

void main();
