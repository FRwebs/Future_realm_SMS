-- AlterTable
ALTER TABLE "AutoTopupAttempt" ADD COLUMN     "charged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "failure" TEXT,
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "SavedCard" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "authorization" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT,
    "bank" TEXT,
    "expMonth" TEXT,
    "expYear" TEXT,
    "email" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedCard_schoolId_removedAt_idx" ON "SavedCard"("schoolId", "removedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedCard_schoolId_signature_key" ON "SavedCard"("schoolId", "signature");

