-- CreateEnum
CREATE TYPE "MessageCampaignStatus" AS ENUM ('DRAFT', 'AWAITING_APPROVAL', 'SCHEDULED', 'SENT', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "TemplateOwner" AS ENUM ('SCHOOL', 'SYSTEM', 'PLATFORM');

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "isMandatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedReason" TEXT,
ADD COLUMN     "timing" TEXT;

-- CreateTable
CREATE TABLE "MessageCampaign" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "audience" JSONB,
    "audienceLabel" TEXT NOT NULL DEFAULT 'Guardians',
    "body" TEXT NOT NULL,
    "status" "MessageCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "thresholdAt" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "decisionNote" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "guardianId" TEXT,
    "recipientName" TEXT NOT NULL,
    "destination" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolMessageTemplate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'SMS',
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "owner" "TemplateOwner" NOT NULL DEFAULT 'SCHOOL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolMessageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageCampaign_schoolId_status_createdAt_idx" ON "MessageCampaign"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageCampaign_schoolId_sentAt_idx" ON "MessageCampaign"("schoolId", "sentAt");

-- CreateIndex
CREATE INDEX "MessageDelivery_schoolId_status_idx" ON "MessageDelivery"("schoolId", "status");

-- CreateIndex
CREATE INDEX "MessageDelivery_campaignId_status_idx" ON "MessageDelivery"("campaignId", "status");

-- CreateIndex
CREATE INDEX "SchoolMessageTemplate_schoolId_owner_idx" ON "SchoolMessageTemplate"("schoolId", "owner");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolMessageTemplate_schoolId_name_key" ON "SchoolMessageTemplate"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolMessageTemplate" ADD CONSTRAINT "SchoolMessageTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

