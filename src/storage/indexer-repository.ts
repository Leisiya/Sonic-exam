import { Prisma } from '@prisma/client';

import type { IngestionEvent, SvmTransaction } from '../domain/types.js';
import { buildProgramUsageDeltas, uniqueValues } from '../domain/aggregation.js';

export type EventProcessingResult = {
  processed: boolean;
};

export class IndexerRepository {
  public constructor(private readonly db: Prisma.TransactionClient | PrismaClientLike) {}

  public async processEvent(event: IngestionEvent, workerId: string): Promise<EventProcessingResult> {
    const claim = await this.db.processedEvent.createMany({
      data: [{ eventId: event.eventId, eventType: event.type }],
      skipDuplicates: true
    });
    if (claim.count === 0) {
      await this.upsertCheckpoint(workerId, event.eventId);
      return { processed: false };
    }

    if (event.type === 'tx') {
      await this.processTx(event.tx);
      await this.upsertCheckpoint(workerId, event.eventId);
      return { processed: true };
    }

    await this.processReorg(event.rollbackToSlot);
    await this.upsertCheckpoint(workerId, event.eventId);
    return { processed: true };
  }

  public async getCheckpoint(workerId: string): Promise<{ lastEventId: number; lastProcessedSlot: number }> {
    const checkpoint = await this.db.ingestionCheckpoint.findUnique({ where: { workerId } });
    if (!checkpoint) {
      return { lastEventId: 0, lastProcessedSlot: 0 };
    }
    return { lastEventId: checkpoint.lastEventId, lastProcessedSlot: checkpoint.lastProcessedSlot };
  }

  private async processTx(tx: SvmTransaction): Promise<void> {
    const inserted = await this.createTransactionIfMissing(tx);
    if (!inserted) {
      return;
    }

    const uniquePrograms = uniqueValues(tx.programIds);
    const uniqueAccounts = uniqueValues(tx.accounts);

    if (uniquePrograms.length > 0) {
      await this.db.transactionProgram.createMany({
        data: uniquePrograms.map((programId) => ({ signature: tx.signature, programId })),
        skipDuplicates: true
      });
    }

    if (uniqueAccounts.length > 0) {
      await this.db.transactionAccount.createMany({
        data: uniqueAccounts.map((address) => ({ signature: tx.signature, address })),
        skipDuplicates: true
      });

      await this.db.accountActivity.createMany({
        data: uniqueAccounts.map((address) => ({
          address,
          signature: tx.signature,
          slot: tx.slot,
          blockTime: tx.blockTime
        })),
        skipDuplicates: true
      });
    }

    for (const delta of buildProgramUsageDeltas(tx)) {
      await this.db.programSlotUsage.upsert({
        where: {
          programId_slot: {
            programId: delta.programId,
            slot: delta.slot
          }
        },
        create: {
          programId: delta.programId,
          slot: delta.slot,
          txCount: delta.txCount,
          totalFeeLamports: delta.totalFeeLamports,
          totalComputeUnits: delta.totalComputeUnits
        },
        update: {
          txCount: { increment: delta.txCount },
          totalFeeLamports: { increment: delta.totalFeeLamports },
          totalComputeUnits: { increment: delta.totalComputeUnits }
        }
      });
    }
  }

  private async createTransactionIfMissing(tx: SvmTransaction): Promise<boolean> {
    const result = await this.db.transaction.createMany({
      data: [
        {
          signature: tx.signature,
          slot: tx.slot,
          blockTime: tx.blockTime,
          feeLamports: BigInt(tx.feeLamports),
          computeUnits: tx.computeUnits,
          instructions: tx.instructions,
          error: tx.error ?? null
        }
      ],
      skipDuplicates: true
    });

    return result.count > 0;
  }

  private async processReorg(rollbackToSlot: number): Promise<void> {
    await this.db.accountActivity.deleteMany({
      where: {
        slot: {
          gt: rollbackToSlot
        }
      }
    });

    await this.db.programSlotUsage.deleteMany({
      where: {
        slot: {
          gt: rollbackToSlot
        }
      }
    });

    await this.db.transaction.deleteMany({
      where: {
        slot: {
          gt: rollbackToSlot
        }
      }
    });
  }

  private async upsertCheckpoint(workerId: string, lastEventId: number): Promise<void> {
    const slotAgg = await this.db.transaction.aggregate({
      _max: { slot: true }
    });
    const canonicalHeadSlot = slotAgg._max?.slot ?? 0;

    await this.db.$executeRawUnsafe(
      `
      INSERT INTO "IngestionCheckpoint" ("workerId", "lastEventId", "lastProcessedSlot", "updatedAt")
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT ("workerId")
      DO UPDATE SET
        "lastEventId" = GREATEST("IngestionCheckpoint"."lastEventId", EXCLUDED."lastEventId"),
        "lastProcessedSlot" = CASE
          WHEN EXCLUDED."lastEventId" >= "IngestionCheckpoint"."lastEventId"
            THEN EXCLUDED."lastProcessedSlot"
          ELSE "IngestionCheckpoint"."lastProcessedSlot"
        END,
        "updatedAt" = CURRENT_TIMESTAMP
      `,
      workerId,
      lastEventId,
      canonicalHeadSlot
    );
  }
}

type PrismaClientLike = {
  processedEvent: {
    createMany: (args: {
      data: Array<{ eventId: number; eventType: string }>;
      skipDuplicates: boolean;
    }) => Promise<{ count: number }>;
  };
  transaction: {
    createMany: (args: {
      data: Array<{
        signature: string;
        slot: number;
        blockTime: number;
        feeLamports: bigint;
        computeUnits: number;
        instructions: string[];
        error: string | null;
      }>;
      skipDuplicates: boolean;
    }) => Promise<{ count: number }>;
    aggregate: (args: { _max: { slot: true } }) => Promise<{ _max: { slot: number | null } }>;
    deleteMany: (args: { where: { slot: { gt: number } } }) => Promise<unknown>;
  };
  transactionProgram: {
    createMany: (args: {
      data: Array<{ signature: string; programId: string }>;
      skipDuplicates: boolean;
    }) => Promise<unknown>;
  };
  transactionAccount: {
    createMany: (args: {
      data: Array<{ signature: string; address: string }>;
      skipDuplicates: boolean;
    }) => Promise<unknown>;
  };
  programSlotUsage: {
    upsert: (args: {
      where: { programId_slot: { programId: string; slot: number } };
      create: {
        programId: string;
        slot: number;
        txCount: number;
        totalFeeLamports: bigint;
        totalComputeUnits: number;
      };
      update: {
        txCount: { increment: number };
        totalFeeLamports: { increment: bigint };
        totalComputeUnits: { increment: number };
      };
    }) => Promise<unknown>;
    deleteMany: (args: { where: { slot: { gt: number } } }) => Promise<unknown>;
  };
  accountActivity: {
    createMany: (args: {
      data: Array<{ address: string; signature: string; slot: number; blockTime: number }>;
      skipDuplicates: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { slot: { gt: number } } }) => Promise<unknown>;
  };
  ingestionCheckpoint: {
    findUnique: (args: { where: { workerId: string } }) => Promise<{ lastEventId: number; lastProcessedSlot: number } | null>;
  };
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
};
