import { Prisma } from '@prisma/client';

import type { IngestionEvent, SvmTransaction } from '../domain/types.js';
import { buildProgramUsageDeltas, uniqueValues } from '../domain/aggregation.js';

export type EventProcessingResult = {
  processed: boolean;
};

export class IndexerRepository {
  public constructor(private readonly db: Prisma.TransactionClient | PrismaClientLike) {}

  public async processEvent(event: IngestionEvent, workerId: string): Promise<EventProcessingResult> {
    const existing = await this.db.processedEvent.findUnique({ where: { eventId: event.eventId } });
    if (existing) {
      return { processed: false };
    }

    if (event.type === 'tx') {
      await this.processTx(event.tx);
      await this.upsertCheckpoint(workerId, event.eventId, event.tx.slot);
      await this.db.processedEvent.create({
        data: { eventId: event.eventId, eventType: event.type }
      });
      return { processed: true };
    }

    await this.processReorg(event.rollbackToSlot);
    await this.upsertCheckpoint(workerId, event.eventId, event.rollbackToSlot);
    await this.db.processedEvent.create({
      data: { eventId: event.eventId, eventType: event.type }
    });
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
    try {
      await this.db.transaction.create({
        data: {
          signature: tx.signature,
          slot: tx.slot,
          blockTime: tx.blockTime,
          feeLamports: BigInt(tx.feeLamports),
          computeUnits: tx.computeUnits,
          error: tx.error ?? null
        }
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  private async processReorg(rollbackToSlot: number): Promise<void> {
    await this.db.transactionProgram.deleteMany({
      where: {
        transaction: {
          slot: {
            gt: rollbackToSlot
          }
        }
      }
    });

    await this.db.transactionAccount.deleteMany({
      where: {
        transaction: {
          slot: {
            gt: rollbackToSlot
          }
        }
      }
    });

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

  private async upsertCheckpoint(workerId: string, lastEventId: number, lastProcessedSlot: number): Promise<void> {
    const now = new Date();
    await this.db.ingestionCheckpoint.upsert({
      where: { workerId },
      create: { workerId, lastEventId, lastProcessedSlot, updatedAt: now },
      update: { lastEventId, lastProcessedSlot, updatedAt: now }
    });
  }
}

type PrismaClientLike = {
  processedEvent: {
    findUnique: (args: { where: { eventId: number } }) => Promise<{ eventId: number } | null>;
    create: (args: { data: { eventId: number; eventType: string } }) => Promise<unknown>;
  };
  transaction: {
    create: (args: {
      data: {
        signature: string;
        slot: number;
        blockTime: number;
        feeLamports: bigint;
        computeUnits: number;
        error: string | null;
      };
    }) => Promise<unknown>;
    deleteMany: (args: { where: { slot: { gt: number } } }) => Promise<unknown>;
  };
  transactionProgram: {
    createMany: (args: {
      data: Array<{ signature: string; programId: string }>;
      skipDuplicates: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { transaction: { slot: { gt: number } } } }) => Promise<unknown>;
  };
  transactionAccount: {
    createMany: (args: {
      data: Array<{ signature: string; address: string }>;
      skipDuplicates: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { transaction: { slot: { gt: number } } } }) => Promise<unknown>;
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
    upsert: (args: {
      where: { workerId: string };
      create: { workerId: string; lastEventId: number; lastProcessedSlot: number; updatedAt: Date };
      update: { lastEventId: number; lastProcessedSlot: number; updatedAt: Date };
    }) => Promise<unknown>;
    findUnique: (args: {
      where: { workerId: string };
    }) => Promise<{ lastEventId: number; lastProcessedSlot: number } | null>;
  };
};
