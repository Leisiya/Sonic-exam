import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../src/api/app.js';

function buildAppWithMockedHealthProbe(probe: () => Promise<unknown>) {
  const prisma = {
    $queryRaw: vi.fn(() => probe())
  } as unknown as PrismaClient;

  return buildApp(prisma);
}

describe('health route', () => {
  it('returns ok when database probe succeeds', async () => {
    const app = buildAppWithMockedHealthProbe(() => Promise.resolve(1));
    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ status: 'ok', db: 'up' });
    } finally {
      await app.close();
    }
  });

  it('returns degraded when database probe fails', async () => {
    const app = buildAppWithMockedHealthProbe(() => Promise.reject(new Error('db down')));

    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({ status: 'degraded', db: 'down' });
    } finally {
      await app.close();
    }
  });
});
