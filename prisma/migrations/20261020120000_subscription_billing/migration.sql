-- AlterTable
ALTER TABLE "School" ADD COLUMN     "dpaAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "dpaAcceptedById" TEXT,
ADD COLUMN     "dpaVersion" TEXT;

-- CreateTable
CREATE TABLE "SchoolSubscription" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'STANDARD',
    "ratePerStudent" DECIMAL(12,2),
    "baseSms" INTEGER,
    "baseWhatsapp" INTEGER,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "remindDays" INTEGER NOT NULL DEFAULT 14,
    "invoiceTo" TEXT,
    "receiptEmail" TEXT,
    "pendingTier" TEXT,
    "pendingFrom" TIMESTAMP(3),
    "switchReason" TEXT,
    "keepCredits" BOOLEAN NOT NULL DEFAULT true,
    "autoTopup" JSONB,
    "warnAt" INTEGER NOT NULL DEFAULT 2000,
    "warnWho" TEXT NOT NULL DEFAULT 'The Bursar',
    "billingContact" TEXT,
    "billingEmail" TEXT,
    "schoolContact" TEXT,
    "productOnly" BOOLEAN NOT NULL DEFAULT true,
    "dpoName" TEXT,
    "dpoEmail" TEXT,
    "hosting" TEXT,
    "retentionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "method" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FullExport" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "datasets" JSONB NOT NULL,
    "rows" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FullExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountClosureRequest" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "exportId" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountClosureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSubscription_schoolId_key" ON "SchoolSubscription"("schoolId");

-- CreateIndex
CREATE INDEX "CreditLedger_schoolId_channel_createdAt_idx" ON "CreditLedger"("schoolId", "channel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FullExport_token_key" ON "FullExport"("token");

-- CreateIndex
CREATE INDEX "FullExport_schoolId_createdAt_idx" ON "FullExport"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountClosureRequest_schoolId_status_idx" ON "AccountClosureRequest"("schoolId", "status");

-- AddForeignKey
ALTER TABLE "SchoolSubscription" ADD CONSTRAINT "SchoolSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FullExport" ADD CONSTRAINT "FullExport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountClosureRequest" ADD CONSTRAINT "AccountClosureRequest_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

