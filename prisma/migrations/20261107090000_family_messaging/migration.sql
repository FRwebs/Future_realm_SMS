-- AlterTable
ALTER TABLE "GuardianSubmission" ADD COLUMN     "dates" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "deliveryId" TEXT,
ADD COLUMN     "evidence" TEXT,
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "MessageDelivery" ADD COLUMN     "acknowledgeAsked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acknowledgedAt" TIMESTAMP(3),
ADD COLUMN     "body" TEXT,
ADD COLUMN     "channel" "NotificationChannel",
ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "logId" TEXT,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GuardianSubmission_deliveryId_idx" ON "GuardianSubmission"("deliveryId");

-- CreateIndex
CREATE INDEX "MessageDelivery_guardianId_createdAt_idx" ON "MessageDelivery"("guardianId", "createdAt");

