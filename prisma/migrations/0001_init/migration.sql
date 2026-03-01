-- CreateTable
CREATE TABLE "Transaction" (
    "signature" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "blockTime" INTEGER NOT NULL,
    "feeLamports" BIGINT NOT NULL,
    "computeUnits" INTEGER NOT NULL,
    "error" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("signature")
);

-- CreateTable
CREATE TABLE "TransactionProgram" (
    "id" SERIAL NOT NULL,
    "signature" TEXT NOT NULL,
    "programId" TEXT NOT NULL,

    CONSTRAINT "TransactionProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionAccount" (
    "id" SERIAL NOT NULL,
    "signature" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "TransactionAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramSlotUsage" (
    "programId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "totalFeeLamports" BIGINT NOT NULL DEFAULT 0,
    "totalComputeUnits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProgramSlotUsage_pkey" PRIMARY KEY ("programId","slot")
);

-- CreateTable
CREATE TABLE "AccountActivity" (
    "address" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "blockTime" INTEGER NOT NULL,

    CONSTRAINT "AccountActivity_pkey" PRIMARY KEY ("address","signature")
);

-- CreateTable
CREATE TABLE "IngestionCheckpoint" (
    "workerId" TEXT NOT NULL,
    "lastEventId" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedSlot" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionCheckpoint_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "eventId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "Transaction_slot_idx" ON "Transaction"("slot");

-- CreateIndex
CREATE INDEX "Transaction_blockTime_idx" ON "Transaction"("blockTime");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionProgram_signature_programId_key" ON "TransactionProgram"("signature", "programId");

-- CreateIndex
CREATE INDEX "TransactionProgram_programId_idx" ON "TransactionProgram"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionAccount_signature_address_key" ON "TransactionAccount"("signature", "address");

-- CreateIndex
CREATE INDEX "TransactionAccount_address_idx" ON "TransactionAccount"("address");

-- CreateIndex
CREATE INDEX "AccountActivity_address_slot_idx" ON "AccountActivity"("address", "slot" DESC);

-- AddForeignKey
ALTER TABLE "TransactionProgram" ADD CONSTRAINT "TransactionProgram_signature_fkey" FOREIGN KEY ("signature") REFERENCES "Transaction"("signature") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAccount" ADD CONSTRAINT "TransactionAccount_signature_fkey" FOREIGN KEY ("signature") REFERENCES "Transaction"("signature") ON DELETE CASCADE ON UPDATE CASCADE;
