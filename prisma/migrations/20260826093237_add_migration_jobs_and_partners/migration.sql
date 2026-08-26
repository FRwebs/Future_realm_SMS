-- CreateEnum
CREATE TYPE "PartnerDealStatus" AS ENUM ('REGISTERED', 'CONVERTED', 'EXPIRED', 'COMMISSION_PAID');

-- CreateEnum
CREATE TYPE "MigrationJobStatus" AS ENUM ('INVITED', 'FILES_AWAITED', 'IN_PROGRESS', 'PREVIEW_READY', 'SIGNED_OFF', 'COMPLETED', 'ROLLED_BACK');

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "territory" TEXT,
    "agreementReference" TEXT,
    "agreementValidTo" TIMESTAMP(3),
    "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDeal" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "schoolId" TEXT,
    "prospectSchoolName" TEXT NOT NULL,
    "prospectLocation" TEXT,
    "expectedTier" TEXT,
    "stream" TEXT,
    "introductionEvidence" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "PartnerDealStatus" NOT NULL DEFAULT 'REGISTERED',
    "commissionRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "convertedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationJob" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "specialistId" TEXT,
    "status" "MigrationJobStatus" NOT NULL DEFAULT 'INVITED',
    "studentsExpected" INTEGER,
    "resultsExpected" INTEGER,
    "includeStudentsGuardians" BOOLEAN NOT NULL DEFAULT true,
    "includeStaffAccounts" BOOLEAN NOT NULL DEFAULT true,
    "includeHistoricalResults" BOOLEAN NOT NULL DEFAULT true,
    "includeFeesBalances" BOOLEAN NOT NULL DEFAULT true,
    "includeAttendanceHistory" BOOLEAN NOT NULL DEFAULT false,
    "includeBehaviouralRecords" BOOLEAN NOT NULL DEFAULT false,
    "filesReceivedAt" TIMESTAMP(3),
    "retentionClockStartsAt" TIMESTAMP(3),
    "previewSharedAt" TIMESTAMP(3),
    "signedOffAt" TIMESTAMP(3),
    "signedOffById" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "rollbackReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationSourceAdapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MigrationSourceAdapter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partner_isActive_idx" ON "Partner"("isActive");

-- CreateIndex
CREATE INDEX "PartnerDeal_partnerId_status_idx" ON "PartnerDeal"("partnerId", "status");

-- CreateIndex
CREATE INDEX "PartnerDeal_schoolId_idx" ON "PartnerDeal"("schoolId");

-- CreateIndex
CREATE INDEX "MigrationJob_schoolId_status_idx" ON "MigrationJob"("schoolId", "status");

-- CreateIndex
CREATE INDEX "MigrationJob_status_idx" ON "MigrationJob"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MigrationSourceAdapter_name_key" ON "MigrationSourceAdapter"("name");

-- AddForeignKey
ALTER TABLE "PartnerDeal" ADD CONSTRAINT "PartnerDeal_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDeal" ADD CONSTRAINT "PartnerDeal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDeal" ADD CONSTRAINT "PartnerDeal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_signedOffById_fkey" FOREIGN KEY ("signedOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationJob" ADD CONSTRAINT "MigrationJob_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

