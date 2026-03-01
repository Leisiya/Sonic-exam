export type SvmTransaction = {
  signature: string;
  slot: number;
  blockTime: number;
  feeLamports: string;
  computeUnits: number;
  accounts: string[];
  programIds: string[];
  instructions: string[];
  error?: string;
};

export type TxEvent = {
  eventId: number;
  type: 'tx';
  tx: SvmTransaction;
};

export type ReorgEvent = {
  eventId: number;
  type: 'reorg';
  rollbackToSlot: number;
};

export type IngestionEvent = TxEvent | ReorgEvent;

export type ProgramUsageDelta = {
  programId: string;
  slot: number;
  txCount: number;
  totalFeeLamports: bigint;
  totalComputeUnits: number;
};
