import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getAllMockEvents } from '../src/ingestion/mock-stream.js';
import { processEventTransactional } from '../src/ingestion/processor.js';
import { createTestPrisma, hasDatabaseUrl, resetDatabase } from './helpers/db.js';

const describeIfDb = hasDatabaseUrl() ? describe : describe.skip;

describeIfDb('ingestion integration', () => {
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
});
