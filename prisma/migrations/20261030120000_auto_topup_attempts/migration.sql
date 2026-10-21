-- CreateTable
CREATE TABLE "AutoTopupAttempt" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "trigger" TEXT NOT NULL,
    "invoiceId" TEXT,
    "outcome" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoTopupAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutoTopupAttempt_schoolId_createdAt_idx" ON "AutoTopupAttempt"("schoolId", "createdAt");

