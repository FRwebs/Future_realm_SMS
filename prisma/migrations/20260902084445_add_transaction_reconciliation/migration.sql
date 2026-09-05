-- AlterTable
ALTER TABLE "PlatformBillingTransaction" ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledById" TEXT,
ADD COLUMN     "recordedById" TEXT;

-- CreateIndex
CREATE INDEX "PlatformBillingTransaction_reconciledAt_idx" ON "PlatformBillingTransaction"("reconciledAt");

-- AddForeignKey
ALTER TABLE "PlatformBillingTransaction" ADD CONSTRAINT "PlatformBillingTransaction_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformBillingTransaction" ADD CONSTRAINT "PlatformBillingTransaction_reconciledById_fkey" FOREIGN KEY ("reconciledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
