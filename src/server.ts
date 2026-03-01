import { prisma } from './storage/client.js';
import { config } from './config.js';
import { buildApp } from './api/app.js';

const app = buildApp(prisma);

async function start(): Promise<void> {
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down server');
  await app.close();
  await prisma.$disconnect();
}

process.once('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => process.exit(0));
});

process.once('SIGINT', () => {
  void shutdown('SIGINT').finally(() => process.exit(0));
});

void start().catch((error: unknown) => {
  app.log.error({ err: error }, 'server failed to start');
  process.exit(1);
});
