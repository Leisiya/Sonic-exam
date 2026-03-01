import type { ProgramUsageDelta, SvmTransaction } from './types.js';

export function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildProgramUsageDeltas(tx: SvmTransaction): ProgramUsageDelta[] {
  const uniquePrograms = uniqueValues(tx.programIds);
  return uniquePrograms.map((programId) => ({
    programId,
    slot: tx.slot,
    txCount: 1,
    totalFeeLamports: BigInt(tx.feeLamports),
    totalComputeUnits: tx.computeUnits
  }));
}
