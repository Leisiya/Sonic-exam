import type { IngestionEvent } from '../domain/types.js';

const MOCK_EVENTS: IngestionEvent[] = [
  {
    eventId: 1,
    type: 'tx',
    tx: {
      signature: 'sig-100',
      slot: 100,
      blockTime: 1_710_000_000,
      feeLamports: '5000',
      computeUnits: 1000,
      accounts: ['acct-a', 'acct-b'],
      programIds: ['prog-1'],
      instructions: ['ix-1']
    }
  },
  {
    eventId: 2,
    type: 'tx',
    tx: {
      signature: 'sig-102',
      slot: 102,
      blockTime: 1_710_000_010,
      feeLamports: '7000',
      computeUnits: 1200,
      accounts: ['acct-a', 'acct-c'],
      programIds: ['prog-2', 'prog-1'],
      instructions: ['ix-2']
    }
  },
  {
    eventId: 3,
    type: 'tx',
    tx: {
      signature: 'sig-102',
      slot: 102,
      blockTime: 1_710_000_010,
      feeLamports: '7000',
      computeUnits: 1200,
      accounts: ['acct-a', 'acct-c'],
      programIds: ['prog-2', 'prog-1'],
      instructions: ['ix-2']
    }
  },
  {
    eventId: 4,
    type: 'tx',
    tx: {
      signature: 'sig-101',
      slot: 101,
      blockTime: 1_710_000_005,
      feeLamports: '6000',
      computeUnits: 1100,
      accounts: ['acct-d'],
      programIds: ['prog-1'],
      instructions: ['ix-3']
    }
  },
  {
    eventId: 5,
    type: 'reorg',
    rollbackToSlot: 100
  },
  {
    eventId: 6,
    type: 'tx',
    tx: {
      signature: 'sig-101b',
      slot: 101,
      blockTime: 1_710_000_020,
      feeLamports: '6500',
      computeUnits: 1150,
      accounts: ['acct-e'],
      programIds: ['prog-1'],
      instructions: ['ix-4']
    }
  },
  {
    eventId: 7,
    type: 'tx',
    tx: {
      signature: 'sig-103',
      slot: 103,
      blockTime: 1_710_000_030,
      feeLamports: '8000',
      computeUnits: 1300,
      accounts: ['acct-f'],
      programIds: ['prog-3'],
      instructions: ['ix-5'],
      error: 'ProgramError(42)'
    }
  }
];

export function getMockEventsAfter(lastEventId: number, batchSize = 50): IngestionEvent[] {
  return MOCK_EVENTS.filter((event) => event.eventId > lastEventId).slice(0, batchSize);
}

export function getAllMockEvents(): IngestionEvent[] {
  return [...MOCK_EVENTS];
}
