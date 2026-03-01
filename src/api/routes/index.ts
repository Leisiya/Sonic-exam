import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';

import { registerHealthRoutes } from './health.js';
import { registerStatsRoutes } from './stats.js';
import { registerTxRoutes } from './tx.js';
import { registerProgramRoutes } from './programs.js';
import { registerAccountRoutes } from './accounts.js';

export function registerRoutes(app: FastifyInstance, prisma: PrismaClient): void {
  registerHealthRoutes(app, prisma);
  registerStatsRoutes(app, prisma);
  registerTxRoutes(app, prisma);
  registerProgramRoutes(app, prisma);
  registerAccountRoutes(app, prisma);
}
