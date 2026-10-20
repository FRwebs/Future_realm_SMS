-- AlterEnum
ALTER TYPE "PartnerDealStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "agreementVersion" TEXT,
ADD COLUMN     "bankAccountName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "countersignedAt" TIMESTAMP(3),
ADD COLUMN     "countersignedRef" TEXT,
ADD COLUMN     "minRegistrationsPerTerm" INTEGER,
ADD COLUMN     "minRetentionPercent" INTEGER,
ADD COLUMN     "opsContactName" TEXT,
ADD COLUMN     "opsContactPhone" TEXT,
ADD COLUMN     "partnerManagerId" TEXT,
ADD COLUMN     "primaryContactName" TEXT,
ADD COLUMN     "primaryContactPhone" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "streamARatePercent" DECIMAL(5,2),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "tier" TEXT,
ADD COLUMN     "type" TEXT,
ADD COLUMN     "yearRates" JSONB;

-- AlterTable
ALTER TABLE "PartnerDeal" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "expectedStudents" INTEGER,
ADD COLUMN     "rejectedReason" TEXT;

-- CreateTable
CREATE TABLE "PartnerAccrual" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "dealId" TEXT,
    "schoolId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "transactionId" TEXT,
    "stream" TEXT NOT NULL DEFAULT 'B',
    "kind" TEXT NOT NULL DEFAULT 'ACCRUAL',
    "collected" DECIMAL(14,2) NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "relationshipYear" INTEGER,
    "commission" DECIMAL(14,2) NOT NULL,
    "reconciledAt" TIMESTAMP(3) NOT NULL,
    "statementId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerAccrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerStatement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "clawbacks" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "invoices" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "lines" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "paymentRef" TEXT,

    CONSTRAINT "PartnerStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDispute" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "raisedByPartnerId" TEXT,
    "counterpartyLabel" TEXT NOT NULL,
    "grounds" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "reattributedTo" TEXT,
    "recalculation" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerDispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerAccrual_partnerId_statementId_idx" ON "PartnerAccrual"("partnerId", "statementId");

-- CreateIndex
CREATE INDEX "PartnerAccrual_schoolId_idx" ON "PartnerAccrual"("schoolId");

-- CreateIndex
CREATE INDEX "PartnerAccrual_invoiceId_kind_idx" ON "PartnerAccrual"("invoiceId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerStatement_ref_key" ON "PartnerStatement"("ref");

-- CreateIndex
CREATE INDEX "PartnerStatement_partnerId_status_idx" ON "PartnerStatement"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerDispute_status_idx" ON "PartnerDispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_code_key" ON "Partner"("code");

-- AddForeignKey
ALTER TABLE "PartnerAccrual" ADD CONSTRAINT "PartnerAccrual_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAccrual" ADD CONSTRAINT "PartnerAccrual_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "PartnerDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerAccrual" ADD CONSTRAINT "PartnerAccrual_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "PartnerStatement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerStatement" ADD CONSTRAINT "PartnerStatement_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

