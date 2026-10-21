-- CreateTable
CREATE TABLE "TrialMessage" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "logId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialMessage_step_status_idx" ON "TrialMessage"("step", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TrialMessage_schoolId_step_key" ON "TrialMessage"("schoolId", "step");

