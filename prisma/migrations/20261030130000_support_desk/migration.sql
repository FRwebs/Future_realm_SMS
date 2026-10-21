-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlatformTicketCategory" ADD VALUE 'FEE_MANAGEMENT';
ALTER TYPE "PlatformTicketCategory" ADD VALUE 'DATA_MIGRATION';
ALTER TYPE "PlatformTicketCategory" ADD VALUE 'ONBOARDING_SETUP';

-- AlterTable
ALTER TABLE "CannedResponse" ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CountryProfile" ADD COLUMN     "publicHolidays" INTEGER,
ADD COLUMN     "supportHours" TEXT;

-- AlterTable
ALTER TABLE "DataCorrectionRecord" ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedById" TEXT;

