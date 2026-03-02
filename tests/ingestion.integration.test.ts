import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAllMockEvents } from '../src/ingestion/mock-stream.js';
import { processEventTransactional } from '../src/ingestion/processor.js';
import { createTestPrisma, requireDatabaseUrl, resetDatabase } from './helpers/db.js';

requireDatabaseUrl();

describe('ingestion integration', () => {
  const prisma = createTestPrisma();

  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('handles duplicate tx, out-of-order slots, and reorg rollback deterministically', async () => {
    for (const event of getAllMockEvents()) {
      await processEventTransactional(prisma, event, 'default');
    }

    const txCount = await prisma.transaction.count();
    expect(txCount).toBe(3);

    const prog1Rows = await prisma.programSlotUsage.findMany({ where: { programId: 'prog-1' } });
    const feeSum = prog1Rows.reduce((acc, row) => acc + Number(row.totalFeeLamports), 0);
    expect(feeSum).toBe(11_500);

    const prog2Rows = await prisma.programSlotUsage.findMany({ where: { programId: 'prog-2' } });
    expect(prog2Rows).toHaveLength(0);

    const checkpoint = await prisma.ingestionCheckpoint.findUnique({ where: { workerId: 'default' } });
    expect(checkpoint?.lastEventId).toBe(7);
    expect(checkpoint?.lastProcessedSlot).toBe(103);
  });

  it('is replay-safe for already processed events', async () => {
    const events = getAllMockEvents();

    for (const event of events) {
      await processEventTransactional(prisma, event, 'default');
    }

    const before = await prisma.transaction.count();

    for (const event of events) {
      await processEventTransactional(prisma, event, 'default');
    }

    const after = await prisma.transaction.count();
    const processedEventCount = await prisma.processedEvent.count();

    expect(after).toBe(before);
    expect(processedEventCount).toBe(events.length);
  });

  it('allows replayed tx eventId after reorg rollback', async () => {
    await processEventTransactional(
      prisma,
      {
        eventId: 1,
        type: 'tx',
        tx: {
          signature: 'sig-old',
          slot: 10,
          blockTime: 1_710_000_000,
          feeLamports: '1000',
          computeUnits: 500,
          accounts: ['acct-1'],
          programIds: ['prog-1'],
          instructions: ['ix-old']
        }
      },
      'default'
    );

    await processEventTransactional(
      prisma,
      {
        eventId: 2,
        type: 'reorg',
        rollbackToSlot: 9
      },
      'default'
    );

    await processEventTransactional(
      prisma,
      {
        eventId: 1,
        type: 'tx',
        tx: {
          signature: 'sig-new',
          slot: 10,
          blockTime: 1_710_000_100,
          feeLamports: '1200',
          computeUnits: 520,
          accounts: ['acct-2'],
          programIds: ['prog-2'],
          instructions: ['ix-new']
        }
      },
      'default'
    );

    const allTx = await prisma.transaction.findMany({ orderBy: { signature: 'asc' } });
    expect(allTx).toHaveLength(1);
    expect(allTx[0]?.signature).toBe('sig-new');

    const prog1Usage = await prisma.programSlotUsage.findMany({ where: { programId: 'prog-1' } });
    const prog2Usage = await prisma.programSlotUsage.findMany({ where: { programId: 'prog-2' } });
    expect(prog1Usage).toHaveLength(0);
    expect(prog2Usage).toHaveLength(1);
    expect(prog2Usage[0]?.txCount).toBe(1);
    expect(prog2Usage[0]?.totalFeeLamports.toString()).toBe('1200');
  });
});
