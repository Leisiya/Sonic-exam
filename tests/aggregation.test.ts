import { describe, expect, it } from 'vitest';

import { buildProgramUsageDeltas } from '../src/domain/aggregation.js';

describe('buildProgramUsageDeltas', () => {
  it('is deterministic and deduplicates program ids', () => {
    const tx = {
      signature: 'sig-x',
      slot: 10,
      blockTime: 100,
      feeLamports: '5000',
      computeUnits: 900,
      accounts: ['a1'],
      programIds: ['p1', 'p2', 'p1'],
      instructions: []
    };

    const first = buildProgramUsageDeltas(tx);
    const second = buildProgramUsageDeltas(tx);

    expect(first).toEqual(second);
    expect(first).toHaveLength(2);
    expect(first.map((delta) => delta.programId).sort()).toEqual(['p1', 'p2']);
  });
});
