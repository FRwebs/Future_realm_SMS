-- CreateTable
CREATE TABLE "ComputationRun" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "students" INTEGER NOT NULL,
    "records" INTEGER NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "recompute" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComputationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputationRun_schoolId_createdAt_idx" ON "ComputationRun"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "ComputationRun_createdAt_idx" ON "ComputationRun"("createdAt");

