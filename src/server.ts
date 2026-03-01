import { prisma } from './storage/client.js';
import { config } from './config.js';
import { buildApp } from './api/app.js';

const app = buildApp(prisma);

async function start(): Promise<void> {
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

void start();
