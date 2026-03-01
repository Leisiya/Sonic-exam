import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/api/app.js';
import { getAllMockEvents } from '../src/ingestion/mock-stream.js';
import { processEventTransactional } from '../src/ingestion/processor.js';
import { createTestPrisma, requireDatabaseUrl, resetDatabase } from './helpers/db.js';

requireDatabaseUrl();

describe('api integration', () => {
  const prisma = createTestPrisma();
  const app = buildApp(prisma);

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    for (const event of getAllMockEvents()) {
      await processEventTransactional(prisma, event, 'default');
    }
  });

  it('serves health and stats', async () => {
    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    const stats = await app.inject({ method: 'GET', url: '/stats' });
    expect(stats.statusCode).toBe(200);

    const body = stats.json() as { indexedTx: number; lastProcessedEventId: number };
    expect(body.indexedTx).toBe(3);
    expect(body.lastProcessedEventId).toBe(7);
  });

  it('returns tx by signature and 404 for missing tx', async () => {
    const ok = await app.inject({ method: 'GET', url: '/tx/sig-100' });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { feeLamports: string; instructions: string[] }).feeLamports).toBe('5000');
    expect((ok.json() as { feeLamports: string; instructions: string[] }).instructions).toEqual(['ix-1']);

    const missing = await app.inject({ method: 'GET', url: '/tx/not-exists' });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { code: string }).code).toBe('TX_NOT_FOUND');
  });

  it('returns program usage with range validation', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/programs/prog-1/usage?fromSlot=100&toSlot=101'
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { txCount: number }).txCount).toBe(2);
    expect((ok.json() as { totalFeeLamports: string }).totalFeeLamports).toBe('11500');

    const bad = await app.inject({
      method: 'GET',
      url: '/programs/prog-1/usage?fromSlot=110&toSlot=100'
    });
    expect(bad.statusCode).toBe(400);
  });

  it('returns account activity with limit validation', async () => {
    const ok = await app.inject({
      method: 'GET',
      url: '/accounts/acct-e/activity?limit=10'
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { activity: unknown[] }).activity).toHaveLength(1);

    const bad = await app.inject({
      method: 'GET',
      url: '/accounts/acct-e/activity?limit=101'
    });
    expect(bad.statusCode).toBe(400);
  });
});
